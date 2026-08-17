/* Letter screen — scroll-driven word reveal animation.
   - Elegant Georgia typography, scroll reveal effect.
   - Text is visible on load (no black screen).
   - "Enjoy the ride my Madam Ji ❤️" transition overlay at the end before Netflix intro. */

import { goFullscreen } from '../ui.js';
import { startLetterBgm, unlockAudio, toggleLetterBgm, stopLetterBgm } from '../bgm.js';
import { driftWall } from '../driftwall.js';
import { fetchGallery } from '../store.js';
import { LETTER_GALLERY_PLACEHOLDERS } from '../config.js';

/* How a word looks before the scroll has reached it. Turn REST_OPACITY down
   for a starker reveal, up if it ever feels too dark. */
const REST_OPACITY = 0.16;
/* Seconds for the scroll to settle onto the real position. Responsive and snappy
   so scrolling feels fluid and direct. */
const SCROLL_GLIDE = 0.035;

/* If she chooses to stay with the photos, how long before the first quiet
   nudge, and how long before it comes back after she waves it away. */
const FIRST_NUDGE_MS = 75_000;
const REPEAT_NUDGE_MS = 120_000;


/* Emphasis is carried by **bold**, never by punctuation or list markers. */
const LETTER = `Before You Enter Our Little World

My love, before you enter this little world I created for us, I want to tell you something I have never been able to put into words properly. I don't know how much I love you. I really don't.

I have tried to understand it, measure it, give it a name, give it a limit, but every time I try, I realize that my love for you doesn't fit into anything that can be measured. I don't know where it begins, and I don't know where it ends. Maybe that's what love really is. Maybe you simply reach a point where someone becomes so deeply a part of you that you stop trying to understand it and just feel it. And somehow, you became that person for me.

I made this little world because I was afraid that one day, some of these memories might become distant. I never want to forget the smallest things about us, the things that nobody else would understand, but somehow mean everything to me.

The way you laugh when you make a silly mistake. The way you become a complete child when you're happy. The way you used to sit in the park and watch your reels while I secretly watched you instead. The way you collected mangoes in the rain without caring about getting wet, only worrying about how we were going to carry them home. The way you refused to share all six momos and still somehow gave me two.

The way you proudly gave me those little flat rasgullas you made with whatever you had, and the way I laughed at them while secretly loving the fact that you made them only for me. The way you drove my bike for the first time and I sat behind you feeling like the luckiest person alive. The way you walked like a model the moment you realized I was watching you.

The way you looked at me from my classroom. The way you sat beside me in my canteen. The way you slowly became a part of places that once belonged only to my everyday life. All these little things became my favorite memories.

But there is one thing about you that I don't think I can ever explain completely. **You remind me of my mother.**

Not because you could ever replace her. You never could. She was my first home. She was the person whose presence made me feel safe without saying a single word. Losing her left a space inside me that I thought would always remain empty. There are some kinds of emptiness that you learn to live with, because you know nothing can ever fill them.

And then you came into my life. Sometimes I look at you when you're not even doing anything special, sitting quietly, smiling to yourself, fixing your hair, watching reels, being your silly little self, and something about you feels so familiar. Your face. Your eyes. Your innocence. The peace I feel when I look at you.

For a few seconds, I forget how much I miss my mother. I feel peaceful. I feel safe. **I feel home.**

And sometimes, when I look at you, it feels like life has quietly given me a tiny piece of the home I lost. I know you can never bring my mother back, and I would never want you to carry that responsibility. But somehow, you gave me something I didn't know I was still searching for. **The feeling of being at home in someone's presence.** And I will always be grateful for that.

I don't think I will ever forget the day you came with me to my mother's grave. You didn't have to come. You were scared. You could have stayed away. But you came because I was going. You stood beside me. You cleaned her grave with your own hands. And then you prayed. You prayed for my mother. You prayed for me.

And when you asked her to give you her son and promised that you would take care of me, something inside me broke in the most beautiful way. I was standing there looking at you, thinking about the woman who gave me my first home, and watching the woman I love promise to take care of me. I couldn't explain what I felt. I still can't. But I remember it, and I always will. Because that day, you didn't just step into my life. **You stepped into the deepest part of my heart.**

Then came all those ordinary days that became extraordinary only because you were in them. Our park. Our rides. Our snacks. Our little trips. Our silly fights. Our laughter. Our secret moments. The rain. The mountains. The beaches. The classroom. The bus. The tiny room that somehow became our home for ten days.

We never knew we were creating memories. We were simply living. And maybe that's what makes them so beautiful. We weren't trying to make a beautiful story. **We were simply being us.**

And then came the day you had to leave. Six months of seeing you almost every day suddenly became distance. The girl I could simply go and meet became someone I had to miss. The person I could pick up after college became someone I had to wait for. The little park where we spent so many evenings became a place filled with memories instead of your presence.

I still remember that last day. I was crying like a little boy who had lost his favorite thing in the world, and you were holding your tears because you knew that if you cried, I would fall apart even more. Then, with only a few minutes left, you bought me snacks, just like I used to buy them for you. We went to our park one last time. We sat together. We ate together. We looked at the same place where we had spent so many ordinary evenings. And we called it one last time.

But I don't want that to be our story. I don't want our life to be a collection of last times. I want more. I want another thousand ordinary days with you.

I want more rides where you drive and I sit behind you. More evenings in the park. More food that we pretend tastes good. More rain. More mountains. More beaches. More birthdays. More stupid jokes. More pranks where you chase me around because you finally realized I fooled you. More moments where we forget that we're adults and become two stupid children again. More moments where you laugh so much that you can't breathe. More moments where I look at you and think, how did I get this lucky?

I don't want perfect memories. I want **more real ones.** I want the messy ones. The funny ones. The emotional ones. The completely pointless ones. The moments that nobody else would understand. Because those are the moments that made you **you** to me.

And that's what this website really is. It isn't just a collection of pictures and videos. It is a little piece of my heart. Every video here carries a memory. Every memory carries a feeling. And every feeling leads back to you.

I wanted to create a place where our little world could stay safe. A place where you could come back whenever you miss us. Whenever you miss me. Whenever distance feels too long. Whenever you want to remember what it felt like when we could see each other every day. You can come here, and you'll find us.

Laughing. Fighting. Travelling. Eating. Getting wet in the rain. Collecting mangoes. Making terrible food. Dancing. Playing like children. Sitting quietly. Looking at each other. Just being us.

And maybe someday, years from now, we'll look back at all of this together and laugh at how silly we were. I hope we do. I hope I'm sitting beside you when we watch these memories again. I hope you look at me and say, “We were so stupid.” And I hope I smile and tell you, **“Yes. But those were the best days of my life.”** Because they were.

You have no idea how many times I've watched an old video of you just because I missed your face. Sometimes I laugh. Sometimes I smile. Sometimes I just stare at the screen quietly. And sometimes I miss you so much that I don't know where to put that feeling.

I miss your presence. I miss your voice. I miss your silly stories. I miss annoying you. I miss watching you get angry at me. I miss making you laugh. I miss simply knowing that you're nearby. But more than anything, **I miss the feeling of having you beside me.**

And if there is one thing I want you to understand before you enter this world of memories, it is this. You are not just someone I love. You are someone who changed what love feels like to me.

You became the person I want to tell everything to. The person I want beside me when something wonderful happens. The person I want beside me when something hurts. The person I want to laugh with when life feels heavy. The person I want to grow old with while still behaving like two stupid children.

You became my favorite person. My safest place. My happiest distraction. My partner in crime. My favorite person to annoy. My favorite person to miss. And somehow, **my home.**

I don't know what the future will look like. I don't know how many miles will stand between us. I don't know how many days we'll have to wait before the next time I see you. But I know this. Distance can separate two people. It can change routines. It can change places. It can change the way we meet. But it cannot erase what we have already lived. It cannot take away our memories. It cannot take away the laughter. It cannot take away the love. And it cannot take away the place you have made for yourself inside my heart.

So, my love, before you enter this little world, I want to say thank you. Thank you for every laugh. Thank you for every silly moment. Thank you for every ride. Thank you for every snack. Thank you for every hug. Thank you for every tear you held back for me. Thank you for coming to my mother's grave. Thank you for making me feel at home again. Thank you for entering my world so quietly and somehow becoming the most beautiful part of it. And thank you for giving me memories that I know I will carry for the rest of my life.

I don't know how to measure my love for you, so I won't try anymore. I'll simply love you. Today. Tomorrow. Through every distance. Through every difficult day. Through every beautiful day. Through every version of us that life gives us.

And if you ever ask me how much I love you, I will probably still have no answer. Because how do you measure something that feels infinite? So I'll just say this. **I love you beyond words. I miss you beyond distance. I need you beyond explanation.** And somewhere between losing my first home and finding you, **you became the place where my heart learned how to feel at home again.**

Happy Birthday, my love.

Before you go inside, take a deep breath. Because everything you're about to see is a little piece of us. A little piece of my heart. A little piece of the life we lived together. And every memory waiting inside has one thing in common. **You.**

So, **welcome to our world. Welcome to us.** And if you ever forget how much I love you, come back here. I'll leave a thousand memories behind to remind you.

**Forever yours.** ❤️`;

