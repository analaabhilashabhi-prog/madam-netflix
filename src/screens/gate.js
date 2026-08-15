/* The front door — shown only when the site is deployed somewhere reachable and
   SITE_PASSPHRASE is set. Locally it never appears at all.

   Every video in here is an unlisted YouTube link, which means the link is the
   secret. This screen is what keeps the whole library from being readable by
   anyone who happens to find the address. */

import { h, sleep } from '../ui.js';
import { enterSite } from '../store.js';
import { startLetterBgm } from '../bgm.js';

export function gateScreen(onUnlocked) {
  const input = h('input', {
    class: 'gate-input',
    type: 'password',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: 'our word',
    'aria-label': 'Passphrase',
  });

  const msg = h('div', { class: 'gate-msg' }, 'Only for you 💛');
  const button = h('button', { class: 'btn-white big', type: 'submit' }, 'Open');

  const card = h(
    'form',
    { class: 'gate-card', onSubmit: submit },
    h('div', { class: 'wordmark gate-mark' }, 'MADAM'),
    h('h1', { class: 'gate-title' }, 'This one is only yours.'),
    msg,
    input,
    button
  );

  const el = h('div', { class: 'gate' }, card);

  let busy = false;

  async function submit(ev) {
    ev.preventDefault();
    if (busy) return;
    const value = input.value.trim();
    if (!value) return;

    busy = true;
    button.disabled = true;
    msg.textContent = 'Opening…';

    const ok = await enterSite(value);
    if (ok) {
      msg.textContent = 'Come in 💛';
      startLetterBgm();
      await sleep(500);
      onUnlocked();
      return;
    }

    card.classList.add('shake');
    msg.textContent = 'That’s not it. Try again.';
    input.value = '';
    await sleep(600);
    card.classList.remove('shake');
    busy = false;
    button.disabled = false;
    input.focus();
  }

  return {
    el,
    begin() {
      setTimeout(() => input.focus(), 400);
    },
  };
}
