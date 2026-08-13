/* Section 4.11 — soft background music for the photo viewer.
   Uses PHOTO_MUSIC.src if that file exists; otherwise falls back to a gentle
   generated piano/pad loop so the behaviour is testable before you hand me a
   real track. Ducks to silence while she is reading the title/description and
   fades back in afterwards. */

import { PHOTO_MUSIC } from './config.js';

let audio = null;
let generated = null;
let ducked = false;
let active = false;

export async function startPhotoMusic() {
  active = true;
  if (await tryFile()) return;
  startGenerated();
}

export function stopPhotoMusic() {
  active = false;
  if (audio) {
    fadeAudio(audio, 0, 500, () => {
      audio.pause();
      audio.currentTime = 0;
    });
  }
  if (generated) {
    generated.stop();
    generated = null;
  }
}

/* Called when she starts / stops reading the text panel. */
export function duckPhotoMusic(on) {
  if (!active || ducked === on) return;
  ducked = on;
  const target = on ? 0 : PHOTO_MUSIC.volume;
  if (audio) fadeAudio(audio, target, on ? 380 : 900);
  if (generated) generated.setVolume(target, on ? 0.4 : 1.1);
}

async function tryFile() {
  try {
    const res = await fetch(PHOTO_MUSIC.src, { method: 'HEAD' });
    if (!res.ok) return false;
    if (!audio) {
      audio = new Audio(PHOTO_MUSIC.src);
      audio.loop = true;
    }
    audio.volume = 0;
    await audio.play();
    fadeAudio(audio, PHOTO_MUSIC.volume, 1200);
    return true;
  } catch (_) {
    return false;
  }
}

function fadeAudio(el, to, ms, done) {
  const from = el.volume;
  const t0 = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k < 1) requestAnimationFrame(step);
    else done?.();
  };
  requestAnimationFrame(step);
}

/* ---- generated fallback: slow major-9th arpeggio over a warm pad -------- */
function startGenerated() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  fadeParam(ctx, master.gain, PHOTO_MUSIC.volume, 2.5);

  const pad = ctx.createGain();
  pad.gain.value = 0.12;
  pad.connect(master);
  [130.81, 196.0, 246.94].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = 0.25 - i * 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07 + i * 0.03;
    const lg = ctx.createGain();
    lg.gain.value = 0.1;
    lfo.connect(lg).connect(g.gain);
    o.connect(g).connect(pad);
    o.start();
    lfo.start();
  });

  const notes = [523.25, 659.25, 783.99, 987.77, 783.99, 659.25];
  let i = 0;
  const timer = setInterval(() => {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = notes[i++ % notes.length];
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 2.5);
  }, 1650);

  generated = {
    stop() {
      clearInterval(timer);
      fadeParam(ctx, master.gain, 0, 0.7);
      setTimeout(() => ctx.close().catch(() => {}), 900);
    },
    setVolume(v, secs) {
      fadeParam(ctx, master.gain, v, secs);
    },
  };
}

function fadeParam(ctx, param, to, secs) {
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(Math.max(0.0001, param.value), now);
  param.linearRampToValueAtTime(Math.max(0.0001, to), now + secs);
}
