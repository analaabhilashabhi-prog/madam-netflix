/* Background music manager for Madam Netflix.
   Uses direct HTML5 Audio (assets/music/letter-bgm.mp3) for instant,
   seamless unmuted audio playback on user click/scroll, with YouTube iframe
   as fallback. */

import { LETTER_BGM } from './config.js';
import { createPlayer, loadYouTubeAPI } from './yt.js';

let audioElement = null;
let bgmPlayer = null;
let bgmContainer = null;
let bgmHost = null;
let isPlaying = false;
let updateCallback = null;

// Preload HTML5 audio element
function getAudioElement() {
  if (!audioElement) {
    audioElement = new Audio();
    audioElement.src = LETTER_BGM.src || 'assets/music/letter-bgm.mp3';
    audioElement.loop = true;
    audioElement.volume = (LETTER_BGM.volume || 80) / 100;
  }
  return audioElement;
}

export function startLetterBgm(onUpdate) {
  if (onUpdate) updateCallback = onUpdate;

  const audio = getAudioElement();
  audio.volume = (LETTER_BGM.volume || 80) / 100;
  
  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      isPlaying = true;
      updateCallback?.(true);
    }).catch(() => {
      // If browser blocked initial autoplay without gesture, unlock on first touch
      isPlaying = false;
      updateCallback?.(false);
      startYouTubeFallback();
    });
  }
}

export function unlockAudio() {
  const audio = getAudioElement();
  if (audio.paused) {
    audio.play().then(() => {
      isPlaying = true;
      updateCallback?.(true);
    }).catch(() => {
      startYouTubeFallback();
    });
  } else {
    isPlaying = true;
    updateCallback?.(true);
  }
}

async function startYouTubeFallback() {
  if (bgmPlayer) return;
  if (!LETTER_BGM || !LETTER_BGM.videoId) return;

  if (!bgmContainer || !document.body.contains(bgmContainer)) {
    bgmContainer = document.createElement('div');
    bgmContainer.id = 'bgm-container';
    bgmContainer.style.cssText = 'position:fixed; width:1px; height:1px; opacity:0.001; pointer-events:none; z-index:-1; left:-9999px; top:-9999px;';
    bgmHost = document.createElement('div');
    bgmContainer.appendChild(bgmHost);
    document.body.appendChild(bgmContainer);
  }

  try {
    bgmPlayer = await createPlayer(bgmHost, {
      videoId: LETTER_BGM.videoId,
      start: LETTER_BGM.start || 48,
      loop: true,
      muted: false,
    });
    if (bgmPlayer) {
      bgmPlayer.seek(LETTER_BGM.start || 48);
      bgmPlayer.volume(LETTER_BGM.volume || 80);
      bgmPlayer.unMute();
      bgmPlayer.play();
      isPlaying = true;
      updateCallback?.(true);
    }
  } catch (_) {}
}

export function toggleLetterBgm() {
  const audio = getAudioElement();
  if (isPlaying) {
    audio.pause();
    if (bgmPlayer) try { bgmPlayer.pause(); } catch (_) {}
    isPlaying = false;
    updateCallback?.(false);
    return false;
  } else {
    unlockAudio();
    return true;
  }
}

export function stopLetterBgm() {
  if (audioElement) {
    try {
      audioElement.pause();
      audioElement.currentTime = 0;
    } catch (_) {}
  }
  if (bgmPlayer) {
    try {
      bgmPlayer.pause();
      bgmPlayer.destroy();
    } catch (_) {}
    bgmPlayer = null;
  }
  isPlaying = false;
  updateCallback?.(false);
}

export function setBgmCallback(fn) {
  updateCallback = fn;
  if (updateCallback) updateCallback(isPlaying);
}

export function isLetterBgmPlaying() {
  return isPlaying;
}
