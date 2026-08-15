/* 4.1 — Landing page. One message, one button. */

import { h, icon, goFullscreen } from '../ui.js';
import { startLetterBgm } from '../bgm.js';

export function landingScreen(nav) {
  const enter = () => {
    goFullscreen();
    startLetterBgm();
    nav.letter();
  };
  const el = h(
    'div',
    { class: 'landing' },
    h('div', { class: 'landing-glow' }),
    h('div', { class: 'hearts', html: Array.from({ length: 14 }, (_, i) => `<span style="--i:${i}">💛</span>`).join('') }),
    h(
      'div',
      { class: 'landing-inner' },
      h('div', { class: 'wordmark big' }, 'MADAM'),
      h('h1', { class: 'landing-title brush' }, 'Happy Birthday Madam G 🎂'),
      h('p', { class: 'landing-sub' }, 'Wanna see our journey?'),
      h('button', { class: 'btn-white big', onClick: enter }, icon('play'), 'Yes, show me'),
      h('div', { class: 'landing-foot' }, 'Made only for you, by Abhi.')
    ),
    // private door for Abhi — she has no reason to ever click a full stop
    h('button', { class: 'admin-door', title: 'Admin', onClick: () => nav.admin() }, '.')
  );
  return { el };
}
