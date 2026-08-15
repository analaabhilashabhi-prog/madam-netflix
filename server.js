/* Zero-dependency static server with MongoDB integration and API endpoints. */

require('dotenv').config();
try {
  require('dns').setServers(['8.8.8.8', '1.1.1.1']);
} catch (_) {}

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const { MongoClient } = require('mongodb');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 5173;
const HOST = process.env.HOST || '0.0.0.0';
/* The PIN is a server-side secret. It used to live in src/config.js, which is
   shipped to the browser, so the lock could be read straight off the page. */
/* No default on purpose. A fallback value written here would be a PIN published
   in the source; if this is unset the Secret profile simply never unlocks. */
const SECRET_PIN = String(process.env.SECRET_PIN || '');
const LOCKED_PROFILES = new Set(['secret']);
/* Every video here is an unlisted YouTube link — the link *is* the secret. So
   once this is reachable from anywhere but this machine, the library must not
   be readable without a shared passphrase. Empty = off (loopback only). */
const SITE_PASSPHRASE = String(process.env.SITE_PASSPHRASE || '');
const gateEnabled = () => SITE_PASSPHRASE.length > 0;

let db = null;
let client = null;

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, storedHash, storedSalt) {
  if (!password || !storedHash || !storedSalt) return false;
  try {
    const { hash } = hashPassword(password, storedSalt);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch (_) {
    return false;
  }
}

async function initDb() {
  if (!process.env.MONGODB_URI) return null;
  try {
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    db = client.db();
    console.log('[madam] Connected to MongoDB database successfully');

    const adminCol = db.collection('admin');

    // Auto-migrate any existing unhashed plain-text passwords in MongoDB
    const unhashedAdmins = await adminCol.find({ password: { $exists: true } }).toArray();
    for (const admin of unhashedAdmins) {
      const { hash, salt } = hashPassword(admin.password);
      await adminCol.updateOne(
        { _id: admin._id },
        {
          $set: { passwordHash: hash, salt },
          $unset: { password: '' }
        }
      );
      console.log(`[madam] Migrated admin '${admin.email}' to hashed password in database.`);
    }

    // Seed default admin account into MongoDB if database is empty
    const count = await adminCol.countDocuments();
    if (count === 0) {
      const defaultEmail = (process.env.ADMIN_EMAIL || 'madamji@abhilas').trim();
      const defaultPass = process.env.ADMIN_PASSWORD || 'madamji@143';
      const { hash, salt } = hashPassword(defaultPass);
      await adminCol.insertOne({ email: defaultEmail, passwordHash: hash, salt });
      console.log(`[madam] Initialized database admin account for '${defaultEmail}' with hashed password.`);
    }
  } catch (err) {
    console.warn('[madam] MongoDB connection warning:', err.message);
  }
}
initDb();

// In-memory rate limiting for sensitive endpoints (e.g. login)
const loginAttempts = new Map();

function checkRateLimit(key, { max = 10, windowMs = 15 * 60 * 1000 } = {}) {
  const now = Date.now();

  // opportunistic prune so the map cannot grow without bound
  if (loginAttempts.size > 5000) {
    for (const [k, v] of loginAttempts) if (now > v.resetAt) loginAttempts.delete(k);
  }

  const record = loginAttempts.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }

  if (record.count >= max) {
    return false;
  }
  record.count++;
  loginAttempts.set(key, record);
  return true;
}

const JWT_SECRET = process.env.JWT_SECRET || crypto.createHash('sha256').update(process.env.MONGODB_URI || 'madam-netflix-secret-key-2026').digest('hex');

/* Tokens carry a scope. Without it the PIN token and the admin token are signed
   by the same key and are therefore interchangeable — unlocking the Secret
   profile would hand out write access to the whole library. */
function generateToken(email, scope = 'admin', ttlMs = 14 * 24 * 60 * 60 * 1000) {
  const payload = JSON.stringify({ email, scope, exp: Date.now() + ttlMs });
  const b64 = Buffer.from(payload).toString('base64url');
  const hmac = crypto.createHmac('sha256', JWT_SECRET).update(b64).digest('hex');
  return `${b64}.${hmac}`;
}

