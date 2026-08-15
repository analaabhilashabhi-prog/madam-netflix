/* The music underneath the browsing part of the app.

   It plays on the profile picker and on Home, loops forever, and gets out of
   the way the instant a video or a photo starts — the video's own audio should
   own the room, not compete with a bed of music. When she comes back, it
   resumes.

   The source is a YouTube link, so this is a hidden IFrame player rather than
   an audio file: nothing to host, and it uses the same yt.js wrapper the
   bumper and the player already go through. */

import { BROWSE_BGM } from './config.js';
import { createPlayer } from './yt.js';

let player = null;
let host = null;
let booting = null;
let wanted = false; // what we want to be true, regardless of what YouTube is doing

function mountHost() {
  if (host) return host;
  host = document.createElement('div');
  host.id = 'browse-bgm';
  host.setAttribute('aria-hidden', 'true');
  const frame = document.createElement('div');
  host.append(frame);
  document.body.append(host);
  return frame;
}

/* Kept deliberately inside the viewport. An iframe parked far off-screen can
   be throttled or refused outright, and then the music simply never starts. */
async function ensurePlayer() {
  if (player) return player;
  if (booting) return booting;

  booting = (async () => {
    const frame = mountHost();
    try {
      player = await createPlayer(frame, {
        videoId: BROWSE_BGM.videoId,
        muted: false,
        loop: true, // yt.js also re-seeks on ENDED, so it never runs out
        start: BROWSE_BGM.start || 0,
      });
      player.volume(BROWSE_BGM.volume ?? 30);
      return player;
    } catch (err) {
      console.warn('[madam] browse music could not start:', err?.message || err);
      return null;
    } finally {
      booting = null;
    }
  })();

  return booting;
}

export async function startBrowseBgm() {
  wanted = true;
  const p = await ensurePlayer();
  if (!p || !wanted) return; // she may have opened a video while this was loading
  try {
    p.volume(BROWSE_BGM.volume ?? 30);
    p.unMute();
    p.play();
  } catch (_) {}
}

/* Paused, not destroyed — rebuilding the player on every video would mean
   re-buffering the track each time she comes back to Home. */
export function pauseBrowseBgm() {
  wanted = false;
  try { player?.pause(); } catch (_) {}
}

export function stopBrowseBgm() {
  wanted = false;
  try { player?.destroy(); } catch (_) {}
  player = null;
  host?.remove();
  host = null;
}
