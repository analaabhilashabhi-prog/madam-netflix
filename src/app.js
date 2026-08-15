/* Router + the universal playback flow from Section 2 / Section 3. */

import { profileById, enabledProfiles } from './config.js';
import { findItem, itemsFor, siteSession } from './store.js';
import { mount, toast } from './ui.js';
import { playBumper } from './bumper.js';
import { landingScreen } from './screens/landing.js';
import { letterScreen } from './screens/letter.js';
import { profilesScreen } from './screens/profiles.js';
import { homeScreen } from './screens/home.js';
import { playerScreen } from './screens/player.js';
import { shortsScreen } from './screens/shorts.js';
import { photoScreen } from './screens/photo.js';
import { adminScreen } from './screens/admin.js';
import { gateScreen } from './screens/gate.js';
import { startBrowseBgm, pauseBrowseBgm } from './browsebgm.js';

const nav = {
  letter() {
    setHash('/letter');
    show(letterScreen(nav));
  },

  landing() {
    setHash('/landing');
    show(landingScreen(nav));
  },

  async profiles({ withBumper = false } = {}) {
    setHash('/profiles');
    if (withBumper) {
      const bumper = playBumper();
      show(profilesScreen(nav));
      await bumper;
      // only after the ta-dum has finished, so the two never talk over each other
      startBrowseBgm();
    } else {
      show(profilesScreen(nav));
      startBrowseBgm();
    }
  },

  home(profileId) {
    const p = profileById(profileId);
    if (!p) return nav.profiles();
    setHash(`/home/${profileId}`);
    show(homeScreen(nav, profileId));
    startBrowseBgm(); // she is back from a video — pick the music up again
  },

  /* Section 3.1 + 3.5: every video gets the bumper; photos fade in directly.
     The target player is mounted *behind* the bumper so it buffers while the
     bumper plays — that's what makes the hand-off feel instant. */
  async open(profileId, itemId) {
    const item = findItem(profileId, itemId);
    const profile = profileById(profileId);
    if (!item || !profile) return toast('That item is gone');
    setHash(`/watch/${profileId}/${itemId}`);

    /* Out of the way before anything starts — the memory's own sound, or the
       photo screen's music, should be the only thing playing. */
    pauseBrowseBgm();

    if (item.kind === 'photo') {
      const screen = photoScreen(nav, { profile, item });
      show(screen, { autoBegin: false });
      screen.begin();
      return;
    }

    const vertical = item.orientation === 'vertical';
    const bumper = playBumper({ vertical }); // 9:16 intro for Shorts
    const screen = vertical
      ? shortsScreen(nav, { profile, item })
      : playerScreen(nav, { profile, item });
    show(screen, { autoBegin: false });
    await bumper;      // bumper fades out...
    screen.begin?.();  // ...and the buffered video is already there
  },

  admin() {
    setHash('/admin');
    pauseBrowseBgm(); // your side of the app, not hers — no soundtrack
    show(adminScreen(nav));
  },
};

let suppressHash = false;
function setHash(path) {
  suppressHash = true;
  location.hash = `#${path}`;
  setTimeout(() => (suppressHash = false), 0);
}

/* Player/photo screens are begun explicitly by nav.open (so they can buffer
   behind the bumper); everything else starts as soon as it is mounted. */
function show(screen, { autoBegin = true } = {}) {
  mount(screen);
  if (autoBegin) screen.begin?.();
  return screen;
}

function route() {
  if (suppressHash) return;
  const [, part, a, b] = (location.hash || '#/').split('/');
  if (part === 'landing') return nav.landing();
  if (part === 'letter') return nav.letter();
  if (part === 'profiles') return nav.profiles();
  if (part === 'admin') return nav.admin();
  if (part === 'home' && a) return nav.home(a);
  if (part === 'watch' && a && b) return nav.open(a, b);
  return nav.letter();
}

function startRouting() {
  window.addEventListener('hashchange', route);
  route();
}

/* boot — when the site is deployed behind a passphrase, nothing is routed and
   no content is ever requested until the door is opened. Locally the gate is
   off and this is one fast check that changes nothing she sees. */
(async () => {
  const { gate, unlocked } = await siteSession();
  if (gate && !unlocked) {
    show(gateScreen(startRouting));
    return;
  }
  startRouting();
})();

/* tiny console helper for Abhi */
window.madam = {
  profiles: () => enabledProfiles().map((p) => ({ id: p.id, name: p.name, items: itemsFor(p.id).length })),
  go: (path) => (location.hash = `#${path}`),
};
