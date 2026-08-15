/* Background music manager for Madam Netflix.
   Instant HTML5 Audio preloading and continuous playback. */

import { LETTER_BGM } from './config.js';

let audioElement = null;
let isPlaying = false;

// Pre-create and preload audio element as soon as app loads
function getAudioElement() {
  if (!audioElement) {
    audioElement = new Audio();
    audioElement.src = LETTER_BGM.src || 'assets/music/letter-bgm.mp3';
    audioElement.preload = 'auto';
    audioElement.loop = true;
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
  audio.volume = (LETTER_BGM.volume || 85) / 100;
  audio.muted = false;

  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      isPlaying = true;
    }).catch((err) => {
      console.warn('[madam] BGM initial play deferred until user touch:', err.message);
      isPlaying = false;
    });
  }
}

export function unlockAudio() {
  const audio = getAudioElement();
  audio.muted = false;
  audio.volume = (LETTER_BGM.volume || 85) / 100;
  
  if (audio.paused) {
    audio.play().then(() => {
      isPlaying = true;
    }).catch((err) => {
      console.warn('[madam] BGM play unlock failed:', err.message);
    });
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
