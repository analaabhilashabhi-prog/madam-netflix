/* Small DOM helpers, the heart loader, and the crossfade router. */

export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* Section 3.5 — heart-themed branded loader, never a generic spinner. */
export function heartLoader(label = 'Loading') {
  const fill = h('span', { class: 'heart-fill' });
  const wrap = h(
    'div',
    { class: 'loader' },
    h('div', { class: 'heart' }, h('span', { class: 'heart-shape' }, fill)),
    h('div', { class: 'loader-label' }, label)
  );
  return {
    el: wrap,
    progress(p) {
      fill.style.height = `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`;
    },
    label(text) {
      wrap.querySelector('.loader-label').textContent = text;
    },
  };
}

export function icon(name, cls = '') {
  const paths = {
    play: '<path d="M8 5v14l11-7z"/>',
    pause: '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>',
    back: '<path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z"/>',
    rewind:
      '<path d="M12 5V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/><text x="10" y="17" font-size="7" fill="currentColor" stroke="none">10</text>',
    forward:
      '<path d="M12 5V1l5 5-5 5V7a5 5 0 1 0 5 5h2a7 7 0 1 1-7-7z"/><text x="8" y="17" font-size="7" fill="currentColor" stroke="none">10</text>',
    volume: '<path d="M4 9v6h4l5 5V4L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/>',
    mute: '<path d="M4 9v6h4l5 5V4L8 9H4z"/><path d="M16 9l5 5m0-5l-5 5" stroke="currentColor" stroke-width="2" fill="none"/>',
    next: '<path d="M5 5l9 7-9 7zM16 5h3v14h-3z"/>',
    prev: '<path d="M19 5l-9 7 9 7zM5 5h3v14H5z"/>',
    captions:
      '<path d="M3 5h18v14H3z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 11h3M7 14h5M14 11h3M14 14h3" stroke="currentColor" stroke-width="1.8" fill="none"/>',
    speed: '<path d="M12 4a8 8 0 1 0 8 8h-2a6 6 0 1 1-6-6zM12 12l5-3-3 5z"/>',
    fullscreen: '<path d="M4 9V4h5V6H6v3zm11-5h5v5h-2V6h-3zM4 15h2v3h3v2H4zm14 0h2v5h-5v-2h3z"/>',
    bell: '<path d="M12 22a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22zm7-5v-6a7 7 0 0 0-5.5-6.8V3a1.5 1.5 0 0 0-3 0v1.2A7 7 0 0 0 5 11v6l-2 2v1h18v-1z"/>',
    search: '<path d="M10 4a6 6 0 1 0 3.7 10.7l4.8 4.8 1.4-1.4-4.8-4.8A6 6 0 0 0 10 4zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"/>',
    plus: '<path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/>',
    check: '<path d="M9 16.2L4.8 12l-1.4 1.4L9 19 20.6 7.4 19.2 6z"/>',
    thumb: '<path d="M2 10h4v11H2zM8 21h9.3c.9 0 1.6-.6 1.8-1.4l1.8-6.6a1.5 1.5 0 0 0-1.5-1.9H14l.8-4.2A1.6 1.6 0 0 0 13.2 5L8 10.6z"/>',
    close: '<path d="M18.3 5.7L12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3 10.6 10.6 16.9 4.3z"/>',
    info: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2zm0-8h-2V7h2z"/>',
    chevronL: '<path d="M15.4 7.4L14 6l-6 6 6 6 1.4-1.4L10.8 12z"/>',
    chevronR: '<path d="M8.6 7.4L10 6l6 6-6 6-1.4-1.4L13.2 12z"/>',
    edit: '<path d="M3 17.2V21h3.8L18 9.8 14.2 6zM20.7 7.3a1 1 0 0 0 0-1.4l-2.6-2.6a1 1 0 0 0-1.4 0L15 5l3.8 3.8z"/>',
    trash: '<path d="M6 7h12l-1 14H7zM9 4h6l1 2H8z"/>',
    party: '<path d="M3 21l6-16 12 12z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/>',
    heart: '<path d="M12 21S3.6 15.8 3.6 9.9A4.9 4.9 0 0 1 12 6.6a4.9 4.9 0 0 1 8.4 3.3C20.4 15.8 12 21 12 21z"/>',
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', `icon ${cls}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = paths[name] || '';
  return svg;
}

export function iconButton(name, title, onClick, extraClass = '') {
  return h('button', { class: `ibtn ${extraClass}`.trim(), title, 'aria-label': title, onClick }, icon(name));
}

export function toast(message) {
  let host = $('#toasts');
  if (!host) {
    host = h('div', { id: 'toasts' });
    document.body.append(host);
  }
  const t = h('div', { class: 'toast' }, message);
  host.append(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => {
    t.classList.remove('in');
    setTimeout(() => t.remove(), 400);
  }, 2600);
}

export const fmtTime = (s) => {
  s = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return hh > 0 ? `${hh}:${String(mm).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${mm}:${String(sec).padStart(2, '0')}`;
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Whole-page fullscreen. Must be called straight from a click handler — the
   browser rejects it otherwise, and rejects it silently, hence the catch. */
export function goFullscreen() {
  try {
    if (document.fullscreenElement) return;
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (req) {
      const p = req.call(el);
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  } catch (_) {}
}

/* ---------- crossfade screen router ----------------------------------- */

const root = () => document.getElementById('app');
let current = null;

export async function mount(screen, { fade = 520 } = {}) {
  const container = root();
  const old = current;
  const node = screen.el;
  node.classList.add('screen', 'fade-enter');
  container.append(node);
  // let layout settle so the fade actually animates
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  node.classList.add('fade-enter-active');

  if (old) {
    old.el.classList.add('fade-leave');
    setTimeout(() => {
      old.destroy?.();
      old.el.remove();
    }, fade);
  }
  current = screen;
  setTimeout(() => node.classList.remove('fade-enter', 'fade-enter-active'), fade + 60);
  return screen;
}

export function currentScreen() {
  return current;
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderDescription(descriptionText, isVertical = false) {
  if (!descriptionText) return '';
  const safeText = escapeHtml(descriptionText.trim());
  if (!isVertical) return safeText;

  let formatted = safeText;

  // If explicit formatting used: *text* or [red]text[/red]
  if (/\[red\](.*?)\[\/red\]/i.test(formatted) || /\*([^\*]+)\*/.test(formatted)) {
    formatted = formatted.replace(/\[red\](.*?)\[\/red\]/gi, '<span class="desc-highlight">$1</span>');
    formatted = formatted.replace(/\*([^\*]+)\*/g, '<span class="desc-highlight">$1</span>');
    return formatted;
  }

  // Auto-detect quotes
  if (/(["'“‘][^"'”’]+["'”’])/.test(formatted)) {
    return formatted.replace(/(["'“‘][^"'”’]+["'”’])/g, '<span class="desc-highlight">$1</span>');
  }

  // Auto-detect emotional / funny key words or clauses
  const emotionRegex = /(favourite|favorite|love|laugh|smile|heart|world|family|special|funny|cute|best|precious|forever|unforgettable|magic|dream|happy|birthday|remember|memories|memory|sweet|mine|always|Abhi|Madam G|hilarious|lol|comedy|cutest|kiss|hug)/i;

  const parts = formatted.split(/([.,!?—\n]+)/);
  let highlighted = false;
  let result = '';

  for (let i = 0; i < parts.length; i++) {
    const chunk = parts[i];
    if (!highlighted && emotionRegex.test(chunk) && chunk.trim().length > 2) {
      result += `<span class="desc-highlight">${chunk}</span>`;
      highlighted = true;
    } else {
      result += chunk;
    }
  }

  if (!highlighted) {
    const sentences = formatted.split(/([.!?\n]+)/);
    if (sentences.length > 1 && sentences[0].trim().length > 3) {
      result = `<span class="desc-highlight">${sentences[0]}${sentences[1] || ''}</span>` + sentences.slice(2).join('');
    } else {
      result = `<span class="desc-highlight">${formatted}</span>`;
    }
  }

  return result;
}
