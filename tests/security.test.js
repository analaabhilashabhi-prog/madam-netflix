/* Security regression tests — the whole point of this file is that a leak that
   was once closed cannot quietly reopen.
 *
 * Run with:  npm test
 *
 * Boots the real server on a spare port with a throwaway config, then attacks
 * it the same way a stranger would. No mocks: if these pass, the running
 * server genuinely refuses. Nothing here writes to the real database.
 */

const { spawn } = require('child_process');
const path = require('path');
const assert = require('assert');

const PORT = 5199;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = path.join(__dirname, '..');

const SITE_PASSPHRASE = 'test-passphrase';
const SECRET_PIN = '4321';

let child;
const results = [];

function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => results.push({ name, ok: true }))
    .catch((err) => results.push({ name, ok: false, err: err.message }));
}

async function get(pathname, headers = {}) {
  return fetch(`${BASE}${pathname}`, { headers });
}

async function post(pathname, body, headers = {}) {
  return fetch(`${BASE}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function startServer(env) {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
      cwd: ROOT,
      env: { ...process.env, ...env, PORT: String(PORT), MADAM_NO_OPEN: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    const onData = (buf) => {
      out += buf.toString();
      if (out.includes('running at')) resolve();
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => reject(new Error(`server exited early (${code}): ${out}`)));
    setTimeout(() => reject(new Error(`server did not start: ${out}`)), 20000);
  });
}

(async () => {
  /* MONGODB_URI is deliberately blanked: these tests attack the access rules,
     and must never be able to touch, read or write the real memories. */
  await startServer({
    HOST: '127.0.0.1',
    MONGODB_URI: '',
    SITE_PASSPHRASE,
    SECRET_PIN,
  });

  /* ---- 1. Nothing outside the app is downloadable --------------------- */
  for (const target of [
    '/.env',
    '/.env.example',
    '/.git/config',
    '/.git/logs/HEAD',
    '/server.js',
    '/package.json',
    '/package-lock.json',
    '/README.md',
    '/src/../.env',
    '/%2e%2e/.env',
    '/%2E%2E%2F.env',
    '/..%2f.env',
    '/./.env',
    '/assets/../.env',
    '/src/../../.env',
  ]) {
    await check(`static: refuses ${target}`, async () => {
      const res = await get(target);
      assert.strictEqual(res.status, 404, `expected 404, got ${res.status}`);
    });
  }

  await check('static: still serves the app itself', async () => {
    for (const ok of ['/', '/index.html', '/src/app.js', '/src/styles.css']) {
      const res = await get(ok);
      assert.strictEqual(res.status, 200, `${ok} returned ${res.status}`);
    }
  });

  await check('static: sends a Content-Security-Policy', async () => {
    const res = await get('/');
    const csp = res.headers.get('content-security-policy') || '';
    assert.ok(csp.includes("frame-ancestors 'none'"), 'missing frame-ancestors');
    assert.ok(csp.includes("object-src 'none'"), 'missing object-src');
    assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
  });

  /* ---- 2. The front door actually holds -------------------------------- */
  await check('gate: content is refused without the passphrase', async () => {
    const res = await get('/api/content');
    assert.strictEqual(res.status, 401, `expected 401, got ${res.status}`);
  });

  await check('gate: sections are refused without the passphrase', async () => {
    const res = await get('/api/sections');
    assert.strictEqual(res.status, 401, `expected 401, got ${res.status}`);
  });

  await check('gate: a wrong passphrase is rejected', async () => {
    const res = await post('/api/auth/enter', { passphrase: 'not-it' });
    assert.strictEqual(res.status, 401);
  });

  await check('gate: /api/session leaks nothing but lock state', async () => {
    const res = await get('/api/session');
    const body = await res.json();
    assert.deepStrictEqual(Object.keys(body).sort(), ['gate', 'unlocked']);
    assert.strictEqual(body.gate, true);
    assert.strictEqual(body.unlocked, false);
  });

  let siteToken;
  await check('gate: the right passphrase opens it', async () => {
    const res = await post('/api/auth/enter', { passphrase: SITE_PASSPHRASE });
    assert.strictEqual(res.status, 200);
    ({ token: siteToken } = await res.json());
    assert.ok(siteToken, 'no token issued');
    const content = await get('/api/content', { 'X-Madam-Site': siteToken });
    assert.strictEqual(content.status, 200);
  });

  /* ---- 3. The Secret profile is locked server-side --------------------- */
  await check('secret: hidden from a normal visitor', async () => {
    const res = await get('/api/content', { 'X-Madam-Site': siteToken });
    const { items } = await res.json();
    const leaked = items.filter((i) => i.profileId === 'secret');
    assert.strictEqual(leaked.length, 0, `${leaked.length} secret items leaked`);
  });

  await check('secret: direct request is refused', async () => {
    const res = await get('/api/content?profileId=secret', { 'X-Madam-Site': siteToken });
    assert.strictEqual(res.status, 401);
  });

  await check('secret: a wrong PIN is refused', async () => {
    const res = await post('/api/auth/pin', { pin: '0000' });
    assert.strictEqual(res.status, 401);
  });

  let pinToken;
  await check('secret: the right PIN unlocks it', async () => {
    const res = await post('/api/auth/pin', { pin: SECRET_PIN });
    assert.strictEqual(res.status, 200);
    ({ token: pinToken } = await res.json());
    // still needs the front-door key too — one lock does not open the other
    const content = await get('/api/content?profileId=secret', {
      'X-Madam-Site': siteToken,
      'X-Madam-Pin': pinToken,
    });
    assert.strictEqual(content.status, 200);
  });

  await check('secret: the PIN alone does not get past the front door', async () => {
    const res = await get('/api/content?profileId=secret', { 'X-Madam-Pin': pinToken });
    assert.strictEqual(res.status, 401);
  });

  /* ---- 3b. The letter gallery is behind the same doors ----------------- */
  await check('gallery: refused without the passphrase', async () => {
    const res = await get('/api/gallery');
    assert.strictEqual(res.status, 401, `expected 401, got ${res.status}`);
  });

  await check('gallery: anonymous cannot add or remove photos', async () => {
    const add = await post('/api/gallery', { url: 'https://example.com/x.jpg' });
    assert.strictEqual(add.status, 401);
    const del = await fetch(`${BASE}/api/gallery/anything`, { method: 'DELETE' });
    assert.strictEqual(del.status, 401);
  });

  await check('gallery: a site token cannot add photos', async () => {
    const res = await post('/api/gallery', { url: 'https://example.com/x.jpg' }, {
      Authorization: `Bearer ${siteToken}`,
    });
    assert.strictEqual(res.status, 401, 'site token was accepted as admin!');
  });

  await check('gallery: readable once the passphrase is given', async () => {
    const res = await get('/api/gallery', { 'X-Madam-Site': siteToken });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.photos), 'photos should be an array');
  });

  /* ---- 4. Tokens cannot be traded up ----------------------------------- */
  await check('tokens: a site token cannot write', async () => {
    const res = await post('/api/content', { id: '__test__', title: 'x' }, {
      Authorization: `Bearer ${siteToken}`,
    });
    assert.strictEqual(res.status, 401, 'site token was accepted as admin!');
  });

  await check('tokens: a PIN token cannot write', async () => {
    const res = await post('/api/content', { id: '__test__', title: 'x' }, {
      Authorization: `Bearer ${pinToken}`,
    });
    assert.strictEqual(res.status, 401, 'PIN token was accepted as admin!');
  });

  await check('tokens: a forged token is rejected', async () => {
    const forged = Buffer.from(JSON.stringify({
      email: 'x', scope: 'admin', exp: Date.now() + 1e7,
    })).toString('base64url') + '.' + 'de.ad'.repeat(12);
    const res = await post('/api/content', { id: '__test__' }, {
      Authorization: `Bearer ${forged}`,
    });
    assert.strictEqual(res.status, 401);
  });

  await check('writes: anonymous cannot write, update or delete', async () => {
    const c = await post('/api/content', { id: '__test__', title: 'x' });
    assert.strictEqual(c.status, 401);
    const p = await fetch(`${BASE}/api/content/__test__`, { method: 'PUT', body: '{}' });
    assert.strictEqual(p.status, 401);
    const d = await fetch(`${BASE}/api/content/__test__`, { method: 'DELETE' });
    assert.strictEqual(d.status, 401);
  });

  /* ---- 5. Login ------------------------------------------------------- */
  await check('login: bad credentials never succeed, and leak no internals', async () => {
    const res = await post('/api/auth/login', { email: 'nobody@example.com', password: 'x' });
    assert.notStrictEqual(res.status, 200, 'bad credentials were accepted!');
    const body = await res.json();
    assert.ok(!body.token, 'a token was issued for bad credentials');
    assert.ok(
      !/database|mongo|stack|ECONN|at .*\.js:\d+/i.test(body.error || ''),
      `error message exposes internals: ${body.error}`
    );
    assert.ok(!/no such user|not found|exist/i.test(body.error || ''), 'error enables user enumeration');
  });

  await check('login: repeated attempts are rate limited', async () => {
    let sawLimit = false;
    for (let i = 0; i < 14; i++) {
      const res = await post('/api/auth/login', { email: 'nobody@example.com', password: 'x' });
      if (res.status === 429) { sawLimit = true; break; }
    }
    assert.ok(sawLimit, 'never hit the rate limit');
  });

  /* ---- 6. Port binding test -------------------------------------------- */
  await check('startup: binds and starts cleanly on 0.0.0.0', async () => {
    const proc = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
      cwd: ROOT,
      env: { ...process.env, HOST: '0.0.0.0', SITE_PASSPHRASE: '', PORT: '5198', MADAM_NO_OPEN: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const started = await new Promise((resolve) => {
      let out = '';
      const onData = (buf) => {
        out += buf.toString();
        if (out.includes('Server running at')) resolve(true);
      };
      proc.stdout.on('data', onData);
      proc.stderr.on('data', onData);
      setTimeout(() => { proc.kill(); resolve(false); }, 10000);
    });
    proc.kill();
    assert.strictEqual(started, true, 'server failed to start on 0.0.0.0');
  });

  /* ---- report ---------------------------------------------------------- */
  child.kill();

  const failed = results.filter((r) => !r.ok);
  for (const r of results) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `\n          ${r.err}`}`);
  }
  console.log(`\n  ${results.length - failed.length}/${results.length} passed\n`);
  process.exit(failed.length ? 1 : 0);
})().catch((err) => {
  console.error(err);
  child?.kill();
  process.exit(1);
});