function verifyToken(token, expectedScope = 'admin') {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  try {
    const [b64, hmac] = token.split('.');
    if (!b64 || !hmac) return false;
    const expectedHmac = crypto.createHmac('sha256', JWT_SECRET).update(b64).digest('hex');
    const hmacBuf = Buffer.from(hmac, 'hex');
    const expBuf = Buffer.from(expectedHmac, 'hex');
    if (hmacBuf.length !== expBuf.length || !crypto.timingSafeEqual(hmacBuf, expBuf)) {
      return false;
    }
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return false;
    if (payload.scope !== expectedScope) return false;
    return true;
  } catch (_) {
    return false;
  }
}

function bearer(req) {
  const authHeader = req.headers['authorization'] || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
}

function isAuthorized(req) {
  return verifyToken(bearer(req), 'admin');
}

/* The Secret profile needs either the PIN token or a signed-in admin. */
function mayReadLocked(req) {
  const token = bearer(req) || String(req.headers['x-madam-pin'] || '');
  return verifyToken(token, 'secret') || verifyToken(token, 'admin');
}

/* The front door. Off when no passphrase is configured (local use). */
function hasSiteAccess(req) {
  if (!gateEnabled()) return true;
  const token = bearer(req) || String(req.headers['x-madam-site'] || '');
  return verifyToken(token, 'site') || verifyToken(token, 'admin');
}

/* Constant-time compare that also hides the length of the real secret. */
function secretEquals(given, expected) {
  const a = crypto.createHash('sha256').update(String(given ?? '')).digest();
  const b = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

/* Strip MongoDB operator keys ($gt, $where, $ne) and dotted paths before a body
   can reach a query or a $set. Without this, a crafted body can rewrite fields
   it was never meant to touch. */
function scrubKeys(value, depth = 0) {
  if (depth > 12 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => scrubKeys(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (k.startsWith('$') || k.includes('.')) continue;
    out[k] = scrubKeys(v, depth + 1);
  }
  return out;
}

/* Explicit allowlist of writable fields — a body cannot invent new ones. */
const CONTENT_FIELDS = [
  'id', 'profileId', 'kind', 'orientation', 'section', 'title', 'description',
  'link', 'ytId', 'src', 'badge', 'liked', 'inList', 'order', 'addedAt',
];
const KNOWN_PROFILES = new Set(['her', 'us', 'secret', 'dreams']);

function pickContentFields(obj) {
  const out = {};
  for (const key of CONTENT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) out[key] = obj[key];
  }
  if (out.profileId !== undefined && !KNOWN_PROFILES.has(String(out.profileId))) return null;
  return out;
}

/* Gallery links are rendered straight into <img src>. Only https is accepted:
   it rules out javascript:/data: entirely, and the page's own CSP allows
   images from https only, so an http link would silently never render. */
function isSafeImageUrl(value) {
  if (!value || value.length > 2048) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) { // 1MB payload limit
        req.destroy();
        resolve({});
      }
    });
    req.on('end', () => {
      try {
        resolve(scrubKeys(JSON.parse(body || '{}')));
      } catch (_) {
        resolve({});
      }
    });
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  }).end(JSON.stringify(data));
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/* Only these are ever served. The previous version joined the request path onto
   the project root and returned whatever happened to be there, which made
   /.env (live database password) and the entire /.git directory downloadable
   by anyone who could reach the port. */
const PUBLIC_FILES = new Set(['index.html', 'favicon.ico']);
const PUBLIC_DIRS = new Set(['src', 'assets']);

