/* Fullscreen horizontal video player screen.
   Same universal rules: highest quality, no native branding, back returns to home. */

import { createPlayer } from '../yt.js';
import { h, icon, iconButton, fmtTime, toast, renderDescription } from '../ui.js';
import { OUTRO_NOTES, BADGES, pick } from '../config.js';
import { neighbours } from '../store.js';

export function playerScreen(nav, { profile, item, autoplay = true }) {
  const host = h('div', { class: 'yt-host' });
  const shield = h('div', { class: 'click-shield' });

  const played = h('div', { class: 'scrub-played' });
  const buffered = h('div', { class: 'scrub-buffered' });
  const head = h('div', { class: 'scrub-head' });
  const bar = h('div', { class: 'scrub-bar' }, buffered, played, head);

  const curTime = h('span', {}, '0:00');
  const durTime = h('span', {}, '0:00');

  const playBtn = iconButton('play', 'Play / pause', () => togglePlay());
  const volIcon = iconButton('volume', 'Mute', () => toggleMute());
  const volRange = h('input', { type: 'range', min: '0', max: '100', value: '100', class: 'vol' });
  const capBtn = iconButton('captions', 'Closed captions', () => toggleCaptions());
  const speedBtn = h('button', { class: 'ibtn wide', title: 'Playback speed' }, icon('speed'), h('span', {}, '1x'));
  const autoBtn = h('button', { class: `ibtn toggle ${autoplay ? 'on' : ''}`, title: 'Autoplay next' }, 'Autoplay');
  const fsBtn = iconButton('fullscreen', 'Fullscreen', () => toggleFullscreen());

  const prevBtn = iconButton('prev', 'Previous video', () => {
    const { prev } = neighbours(profile.id, item.id);
    prev ? nav.open(profile.id, prev.id) : toast('This is the first one 💛');
  });
  const nextBtn = iconButton('next', 'Next video', () => goNext());

  const controls = h(
    'div',
    { class: 'player-bottom' },
    h('div', { class: 'scrub' }, bar),
    h('div', { class: 'controls' },
      h('div', { class: 'controls-left' },
        playBtn,
        iconButton('rewind', 'Rewind 10s', () => nudge(-10)),
        iconButton('forward', 'Forward 10s', () => nudge(10)),
        h('div', { class: 'vol-wrap' }, volIcon, volRange),
        h('div', { class: 'time-display' }, curTime, ' / ', durTime)
      ),
      h('div', { class: 'controls-right' },
        prevBtn,
        nextBtn,
        capBtn,
        speedBtn,
        autoBtn,
        fsBtn
      )
    )
  );

  const stage = h('div', { class: 'player-stage' }, h('div', { class: 'yt-frame' }, host), shield);

  const descriptionFormatted = renderDescription(item.description || '', false);

  const side = h(
    'div',
    { class: 'player-side' },
    h('div', { class: 'split-badge' }, pick(BADGES)),
    h('h1', { class: 'player-title brush' }, item.title || 'A memory'),
    h('div', { class: 'split-sub' }, `${profile.name} · Video · HD`),
    descriptionFormatted ? h('div', { class: 'player-desc-box' }, h('h2', { class: 'split-desc-head' }, 'DESCRIPTION'), h('p', { class: 'player-desc', html: descriptionFormatted })) : null
  );

  const el = h(
    'div',
    { class: 'player ready', tabindex: '0' },
    h('button', { class: 'back-arrow', title: 'Back to Home', onClick: () => nav.home(profile.id) }, icon('back'), h('span', {}, 'Back')),
    stage,
    side,
    controls
  );

  let player = null;
  let ticker = null;
  let idle = null;
  let dragging = false;
  let ready = false;
  let ended = false;
  let auto = autoplay;
  let captionsOn = false;
  let speedIdx = 2;
  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

  const setPlayIcon = (playing) => playBtn.replaceChildren(icon(playing ? 'pause' : 'play'));

  function togglePlay() {
    if (!player) return;
    if (player.state() === 1) {
      player.pause();
      setPlayIcon(false);
    } else {
      player.play();
      setPlayIcon(true);
    }
  }
  const nudge = (d) => player && player.seek(player.time() + d);

  function toggleMute() {
    if (!player) return;
    const m = player.isMuted();
    if (m) player.unMute();
    else player.mute();
    volIcon.replaceChildren(icon(m ? 'volume' : 'mute'));
  }
  function toggleCaptions() {
    captionsOn = !captionsOn;
    player?.captions(captionsOn);
    capBtn.classList.toggle('on', captionsOn);
    toast(captionsOn ? 'Captions on (if this video has any)' : 'Captions off');
  }
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.().catch(() => {});
  }
  function goNext() {
    const { next } = neighbours(profile.id, item.id);
    if (!next) return toast('That was the last one 💛');
    nav.open(profile.id, next.id);
  }

  speedBtn.addEventListener('click', () => {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    const r = SPEEDS[speedIdx];
    player?.rate(r);
    speedBtn.querySelector('span').textContent = `${r}x`;
  });
  autoBtn.addEventListener('click', () => {
    auto = !auto;
    autoBtn.classList.toggle('on', auto);
    toast(auto ? 'Autoplay on' : 'Autoplay off');
  });
  volRange.addEventListener('input', () => {
    const v = Number(volRange.value);
    player?.volume(v);
    if (v === 0) player?.mute();
    else player?.unMute();
    volIcon.replaceChildren(icon(v === 0 ? 'mute' : 'volume'));
  });

  const seekFromEvent = (ev) => {
    const rect = bar.getBoundingClientRect();
    const x = (ev.touches?.[0]?.clientX ?? ev.clientX) - rect.left;
    const k = Math.max(0, Math.min(1, x / rect.width));
    const d = player?.duration() || 0;
    played.style.width = `${k * 100}%`;
    head.style.left = `${k * 100}%`;
    return k * d;
  };
  bar.addEventListener('pointerdown', (ev) => {
    dragging = true;
    bar.setPointerCapture(ev.pointerId);
    player?.seek(seekFromEvent(ev));
  });
  bar.addEventListener('pointermove', (ev) => dragging && player?.seek(seekFromEvent(ev)));
  bar.addEventListener('pointerup', () => (dragging = false));

  shield.addEventListener('click', () => ready && togglePlay());
  shield.addEventListener('dblclick', toggleFullscreen);

  const wake = () => {
    el.classList.remove('idle');
    clearTimeout(idle);
    idle = setTimeout(() => player?.state() === 1 && el.classList.add('idle'), 3400);
  };
  el.addEventListener('mousemove', wake);
  el.addEventListener('touchstart', wake);

  const onKey = (ev) => {
    if (ev.target.matches('input,textarea')) return;
    const k = ev.key.toLowerCase();
    if (k === ' ' || k === 'k') { ev.preventDefault(); togglePlay(); }
    else if (k === 'arrowright') nudge(10);
    else if (k === 'arrowleft') nudge(-10);
    else if (k === 'f') toggleFullscreen();
    else if (k === 'm') toggleMute();
    else if (k === 'escape' && !document.fullscreenElement) nav.home(profile.id);
    wake();
  };
  window.addEventListener('keydown', onKey);

  function showOutro() {
    if (ended) return;
    ended = true;
    const { next } = neighbours(profile.id, item.id);
    const note = h(
      'div',
      { class: 'outro' },
      h('div', { class: 'outro-card' },
        h('div', { class: 'outro-kicker' }, 'A note from Abhi'),
        h('p', { class: 'outro-note brush' }, pick(OUTRO_NOTES)),
        h('div', { class: 'outro-actions' },
          next && h('button', { class: 'btn-white', onClick: () => nav.open(profile.id, next.id) }, icon('play'), 'Play next'),
          h('button', { class: 'btn-ghost', onClick: () => nav.home(profile.id) }, 'Back to Home'),
          h('button', { class: 'btn-ghost', onClick: () => { note.remove(); ended = false; player.seek(0); player.play(); } }, 'Watch again')
        )
      )
    );
    el.append(note);
    requestAnimationFrame(() => note.classList.add('in'));
  }

  const bootReady = (async () => {
    if (!item || !item.ytId) return null;
    player = await createPlayer(host, {
      videoId: item.ytId,
      muted: false,
      onStateChange: (e) => {
        if (e.data === 1) { setPlayIcon(true); wake(); }
        if (e.data === 2) { setPlayIcon(false); el.classList.remove('idle'); }
        if (e.data === 0) showOutro();
      },
    });
    ready = true;
    return player;
  })();

  function startTicker() {
    ticker = setInterval(() => {
      if (!player || dragging) return;
      const d = player.duration() || 0;
      const t = player.time() || 0;
      if (d > 0) {
        played.style.width = `${(t / d) * 100}%`;
        head.style.left = `${(t / d) * 100}%`;
        buffered.style.width = `${player.buffered() * 100}%`;
        curTime.textContent = fmtTime(t);
        durTime.textContent = fmtTime(d);
      }
    }, 200);
  }

  return {
    el,
    async begin() {
      el.classList.add('ready');
      await bootReady;
      player?.mute();
      player?.play();
      setPlayIcon(true);
      wake();
      startTicker();

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

      el.focus();
    },
    destroy() {
      clearInterval(ticker);
      clearTimeout(idle);
      window.removeEventListener('keydown', onKey);
      player?.destroy();
    },
  };
}
