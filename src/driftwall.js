/* DriftWall — a 3D wall of photos drifting endlessly behind the letter.

   Ported from the React component to plain ES modules, because this app has no
   build step and no React. The motion is the same: columns of tiles scrolling
   at slightly different speeds on a tilted plane, each column wrapping around
   itself so it never runs out.

   What is deliberately dropped from the original: hover lift, focus handling,
   click-through links and pointer parallax. This is wallpaper behind a letter
   she is reading — it must never react, never pause, and never take a click.
   The whole wall is pointer-events: none. */

const GOLDEN = 0.6180339887;

/* Spreads the column speeds apart so they never march in lockstep. */
const columnFactor = (index, variance) => {
  const pseudo = ((index * GOLDEN + 0.35) % 1) * 2 - 1;
  return 1 + variance * pseudo;
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* The wall needs enough tiles to fill every column twice over, otherwise the
   wrap is visible as a gap. With fewer photos than that, repeat them. */
function padToMinimum(list, minimum) {
  if (!list.length) return [];
  if (list.length >= minimum) return list.slice();
  const out = [];
  while (out.length < minimum) out.push(list[out.length % list.length]);
  return out;
}

export function driftWall(photoUrls, options = {}) {
  const urls = (photoUrls || []).filter(Boolean);
  if (!urls.length) return null;

  const {
    columns = 5,
    tileWidth = 200,
    tileHeight = 132,
    gap = 18,
    radius = 14,
    tilt = 16,
    turn = -14,
    roll = 0,
    perspective = 1200,
    depth = 120,
    speed = 42,
    direction = 'up',
    variance = 0.45,
    fade = 0.6,
    dim = 0.32,
    grayscale = false,
    overlayColor = '#060010',
    minimumTiles = 10,
    className = '',
  } = options;

  const items = padToMinimum(urls, minimumTiles);

  const root = document.createElement('div');
  root.className = `drift-wall ${className}`.trim();
  root.setAttribute('aria-hidden', 'true'); // decorative; the letter is the content
  Object.assign(root.style, {
    '--dw-tile-w': `${tileWidth}px`,
    '--dw-tile-h': `${tileHeight}px`,
    '--dw-gap': `${gap}px`,
    '--dw-radius': `${radius}px`,
    '--dw-perspective': `${perspective}px`,
    '--dw-dim': String(dim),
    '--dw-gray': grayscale ? '1' : '0',
    '--dw-overlay': overlayColor,
    '--dw-edge': `${Math.max(0, (1 - fade) * 100)}%`,
  });

  const plane = document.createElement('div');
  plane.className = 'drift-wall__plane';
  plane.style.transform =
    `translate(-50%, -50%) scale(1.18) ` +
    `rotateX(${tilt}deg) rotateY(${turn}deg) rotateZ(${roll}deg) ` +
    `translateZ(${-depth}px)`;
  root.append(plane);

  /* deal the photos out across the columns */
  const columnItems = Array.from({ length: columns }, () => []);
  items.forEach((url, i) => columnItems[i % columns].push(url));
  for (const col of columnItems) if (!col.length) col.push(items[0]);

  const unit = tileHeight + gap;
  const tracks = [];
  const meta = [];

  function build(viewportHeight) {
    plane.replaceChildren();
    tracks.length = 0;
    meta.length = 0;

    columnItems.forEach((col, c) => {
      const copyHeight = Math.max(unit, col.length * unit);
      const copies = Math.max(2, Math.ceil((viewportHeight * 1.6) / copyHeight) + 1);
      meta[c] = { copyHeight, copies };

      const column = document.createElement('div');
      column.className = 'drift-wall__col';
      const track = document.createElement('div');
      track.className = 'drift-wall__track';

      for (let copy = 0; copy < copies; copy++) {
        for (const url of col) {
          const tile = document.createElement('div');
          tile.className = 'drift-wall__tile';
          const inner = document.createElement('span');
          inner.className = 'drift-wall__inner';
          const img = document.createElement('img');
          img.src = url;
          img.alt = '';
          img.loading = 'lazy';
          img.decoding = 'async';
          img.draggable = false;
          // a dead link must not leave a broken-image icon on her letter
          img.addEventListener('error', () => { tile.style.visibility = 'hidden'; });
          const overlay = document.createElement('span');
          overlay.className = 'drift-wall__overlay';
          inner.append(img, overlay);
          tile.append(inner);
          track.append(tile);
        }
      }

      column.append(track);
      plane.append(column);
      tracks[c] = track;
    });
  }

  const dirSign = direction === 'up' ? 1 : -1;
  const velocities = columnItems.map((_, c) => {
    const altSign = c % 2 === 0 ? 1 : -1; // neighbouring columns drift opposite ways
    return speed * columnFactor(c, variance) * dirSign * altSign;
  });

  const offsets = columnItems.map((_, c) => c * 0.37);
  let raf = null;
  let lastTs = null;
  let reduced = prefersReducedMotion();
  let viewport = window.innerHeight || 600;

  build(viewport);
  // stagger the columns so they do not all start on the same tile boundary
  columnItems.forEach((_, c) => {
    offsets[c] = (meta[c]?.copyHeight || 0) * ((c * 0.37) % 1);
  });

  function paint() {
    for (let c = 0; c < tracks.length; c++) {
      if (tracks[c]) tracks[c].style.transform = `translate3d(0, ${-offsets[c]}px, 0)`;
    }
  }
  paint();

  function frame(ts) {
    if (lastTs === null) lastTs = ts;
    const dt = Math.min(0.05, Math.max(0, ts - lastTs) / 1000);
    lastTs = ts;

    for (let c = 0; c < tracks.length; c++) {
      const m = meta[c];
      if (!m) continue;
      let next = offsets[c] + velocities[c] * dt;
      // wrap into [0, copyHeight) so the column never reaches an end
      next = ((next % m.copyHeight) + m.copyHeight) % m.copyHeight;
      offsets[c] = next;
      if (tracks[c]) tracks[c].style.transform = `translate3d(0, ${-next}px, 0)`;
    }

    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (raf || reduced) return;
    lastTs = null;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    lastTs = null;
  }

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onMotionChange = (e) => {
    reduced = e.matches;
    if (reduced) stop();
    else start();
  };
  motionQuery.addEventListener('change', onMotionChange);

  /* Rebuild only when the viewport height changes enough to expose a gap. */
  let resizeTimer = null;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const h = window.innerHeight || 600;
      if (Math.abs(h - viewport) < 80) return;
      viewport = h;
      build(viewport);
      paint();
    }, 200);
  };
  window.addEventListener('resize', onResize);

  /* A background animation has no business running while the tab is hidden. */
  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVisibility);

  start();

  return {
    el: root,
    destroy() {
      stop();
      clearTimeout(resizeTimer);
      motionQuery.removeEventListener('change', onMotionChange);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      root.remove();
    },
  };
}
