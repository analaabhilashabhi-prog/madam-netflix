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

/* matchMedia is guarded throughout: if it is missing the wall should still be
   built and still drift, rather than throwing and leaving her with nothing. */
const motionMedia = () => {
  try {
    return typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
  } catch (_) {
    return null;
  }
};

const prefersReducedMotion = () => motionMedia()?.matches === true;

/* Every photo keeps its own shape, so its height has to be measured before the
   wall can be laid out. Ratios are cached across rebuilds and across mounts —
   the browser has the image by then, so this costs nothing after the first. */
const DEFAULT_RATIO = 3 / 2;
const ratioCache = new Map();

function measureRatio(url, timeout = 1500) {
  if (ratioCache.has(url)) return Promise.resolve(ratioCache.get(url));
  // Fast path: extract dimensions directly from URL if encoded in path (e.g. /600/400 or /600x400)
  const match = /(?:^|[^\d])(\d{2,4})[x/](\d{2,4})(?:[^\d]|$)/.exec(url);
  if (match) {
    const w = parseInt(match[1], 10);
    const h = parseInt(match[2], 10);
    if (w > 0 && h > 0) {
      const ratio = w / h;
      ratioCache.set(url, ratio);
      return Promise.resolve(ratio);
    }
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ratio) => {
      if (settled) return;
      settled = true;
      const safe = Number.isFinite(ratio) && ratio > 0 ? ratio : DEFAULT_RATIO;
      ratioCache.set(url, safe);
      resolve(safe);
    };
    // a photo that never loads must not hold the whole wall up
    setTimeout(() => finish(DEFAULT_RATIO), timeout);
    try {
      const img = new Image();
      img.onload = () => finish(img.naturalWidth / img.naturalHeight);
      img.onerror = () => finish(DEFAULT_RATIO);
      img.decoding = 'async';
      img.src = url;
    } catch (_) {
      finish(DEFAULT_RATIO);
    }
  });
}

/* Masonry packing: each photo goes into whichever column is currently shortest.
   That is what stops a column of tall portraits running away from a column of
   wide landscapes and leaving a ragged, half-empty wall. */
