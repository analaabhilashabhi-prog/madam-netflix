/* DriftWall render tests.
 *
 * These exist because the wall once shipped completely invisible: the tile
 * sizes were pushed onto element.style with Object.assign, which cannot set
 * CSS custom properties, so every calc() went invalid and the tiles collapsed
 * to zero height. Nothing threw, nothing logged — it just wasn't there.
 *
 * jsdom does no layout, so these assert the things that actually break:
 * the custom properties really land, real tiles get built, and each photo is
 * given a height from its own aspect ratio.
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

  /* jsdom fetches nothing, so stand in an Image that reports the dimensions
     encoded in the URL. That lets these tests drive real aspect ratios. */
  global.Image = class {
    set src(value) {
      const m = /(\d+)x(\d+)/.exec(String(value));
      this.naturalWidth = m ? Number(m[1]) : 600;
      this.naturalHeight = m ? Number(m[2]) : 400;
      setTimeout(() => this.onload && this.onload(), 0);
    }
  };

  const { driftWall, packColumns } = await import('../src/driftwall.js');

  // 3:2 landscape by default
  const photos = (n) => Array.from({ length: n }, (_, i) => `https://example.com/${i}-600x400.jpg`);
  const shaped = (list) => list.map((s, i) => `https://example.com/${i}-${s}.jpg`);

  const make = async (urls, opts = {}) => {
    const wall = driftWall(urls, { columns: 5, measureTimeout: 20, ...opts });
    await wall.ready;
    return wall;
  };

  await check('the tile size variables actually reach the element', async () => {
    const wall = await make(photos(12));
    const s = wall.el.style;
    // the exact bug: these were silently empty
    assert.strictEqual(s.getPropertyValue('--dw-tile-w'), '200px');
    assert.strictEqual(s.getPropertyValue('--dw-gap'), '18px');
    assert.ok(s.getPropertyValue('--dw-edge'), '--dw-edge must be set');
    wall.destroy();
  });

  await check('it builds columns and tiles', async () => {
    const wall = await make(photos(12));
    const cols = wall.el.querySelectorAll('.drift-wall__col');
    const tiles = wall.el.querySelectorAll('.drift-wall__tile');
    const imgs = wall.el.querySelectorAll('img');
    assert.strictEqual(cols.length, 5, `expected 5 columns, got ${cols.length}`);
    assert.ok(tiles.length > 0, 'no tiles were built');
    assert.strictEqual(imgs.length, tiles.length, 'every tile needs an image');
    wall.destroy();
  });

  await check('each photo is sized from its own aspect ratio', async () => {
    // 200px wide tiles: 1:1 -> 200, 2:3 portrait -> 300, 3:2 landscape -> 133
    const wall = await make(shaped(['600x600', '400x600', '600x400']), { columns: 3, minimumTiles: 3 });
    const byRatio = new Map();
    wall.el.querySelectorAll('.drift-wall__tile').forEach((t) => {
      const src = t.querySelector('img').getAttribute('src');
      byRatio.set(src.replace(/.*-(\d+x\d+).*/, '$1'), parseInt(t.style.height, 10));
    });
    const gap = 18;
    assert.strictEqual(byRatio.get('600x600'), 200 + gap, 'square should be 200 tall');
    assert.strictEqual(byRatio.get('400x600'), 300 + gap, 'portrait should be 300 tall');
    assert.strictEqual(byRatio.get('600x400'), 133 + gap, 'landscape should be 133 tall');
    wall.destroy();
  });

  await check('tile heights genuinely vary across a mixed wall', async () => {
    const wall = await make(shaped(['600x400', '400x600', '600x600', '800x450', '540x960', '1200x800']));
    const heights = new Set(
      [...wall.el.querySelectorAll('.drift-wall__tile')].map((t) => t.style.height)
    );
    assert.ok(heights.size >= 4, `expected several distinct heights, got ${[...heights].join(', ')}`);
    wall.destroy();
  });

  await check('extreme shapes are clamped, not allowed to swallow a column', async () => {
    // a 1:6 sliver and a 6:1 banner
    const wall = await make(shaped(['200x1200', '1200x200']), { columns: 2, minimumTiles: 2 });
    const heights = [...wall.el.querySelectorAll('.drift-wall__tile')].map((t) => parseInt(t.style.height, 10) - 18);
    // round the bounds the same way the code does: 200 * 2.3 is 459.99999999999994
    for (const h of heights) {
      assert.ok(
        h >= Math.round(200 * 0.5) && h <= Math.round(200 * 2.3),
        `height ${h} is outside the clamp`
      );
    }
    wall.destroy();
  });

  await check('no column is one photo repeated down the screen', async () => {
    // 15 photos over 11 columns used to give each column a single image
    Object.defineProperty(window, 'innerWidth', { value: 1920, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1080, configurable: true });
    const wall = await make(photos(15), { columns: 'auto' });
    wall.el.querySelectorAll('.drift-wall__track').forEach((track, i) => {
      const srcs = [...track.querySelectorAll('img')].map((n) => n.getAttribute('src'));
      assert.ok(new Set(srcs).size >= 3, `column ${i} only shows ${new Set(srcs).size} distinct photo(s)`);
    });
    wall.destroy();
  });

  await check('the shipped placeholders are genuinely mixed shapes', async () => {
    const { LETTER_GALLERY_PLACEHOLDERS } = await import('../src/config.js');
    const ratios = new Set(
      LETTER_GALLERY_PLACEHOLDERS.map((u) => {
        const m = /\/(\d+)\/(\d+)$/.exec(u);
        return m ? (Number(m[1]) / Number(m[2])).toFixed(2) : 'x';
      })
    );
    assert.ok(LETTER_GALLERY_PLACEHOLDERS.length >= 20, 'want enough placeholders to fill a wide wall');
    assert.ok(ratios.size >= 6, `placeholders must vary in shape, found ${ratios.size} ratio(s)`);
  });

  await check('packColumns fills the shortest column each time', () => {
    const items = [300, 100, 100, 100, 400, 120].map((height, i) => ({ url: `u${i}`, height }));
    const cols = packColumns(items, 3, 0);
    const totals = cols.map((c) => c.reduce((s, i) => s + i.height, 0));
    const spread = Math.max(...totals) - Math.min(...totals);
    assert.strictEqual(cols.flat().length, items.length, 'no item may be dropped');
    assert.ok(spread <= 300, `columns are badly unbalanced: ${totals.join(', ')}`);
  });

  await check('every column is filled, whatever the photo count', async () => {
    for (const n of [1, 3, 9, 10, 43, 120]) {
      const wall = await make(photos(n));
      const tracks = wall.el.querySelectorAll('.drift-wall__track');
      assert.strictEqual(tracks.length, 5, `${n} photos: expected 5 tracks`);
      tracks.forEach((t, i) => {
        const count = t.querySelectorAll('.drift-wall__tile').length;
        assert.ok(count >= 2, `${n} photos: column ${i} only has ${count} tiles`);
      });
      wall.destroy();
    }
  });

  await check('fewer than ten photos are repeated, not dropped', async () => {
    const wall = await make(photos(3));
    const srcs = [...wall.el.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    assert.strictEqual(new Set(srcs).size, 3, 'the three originals should all appear');
    assert.ok(srcs.length > 3, 'they should be repeated to fill the wall');
    wall.destroy();
  });

  await check('it fills the screen at any window size', async () => {
    // must mirror the live defaults, or this passes on numbers that are not real
    const scale = 1;
    const turn = 0;
    const colWidth = 200 + 18;
    for (const [w, h] of [[1920, 1080], [1536, 864], [1366, 768], [2560, 1440], [3840, 2160], [820, 1180], [390, 844]]) {
      Object.defineProperty(window, 'innerWidth', { value: w, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: h, configurable: true });
      const wall = await make(photos(15), { columns: 'auto' });
      const cols = wall.el.querySelectorAll('.drift-wall__col').length;
      const projected = cols * colWidth * scale * Math.cos((turn * Math.PI) / 180);
      assert.ok(projected >= w, `${w}x${h}: wall spans ${Math.round(projected)}px, screen is ${w}px`);
      wall.destroy();
    }
  });

  /* The letter shipped completely invisible because a "written" word was given
     el.style.opacity = '', which removes the inline value and drops the word
     back to a stylesheet rule that hides it. */
  await check('a written word is never handed back to the stylesheet', () => {
    const d = new JSDOM('<!doctype html><style>.letter-w{opacity:1}#letter-root.ink .letter-w{opacity:0.16}</style>'
      + '<div id="letter-root" class="ink"><span class="letter-w">word</span></div>');
    const el = d.window.document.querySelector('.letter-w');
    const root = d.window.document.getElementById('letter-root');
    const computed = () => d.window.getComputedStyle(el).opacity;

    el.style.opacity = '';
    assert.strictEqual(computed(), '0.16', 'clearing the inline value drops it to the resting rule — this is the trap');
    el.style.opacity = '1';
    assert.strictEqual(computed(), '1', 'an explicit 1 must win over the hiding rule');

    // and if the writing pass never runs at all, the letter must stay readable
    el.style.opacity = '';
    root.classList.remove('ink');
    assert.strictEqual(computed(), '1', 'without .ink the words must be visible');
  });

  await check('the letter source applies opacity explicitly', () => {
    const src = require('fs').readFileSync(new URL('../src/screens/letter.js', 'file://' + __filename.replace(/\\/g, '/')), 'utf8');
    assert.ok(
      !/style\.opacity\s*=\s*(''|""|`\`)/.test(src),
      'letter.js must never clear style.opacity — set an explicit value'
    );
  });

  await check('no photos means no wall at all', () => {
    assert.strictEqual(driftWall([]), null);
    assert.strictEqual(driftWall(null), null);
    assert.strictEqual(driftWall([null, undefined, '']), null);
  });

  await check('it can never steal a click from the letter', async () => {
    const wall = await make(photos(12));
    assert.strictEqual(wall.el.getAttribute('aria-hidden'), 'true');
    // pointer-events is in the stylesheet, so assert nothing interactive exists
    assert.strictEqual(wall.el.querySelectorAll('a, button, [tabindex]').length, 0);
    wall.destroy();
  });

  await check('the wall hangs straight, not skewed', async () => {
    const wall = await make(photos(12));
    const t = wall.el.querySelector('.drift-wall__plane').style.transform;
    assert.ok(/rotateX\(0deg\)/.test(t), `should not pitch: ${t}`);
    assert.ok(/rotateY\(0deg\)/.test(t), `should not yaw: ${t}`);
    assert.ok(/rotateZ\(0deg\)/.test(t), `should not roll: ${t}`);
    wall.destroy();
  });

  await check('it can still be tipped into 3D when asked', async () => {
    const wall = await make(photos(12), { tilt: 16, turn: -14, depth: 120 });
    const t = wall.el.querySelector('.drift-wall__plane').style.transform;
    assert.ok(/rotateX\(16deg\)/.test(t), `missing pitch: ${t}`);
    assert.ok(/rotateY\(-14deg\)/.test(t), `missing yaw: ${t}`);
    assert.ok(/translateZ\(-120px\)/.test(t), `missing depth: ${t}`);
    wall.destroy();
  });

  await check('destroy removes it and stops the loop', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const wall = await make(photos(12));
    host.appendChild(wall.el);
    assert.strictEqual(host.children.length, 1);
    wall.destroy();
    assert.strictEqual(host.children.length, 0, 'destroy should detach the wall');
  });

  await check('destroying before the photos finish measuring is safe', async () => {
    const wall = driftWall(photos(12), { columns: 5, measureTimeout: 20 });
    wall.destroy(); // immediately, mid-measure
    await wall.ready;
    assert.strictEqual(wall.el.querySelectorAll('.drift-wall__tile').length, 0);
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
