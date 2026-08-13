/* 4.5–4.8, 4.12 — Profile Home: navbar, hero, scrollable rows, More Info modal,
   notifications panel and search. */

import { profileById, BADGES, NOTIFICATIONS, ROW_LABELS, pick } from '../config.js';
import { itemsFor, posterFor, posterFallbacks, toggleLike, toggleList, resolveOrientation, getItemSection, getSections } from '../store.js';
import { createPlayer } from '../yt.js';
import { h, icon, iconButton, toast, fmtTime, renderDescription } from '../ui.js';

export function homeScreen(nav, profileId) {
  const profile = profileById(profileId);

  /* ---------- hero background (keeps playing behind the scroll, 4.7) ----- */
  const heroHost = h('div', { class: 'yt-host' });
  const heroBg = h('div', { class: 'hero-bg' }, h('div', { class: 'hero-bg-inner' }, heroHost), h('div', { class: 'hero-scrim' }));
  let heroPlayer = null;
  let heroWatch = null; // keeps the background video playing (see paintHero)

  /* ---------- navbar (4.5) ---------------------------------------------- */
  const NAV_LINKS = ['Home', 'Shows', 'Movies', 'New & Popular', 'My List', 'Browse by Languages'];
  let view = 'Home';

  const navLinks = h('nav', { class: 'nav-links' },
    NAV_LINKS.map((label) =>
      h('button', { class: `nav-link ${label === 'Home' ? 'active' : ''}`, onClick: (e) => setView(label, e.currentTarget) }, label)
    )
  );

  const searchInput = h('input', { class: 'search-input', type: 'search', placeholder: 'Search our memories', 'aria-label': 'Search' });
  const searchWrap = h('div', { class: 'search-wrap' },
    iconButton('search', 'Search', () => {
      searchWrap.classList.toggle('open');
      if (searchWrap.classList.contains('open')) searchInput.focus();
      else { searchInput.value = ''; renderBody(); }
    }),
    searchInput
  );
  searchInput.addEventListener('input', () => renderBody());

  const bellBtn = iconButton('bell', 'Notifications', () => toggleBell());
  // count badge, like the real thing — how many notes are waiting for her
  const bellDot = h('span', { class: 'bell-count' }, String(NOTIFICATIONS.length));
  const bellWrap = h('div', { class: 'bell-wrap' }, bellBtn, bellDot);

  const avatar = profile.photo
    ? h('img', { class: 'nav-avatar', src: profile.photo, alt: profile.name })
    : h('div', { class: 'nav-avatar', style: { background: profile.tint } }, profile.initial);

  const profileMenu = h('div', { class: 'profile-menu' },
    h('button', { class: 'pm-item', onClick: () => nav.profiles() }, 'Switch profile'),
    h('button', { class: 'pm-item', onClick: () => nav.landing() }, 'Back to the beginning'),
    h('div', { class: 'pm-note' }, 'Signed in as Madam G 💛')
  );
  const profileBadge = h('div', { class: 'profile-badge', onClick: () => profileMenu.classList.toggle('open') },
    avatar, h('span', { class: 'nav-name' }, profile.name), h('span', { class: 'caret' }, '▾'), profileMenu);

  const header = h('header', { class: 'nav' },
    h('div', { class: 'nav-left' }, h('button', { class: 'wordmark', onClick: () => setView('Home') }, 'MADAM'), navLinks),
    h('div', { class: 'nav-right' }, searchWrap, bellWrap, profileBadge)
  );

  /* ---------- hero (4.6) ------------------------------------------------ */
  const heroTitle = h('h1', { class: 'hero-title brush' }, '');
  const heroMeta = h('div', { class: 'hero-meta' }, '');
  const heroDesc = h('p', { class: 'hero-desc' }, '');
  const heroBadges = h('div', { class: 'hero-badges' });
  const heroPlay = h('button', { class: 'btn-white', onClick: () => featured && nav.open(profileId, featured.id) }, icon('play'), 'Play');
  const heroInfo = h('button', { class: 'btn-grey', onClick: () => featured && openModal(featured) }, icon('info'), 'More Info');
  /* The hero is an inset rounded card with the video living inside it, so it
     scrolls away as a card rather than sitting behind the whole page. */
  const hero = h('section', { class: 'hero' },
    heroBg,
    h('div', { class: 'hero-copy' }, h('div', { class: 'hero-kicker' }, '🎂  A birthday original'), heroTitle, heroMeta, heroDesc,
      h('div', { class: 'hero-actions' }, heroPlay, heroInfo)),
    heroBadges
  );

  const rowsHost = h('div', { class: 'rows' });
  /* One repaint fn per visible row, refreshed whenever the rows are rebuilt, so
     a single resize/fullscreen listener can keep every row's arrows honest. */
  let rowPainters = [];
  const body = h('main', { class: 'home-body' }, hero, rowsHost,
    h('footer', { class: 'home-foot' }, 'MADAM · built by Abhi, for Madam G · every frame here is real'));

  const el = h('div', { class: 'home' }, header, body);

  let featured = null;
  let heroPinned = false; // true once she picks something from a row
  /* Signature of what the hero is currently showing. Compared on every render so
     an Admin Panel edit to the featured item's title/description repaints the
     copy — the id alone doesn't change, so it would otherwise go stale. */
  let featuredSig = '';

  /* Promote a card into the hero: it becomes the featured item, its copy and
     badges repaint, and the hero plays it. Playback itself still happens in the
     fullscreen player, reached from the hero's Play button. */
  function selectHero(item) {
    heroPinned = true;
    if (item.id !== featured?.id) {
      featured = item;
      featuredSig = heroSig(item);
      heroLen = '—';
      paintHero(item);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  let heroLen = '—'; // filled in once the background player reports a duration
  const heroSig = (i) => `${i.id}|${i.title}|${i.description}`;

  const floatBadge = (text) => h('div', { class: 'float-badge' }, icon('heart'), h('span', {}, text));

  /* Red "Recently added" tag, like the reference. Anything added in the last
     fortnight carries it — which is everything, right after you add a batch. */
  const RECENT_MS = 14 * 24 * 60 * 60 * 1000;
  const isRecent = (item) => Date.now() - item.addedAt < RECENT_MS;
  /* Two badges, never the same one twice — the reference shows two distinct pills. */
  function twoBadges() {
    const a = pick(BADGES);
    const others = BADGES.filter((b) => b !== a);
    return [a, others.length ? pick(others) : a];
  }

  /* ---------- rows / views --------------------------------------------- */
  function buildRows(items) {
    const allSecs = getSections(profileId);
    const sectionItemsMap = {};
    for (const sec of allSecs) sectionItemsMap[sec] = [];

    for (const item of items) {
      const sec = getItemSection(item);
      if (!sectionItemsMap[sec]) sectionItemsMap[sec] = [];
      sectionItemsMap[sec].push(item);
    }

    const list = items.filter((i) => i.inList);
    const loved = items.filter((i) => i.liked);

    const rows = [];
    for (const [label, secItems] of Object.entries(sectionItemsMap)) {
      if (secItems.length) {
        const isTall = label === 'Short and Sweet Memories of Us' || secItems.some((i) => i.orientation === 'vertical');
        rows.push({ label, items: secItems, tall: isTall });
      }
    }

    if (list.length) rows.push({ label: ROW_LABELS.list, items: list });
    if (loved.length) rows.push({ label: ROW_LABELS.loved, items: loved });

    // Fallback if no sections exist yet but profile has un-sectioned items
    if (!rows.length && items.length) {
      const videos = items.filter((i) => i.kind === 'video' && i.orientation !== 'vertical');
      const shorts = items.filter((i) => i.kind === 'video' && i.orientation === 'vertical');
      const photos = items.filter((i) => i.kind === 'photo');
      return [
        videos.length && { label: ROW_LABELS.featured, items: videos },
        shorts.length && { label: ROW_LABELS.shorts, items: shorts, tall: true },
        photos.length && { label: ROW_LABELS.photos, items: photos },
      ].filter(Boolean);
    }

    return rows;
  }

  function viewItems(items) {
    switch (view) {
      case 'Shows': return items.filter((i) => i.kind === 'video' && i.orientation === 'vertical');
      case 'Movies': return items.filter((i) => i.kind === 'video' && i.orientation !== 'vertical');
      case 'New & Popular': return items.slice().sort((a, b) => b.addedAt - a.addedAt);
      case 'My List': return items.filter((i) => i.inList);
      case 'Browse by Languages': return items.filter((i) => i.kind === 'photo').concat(items.filter((i) => i.kind === 'video'));
      default: return items;
    }
  }

  function setView(label, btn) {
    view = label;
    for (const b of navLinks.children) b.classList.toggle('active', b.textContent === label);
    if (label === 'Home' && !btn) navLinks.firstElementChild.classList.add('active');
    body.scrollTo?.({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderBody();
  }

  function renderBody() {
    const items = itemsFor(profileId);
    const q = searchInput.value.trim().toLowerCase();

    /* Hero target: whatever she picked from a row, else the profile's default.
       A pinned pick wins until it is deleted, so a content-changed repaint can't
       yank her selection back to the default. */
    const autoPick = items.find((i) => i.kind === 'video' && i.orientation !== 'vertical') || items[0] || null;
    let target = heroPinned && featured ? items.find((i) => i.id === featured.id) || null : null;
    if (!target) {
      target = autoPick;
      heroPinned = false;
    }

    if (!target) {
      featured = null;
      featuredSig = '';
      paintEmptyHero();
    } else if (target.id !== featured?.id) {
      featured = target;
      featuredSig = heroSig(featured);
      heroLen = '—';
      paintHero(featured);
    } else if (heroSig(target) !== featuredSig) {
      // same item, edited copy — repaint the text without tearing down the
      // background player, so the hero never restarts mid-scroll
      featured = target;
      featuredSig = heroSig(featured);
      paintHeroCopy(featured);
    }

    rowsHost.replaceChildren();
    rowPainters = []; // the rows holding the old ones are gone

    if (q) {
      const hits = items.filter((i) => (i.title || '').toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q));
      rowsHost.append(gridSection(`Results for “${q}”`, hits, 'Nothing matched. Try another word.'));
      return;
    }

    if (view !== 'Home') {
      rowsHost.append(gridSection(view, viewItems(items), 'Nothing here yet — Abhi will add more.'));
      return;
    }

    const rows = buildRows(items);
    if (!rows.length) {
      rowsHost.append(h('div', { class: 'empty-state' },
        h('p', {}, 'This profile is still empty.'),
        h('p', { class: 'dim' }, 'Add content from the Admin Panel and it shows up here instantly.')));
      return;
    }
    for (const r of rows) rowsHost.append(rowSection(r));
  }

  function gridSection(label, items, emptyText) {
    if (!items.length) return h('section', { class: 'row' }, h('h2', { class: 'row-title' }, label), h('div', { class: 'empty-state' }, emptyText));
    return h('section', { class: 'row grid-row' },
      h('h2', { class: 'row-title' }, label),
      h('div', { class: 'grid' }, items.map((i) => card(i, i.orientation === 'vertical'))));
  }

  function rowSection(row) {
    const isTallRow = row.tall || row.items.some((i) => i.orientation === 'vertical');
    const track = h('div', { class: `row-track ${isTallRow ? 'tall' : ''}` }, row.items.map((i) => card(i, isTallRow)));
    const dashes = h('div', { class: 'row-dashes' });
    const left = h('button', { class: 'row-arrow left', title: 'Scroll left', onClick: () => scrollBy(-1) }, icon('chevronL'));
    const right = h('button', { class: 'row-arrow right', title: 'Scroll right', onClick: () => scrollBy(1) }, icon('chevronR'));

    const section = h('section', { class: 'row' },
      h('div', { class: 'row-head' }, h('h2', { class: 'row-title' }, row.label), dashes),
      h('div', { class: 'row-scroller' }, left, track, right));

    /* Recomputed on scroll, on resize and whenever fullscreen changes the
       viewport — otherwise a row that overflows after a resize keeps the arrow
       state it had when it was first drawn, and she has no way to reach the
       cards past the edge. */
    const paint = () => {
      const max = track.scrollWidth - track.clientWidth;
      const scrollable = max > 8;
      section.classList.toggle('can-scroll', scrollable);

      if (!scrollable) {
        dashes.replaceChildren();
        left.classList.add('hide');
        right.classList.add('hide');
        return;
      }
      const pages = Math.max(1, Math.ceil(track.scrollWidth / Math.max(1, track.clientWidth)));
      const current = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      dashes.replaceChildren(...Array.from({ length: pages }, (_, i) => h('span', { class: `dash ${i === current ? 'on' : ''}` })));
      left.classList.toggle('hide', track.scrollLeft < 8);
      right.classList.toggle('hide', track.scrollLeft >= max - 8);
    };

    const scrollBy = (dir) => track.scrollBy({ left: dir * track.clientWidth * 0.86, behavior: 'smooth' });
    track.addEventListener('scroll', paint, { passive: true });
    rowPainters.push(paint);
    // measure after layout has actually settled, not on a guessed timeout
    requestAnimationFrame(() => requestAnimationFrame(paint));
    return section;
  }

  /* ---------- card ------------------------------------------------------ */
  function card(item, tall) {
    const isTall = tall || item.orientation === 'vertical';
    const img = h('img', { class: 'card-img', alt: item.title || 'memory', loading: 'lazy' });
    const fallbacks = posterFallbacks(item);
    let fi = 0;
    img.addEventListener('error', () => {
      if (fi < fallbacks.length) img.src = fallbacks[fi++];
      else img.classList.add('broken');
    });
    img.src = posterFor(item); // 3.6 — mid-video frame, never a separate upload
    if (item.kind === 'photo' && !item.orientation) resolveOrientation(item);

    const badge = Math.random() < 0.55 ? h('div', { class: 'card-badge' }, pick(BADGES)) : null;
    const c = h('article', { class: `card ${isTall ? 'tall' : ''}` },
      img,
      badge,
      h('div', { class: 'card-shade' }),
      h('div', { class: 'card-bottom' },
        h('div', { class: 'card-title' }, item.title || (item.kind === 'photo' ? 'Untitled photo' : 'Untitled video')),
        isRecent(item) ? h('span', { class: 'card-new' }, 'Recently added') : null),
      h('div', { class: 'card-hover' },
        h('button', { class: 'card-play', title: 'Show in hero', onClick: (e) => { e.stopPropagation(); selectHero(item); } }, icon('play')),
        h('button', { class: 'card-more', title: 'More info', onClick: (e) => { e.stopPropagation(); openModal(item); } }, icon('info')))
    );
    // picking a card lifts it into the hero rather than navigating away
    c.addEventListener('click', () => selectHero(item));
    return c;
  }

  /* ---------- hero paint ------------------------------------------------ */
  /* Text-only paint. Uses whatever length the player has already reported so a
     copy edit can't wipe it back to a dash. */
  function paintHeroCopy(item) {
    // vertical items get the split shape: copy left, 9:16 frame right
    hero.classList.toggle('is-vertical', item.orientation === 'vertical');
    heroTitle.textContent = item.title || (item.kind === 'photo' ? 'A photo of us' : 'Our story, unedited');
    const year = new Date(item.addedAt).getFullYear();
    const type = item.kind === 'photo' ? 'Photo' : item.orientation === 'vertical' ? 'Short' : 'Video';
    heroMeta.replaceChildren(
      ...['Featured', type, String(year), heroLen, 'Rated 💛 for Madam G'].map((t, i, arr) =>
        h('span', { class: 'meta-bit' }, t + (i < arr.length - 1 ? ' · ' : '')))
    );
    heroDesc.innerHTML = renderDescription(item.description || 'One of my favourite things we ever recorded. Press play and you’ll see why — it’s all you.', item.orientation === 'vertical');
    heroBadges.replaceChildren(...twoBadges().map(floatBadge));
  }

  async function paintHero(item) {
    paintHeroCopy(item);

    // background keeps playing subtly behind the whole page
    heroPlayer?.destroy();
    heroHost.replaceChildren();
    const inner = h('div', { class: 'yt-host' });
    heroHost.append(inner);
    if (item.kind === 'video') {
      heroPlayer = await createPlayer(inner, { videoId: item.ytId, muted: true, loop: true });
      heroPlayer.play();

      /* 3.3 — YouTube only draws its own control overlay when the video is not
         playing, so the surest way to keep that overlay off her screen is to
         never let the background stop. Nudge it back whenever it drifts out of
         the playing state (paused, ended, cued or buffering-stalled). */
      clearInterval(heroWatch);
      heroWatch = setInterval(() => {
        if (!heroPlayer) return;
        const s = heroPlayer.state(); // 1 = playing, 3 = buffering
        if (s !== 1 && s !== 3) {
          heroPlayer.mute();
          heroPlayer.play();
        }
      }, 1000);

      const stamp = setInterval(() => {
        const d = heroPlayer?.duration();
        if (d) {
          heroLen = fmtTime(d);
          heroMeta.children[3].textContent = heroLen + ' · ';
          clearInterval(stamp);
        }
      }, 400);
    } else {
      heroPlayer = null;
      clearInterval(heroWatch);
      inner.style.background = `#000 center/cover no-repeat url("${item.src}")`;
      heroLen = 'Still';
      heroMeta.children[3].textContent = heroLen + ' · ';
    }
  }

  function paintEmptyHero() {
    hero.classList.remove('is-vertical');
    heroTitle.textContent = 'Happy Birthday, Madam G';
    heroMeta.textContent = 'Featured · Coming soon';
    heroDesc.textContent = 'Nothing has been added to this profile yet. It won’t stay that way for long.';
    heroBadges.replaceChildren(floatBadge('Loading love 💛'));
  }

  /* ---------- More Info modal (4.8) ------------------------------------ */
  async function openModal(item) {
    const previewHost = h('div', { class: 'yt-host' });
    let preview = null;
    const muteBtn = iconButton('mute', 'Unmute preview', () => {
      if (!preview) return;
      const m = preview.isMuted();
      m ? preview.unMute() : preview.mute();
      muteBtn.replaceChildren(icon(m ? 'volume' : 'mute'));
    }, 'modal-mute');

    const listBtn = h('button', { class: `round ${item.inList ? 'on' : ''}`, title: 'Add to My List' }, icon(item.inList ? 'check' : 'plus'));
    listBtn.addEventListener('click', () => {
      toggleList(item);
      listBtn.classList.toggle('on', item.inList);
      listBtn.replaceChildren(icon(item.inList ? 'check' : 'plus'));
      toast(item.inList ? 'Added to My List' : 'Removed from My List');
      renderBody();
    });
    const likeBtn = h('button', { class: `round ${item.liked ? 'on' : ''}`, title: 'Like' }, icon('thumb'));
    likeBtn.addEventListener('click', () => {
      toggleLike(item);
      likeBtn.classList.toggle('on', item.liked);
      toast(item.liked ? 'Liked 💛' : 'Unliked');
      renderBody();
    });

    const card = h('div', { class: 'modal-card' },
      h('div', { class: 'modal-preview' },
        item.kind === 'video' ? h('div', { class: 'yt-frame' }, previewHost) : h('img', { class: 'modal-still', src: item.src, alt: item.title || '' }),
        h('div', { class: 'modal-preview-scrim' }),
        h('h2', { class: 'modal-title brush' }, item.title || 'Untitled'),
        item.kind === 'video' ? muteBtn : null,
        h('button', { class: 'modal-close', title: 'Close', onClick: close }, icon('close'))
      ),
      h('div', { class: 'modal-actions' },
        h('button', { class: 'btn-white', onClick: () => { close(); nav.open(profileId, item.id); } }, icon('play'), 'Play'),
        // Section 10 — decorative unless a real integration is added
        h('button', { class: 'btn-party', onClick: () => toast('Teleparty is just for show 💛 — but I’m always watching with you') }, icon('party'), 'Start a Teleparty'),
        listBtn, likeBtn
      ),
      h('div', { class: 'modal-info' },
        h('div', { class: 'modal-col' },
          h('div', { class: 'modal-tags' },
            h('span', { class: 'dim' }, new Date(item.addedAt).getFullYear()),
            h('span', { class: 'tag' }, item.kind === 'photo' ? 'Photo' : item.orientation === 'vertical' ? 'Short' : 'Video'),
            h('span', { class: 'tag' }, 'HD'),
            h('span', { class: 'rating' }, '💛 U/A')),
          h('p', { class: 'modal-desc', html: renderDescription(item.description || 'No description on this one yet — it speaks for itself.', item.orientation === 'vertical') })),
        h('div', { class: 'modal-col side' },
          field('Who’s in this', item.kind === 'photo' ? 'Us' : 'You, mostly'),
          field('Genres', 'Us · Real life · Comfort watch'),
          field('This is', pick(['Heartfelt', 'Silly', 'Quietly perfect', 'Loud and happy'])))
      )
    );

    const overlay = h('div', { class: 'modal-overlay', onClick: (e) => e.target === overlay && close() }, card);
    el.append(overlay);
    requestAnimationFrame(() => overlay.classList.add('in'));
    window.addEventListener('keydown', escClose);

    if (item.kind === 'video') {
      preview = await createPlayer(previewHost, { videoId: item.ytId, muted: true, loop: true });
      preview.play();
    }

    function field(label, value) {
      return h('div', { class: 'field' }, h('span', { class: 'field-label' }, `${label}: `), h('span', { class: 'field-value' }, value));
    }
    function escClose(ev) { if (ev.key === 'Escape') close(); }
    function close() {
      window.removeEventListener('keydown', escClose);
      overlay.classList.remove('in');
      preview?.destroy();
      setTimeout(() => overlay.remove(), 320);
    }
  }

  /* ---------- notifications panel (4.12) ------------------------------- */
  let bellPanel = null;
  let notifFeed = null; // built once so read/unread survives closing the panel
  let notifTab = 'All';

  /* One note per row: who it's from, when, the note itself, and whether she has
     opened it yet. Order is reshuffled per screen, so the panel reads fresh
     every visit (4.12's "rotating" messages). */
  function buildFeed() {
    const shuffled = NOTIFICATIONS.slice().sort(() => Math.random() - 0.5);
    const kinds = ['heart', 'thumb', 'party'];
    const feed = shuffled.map((text, i) => ({
      text,
      sub: 'Left a note for you',
      when: i === 0 ? 'Just now' : `${i}h ago`,
      unread: true, // she hasn't opened any of them yet
      kind: kinds[i % kinds.length],
    }));
    // an invite row, so the action buttons in the reference have a real job
    if (featured) {
      feed.unshift({
        text: '',
        sub: 'Invited you to watch',
        entity: featured.title || 'our story',
        when: 'Just now',
        unread: true,
        kind: 'heart',
        invite: true,
      });
    }
    return feed;
  }

  function notifRow(n) {
    const avatar = h('div', { class: 'notif-ava' },
      h('span', { class: 'notif-ava-face' }, 'A'),
      h('span', { class: `notif-kind kind-${n.kind}` }, icon(n.kind)));

    const top = h('div', { class: 'notif-top' },
      h('span', { class: 'notif-who' }, 'Abhi'),
      h('span', { class: 'notif-time' }, n.when));

    const sub = h('div', { class: 'notif-sub' }, n.sub, n.entity ? h('b', {}, ` ${n.entity}`) : null);
    const main = h('div', { class: 'notif-main' }, top, sub);

    if (n.text) main.append(h('div', { class: 'notif-body' }, n.text));

    if (n.invite) {
      main.append(h('div', { class: 'notif-actions' },
        h('button', { class: 'notif-btn ghost', onClick: (e) => { e.stopPropagation(); markRead(n); toast('Maybe later then 💛'); } }, 'Decline'),
        h('button', { class: 'notif-btn solid', onClick: (e) => { e.stopPropagation(); markRead(n); closeBell(); nav.open(profileId, featured.id); } }, 'Accept')));
    }

    const row = h('div', { class: `notif ${n.unread ? 'unread' : ''}` },
      avatar, main, n.unread ? h('span', { class: 'notif-unread' }) : null);
    row.addEventListener('click', () => markRead(n));
    return row;
  }

  function markRead(n) {
    if (!n.unread) return;
    n.unread = false;
    paintFeed();
    paintBellCount();
  }

  function paintBellCount() {
    const n = notifFeed ? notifFeed.filter((x) => x.unread).length : NOTIFICATIONS.length;
    bellDot.textContent = String(n);
    bellDot.classList.toggle('read', n === 0);
  }

  let notifListEl = null;
  let notifTabsEl = null;
  function paintFeed() {
    if (!notifListEl) return;
    const rows = notifTab === 'Unread' ? notifFeed.filter((n) => n.unread) : notifFeed;
    notifListEl.replaceChildren(
      ...(rows.length ? rows.map(notifRow) : [h('div', { class: 'notif-empty' }, 'All caught up 💛')])
    );
    for (const b of notifTabsEl.children) b.classList.toggle('on', b.textContent === notifTab);
  }

  function toggleBell() {
    if (bellPanel) return closeBell();
    if (!notifFeed) notifFeed = buildFeed();

    notifListEl = h('div', { class: 'notif-list' });
    notifTabsEl = h('div', { class: 'notif-tabs' },
      ['All', 'Unread'].map((t) =>
        h('button', { class: `notif-tab ${t === notifTab ? 'on' : ''}`, onClick: () => { notifTab = t; paintFeed(); } }, t)));

    bellPanel = h('div', { class: 'notif-panel' },
      h('div', { class: 'notif-head' }, h('h3', {}, 'Notifications'), notifTabsEl),
      notifListEl);
    paintFeed();
    bellWrap.append(bellPanel);
    requestAnimationFrame(() => bellPanel.classList.add('in'));
  }
  function closeBell() {
    bellPanel?.classList.remove('in');
    notifListEl = null; // stop repaints landing on a detached panel
    notifTabsEl = null;
    const p = bellPanel;
    bellPanel = null;
    setTimeout(() => p?.remove(), 300);
  }

  /* ---------- scroll behaviour: hero keeps playing, just recedes ------- */
  // the hero is a card that scrolls away on its own now, so nothing to dim —
  // the bar only picks up a shadow once she has moved off the top
  const onScroll = () => header.classList.toggle('solid', window.scrollY > 40);

  /* Entering fullscreen changes the viewport width, which changes how many cards
     fit — so every row has to re-measure or its arrows go stale. */
  const repaintRows = () => rowPainters.forEach((p) => p());
  window.addEventListener('resize', repaintRows);
  document.addEventListener('fullscreenchange', repaintRows);
  window.addEventListener('scroll', onScroll, { passive: true });

  const onOutside = (ev) => {
    if (!profileBadge.contains(ev.target)) profileMenu.classList.remove('open');
    if (bellPanel && !bellWrap.contains(ev.target)) closeBell();
  };
  document.addEventListener('click', onOutside);

  const onChange = () => renderBody();
  window.addEventListener('madam:content-changed', onChange);

  renderBody();
  // built here (not on first open) so the bell's count is honest from the start
  notifFeed = buildFeed();
  paintBellCount();

  return {
    el,
    begin() { window.scrollTo({ top: 0 }); onScroll(); },
    destroy() {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', repaintRows);
      document.removeEventListener('fullscreenchange', repaintRows);
      window.removeEventListener('madam:content-changed', onChange);
      document.removeEventListener('click', onOutside);
      clearInterval(heroWatch);
      heroPlayer?.destroy();
    },
  };
}