export function packColumns(sized, count, gap = 0) {
  const cols = Array.from({ length: count }, () => []);
  const heights = new Array(count).fill(0);
  for (const item of sized) {
    let shortest = 0;
    for (let i = 1; i < count; i++) if (heights[i] < heights[shortest]) shortest = i;
    cols[shortest].push(item);
    heights[shortest] += item.height + gap;
  }
  return cols;
}

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
    columns = 'auto', // 'auto' works out how many it takes to fill the screen
    scale = 1, // no perspective squeeze to compensate for while it is flat
    overfill = 1.15,
    tileWidth = 200,
    tileHeight = 132,
    gap = 18,
    radius = 14,
    /* Straight on by default: a flat, square grid facing the viewer. Give
       these angles a value and the wall tips back into 3D. */
    tilt = 0,
    turn = 0,
    roll = 0,
    perspective = 1200,
    depth = 0,
    speed = 42,
    direction = 'up',
    /* false = every column travels the same way, so none cross each other */
    alternate = false,
    variance = 0.45,
    fade = 0.1, // how far the edges dissolve; higher hides more of the wall
    dim = 0.9, // resting opacity of a tile
    tint = 0.12, // strength of the colour wash over each tile
    grayscale = false,
    overlayColor = '#060010',
    minimumTiles = 10,
    /* Pinterest-style: how tall a tile may get relative to its width, so a
       freak panorama or a very long portrait cannot dominate a column. */
    minAspect = 0.5, // widest allowed: 2:1 landscape
    /* Tall enough for a modern phone screenshot, which is about 1:2.23. At
       1.9 every one of those was clamped to an identical height, which put
       the uniform-grid look straight back. */
    maxAspect = 2.3,
    measureTimeout = 1500,
    className = '',
  } = options;


  const root = document.createElement('div');
  root.className = `drift-wall ${className}`.trim();
  root.setAttribute('aria-hidden', 'true'); // decorative; the letter is the content
  /* Custom properties MUST go through setProperty. They are not real
     properties on CSSStyleDeclaration, so Object.assign silently drops them
     and every calc() below turns invalid — which collapses the tiles to zero
     height and makes the whole wall disappear. React's style prop hides this
     by special-casing `--` keys; plain DOM does not. */
  const vars = {
    '--dw-tile-w': `${tileWidth}px`,
    '--dw-tile-h': `${tileHeight}px`,
    '--dw-gap': `${gap}px`,
    '--dw-radius': `${radius}px`,
    '--dw-perspective': `${perspective}px`,
    '--dw-dim': String(dim),
    '--dw-tint': String(tint),
    '--dw-gray': grayscale ? '1' : '0',
    '--dw-overlay': overlayColor,
    '--dw-edge': `${Math.max(0, (1 - fade) * 100)}%`,
  };
  for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value);

  const plane = document.createElement('div');
  plane.className = 'drift-wall__plane';
  plane.style.transform =
    `translate(-50%, -50%) scale(${scale}) ` +
    `rotateX(${tilt}deg) rotateY(${turn}deg) rotateZ(${roll}deg) ` +
    `translateZ(${-depth}px)`;
  root.append(plane);

  const unit = tileHeight + gap;
  const colWidth = tileWidth + gap;
  const tracks = [];
  const meta = [];
  let columnItems = [];
  let velocities = [];
  let offsets = [];

  /* How many columns it takes to cover the screen edge to edge. The plane is
     scaled up and rotated, and rotateY foreshortens its projected width, so
     the raw width has to beat the viewport by that factor before it fills. */
  function columnCount() {
    if (columns !== 'auto') return Math.max(1, columns);
    const vw = (typeof window !== 'undefined' && window.innerWidth) || 1280;
    const foreshorten = Math.cos((Math.abs(turn) * Math.PI) / 180) || 1;
    return Math.max(3, Math.ceil((vw * overfill) / (colWidth * scale * foreshorten)));
  }

  /* url -> the height this photo gets at the current tile width, from its own
     aspect ratio. Clamped so nothing extreme swallows a column. */
  function heightFor(url) {
    const ratio = ratioCache.get(url) || DEFAULT_RATIO;
    const clamped = Math.min(Math.max(1 / ratio, minAspect), maxAspect);
    return Math.round(tileWidth * clamped);
  }

  function build(viewportHeight) {
    const count = columnCount();

    /* Enough tiles that every column gets several *different* photos. With
       fewer than this each column ends up holding one image and repeating it
       down the screen, which reads as a grid of duplicates rather than a wall. */
    const items = padToMinimum(urls, Math.max(minimumTiles, count * 3));

    /* pack the photos by height, shortest column first */
    const sized = items.map((url) => ({ url, height: heightFor(url) }));
    columnItems = packColumns(sized, count, gap);
    for (const col of columnItems) if (!col.length) col.push(sized[0]);

    const dirSign = direction === 'up' ? 1 : -1;
    velocities = columnItems.map((_, c) => {
      // with alternate off every column runs the same way, only at its own pace
      const altSign = alternate && c % 2 === 1 ? -1 : 1;
      return speed * columnFactor(c, variance) * dirSign * altSign;
    });

    plane.replaceChildren();
    tracks.length = 0;
    meta.length = 0;

    /* Eager loading for transformed 3D plane tiles so images never stay blank */
    const columnHeight = (col) =>
      Math.max(unit, col.reduce((sum, item) => sum + item.height + gap, 0));

    columnItems.forEach((col, c) => {
      const copyHeight = columnHeight(col);
      const copies = Math.max(2, Math.ceil((viewportHeight * 1.6) / copyHeight) + 1);
      meta[c] = { copyHeight, copies };

      const column = document.createElement('div');
      column.className = 'drift-wall__col';
      const track = document.createElement('div');
      track.className = 'drift-wall__track';

      for (let copy = 0; copy < copies; copy++) {
        for (const { url, height } of col) {
          const tile = document.createElement('div');
          tile.className = 'drift-wall__tile';
          // its own shape — this is what makes the wall read as Pinterest
          tile.style.height = `${height + gap}px`;
          const inner = document.createElement('span');
          inner.className = 'drift-wall__inner';
          const img = document.createElement('img');
          img.src = url;
          img.alt = '';
          img.loading = 'eager';
          img.decoding = 'async';
          img.draggable = false;
          // a dead link must not leave a broken-image icon on her letter
          img.addEventListener('error', () => {
            img.style.display = 'none';
            inner.classList.add('drift-wall__inner--failed');
          });
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

    // stagger the columns so they do not all start on the same tile boundary
    offsets = columnItems.map((_, c) => (meta[c]?.copyHeight || 0) * ((c * 0.37) % 1));
  }

  let raf = null;
  let lastTs = null;
  let destroyed = false;
  let reduced = prefersReducedMotion();
  let viewport = window.innerHeight || 600;
  let viewportW = window.innerWidth || 1280;

  function paint() {
    for (let c = 0; c < tracks.length; c++) {
      if (tracks[c]) tracks[c].style.transform = `translate3d(0, ${-offsets[c]}px, 0)`;
    }
  }

  /* Measure every photo first, then lay out once. Building on guessed heights
     and re-laying out afterwards would make the whole wall visibly jump. */
  const ready = Promise.all([...new Set(urls)].map((url) => measureRatio(url, measureTimeout)))
    .then(() => {
      if (destroyed) return;
      build(viewport);
      paint();
      start();
    })
    .catch(() => {});

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
    if (raf || reduced || destroyed || !tracks.length) return;
    lastTs = null;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    lastTs = null;
  }

  const motionQuery = motionMedia();
  const onMotionChange = (e) => {
    reduced = e.matches;
    if (reduced) stop();
    else start();
  };
  motionQuery?.addEventListener?.('change', onMotionChange);

  /* Rebuild when the window changes enough to expose an edge. Width matters as
     much as height now that the column count is derived from it. */
  let resizeTimer = null;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const h = window.innerHeight || 600;
      const w = window.innerWidth || 1280;
      if (destroyed || !tracks.length) return;
      if (Math.abs(h - viewport) < 80 && Math.abs(w - viewportW) < 80) return;
      viewport = h;
      viewportW = w;
      build(viewport);
      paint();
    }, 200);
  };
  window.addEventListener('resize', onResize);

  /* A background animation has no business running while the tab is hidden. */
  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVisibility);

  return {
    el: root,
    ready, // resolves once the photos have been measured and laid out
    destroy() {
      destroyed = true;
      stop();
      clearTimeout(resizeTimer);
      motionQuery?.removeEventListener?.('change', onMotionChange);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      root.remove();
    },
  };
}
