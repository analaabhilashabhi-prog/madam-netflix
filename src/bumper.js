/* Section 3.1 — the Netflix intro bumper.
   Fullscreen, no chrome, plays before EVERY video anywhere in the app (never
   before photos), buffers first behind the heart loader, then fades out into the
   target content with no hard cut. A mute/unmute toggle is available throughout. */

import { BUMPER } from './config.js';
import { createPlayer, bufferAhead } from './yt.js';
import { h, heartLoader, iconButton, icon, sleep, goFullscreen } from './ui.js';

let sound = { muted: false }; // remembered across bumpers

export function bumperMuted() {
  return sound.muted;
}

/* `vertical` plays the intro inside the same 9:16 frame the Short will use, in
   the same spot, so there is no jump when it hands over (4.10). */
export async function playBumper({ label = '', vertical = false } = {}) {
  if (!BUMPER || !BUMPER.id) return Promise.resolve();
  const host = h('div', { id: 'yt-bumper' });
  const loader = heartLoader('Getting this ready for you');
  const stage = h('div', { class: 'bumper-stage' }, h('div', { class: 'yt-frame' }, host));
  const overlay = h('div', { class: `bumper${vertical ? ' vertical' : ''}`, 'aria-label': 'intro' }, stage, h('div', { class: 'bumper-loading' }, loader.el));

  const muteBtn = iconButton(sound.muted ? 'mute' : 'volume', 'Mute / unmute', () => {
    sound.muted = !sound.muted;
    if (sound.muted) player?.mute();
    else player?.unMute();
    muteBtn.replaceChildren(icon(sound.muted ? 'mute' : 'volume'));
  }, 'bumper-mute');
  overlay.append(muteBtn);
  if (label) overlay.append(h('div', { class: 'bumper-label' }, label));

  /* The intro takes over the whole screen. The click that opened this journey
     is still counted as a live gesture here, so the request lands; if it does
     not, the overlay is fixed/inset-0 anyway and fills the window. */
  goFullscreen();

  document.body.append(overlay);
  requestAnimationFrame(() => overlay.classList.add('in'));

  let player = null;
  let finished = false;
  let watcher = null;
  let armed = false; // true once the *visible* pass has started — see below

  const done = new Promise((resolve) => {
    const finish = async (reason = 'ended') => {
      if (finished) return;
      finished = true;
      clearInterval(watcher);
      console.debug(`[madam] bumper ${reason} at ${(player?.time() || 0).toFixed(2)}s of ${(player?.duration() || 0).toFixed(2)}s`);
      // the last "ta-dum" has already landed — hold the final frame for a beat,
      // then fade out over the target content
      await sleep(260);
      overlay.classList.add('out');
      await sleep(700);
      player?.destroy();
      overlay.remove();
      resolve();
    };

    (async () => {
      try {
        player = await createPlayer(host, {
          videoId: BUMPER.id,
          muted: true,
          onStateChange: (e) => {
            /* The pre-buffer pass plays the clip muted, behind the loader. The
               intro is only a few seconds long, so it reaches ENDED *before*
               she has seen a single frame — which used to tear the whole
               bumper down on the spot. Only the visible pass may end it. */
            if (e.data === 0 && armed) finish(); // ENDED
          },
        });
        await bufferAhead(player, { targetSeconds: 6, timeout: 3000, onProgress: (p) => loader.progress(p) });
        overlay.classList.add('ready');
        try {
          if (!sound.muted) player.unMute();
        } catch (_) {}
        player.volume(100);
        armed = true;
        player.seek(0); // the buffering pass may have run it to the end
        player.play();

        /* Fullscreen wants a user gesture and unmuted audio wants one too. If
           we got here without one, the frame would just sit there frozen —
           drop to a muted intro rather than show her a still image. */
        setTimeout(() => {
          if (finished) return;
          const st = player.state ? player.state() : -1;
          if (st !== 1 && st !== 3 && (player.time() || 0) < 0.05) {
            player.mute();
            player.play();
          }
        }, 1200);

        /* Follow playhead and bail out if playback is genuinely stuck. */
        const startedAt = performance.now();
        let lastTime = 0;
        let stalledFor = 0;
        watcher = setInterval(() => {
          const dur = player.duration() || 0;
          const t = player.time() || 0;
          const st = player.state ? player.state() : -1;
          if (dur > 0 && t >= dur - 0.15) return finish('played to end'); // full intro
          if (t > lastTime + 0.01) {
            lastTime = t;
            stalledFor = 0;
          } else if (st === 1 || st === 3) {
            // Player is playing (1) or buffering (3) — not stalled!
            stalledFor = 0;
          } else if (t > 0.1) {
            stalledFor += 150;
          } else {
            stalledFor += 150;
          }
          if (stalledFor > 3500) return finish('stalled');
          if (performance.now() - startedAt > BUMPER.maxSeconds * 1000) finish('hard stop');
        }, 150);
      } catch (e) {
        console.error('[madam] ❌ Bumper video failed to load:', e);
        console.error('[madam] Check that BUMPER.id in config.js is a valid YouTube video ID');
        // Don't block the app — continue to profiles even if bumper fails
        finish('error');
      }
    })();
  });

  return done;
}
