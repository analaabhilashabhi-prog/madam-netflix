/* Background music manager for Madam Netflix.
   Instant HTML5 Audio preloading and continuous playback. */

import { LETTER_BGM } from './config.js';

let audioElement = null;
let isPlaying = false;

// Pre-create and preload audio element as soon as app loads
export function getAudioElement() {
  if (!audioElement) {
    if (typeof document !== 'undefined') {
      let el = document.getElementById('madam-letter-audio');
      if (!el) {
        el = document.createElement('audio');
        el.id = 'madam-letter-audio';
        el.src = LETTER_BGM.src || 'assets/music/letter-bgm.mp3';
        el.preload = 'auto';
        el.loop = true;
        el.setAttribute('playsinline', '');
        el.setAttribute('webkit-playsinline', '');
        el.style.display = 'none';
        if (document.body) {
          document.body.appendChild(el);
        } else {
          document.addEventListener('DOMContentLoaded', () => document.body.appendChild(el));
        }
      }
      audioElement = el;
    } else {
      audioElement = new Audio(LETTER_BGM.src || 'assets/music/letter-bgm.mp3');
    }
    audioElement.volume = (LETTER_BGM.volume || 85) / 100;
    // keep the flag honest even if the browser pauses us on its own
    audioElement.addEventListener('play', () => { isPlaying = true; });
    audioElement.addEventListener('pause', () => { isPlaying = false; });
    try { audioElement.load(); } catch (_) {}
  }
  return audioElement;
}

// Start preloading immediately when script loads
if (typeof window !== 'undefined') {
  try { getAudioElement(); } catch (_) {}
}

/* Returns whether the music is actually audible now.
   A browser will not play sound until the page has had a real user gesture, and
   it refuses silently — so the caller needs to know, and can ask for a tap. */
export function startLetterBgm() {
  const audio = getAudioElement();
  if (!audio) return Promise.resolve(false);
  if (isPlaying && !audio.paused) return Promise.resolve(true);

  audio.volume = (LETTER_BGM.volume || 85) / 100;
  audio.muted = false;

  const playPromise = audio.play();
  if (playPromise === undefined) {
    isPlaying = !audio.paused;
    return Promise.resolve(isPlaying);
  }
  return playPromise
    .then(() => {
      isPlaying = true;
      return true;
    })
    .catch((err) => {
      console.warn('[madam] BGM is waiting for a tap:', err.message);
      isPlaying = false;
      return false;
    });
}

export function unlockAudio() {
  const audio = getAudioElement();
  if (!audio) return Promise.resolve(false);
  // cheap no-op — this is called from scroll handlers
  if (isPlaying && !audio.paused) return Promise.resolve(true);
  return startLetterBgm();
}

export function stopLetterBgm() {
  if (audioElement) {
    try {
      audioElement.pause();
      audioElement.currentTime = 0;
    } catch (_) {}
  }
  isPlaying = false;
}

export function toggleLetterBgm() {
  const audio = getAudioElement();
  if (!audio) return;
  if (isPlaying) {
    audio.pause();
    isPlaying = false;
  } else {
    audio.play().catch(() => {});
    isPlaying = true;
  }
}

export function isLetterBgmPlaying() {
  return isPlaying;
}
