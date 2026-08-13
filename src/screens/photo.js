/* 4.11 — Photo viewer, horizontal & vertical.
   Orientation is auto-detected from the image itself (no manual choice at upload
   time). No intro bumper before a still image — a smooth fade-in instead. Soft
   background music plays and ducks itself while she reads the text. */

import { h, icon, heartLoader, toast } from '../ui.js';
import { BADGES, pick } from '../config.js';
import { neighbours, resolveOrientation, toggleLike } from '../store.js';
import { startPhotoMusic, stopPhotoMusic, duckPhotoMusic } from '../music.js';

export function photoScreen(nav, { profile, item }) {
  const loader = heartLoader('Opening this one gently');
  const img = h('img', { class: 'photo-img', alt: item.title || 'memory' });
  const stage = h('div', { class: 'photo-stage' }, img);

  const panel = h(
    'div',
    { class: 'split-panel' },
    h('div', { class: 'split-badge' }, pick(BADGES)),
    h('h1', { class: 'split-title brush' }, item.title || 'A still we kept'),
    h('div', { class: 'split-sub' }, `${profile.name} · Photo · ${new Date(item.addedAt).getFullYear()}`),
    h('p', { class: 'split-desc' }, item.description || 'No caption needed. Look at us.'),
    h('div', { class: 'photo-actions' },
      h('button', { class: 'btn-ghost', onClick: () => { toggleLike(item); toast(item.liked ? 'Liked 💛' : 'Unliked'); } }, icon('thumb'), 'Like'),
      h('button', { class: 'btn-ghost', onClick: () => step(-1) }, icon('chevronL'), 'Previous'),
      h('button', { class: 'btn-ghost', onClick: () => step(1) }, 'Next', icon('chevronR'))
    ),
    h('div', { class: 'split-hint' }, 'Music softens while you read · Esc to go back')
  );

  const el = h(
    'div',
    { class: 'photo-view', tabindex: '0' },
    h('button', { class: 'back-arrow', title: 'Back to Home', onClick: () => nav.home(profile.id) }, icon('back'), h('span', {}, 'Back')),
    h('div', { class: 'photo-loading' }, loader.el),
    h('div', { class: 'split-body photo-body' }, stage, panel)
  );

  function step(d) {
    const { prev, next } = neighbours(profile.id, item.id);
    const target = d > 0 ? next : prev;
    if (!target) return toast(d > 0 ? 'That was the last one 💛' : 'This is the first one');
    nav.open(profile.id, target.id);
  }

  const onKey = (ev) => {
    const k = ev.key.toLowerCase();
    if (k === 'escape') nav.home(profile.id);
    else if (k === 'arrowright') step(1);
    else if (k === 'arrowleft') step(-1);
  };
  window.addEventListener('keydown', onKey);

  /* music ducking while she reads */
  let readTimer = null;
  panel.addEventListener('pointerenter', () => duckPhotoMusic(true));
  panel.addEventListener('pointerleave', () => duckPhotoMusic(false));
  panel.addEventListener('focusin', () => duckPhotoMusic(true));

  let progress = 0;
  const fake = setInterval(() => {
    progress = Math.min(0.9, progress + 0.08);
    loader.progress(progress);
  }, 90);

  return {
    el,
    async begin() {
      const orientation = await resolveOrientation(item);
      el.classList.add(orientation === 'vertical' ? 'is-vertical' : 'is-horizontal');
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = () => {
          stage.append(h('div', { class: 'photo-fallback' }, 'This link could not be shown as a photo. Check it in the Admin Panel.'));
          resolve();
        };
        img.src = item.src || item.link;
      });
      clearInterval(fake);
      loader.progress(1);
      el.classList.add('ready');

      await startPhotoMusic();
      // She lands on the text first — hold the music back while she reads it,
      // then let it come back in.
      duckPhotoMusic(true);
      readTimer = setTimeout(() => duckPhotoMusic(false), 7000);
      el.focus();
    },
    destroy() {
      clearInterval(fake);
      clearTimeout(readTimer);
      window.removeEventListener('keydown', onKey);
      stopPhotoMusic();
    },
  };
}
