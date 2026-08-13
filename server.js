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

function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minute window
  const maxAttempts = 10;
  
  const record = loginAttempts.get(ip) || { count: 0, resetAt: now + windowMs };
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }
  
  if (record.count >= maxAttempts) {
    return false;
  }
  record.count++;
  loginAttempts.set(ip, record);
  return true;
}

const JWT_SECRET = process.env.JWT_SECRET || crypto.createHash('sha256').update(process.env.MONGODB_URI || 'madam-netflix-secret-key-2026').digest('hex');

function generateToken(email) {
  const payload = JSON.stringify({ email, exp: Date.now() + 14 * 24 * 60 * 60 * 1000 }); // valid 14 days
  const b64 = Buffer.from(payload).toString('base64url');
  const hmac = crypto.createHmac('sha256', JWT_SECRET).update(b64).digest('hex');
  return `${b64}.${hmac}`;
}

function verifyToken(token) {
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
    return true;
  } catch (_) {
    return false;
  }
}

function isAuthorized(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  return verifyToken(token);
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
        resolve(JSON.parse(body || '{}'));
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
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
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

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const urlPath = parsedUrl.pathname;
  const method = req.method.toUpperCase();
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  // API Endpoints
  if (urlPath.startsWith('/api/')) {
    if (urlPath === '/api/auth/login' && method === 'POST') {
      if (!checkRateLimit(clientIp)) {
        return sendJson(res, 429, { success: false, error: 'Too many login attempts. Please try again in 15 minutes.' });
      }

      const { email, password } = await parseBody(req);
      const cleanEmail = (email || '').trim();
      if (!db) {
        return sendJson(res, 500, { success: false, error: 'Database is not connected' });
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
      const profileId = parsedUrl.searchParams.get('profileId');
      if (db) {
        const query = profileId ? { profileId: String(profileId) } : {};
        // Item 17: Projection — trim MongoDB metadata (_id, passwordHash, salt)
        const items = await db.collection('content').find(query, { projection: { _id: 0 } }).sort({ order: 1, addedAt: 1 }).toArray();
        return sendJson(res, 200, { items });
      } else {
        return sendJson(res, 200, { items: [] });
      }
    }

    if (urlPath === '/api/content' && method === 'POST') {
      if (!isAuthorized(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized' });
      }
      const item = await parseBody(req);
      if (db && item && item.id && typeof item.id === 'string') {
        const cleanId = String(item.id);
        delete item._id; // prevent field tampering
        await db.collection('content').updateOne({ id: cleanId }, { $set: item }, { upsert: true });
        return sendJson(res, 200, { success: true, item });
      }
      return sendJson(res, 400, { success: false, error: 'Invalid item data' });
    }

    if (urlPath.startsWith('/api/content/') && method === 'PUT') {
      if (!isAuthorized(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized' });
      }
      const itemId = urlPath.replace('/api/content/', '');
      const patch = await parseBody(req);
      delete patch._id; // prevent field tampering
      if (db && itemId) {
        await db.collection('content').updateOne({ id: String(itemId) }, { $set: patch });
      }
      return sendJson(res, 200, { success: true });
    }

    if (urlPath.startsWith('/api/content/') && method === 'DELETE') {
      if (!isAuthorized(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized' });
      }
      const itemId = urlPath.replace('/api/content/', '');
      if (db && itemId) {
        await db.collection('content').deleteOne({ id: String(itemId) });
      }
      return sendJson(res, 200, { success: true });
    }

    if (urlPath === '/api/sections' && method === 'GET') {
      const profileId = parsedUrl.searchParams.get('profileId');
      if (db) {
        const query = profileId ? { profileId: String(profileId) } : {};
        const list = await db.collection('sections').find(query, { projection: { _id: 0 } }).toArray();
        return sendJson(res, 200, { sections: list });
      } else {
        return sendJson(res, 200, { sections: [] });
      }
    }

    if (urlPath === '/api/sections' && method === 'POST') {
      if (!isAuthorized(req)) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized' });
      }
      const { profileId, name } = await parseBody(req);
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
  let filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || stat.isDirectory()) {
      if (!err && stat.isDirectory()) filePath = path.join(filePath, 'index.html');
      else {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
        return;
      }
    }
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      }).end(data);
    });
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}/`;
  console.log(`\n  MADAM  ♥  running at ${url}`);
  console.log(`  Her side:     ${url}`);
  console.log(`  Admin panel:  ${url}#/admin`);
  console.log('\n  Ctrl+C to stop.\n');
  if (process.platform === 'win32' && process.env.MADAM_NO_OPEN !== '1') {
    exec(`start "" "${url}"`, { shell: 'cmd.exe' }, () => {});
  }
});
