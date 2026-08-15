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
    try { audioElement.load(); } catch (_) {}
  }
  return audioElement;
}

// Start preloading immediately when script loads
if (typeof window !== 'undefined') {
  try { getAudioElement(); } catch (_) {}
}

export function startLetterBgm() {
  const audio = getAudioElement();
  if (!audio) return;
  audio.volume = (LETTER_BGM.volume || 85) / 100;
  audio.muted = false;

  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      isPlaying = true;
    }).catch((err) => {
      console.warn('[madam] BGM autoplay deferred until user interaction:', err.message);
      isPlaying = false;
    });
  }
}

export function unlockAudio() {
  const audio = getAudioElement();
  if (!audio) return;
  audio.muted = false;
  audio.volume = (LETTER_BGM.volume || 85) / 100;
  
  if (audio.paused) {
    audio.play().then(() => {
      isPlaying = true;
    }).catch(() => {});
  } else {
    isPlaying = true;
  }
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