export function letterScreen(nav) {
  /* ---- Build DOM ---- */
  const allWords = [];

  const textWrap = document.createElement('div');
  textWrap.id = 'letter-text-wrap';

  const paragraphs = LETTER.trim().split(/\n\s*\n/);
  paragraphs.forEach((p, idx) => {
    const pEl = document.createElement(idx === 0 ? 'h1' : 'p');
    pEl.className = idx === 0 ? 'letter-heading-para' : 'letter-para';

    /* **wrapped like this** marks a line that carries weight. It renders
       heavier and warmer, and still reveals word by word like the rest —
       every word remains its own span, which is what the scroll animates. */
    const segments = p.trim().split('**');
    let placed = false;
    segments.forEach((segment, segIdx) => {
      const strong = segIdx % 2 === 1;
      for (const w of segment.split(/\s+/).filter(Boolean)) {
        if (placed) pEl.appendChild(document.createTextNode(' '));
        const span = document.createElement('span');
        span.className = strong ? 'letter-w letter-strong' : 'letter-w';
        span.textContent = w;
        pEl.appendChild(span);
        allWords.push(span);
        placed = true;
      }
    });

    textWrap.appendChild(pEl);
  });

  const stage = document.createElement('div');
  stage.id = 'letter-stage';
  stage.appendChild(textWrap);

  const spacer = document.createElement('div');
  spacer.id = 'letter-spacer';
  spacer.appendChild(stage);

  const endSpace = document.createElement('div');
  endSpace.id = 'letter-end-space';

  const progressBar = document.createElement('div');
  progressBar.id = 'letter-progress';

  const hint = document.createElement('div');
  hint.id = 'letter-hint';
  hint.innerHTML = 'scroll to read the letter <span class="letter-hint-arrow">↓</span>';

  const outroMsg = document.createElement('div');
  outroMsg.id = 'letter-outro-msg';
  outroMsg.innerHTML = `
    <div class="outro-msg-content">
      <div>Enjoy the ride my Madam Ji ❤️</div>
      <p class="outro-sub">There is no hurry. Sit here as long as you like.</p>
      <div class="outro-actions">
        <button id="letter-stay-btn" class="btn-ghost big" type="button">Stay in this moment</button>
        <button id="letter-start-btn" class="btn-white big" type="button">Enter Our World 🍿</button>
      </div>
    </div>
  `;

  const proceedToBumper = () => {
    clearTimeout(nudgeTimer);
    stopLetterBgm();
    goFullscreen();
    nav.profiles({ withBumper: true });
  };

  /* The other choice: the letter steps aside and leaves her with the photos
     and the music. Nothing is asked of her — after a while a quiet nudge
     appears, and she can push it away as many times as she likes. */
  function stayInTheMoment() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    outroMsg.classList.remove('letter-outro-active');
    el.classList.add('staying'); // fades the words out and lifts the scrim
    scheduleNudge(FIRST_NUDGE_MS);
  }

  function scheduleNudge(delay) {
    clearTimeout(nudgeTimer);
    nudgeTimer = setTimeout(showNudge, delay);
  }

  function showNudge() {
    if (!nudgeEl) {
      nudgeEl = document.createElement('div');
      nudgeEl.id = 'letter-stay-nudge';
      nudgeEl.innerHTML = `
        <div class="nudge-text">Whenever you are ready, our world is waiting 💛</div>
        <div class="nudge-actions">
          <button class="btn-white" type="button" data-go>Enter Our World 🍿</button>
          <button class="btn-ghost small" type="button" data-later>A little longer</button>
        </div>`;
      nudgeEl.querySelector('[data-go]').addEventListener('click', proceedToBumper);
      nudgeEl.querySelector('[data-later]').addEventListener('click', () => {
        nudgeEl.classList.remove('in');
        scheduleNudge(REPEAT_NUDGE_MS);
      });
      el.appendChild(nudgeEl);
    }
    requestAnimationFrame(() => nudgeEl.classList.add('in'));
  }

  /* Only the buttons act now. The whole overlay used to be one big click
     target, which would fire the moment she reached for either choice. */
  outroMsg.querySelector('#letter-start-btn').addEventListener('click', proceedToBumper);
  outroMsg.querySelector('#letter-stay-btn').addEventListener('click', stayInTheMoment);

  /* The drifting photo wall lives here, behind everything, with a scrim over
     it so the letter stays the thing you actually read. */
  const bgHost = document.createElement('div');
  bgHost.id = 'letter-bg';
  const bgScrim = document.createElement('div');
  bgScrim.id = 'letter-bg-scrim';

  const el = document.createElement('div');
  el.id = 'letter-root';
  el.appendChild(bgHost);
  el.appendChild(bgScrim);
  el.appendChild(progressBar);
  el.appendChild(hint);
  el.appendChild(spacer);
  el.appendChild(endSpace);
  el.appendChild(outroMsg);

  /* ---- Animation state ---- */
  let textHeight = 0;
  let wordTops = [];
  let maxScroll = 1;
  let viewportHeight = window.innerHeight || 800;
  const anchorFrac = 0.4;
  let currentProgress = 0;
  let hintFaded = false;
  let running = false;
  let rafId = null;
  let hasTriggeredEnd = false;
  let nudgeTimer = null;
  let nudgeEl = null;

  function measure() {
    viewportHeight = window.innerHeight || 800;
    const prevTransform = textWrap.style.transform;
    textWrap.style.transform = 'none';
    const wrapRectTop = textWrap.getBoundingClientRect().top;
    wordTops = allWords.map((span) => span.getBoundingClientRect().top - wrapRectTop);
    textHeight = textWrap.scrollHeight;
    textWrap.style.transform = prevTransform;
    // More scroll room — 2x viewport height so the end doesn't trigger early
    const spacerH = textHeight + viewportHeight * 2;
    spacer.style.height = spacerH + 'px';
    maxScroll = Math.max(1, spacerH - viewportHeight);
  }

  function render(progress) {
    progressBar.style.width = (progress * 100) + '%';

    const shouldFade = progress > 0.015;
    if (shouldFade !== hintFaded) {
      hint.classList.toggle('letter-hint-fade', shouldFade);
      hintFaded = shouldFade;
    }

    const minTranslate = Math.min(0, viewportHeight - textHeight);
    const translateY = progress * minTranslate;
    textWrap.style.transform = `translate3d(0, ${translateY.toFixed(2)}px, 0)`;

    /* Nothing measured means nothing to drive, so hand the letter back to the
       stylesheet and let her read it plainly rather than show her a blank. */
    if (!wordTops.length) {
      el.classList.remove('ink');
      return;
    }
    el.classList.add('ink');

    const anchorY = viewportHeight * anchorFrac;
    const band = 160;
    const lead = 30;

    for (let i = 0; i < allWords.length; i++) {
      const screenY = (wordTops[i] || 0) + translateY;
      const dist = screenY - anchorY;
      let t;
      if (dist <= -lead) {
        t = 1;
      } else if (dist >= band) {
        t = 0;
      } else {
        t = 1 - (dist + lead) / (band + lead);
      }

      const opacity = Math.max(REST_OPACITY, t);
      const span = allWords[i];
      /* Always an explicit value. Assigning '' REMOVES the inline style and
         drops the word back to the stylesheet, which is what once left the
         whole letter invisible. */
      if (span._o !== opacity) {
        span.style.opacity = opacity.toFixed(2);
        span._o = opacity;
      }
    }

    // Outro trigger — only when truly at the end AND the last words are revealed
    if (progress > 0.99 && !hasTriggeredEnd) {
      // Guard: check that the last 10 words are actually visible
      const lastWords = allWords.slice(-10);
      const allRevealed = lastWords.every(w => (w._o || 0) > 0.7);
      if (!allRevealed) return;

      hasTriggeredEnd = true;
      // Stop the loop immediately to prevent any re-trigger
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;

      /* Wait for her tap. Fullscreen and unmuted audio both need a real user
         gesture — a timer here would hand the intro to the browser with no
         gesture behind it, and it would play windowed and silent. Clicking
         anywhere on this overlay proceeds, so it is never a dead end. */
      outroMsg.classList.add('letter-outro-active');
    }
  }

  let lastFrameTs = 0;

  function loop(ts) {
    if (!running) return;
    // #letter-root is position:fixed with overflow-y:auto — it IS the scroll container.
    // Use cached maxScroll to prevent reading DOM layout properties every frame.
    const scrolled = Math.min(Math.max(el.scrollTop, 0), maxScroll);
    const targetProgress = maxScroll > 0 ? scrolled / maxScroll : 0;

    /* Responsive easing: settles quickly and smoothly across both 60Hz and 120Hz screens. */
    const dt = lastFrameTs ? Math.min(0.05, Math.max(0, (ts || 0) - lastFrameTs) / 1000) : 1 / 60;
    lastFrameTs = ts || 0;
    const ease = 1 - Math.exp(-dt / SCROLL_GLIDE);

    currentProgress += (targetProgress - currentProgress) * ease;
    if (Math.abs(targetProgress - currentProgress) < 0.00005) {
      currentProgress = targetProgress;
    }

    render(currentProgress);
    rafId = requestAnimationFrame(loop);
  }

  /* The rAF chain already runs continuously while the screen is alive. Calling
     loop() from here as well started a NEW chain on every scroll event, so a
     single flick left dozens of them running in parallel, each re-rendering
     every word in the letter. That is what made scrolling feel like it stuck. */
  const onScroll = () => {
    if (running) unlockAudio(); // no-op once it is already playing
  };

  const GESTURES = ['pointerdown', 'click', 'touchend', 'keydown'];
  const enableAudioOnGesture = () => unlockAudio();
  let wall = null;

  /* The one tap the browser needs before it will let the music be heard.
     Only ever shown when playback was actually refused. */
  let soundPrompt = null;
  function showSoundPrompt() {
    if (soundPrompt) return;
    soundPrompt = document.createElement('div');
    soundPrompt.id = 'letter-sound-gate';
    soundPrompt.innerHTML = `
      <div class="sound-gate-card">
        <div class="sound-gate-note">🎧</div>
        <div class="sound-gate-title">Put your sound on, my love.</div>
        <div class="sound-gate-sub">I picked a song to go with this.</div>
        <button class="btn-white big" type="button">Start the letter</button>
      </div>
    `;

    const dismiss = async () => {
      await unlockAudio(); // this call is inside the click — the browser allows it
      soundPrompt.classList.add('out');
      setTimeout(() => {
        soundPrompt?.remove();
        soundPrompt = null;
      }, 420);
    };

    soundPrompt.addEventListener('click', dismiss);
    el.appendChild(soundPrompt);
    requestAnimationFrame(() => soundPrompt.classList.add('in'));
  }

  return {
    el,
    begin() {
      running = true;

      /* Try to start the music straight away — that works when she arrived by
         tapping something (the passphrase door, or the landing button). On a
         cold page load there has been no tap yet, the browser refuses, and
         scrolling will NOT change its mind: wheel and scroll do not count as
         user activation. So in that case, ask for one tap. */
      startLetterBgm().then((playing) => {
        if (!playing && running) showSoundPrompt();
      });

      /* Whatever is in the Admin Panel wins; the placeholders only fill in
         until there is something of your own to show. */
      fetchGallery().then((photos) => {
        if (!running) return;
        const urls = photos.map((p) => p.url).filter(Boolean);
        /* Tune the look here. dim = how bright the photos are, tint = the
           colour wash over them, fade = how far the edges dissolve, speed =
           drift rate in pixels per second. */
        wall = driftWall(urls.length ? urls : LETTER_GALLERY_PLACEHOLDERS, {
          columns: 'auto', // as many as it takes to fill her screen
          tilt: 0, turn: 0, roll: 0, depth: 0, // straight on, not tipped in 3D
          alternate: false, // every column drifts the same way, none cross
          speed: 34,
          dim: 0.9,
          tint: 0.12,
          fade: 0.1,
        });
        if (wall) bgHost.appendChild(wall.el);
      });

      /* Real activation events only — wheel/scroll can never unlock audio. */
      for (const ev of GESTURES) window.addEventListener(ev, enableAudioOnGesture);

      requestAnimationFrame(() => {
        measure();
        render(0);
        requestAnimationFrame(() => {
          measure();
          loop();
        });
      });

      el.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', measure);
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(measure);
      }
    },
    destroy() {
      running = false;
      clearTimeout(nudgeTimer);
      wall?.destroy();
      wall = null;
      soundPrompt?.remove();
      soundPrompt = null;
      stopLetterBgm();
      if (rafId) cancelAnimationFrame(rafId);
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
      for (const ev of GESTURES) window.removeEventListener(ev, enableAudioOnGesture);
    },
  };
}

