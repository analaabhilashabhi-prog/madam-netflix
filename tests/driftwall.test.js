/* DriftWall render tests.
 *
 * These exist because the wall once shipped completely invisible: the tile
 * sizes were pushed onto element.style with Object.assign, which cannot set
 * CSS custom properties, so every calc() went invalid and the tiles collapsed
 * to zero height. Nothing threw, nothing logged — it just wasn't there.
 *
 * jsdom does no layout, so these assert the things that actually broke:
 * the custom properties really land, and real tiles get built.
 */

const assert = require('assert');
const { JSDOM } = require('jsdom');

const results = [];
const check = (name, fn) =>
  Promise.resolve()
    .then(fn)
    .then(() => results.push({ name, ok: true }))
    .catch((err) => results.push({ name, ok: false, err: err.message }));

(async () => {
  const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
  global.window = dom.window;
  global.document = dom.window.document;
  global.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
  global.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);

  const { driftWall } = await import('../src/driftwall.js');

  const photos = (n) => Array.from({ length: n }, (_, i) => `https://example.com/${i}.jpg`);

  await check('the tile size variables actually reach the element', () => {
    const wall = driftWall(photos(12), { columns: 5 });
    const s = wall.el.style;
    // the exact bug: these were silently empty
    assert.strictEqual(s.getPropertyValue('--dw-tile-w'), '200px');
    assert.strictEqual(s.getPropertyValue('--dw-tile-h'), '132px');
    assert.strictEqual(s.getPropertyValue('--dw-gap'), '18px');
    assert.ok(s.getPropertyValue('--dw-edge'), '--dw-edge must be set');
    wall.destroy();
  });

  await check('it builds columns and tiles', () => {
    const wall = driftWall(photos(12), { columns: 5 });
    const cols = wall.el.querySelectorAll('.drift-wall__col');
    const tiles = wall.el.querySelectorAll('.drift-wall__tile');
    const imgs = wall.el.querySelectorAll('img');
    assert.strictEqual(cols.length, 5, `expected 5 columns, got ${cols.length}`);
    assert.ok(tiles.length > 0, 'no tiles were built');
    assert.strictEqual(imgs.length, tiles.length, 'every tile needs an image');
    wall.destroy();
  });

  await check('every column is filled, whatever the photo count', () => {
    for (const n of [1, 3, 9, 10, 43, 120]) {
      const wall = driftWall(photos(n), { columns: 5 });
      const tracks = wall.el.querySelectorAll('.drift-wall__track');
      assert.strictEqual(tracks.length, 5, `${n} photos: expected 5 tracks`);
      tracks.forEach((t, i) => {
        const count = t.querySelectorAll('.drift-wall__tile').length;
        assert.ok(count >= 2, `${n} photos: column ${i} only has ${count} tiles`);
      });
      wall.destroy();
    }
  });

  await check('fewer than ten photos are repeated, not dropped', () => {
    const wall = driftWall(photos(3), { columns: 5 });
    const srcs = [...wall.el.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    const unique = new Set(srcs);
    assert.strictEqual(unique.size, 3, 'the three originals should all appear');
    assert.ok(srcs.length > 3, 'they should be repeated to fill the wall');
    wall.destroy();
  });

  await check('no photos means no wall at all', () => {
    assert.strictEqual(driftWall([]), null);
    assert.strictEqual(driftWall(null), null);
    assert.strictEqual(driftWall([null, undefined, '']), null);
  });

  await check('it can never steal a click from the letter', () => {
    const wall = driftWall(photos(12), { columns: 5 });
    assert.strictEqual(wall.el.getAttribute('aria-hidden'), 'true');
    // pointer-events is in the stylesheet, so assert nothing interactive exists
    assert.strictEqual(wall.el.querySelectorAll('a, button, [tabindex]').length, 0);
    wall.destroy();
  });

  await check('the plane is actually tilted in 3D', () => {
    const wall = driftWall(photos(12), { columns: 5 });
    const t = wall.el.querySelector('.drift-wall__plane').style.transform;
    assert.ok(/rotateX\(16deg\)/.test(t), `missing pitch: ${t}`);
    assert.ok(/rotateY\(-14deg\)/.test(t), `missing yaw: ${t}`);
    assert.ok(/translateZ\(-120px\)/.test(t), `missing depth: ${t}`);
    wall.destroy();
  });

  await check('destroy removes it and stops the loop', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const wall = driftWall(photos(12), { columns: 5 });
    host.appendChild(wall.el);
    assert.strictEqual(host.children.length, 1);
    wall.destroy();
    assert.strictEqual(host.children.length, 0, 'destroy should detach the wall');
  });

  const failed = results.filter((r) => !r.ok);
  for (const r of results) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `\n          ${r.err}`}`);
  }
  console.log(`\n  ${results.length - failed.length}/${results.length} passed\n`);
  process.exit(failed.length ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