function resolveStatic(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch (_) {
    return null; // malformed percent-encoding
  }
  if (decoded.includes('\0')) return null;

  const rel = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const segments = rel.split(/[\\/]+/);
  // no empty segments, no traversal, no dotfiles (.env, .git, .DS_Store)
  if (segments.some((s) => !s || s === '.' || s === '..' || s.startsWith('.'))) return null;
  // top level: an allowlisted file; deeper: inside an allowlisted directory
  if (segments.length === 1 ? !PUBLIC_FILES.has(segments[0]) : !PUBLIC_DIRS.has(segments[0])) return null;
  // and only file types this app actually ships
  if (!TYPES[path.extname(segments[segments.length - 1]).toLowerCase()]) return null;

  const full = path.join(ROOT, ...segments);
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  return full.startsWith(rootWithSep) ? full : null;
}

/* Rules 16 & 19. Scoped to exactly what the app loads: the YouTube IFrame API,
   Google Fonts, and remote poster/photo images. */
const CSP = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'",
  "script-src 'self' https://www.youtube.com https://s.ytimg.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "media-src 'self' https:",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
  "connect-src 'self'",
].join('; ');

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const urlPath = parsedUrl.pathname;
  const method = req.method.toUpperCase();
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  // API Endpoints
  if (urlPath.startsWith('/api/')) {
    if (urlPath === '/api/health' && method === 'GET') {
      return sendJson(res, db ? 200 : 503, { status: db ? 'ok' : 'degraded', db: !!db });
    }

    /* Tells the browser whether the front door is locked, and if this tab
       already holds the key. Deliberately reveals nothing else. */
    if (urlPath === '/api/session' && method === 'GET') {
      return sendJson(res, 200, { gate: gateEnabled(), unlocked: hasSiteAccess(req) });
    }

    if (urlPath === '/api/auth/enter' && method === 'POST') {
      if (!gateEnabled()) return sendJson(res, 200, { success: true, token: '' });
      if (!checkRateLimit(`enter:${clientIp}`, { max: 12 })) {
        return sendJson(res, 429, { success: false, error: 'Too many attempts. Try again in 15 minutes.' });
      }
      const { passphrase } = await parseBody(req);
      if (!secretEquals(passphrase, SITE_PASSPHRASE)) {
        return sendJson(res, 401, { success: false, error: 'That is not it.' });
      }
      return sendJson(res, 200, {
        success: true,
        token: generateToken('site', 'site', 30 * 24 * 60 * 60 * 1000), // 30d
      });
    }

    /* The PIN is checked here, not in the browser. */
    if (urlPath === '/api/auth/pin' && method === 'POST') {
      if (!checkRateLimit(`pin:${clientIp}`, { max: 8 })) {
        return sendJson(res, 429, { success: false, error: 'Too many attempts. Try again in 15 minutes.' });
      }
      const { pin } = await parseBody(req);
      if (!SECRET_PIN) {
        console.warn('[madam] SECRET_PIN is not set — the Secret profile cannot be unlocked.');
        return sendJson(res, 401, { success: false, error: 'Incorrect PIN' });
      }
      if (!secretEquals(pin, SECRET_PIN)) return sendJson(res, 401, { success: false, error: 'Incorrect PIN' });
      return sendJson(res, 200, {
        success: true,
        token: generateToken('secret', 'secret', 12 * 60 * 60 * 1000), // 12h
      });
    }

    if (urlPath === '/api/auth/login' && method === 'POST') {
      if (!checkRateLimit(`login:${clientIp}`)) {
        return sendJson(res, 429, { success: false, error: 'Too many login attempts. Please try again in 15 minutes.' });
      }

      const { email, password } = await parseBody(req);
      const cleanEmail = (email || '').trim();
      if (!db) {
        // Rule 18/30 — say nothing about the infrastructure behind this.
        console.warn('[madam] login attempted while the database was unavailable');
        return sendJson(res, 503, { success: false, error: 'Service temporarily unavailable' });
      }
      const admin = await db.collection('admin').findOne({ email: cleanEmail });
      if (admin && admin.passwordHash && admin.salt) {
        const isValid = verifyPassword(password, admin.passwordHash, admin.salt);
        if (isValid) {
          const sessionToken = generateToken(cleanEmail);
          return sendJson(res, 200, { success: true, token: sessionToken });
        }
      }
      return sendJson(res, 401, { success: false, error: 'Invalid email or password' });
    }

    if (urlPath === '/api/content' && method === 'GET') {
      if (!hasSiteAccess(req)) return sendJson(res, 401, { error: 'Locked' });
      const profileId = parsedUrl.searchParams.get('profileId');

      /* Locked profiles are filtered out server-side. Previously the whole
         library came back on an unauthenticated request and the PIN screen was
         the only thing standing in front of it — which a `curl` walks past.
         This is decided before the database is consulted, so the answer cannot
         depend on whether the database happens to be up. */
      const unlocked = mayReadLocked(req);
      let query;
      if (profileId) {
        if (LOCKED_PROFILES.has(String(profileId)) && !unlocked) {
          return sendJson(res, 401, { error: 'Locked' });
        }
        query = { profileId: String(profileId) };
      } else {
        query = unlocked ? {} : { profileId: { $nin: [...LOCKED_PROFILES] } };
      }
      if (!db) return sendJson(res, 200, { items: [] });

      // Item 17: Projection — trim MongoDB metadata (_id, passwordHash, salt)
      const items = await db.collection('content')
        .find(query, { projection: { _id: 0 } })
        .sort({ order: 1, addedAt: 1 })
        .limit(500) // Rule 30 — never return an unbounded collection
        .toArray();
      return sendJson(res, 200, { items });
    }

    if (urlPath === '/api/content' && method === 'POST') {
      if (!isAuthorized(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized' });
      }
      const body = await parseBody(req);
      const item = body && typeof body.id === 'string' && body.id ? pickContentFields(body) : null;
      if (db && item) {
        await db.collection('content').updateOne({ id: String(item.id) }, { $set: item }, { upsert: true });
        return sendJson(res, 200, { success: true, item });
      }
      return sendJson(res, 400, { success: false, error: 'Invalid item data' });
    }

    if (urlPath.startsWith('/api/content/') && method === 'PUT') {
      if (!isAuthorized(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized' });
      }
      const itemId = decodeURIComponent(urlPath.replace('/api/content/', ''));
      const patch = pickContentFields(await parseBody(req));
      if (!patch || !Object.keys(patch).length) {
        return sendJson(res, 400, { success: false, error: 'Invalid item data' });
      }
      if (db && itemId) {
        await db.collection('content').updateOne({ id: String(itemId) }, { $set: patch });
      }
      return sendJson(res, 200, { success: true });
    }

    if (urlPath.startsWith('/api/content/') && method === 'DELETE') {
      if (!isAuthorized(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized' });
      }
      const itemId = decodeURIComponent(urlPath.replace('/api/content/', ''));
      if (db && itemId) {
        await db.collection('content').deleteOne({ id: String(itemId) });
      }
      return sendJson(res, 200, { success: true });
    }

    /* The photo wall that drifts behind the letter. */
    if (urlPath === '/api/gallery' && method === 'GET') {
      if (!hasSiteAccess(req)) return sendJson(res, 401, { error: 'Locked' });
      if (!db) return sendJson(res, 200, { photos: [] });
      const photos = await db.collection('gallery')
        .find({}, { projection: { _id: 0 } })
        .sort({ order: 1, addedAt: 1 })
        .limit(300) // Rule 30 — bounded
        .toArray();
      return sendJson(res, 200, { photos });
    }

    if (urlPath === '/api/gallery' && method === 'POST') {
      if (!isAuthorized(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized' });
      }
      const { url } = await parseBody(req);
      const clean = String(url || '').trim();
      if (!isSafeImageUrl(clean)) {
        return sendJson(res, 400, { success: false, error: 'Needs to be an https:// image link' });
      }
      const photo = { id: crypto.randomUUID(), url: clean, addedAt: Date.now(), order: Date.now() };
      if (db) await db.collection('gallery').insertOne({ ...photo });
      return sendJson(res, 200, { success: true, photo });
    }

    if (urlPath.startsWith('/api/gallery/') && method === 'DELETE') {
      if (!isAuthorized(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized' });
      }
      const photoId = decodeURIComponent(urlPath.replace('/api/gallery/', ''));
      if (db && photoId) await db.collection('gallery').deleteOne({ id: String(photoId) });
      return sendJson(res, 200, { success: true });
    }

    if (urlPath === '/api/sections' && method === 'GET') {
      if (!hasSiteAccess(req)) return sendJson(res, 401, { error: 'Locked' });
      const profileId = parsedUrl.searchParams.get('profileId');

      const unlocked = mayReadLocked(req);
      let query;
      if (profileId) {
        if (LOCKED_PROFILES.has(String(profileId)) && !unlocked) {
          return sendJson(res, 401, { error: 'Locked' });
        }
        query = { profileId: String(profileId) };
      } else {
        query = unlocked ? {} : { profileId: { $nin: [...LOCKED_PROFILES] } };
      }
      if (!db) return sendJson(res, 200, { sections: [] });
      const list = await db.collection('sections')
        .find(query, { projection: { _id: 0 } })
        .limit(200)
        .toArray();
      return sendJson(res, 200, { sections: list });
    }

    if (urlPath === '/api/sections' && method === 'POST') {
      if (!isAuthorized(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized' });
      }
      const { profileId, name } = await parseBody(req);
      if (!KNOWN_PROFILES.has(String(profileId)) || typeof name !== 'string' || !name.trim() || name.length > 120) {
        return sendJson(res, 400, { success: false, error: 'Invalid section' });
      }
      if (db && profileId && name) {
        await db.collection('sections').updateOne(
          { profileId: String(profileId), name: String(name) },
          { $set: { profileId: String(profileId), name: String(name) } },
          { upsert: true }
        );
      }
      return sendJson(res, 200, { success: true });
    }

    return sendJson(res, 404, { error: 'API endpoint not found' });
  }

  // Static File Serving
  const filePath = resolveStatic(urlPath);
  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain', 'X-Content-Type-Options': 'nosniff' }).end('Not found');
    return;
  }

  fs.stat(filePath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain', 'X-Content-Type-Options': 'nosniff' }).end('Not found');
      return;
    }

    const contentType = TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    const totalSize = stats.size;
    const rangeHeader = req.headers.range;

    const baseHeaders = {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    };

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10) || 0;
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      const chunkSize = (end - start) + 1;

      if (start >= totalSize || end >= totalSize) {
        res.writeHead(416, {
          'Content-Range': `bytes */${totalSize}`,
          'Content-Type': 'text/plain',
        }).end('Requested Range Not Satisfiable');
        return;
      }

      res.writeHead(206, {
        ...baseHeaders,
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Content-Length': chunkSize,
      });

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        ...baseHeaders,
        'Content-Length': totalSize,
      });
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    }
  });
});

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);
if (!LOOPBACK.has(HOST) && !gateEnabled()) {
  console.warn(`\n  ⚠️ Warning: HOST is "${HOST}" and SITE_PASSPHRASE is not configured.`);
  console.warn(`     Consider setting SITE_PASSPHRASE in environment variables for production.\n`);
}

server.listen(PORT, HOST, () => {
  console.log(`\n  MADAM  ♥  Server running at http://${HOST}:${PORT}/ (port: ${PORT})`);
  console.log(`  Her side:     http://localhost:${PORT}/`);
  console.log(`  Admin panel:  http://localhost:${PORT}/#/admin\n`);
  if (process.platform === 'win32' && process.env.MADAM_NO_OPEN !== '1') {
    exec(`start "" "http://localhost:${PORT}/"`, { shell: 'cmd.exe' }, () => {});
  }
});

/* Rule 31 — stop taking requests, then close the database cleanly. */
let shuttingDown = false;
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('\n[madam] shutting down…');
    server.close(async () => {
      try { await client?.close(); } catch (_) {}
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
