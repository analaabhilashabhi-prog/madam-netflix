/* 4.1 — Landing page. One message, one button. */

import { h, icon, goFullscreen } from '../ui.js';

export function landingScreen(nav) {
  /* Take the whole screen from here on. On a laptop the browser's own chrome
     leaves a viewport wider than 16:9, so a 16:9 video has to either sit in
     black bands or lose its edges to a crop. Fullscreen makes the viewport match
     the screen, and on a 16:9 laptop the video then fits exactly — nothing
     cropped, nothing banded. It has to hang off her click; the browser refuses
     a fullscreen request that isn't tied to a gesture. */
  const enter = () => {
    goFullscreen();
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
