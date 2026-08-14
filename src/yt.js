/* YouTube IFrame wrapper.
   Implementation path 1 from Section 11: native controls fully disabled, a
   transparent click-shield on top so no YouTube element is ever clickable, and
   our own control layer drawn over it (Section 3.4).
   Also enforces highest available quality (3.2) and buffers before play (3.5). */

let apiPromise = null;

export function loadYouTubeAPI() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT && window.YT.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev();
      resolve(window.YT);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    document.head.appendChild(s);
  });
  return apiPromise;
}

const QUALITY_ORDER = ['highres', 'hd2160', 'hd1440', 'hd1080', 'hd720', 'large'];

function forceBestQuality(player) {
  try {
    if (typeof player?.getAvailableQualityLevels === 'function' && typeof player?.setPlaybackQuality === 'function') {
      const levels = player.getAvailableQualityLevels() || [];
      const best = QUALITY_ORDER.find((q) => levels.includes(q)) || 'hd1080';
      player.setPlaybackQuality(best);
    } else if (typeof player?.setPlaybackQuality === 'function') {
      player.setPlaybackQuality('hd1080');
    }
  } catch (_) {}
}

/* Section 3.5 — buffer the video before she ever sees it.
   Plays muted and hidden, watches the loaded fraction, then rewinds and hands
   back a player that starts instantly and doesn't stutter. */
export function bufferAhead(player, { targetSeconds = 25, timeout = 12000, onProgress } = {}) {
  return new Promise((resolve) => {
    const started = performance.now();
    player.mute();
    player.play();
    const tick = setInterval(() => {
      forceBestQuality(player.raw || player);
      const dur = player.duration() || 0;
      const frac = player.buffered() || 0;
      const secs = dur * frac;
      // Never wait for more buffer than the clip actually holds — the intro
      // bumper is only a few seconds long and would otherwise sit out the
      // whole timeout waiting for seconds that don't exist.
      const need = dur > 0 ? Math.min(targetSeconds, dur, Math.max(6, dur * 0.45)) : targetSeconds;
      const pct = need > 0 ? Math.min(1, secs / need) : 0;
      onProgress?.(Math.max(pct, ((performance.now() - started) / timeout) * 0.9));
      const done = (dur > 0 && secs >= need) || performance.now() - started > timeout;
      if (done) {
        clearInterval(tick);
        player.pause();
        player.seek(0);
        onProgress?.(1);
        resolve();
      }
    }, 100);
  });
}

/* Creates a player inside `host` (an element that gets replaced by the iframe). */
export async function createPlayer(host, opts = {}) {
  const YT = await loadYouTubeAPI();
  const {
    videoId,
    muted = false,
    loop = false,
    start = 0,
    onStateChange,
    onReady,
    onError,
  } = opts;

  return new Promise((resolve) => {
    let settled = false;
    const player = new YT.Player(host, {
      videoId,
      playerVars: {
        autoplay: 0,
        controls: 0,          // 3.3 — no native control bar
        modestbranding: 1,
        rel: 0,               // no related videos overlay
        iv_load_policy: 3,    // no annotations
        disablekb: 1,         // our own keyboard layer
        fs: 0,
        playsinline: 1,
        enablejsapi: 1,
        loop: loop ? 1 : 0,
        playlist: loop ? videoId : undefined,
        start: start || undefined,
      },
      events: {
        onReady: (e) => {
          if (muted) e.target.mute();
          else e.target.unMute();
          forceBestQuality(e.target);
          onReady?.(e);
          if (!settled) {
            settled = true;
            resolve(wrap(e.target));
          }
        },
        onPlaybackQualityChange: (e) => forceBestQuality(e.target),
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.PLAYING) forceBestQuality(e.target);
          if (loop && e.data === YT.PlayerState.ENDED) {
            e.target.seekTo(0, true);
            e.target.playVideo();
          }
          onStateChange?.(e);
        },
        onError: (e) => {
          console.warn('[madam] YouTube player error code:', e?.data);
          onError?.(e);
          if (!settled) {
            settled = true;
            resolve(wrap(player));
          }
        },
      },
    });
  });
}

function wrap(player) {
  return {
    raw: player,
    el: () => player.getIframe(),
    play: () => safe(() => player.playVideo()),
    pause: () => safe(() => player.pauseVideo()),
    seek: (t) => safe(() => player.seekTo(Math.max(0, t), true)),
    time: () => num(() => player.getCurrentTime()),
    duration: () => num(() => player.getDuration()),
    buffered: () => num(() => player.getVideoLoadedFraction()),
    state: () => num(() => player.getPlayerState(), -1),
    mute: () => safe(() => player.mute()),
    unMute: () => safe(() => player.unMute()),
    isMuted: () => {
      try { return player.isMuted(); } catch (_) { return true; }
    },
    volume: (v) => (v === undefined ? num(() => player.getVolume(), 100) : safe(() => player.setVolume(v))),
    rate: (r) => (r === undefined ? num(() => player.getPlaybackRate(), 1) : safe(() => player.setPlaybackRate(r))),
    captions: (on) =>
      safe(() => {
        if (on) {
          player.loadModule('captions');
          player.setOption('captions', 'track', { languageCode: 'en' });
        } else {
          player.unloadModule('captions');
        }
      }),
    quality: () => {
      try { return player.getPlaybackQuality(); } catch (_) { return ''; }
    },
    forceQuality: () => forceBestQuality(player),
    destroy: () => safe(() => player.destroy()),
  };
}

const safe = (fn) => { try { return fn(); } catch (_) { return undefined; } };
const num = (fn, fallback = 0) => { const v = safe(fn); return typeof v === 'number' && !isNaN(v) ? v : fallback; };

