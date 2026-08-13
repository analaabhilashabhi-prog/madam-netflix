/* Letter screen — scroll-driven word reveal animation.
   - Elegant Georgia typography, scroll reveal effect.
   - Text is visible on load (no black screen).
   - "Enjoy the ride my Madam Ji ❤️" transition overlay at the end before Netflix intro. */

import { goFullscreen } from '../ui.js';

const LETTER = `Before You Enter Our Little World

My love,

Before you enter this little world I made for you, I want you to know something that I have never been able to explain properly — I don't know how much I love you. I don't know where it starts, and I don't know where it ends. Maybe it doesn't have an end. I have never had a number, a limit, or a definition for it. I just know that somewhere between our silly laughs, our endless rides, our random park visits, our fights, our trips, our snacks, our secrets, and all those ordinary moments… you became the most beautiful part of my life.

I made this because I was scared that one day, memories might become blurry. I never want to forget the way you laughed at your own silly mistakes, the way you looked at me when I was teaching, the way you became a little child around me, the way you trusted me on those mountain trails, the way you collected mangoes like they were treasures, the way you shared your momos even when you didn't want to, the way you made those flat little rasgullas just for me, and the way you held your tears when you had to leave because you knew I would cry even more. I remember the hospital, the grave, the rain, the beach, the temple, the classroom, the bus, the little room that became our home, and every place where somehow you made an ordinary day feel like something worth remembering forever.

There are so many moments here, but honestly, these videos are not the memories I miss the most. I miss you. I miss seeing you without needing a screen. I miss waiting for you, picking you up, sitting beside you, hearing your random stories, annoying you, watching you get angry at my stupid jokes, and then watching you laugh again. I miss the version of life where I could just decide, "I'm going to see her today," and actually go see you.

You have no idea how many times I have looked at an old video just because I wanted to see your face for a few seconds. Sometimes I laugh. Sometimes I smile like an idiot. Sometimes I just stare at the screen and miss you so badly that I don't know what to do with myself.

And there is something else I want you to know.

You came from a different world, a different faith, a different life, and somehow you still found your way into mine. You prayed for my mother. You came into places I never imagined you would enter. You sat in my classroom, my canteen, my cabin, my bus, my little everyday world — and without even realizing it, you became a part of it.

When you left, I thought I was losing my everyday life with you. And maybe I did. But I never lost what we created. Distance took away the everyday meetings, but it never took away the memories. It never took away the love. It never took away the girl who became my favorite person to laugh with, travel with, fight with, annoy, protect, and simply exist beside.

So, before you enter all these memories, I want you to promise me one thing:

Don't watch these just as old videos. Watch them as pieces of my heart.

Every reel here has a little bit of me in it. Every silly video has a story behind it. Every picture has a feeling I couldn't explain at the time. And every memory is proof that for some beautiful part of my life, I got to call you mine.

Today is your birthday, and more than wishing you another beautiful year, I wish that someday soon, I get to sit beside you again without counting the days between us.

I want more ordinary days with you.

More stupid jokes. More park evenings. More rides. More trips. More food that we pretend tastes good. More rain. More fights that last five minutes. More laughter that makes our stomachs hurt. More moments where we forget the entire world exists.

And if life gives me the chance, I want to make another thousand memories with you — not because I want a beautiful story to look back on, but because I want you there for the next chapters too.

I don't know how to measure what you mean to me. So I won't try. I'll just say this:

I love you more than I know how to explain. I miss you more than I know how to say. And I want you more than distance can ever change.

Happy Birthday, my love.

Now… enter our little world. Every memory waiting inside belongs to us. ❤️`;

