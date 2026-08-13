/* 4.10 — Short-form (vertical / reels-style) video player.
   Split screen: 9:16 video frame on one side, text panel on the other.
   Back returns to the profile Home. */

import { createPlayer } from '../yt.js';
import { h, icon, iconButton, fmtTime, toast, renderDescription } from '../ui.js';
import { OUTRO_NOTES, BADGES, pick } from '../config.js';
import { neighbours } from '../store.js';

export function shortsScreen(nav, { profile, item, autoplay = true }) {
  const host = h('div', { class: 'yt-host' });
  const shield = h('div', { class: 'click-shield' });

  const played = h('div', { class: 'scrub-played' });
  const buffered = h('div', { class: 'scrub-buffered' });
  const headEl = h('div', { class: 'scrub-head' });
  const bar = h('div', { class: 'scrub-bar' }, buffered, played, headEl);
  const remaining = h('div', { class: 'scrub-time' }, '0:00');

  const playBtn = iconButton('play', 'Play / pause', () => togglePlay());
  const volIcon = iconButton('volume', 'Mute', () => toggleMute());
  const speedBtn = h('button', { class: 'ibtn wide', title: 'Playback speed' }, icon('speed'), h('span', {}, '1x'));
  const fsBtn = iconButton('fullscreen', 'Fullscreen', () => (document.fullscreenElement ? document.exitFullscreen() : frame.requestFullscreen?.()));
  const prevBtn = iconButton('prev', 'Previous', () => {
    const { prev } = neighbours(profile.id, item.id);
    prev ? nav.open(profile.id, prev.id) : toast('This is the first one 💛');
  });
  const nextBtn = iconButton('next', 'Next', () => {
    const { next } = neighbours(profile.id, item.id);
    next ? nav.open(profile.id, next.id) : toast('That was the last one 💛');
  });

  const frame = h(
    'div',
    { class: 'vframe' },
    h('div', { class: 'vframe-stage' }, h('div', { class: 'yt-frame' }, host), shield),
    h('div', { class: 'vframe-controls' },
      h('div', { class: 'scrub' }, bar, remaining),
      h('div', { class: 'controls compact' },
        h('div', { class: 'controls-left' }, playBtn, iconButton('rewind', 'Rewind 10s', () => nudge(-10)), iconButton('forward', 'Forward 10s', () => nudge(10)), volIcon),
        h('div', { class: 'controls-right' }, prevBtn, nextBtn, speedBtn, fsBtn)
      )
    )
  );

  const panel = h(
    'div',
    { class: 'split-panel' },
    h('div', { class: 'split-badge' }, pick(BADGES)),
    h('h1', { class: 'split-title brush' }, item.title || 'A little moment'),
    h('div', { class: 'split-sub' }, `${profile.name} · Short · HD`),
    h('div', { class: 'split-block' },
      h('h2', { class: 'split-desc-head' }, 'Description'),
      h('p', { class: 'split-desc', html: renderDescription(item.description || 'Short, but I kept it. That should tell you something.', true) })),
    h('div', { class: 'split-hint' }, 'Space to pause · ← → to skip · Esc to go back')
  );

  const el = h(
    'div',
    { class: 'split-screen ready', tabindex: '0' },
    h('button', { class: 'back-arrow', title: 'Back to Home', onClick: () => nav.home(profile.id) }, icon('back'), h('span', {}, 'Back')),
    h('div', { class: 'split-body' }, panel, frame)
  );

  let player = null;
  let ticker = null;
  let dragging = false;
  let ended = false;
  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  let speedIdx = 2;

  const setPlayIcon = (p) => playBtn.replaceChildren(icon(p ? 'pause' : 'play'));
  function togglePlay() {
    if (!player) return;
    player.state() === 1 ? player.pause() : player.play();
  }
  const nudge = (d) => player?.seek(player.time() + d);
  function toggleMute() {
    if (!player) return;
    const m = player.isMuted();
    m ? player.unMute() : player.mute();
    volIcon.replaceChildren(icon(m ? 'volume' : 'mute'));
  }
  speedBtn.addEventListener('click', () => {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    player?.rate(SPEEDS[speedIdx]);
    speedBtn.querySelector('span').textContent = `${SPEEDS[speedIdx]}x`;
  });

  const seekFromEvent = (ev) => {
    const rect = bar.getBoundingClientRect();
    const k = Math.max(0, Math.min(1, ((ev.touches?.[0]?.clientX ?? ev.clientX) - rect.left) / rect.width));
    played.style.width = `${k * 100}%`;
    headEl.style.left = `${k * 100}%`;
    return k * (player?.duration() || 0);
  };
  bar.addEventListener('pointerdown', (ev) => { dragging = true; bar.setPointerCapture(ev.pointerId); player?.seek(seekFromEvent(ev)); });
  bar.addEventListener('pointermove', (ev) => dragging && player?.seek(seekFromEvent(ev)));
  bar.addEventListener('pointerup', () => (dragging = false));
  shield.addEventListener('click', () => togglePlay());

  const onKey = (ev) => {
    const k = ev.key.toLowerCase();
    if (k === ' ') { ev.preventDefault(); togglePlay(); }
    else if (k === 'arrowright') nudge(10);
    else if (k === 'arrowleft') nudge(-10);
    else if (k === 'm') toggleMute();
    else if (k === 'escape' && !document.fullscreenElement) nav.home(profile.id);
  };
  window.addEventListener('keydown', onKey);

  function showOutro() {
    if (ended) return;
    ended = true;
    const { next } = neighbours(profile.id, item.id);
    const note = h('div', { class: 'outro' },
      h('div', { class: 'outro-card' },
        h('div', { class: 'outro-kicker' }, 'A note from Abhi'),
        h('p', { class: 'outro-note brush' }, pick(OUTRO_NOTES)),
        h('div', { class: 'outro-actions' },
          next && h('button', { class: 'btn-white', onClick: () => nav.open(profile.id, next.id) }, icon('play'), 'Play next'),
          h('button', { class: 'btn-ghost', onClick: () => nav.home(profile.id) }, 'Back to Home'),
          h('button', { class: 'btn-ghost', onClick: () => { note.remove(); ended = false; player.seek(0); player.play(); } }, 'Watch again')
        )));
    el.append(note);
    requestAnimationFrame(() => note.classList.add('in'));
  }

  const bootReady = (async () => {
    if (!item || !item.ytId) return null;
    player = await createPlayer(host, {
      videoId: item.ytId,
      muted: false,
      onStateChange: (e) => {
        if (e.data === 1) setPlayIcon(true);
        if (e.data === 2) setPlayIcon(false);
        if (e.data === 0) showOutro();
      },
    });
    return player;
  })();

  return {
    el,
    async begin() {
      el.classList.add('ready');
      await bootReady;
      player?.mute();
      player?.play();
      setPlayIcon(true);
      let tries = 0;
      const sound = setInterval(() => {
        if (!player) return clearInterval(sound);
        if (player.state() === 1) {
          player.unMute();
          player.volume(100);
          clearInterval(sound);
        } else if (tries++ < 25) {
          player.play();
        } else {
          clearInterval(sound);
        }
      }, 200);
      ticker = setInterval(() => {
        if (!player || dragging) return;
        const d = player.duration() || 0;
        const t = player.time() || 0;
        if (d > 0) {
          played.style.width = `${(t / d) * 100}%`;
          headEl.style.left = `${(t / d) * 100}%`;
          buffered.style.width = `${player.buffered() * 100}%`;
          remaining.textContent = fmtTime(d - t);
        }
      }, 200);
      el.focus();
    },
    destroy() {
      clearInterval(ticker);
      window.removeEventListener('keydown', onKey);
      player?.destroy();
    },
  };
}
