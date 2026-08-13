/* 4.3 — Profile selection, and 4.4 — the Secret profile PIN lock. */

import { enabledProfiles, PIN } from '../config.js';
import { h, icon, sleep, goFullscreen } from '../ui.js';

export function profilesScreen(nav) {
  const grid = h('div', { class: 'profile-grid' });

  for (const p of enabledProfiles()) {
    const tile = h(
      'button',
      { class: 'profile-tile', onClick: () => choose(p) },
      h('div', { class: 'profile-avatar', style: { background: p.tint } },
        p.photo ? h('img', { src: p.photo, alt: p.name }) : h('span', {}, p.initial)),
      h('div', { class: 'profile-name' }, p.name),
      h('div', { class: 'profile-tag' }, p.locked ? '🔒 Locked' : p.tagline)
    );
    grid.append(tile);
  }

  const el = h(
    'div',
    { class: 'profiles' },
    h('div', { class: 'topbar' }, h('div', { class: 'wordmark' }, 'MADAM')),
    h('div', { class: 'profiles-inner' },
      h('h2', { class: 'profiles-title' }, "Who's watching?"),
      grid,
      h('p', { class: 'profiles-hint' }, 'Pick one. They all lead back to you.')
    )
  );

  function choose(p) {
    /* Second chance at fullscreen. If she reloaded straight onto this screen she
       never pressed the landing button, and the browser only grants fullscreen
       from a gesture — this tile tap is one. No-ops if already fullscreen. */
    goFullscreen();
    if (!p.locked) return nav.home(p.id);
    openPin(el, () => nav.home(p.id));
  }

  return { el };
}

/* ---- PIN gate ---------------------------------------------------------- */

function openPin(host, onSuccess) {
  let entered = '';
  const boxes = Array.from({ length: 4 }, () => h('div', { class: 'pin-box' }));
  const row = h('div', { class: 'pin-row' }, boxes);
  const msg = h('div', { class: 'pin-msg' }, 'This profile is locked.');

  const keypad = h('div', { class: 'keypad' });
  for (const key of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del']) {
    keypad.append(
      h('button', { class: `key ${key.length > 1 ? 'key-wide' : ''}`, onClick: () => press(key) },
        key === 'del' ? '⌫' : key === 'clear' ? 'Clear' : key)
    );
  }

  const overlay = h('div', { class: 'pin-overlay' },
    h('div', { class: 'pin-card' },
      h('div', { class: 'pin-lock' }, '🔒'),
      h('h3', {}, 'Enter your PIN'),
      msg, row, keypad,
      h('button', { class: 'btn-ghost', onClick: close }, icon('back'), 'Back to profiles')
    ));

  host.append(overlay);
  requestAnimationFrame(() => overlay.classList.add('in'));
  window.addEventListener('keydown', onKey);

  function paint() {
    boxes.forEach((b, i) => {
      b.classList.toggle('filled', i < entered.length);
      b.textContent = i < entered.length ? '•' : '';
    });
  }

  function press(key) {
    if (key === 'del') entered = entered.slice(0, -1);
    else if (key === 'clear') entered = '';
    else if (/^\d$/.test(key) && entered.length < 4) entered += key;
    paint();
    if (entered.length === 4) check();
  }

  async function check() {
    if (entered === PIN) {
      overlay.classList.add('ok');
      msg.textContent = 'Welcome back 💛';
      await sleep(650);
      close();
      onSuccess();
    } else {
      overlay.querySelector('.pin-card').classList.add('shake');
      msg.textContent = 'That’s not it. Try again.';
      await sleep(600);
      overlay.querySelector('.pin-card').classList.remove('shake');
      entered = '';
      paint();
    }
  }

  function onKey(ev) {
    if (/^\d$/.test(ev.key)) press(ev.key);
    else if (ev.key === 'Backspace') press('del');
    else if (ev.key === 'Escape') close();
  }

  function close() {
    window.removeEventListener('keydown', onKey);
    overlay.classList.remove('in');
    setTimeout(() => overlay.remove(), 350);
  }
}