export function letterScreen(nav) {
  /* ---- Build DOM ---- */
  const allWords = [];

  const textWrap = document.createElement('div');
  textWrap.id = 'letter-text-wrap';

  const paragraphs = LETTER.trim().split(/\n\s*\n/);
  paragraphs.forEach((p, idx) => {
    const pEl = document.createElement(idx === 0 ? 'h1' : 'p');
    pEl.className = idx === 0 ? 'letter-heading-para' : 'letter-para';
    const words = p.trim().split(/\s+/);
    words.forEach((w, i) => {
      const span = document.createElement('span');
      span.className = 'letter-w';
      span.textContent = w;
      pEl.appendChild(span);
      if (i < words.length - 1) pEl.appendChild(document.createTextNode(' '));
      allWords.push(span);
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
      <button id="letter-start-btn" class="btn-white big" style="margin-top:28px; cursor:pointer; font-size: 18px; padding: 14px 28px;">Enter Our World 🍿</button>
    </div>
  `;

  const proceedToBumper = () => {
    if (transitionTimer) clearTimeout(transitionTimer);
    goFullscreen();
    nav.profiles({ withBumper: true });
  };

  outroMsg.addEventListener('click', proceedToBumper);

  const el = document.createElement('div');
  el.id = 'letter-root';
  el.appendChild(progressBar);
  el.appendChild(hint);
  el.appendChild(spacer);
  el.appendChild(endSpace);
  el.appendChild(outroMsg);

  /* ---- Animation state ---- */
  let textHeight = 0;
  let wordTops = [];
  const anchorFrac = 0.4;
  let currentProgress = 0;
  let hintFaded = false;
  let running = false;
  let rafId = null;
  let transitionTimer = null;
  let hasTriggeredEnd = false;

  function measure() {
    const prevTransform = textWrap.style.transform;
    textWrap.style.transform = 'translateY(0px)';
    const wrapRectTop = textWrap.getBoundingClientRect().top;
    wordTops = allWords.map(span => span.getBoundingClientRect().top - wrapRectTop);
    textHeight = textWrap.scrollHeight;
    textWrap.style.transform = prevTransform;
    // More scroll room — 2x viewport height so the end doesn't trigger early
    spacer.style.height = (textHeight + window.innerHeight * 2) + 'px';
  }

  function render(progress) {
    progressBar.style.width = (progress * 100) + '%';

    const shouldFade = progress > 0.015;
    if (shouldFade !== hintFaded) {
      hint.classList.toggle('letter-hint-fade', shouldFade);
      hintFaded = shouldFade;
    }

    const minTranslate = Math.min(0, window.innerHeight - textHeight);
    const translateY = progress * minTranslate;
    textWrap.style.transform = `translateY(${translateY.toFixed(2)}px)`;

    const anchorY = window.innerHeight * anchorFrac;
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
      // Ensure words near top are visible on load (minimum 0.15 opacity) so it is NEVER pitch black
      const opacity = Math.max(0.15, t);
      const blur = 6 * (1 - t);
      const span = allWords[i];
      if (span._o !== opacity) {
        span.style.opacity = opacity.toFixed(2);
        span._o = opacity;
      }
      if (span._b !== blur) {
        span.style.filter = `blur(${blur.toFixed(2)}px)`;
        span._b = blur;
      }
    }

    // Outro trigger — only when truly at the end AND the last words are revealed
    if (progress > 0.99 && !hasTriggeredEnd) {
      // Guard: check that the last 10 words are actually visible (opacity > 0.7)
      const lastWords = allWords.slice(-10);
      const allRevealed = lastWords.every(w => (w._o || 0) > 0.7);
      if (!allRevealed) return;

      hasTriggeredEnd = true;
      // Stop the loop immediately to prevent any re-trigger
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;

      outroMsg.classList.add('letter-outro-active');
      transitionTimer = setTimeout(() => {
        proceedToBumper();
      }, 4000);
    }
  }

  function loop() {
    if (!running) return;
    // #letter-root is position:fixed with overflow-y:auto — it IS the scroll container.
    // Only use el.scrollTop, never window.scrollY or getBoundingClientRect.
    const total = spacer.offsetHeight - el.clientHeight;
    const scrolled = Math.min(Math.max(el.scrollTop, 0), total);
    const targetProgress = total > 0 ? scrolled / total : 0;

    currentProgress += (targetProgress - currentProgress) * 0.1;
    if (Math.abs(targetProgress - currentProgress) < 0.0001) {
      currentProgress = targetProgress;
    }

    render(currentProgress);
    rafId = requestAnimationFrame(loop);
  }

  const onScroll = () => {
    if (running) loop();
  };

  return {
    el,
    begin() {
      running = true;

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
      if (rafId) cancelAnimationFrame(rafId);
      if (transitionTimer) clearTimeout(transitionTimer);
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
    },
  };
}

