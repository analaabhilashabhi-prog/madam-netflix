/* Background music manager for Madam Netflix.
   Ensures audio starts seamlessly on user interaction (landing click / scroll)
   starting at timestamp (48s). */

import { LETTER_BGM } from './config.js';
import { createPlayer, loadYouTubeAPI } from './yt.js';

let bgmPlayer = null;
let bgmContainer = null;
let bgmHost = null;
let isPlaying = false;
let updateCallback = null;

// Pre-load YouTube API in background as soon as module loads
loadYouTubeAPI();

function ensureContainer() {
  if (!bgmContainer || !document.body.contains(bgmContainer)) {
    bgmContainer = document.createElement('div');
    bgmContainer.id = 'bgm-container';
    bgmContainer.style.cssText = 'position:fixed; width:1px; height:1px; opacity:0.001; pointer-events:none; z-index:-1; left:-9999px; top:-9999px;';
    bgmHost = document.createElement('div');
    bgmContainer.appendChild(bgmHost);
    document.body.appendChild(bgmContainer);
  }
}

export async function startLetterBgm(onUpdate) {
  if (onUpdate) updateCallback = onUpdate;
  ensureContainer();

  if (!LETTER_BGM || !LETTER_BGM.videoId) return;

  const startSecs = LETTER_BGM.start || 48;

  if (bgmPlayer) {
    try {
      bgmPlayer.seek(startSecs);
      bgmPlayer.volume(LETTER_BGM.volume || 80);
      bgmPlayer.unMute();
      bgmPlayer.play();
      isPlaying = true;
      updateCallback?.(true);
      return;
    } catch (_) {}
  }

  try {
    bgmPlayer = await createPlayer(bgmHost, {
      videoId: LETTER_BGM.videoId,
      start: startSecs,
      loop: true,
      muted: false,
    });
    if (bgmPlayer) {
      bgmPlayer.seek(startSecs);
      bgmPlayer.volume(LETTER_BGM.volume || 80);
      bgmPlayer.unMute();
      bgmPlayer.play();
      isPlaying = true;
      updateCallback?.(true);
    }
  } catch (err) {
    console.warn('[madam] Could not start letter BGM:', err);
  }
}

export function unlockAudio() {
  if (bgmPlayer) {
    try {
      const startSecs = LETTER_BGM.start || 48;
      if (bgmPlayer.time() < 5) {
        bgmPlayer.seek(startSecs);
      }
      bgmPlayer.unMute();
      bgmPlayer.play();
      isPlaying = true;
      updateCallback?.(true);
    } catch (_) {}
  }
}

export function toggleLetterBgm() {
  if (!bgmPlayer) return false;
  if (isPlaying) {
    try { bgmPlayer.pause(); } catch (_) {}
    isPlaying = false;
    updateCallback?.(false);
    return false;
  } else {
    unlockAudio();
    isPlaying = true;
    updateCallback?.(true);
    return true;
  }
}

export function stopLetterBgm() {
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
