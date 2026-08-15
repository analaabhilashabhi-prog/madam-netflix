/* Madam G's Netflix — configuration, credentials and editable content pools.
   Everything in Section 8 of the spec (the "fill later" pools) lives here so it
   can be swapped without touching any app logic. */

export const BUMPER = {
  id: 'GV3HUDMQ-F8',
  maxSeconds: 30,
};

export const LETTER_BGM = {
  src: 'assets/music/letter-bgm.mp3',
  videoId: 'U5UhkvH3IcI',
  start: 10, // seconds — skips the intro, and every loop restarts here too
  volume: 80,
};

/* The photo wall drifting behind the letter. Whatever you add in the Admin
   Panel replaces this list entirely — these are only placeholders so the wall
   is visible before you have added anything of your own. Ten is the minimum
   for it to look full; below that the wall repeats what it has. */
/* Deliberately mixed shapes — portraits, squares, landscapes and phone clips —
   so the masonry has something to actually lay out. Asking picsum for the same
   crop every time is what made an earlier version look like a plain grid. */
export const LETTER_GALLERY_PLACEHOLDERS = [
  [1015, 600, 400],  // 3:2 landscape
  [1025, 400, 600],  // 2:3 portrait
  [1039, 600, 600],  // square
  [1043, 800, 450],  // 16:9
  [1044, 450, 800],  // 9:16
  [1050, 640, 480],  // 4:3
  [1062, 480, 640],  // 3:4
  [1069, 600, 400],
  [1074, 500, 750],
  [1080, 600, 600],
  [1084, 700, 400],
  [106, 400, 620],
  [110, 800, 500],
  [133, 520, 700],
  [164, 640, 480],
  [180, 450, 800],
  [211, 700, 700],
  [225, 800, 450],
  [239, 420, 640],
  [244, 600, 400],
  [287, 560, 760],
  [301, 640, 420],
].map(([id, w, h]) => `https://picsum.photos/id/${id}/${w}/${h}`);

/* Section 4.4 — the PIN itself deliberately does NOT live here. This file is
   served to the browser, so anything in it is readable by anyone who opens the
   page. It is checked by the server (SECRET_PIN in .env, POST /api/auth/pin). */

/* Section 5 — profiles. Secret / Her / Us are confirmed.
   The undecided 4th (Section 10) can be switched on by flipping `enabled`. */
export const PROFILES = [
  {
    id: 'her',
    name: 'Madam G',
    initial: 'G',
    photo: '', // drop a photo URL here and it replaces the gradient tile
    tint: 'linear-gradient(145deg,#ff5f6d,#c9184a)',
    locked: false,
    enabled: true,
    tagline: 'Everything that is about you',
  },
  {
    id: 'us',
    name: 'Us',
    initial: 'U',
    photo: '',
    tint: 'linear-gradient(145deg,#f7b733,#fc4a1a)',
    locked: false,
    enabled: true,
    tagline: 'Our shared memories',
  },
  {
    id: 'secret',
    name: 'Secret',
    initial: '🔒',
    photo: '',
    tint: 'linear-gradient(145deg,#3a1c71,#d76d77)',
    locked: true, // Section 4.4 — PIN gate
    enabled: true,
    tagline: 'Only for us two',
  },
  {
    id: 'dreams',
    name: 'Someday',
    initial: '∞',
    photo: '',
    tint: 'linear-gradient(145deg,#0f3443,#34e89e)',
    locked: false,
    enabled: false, // Section 10 — undecided 4th profile, off until you say so
    tagline: 'The plans we keep making',
  },
];

export const US_SECTIONS = [
  'Random Us',
  'Short and Sweet Memories of Us',
  'College Snippets',
];

/* Section 8 — randomized cute badge tags (hero + row cards). */
export const BADGES = [
  'Replayed 100 times 💛',
  'Her favourite 💫',
  'Top 1 in our house',
  'Certified heart-melter',
  'Rewatched at 2am',
  'Reason I smile 🙂',
  'Best day of that month',
  'Still my screensaver',
  'Highly rewatched by Abhi',
  'Number 1 in Madam G’s heart',
];

/* Section 8 — love-note outro messages, shown after each video ends. */
export const OUTRO_NOTES = [
  'That was one of my favourite days. Thank you for being in it.',
  'I could watch this on loop and never get bored — same way I never get bored of you.',
  'Happy birthday, Madam G. Every one of these exists because of you.',
  'If I had to pick a life, I’d pick this one again. With you.',
  'You make ordinary days look like this. That’s your magic.',
];

/* Section 8 — sweet/affirming notification panel messages. */
export const NOTIFICATIONS = [
  'You’re the most beautiful person on this entire earth.',
  'Reminder: you are so deeply loved today.',
  'Your laugh is my favourite sound ever recorded.',
  'Whatever you’re worrying about — you’ll handle it. You always do.',
  'You are enough, exactly as you are right now.',
  'Somebody thought about you the moment they woke up today. It was me.',
  'Happy birthday, Madam G 🎂 — this whole app is a love letter.',
  'You’re not too much. You’re just rare.',
];

/* Section 8 — background music for the photo viewer.
   Drop an mp3 at assets/music/soft.mp3 (or point this at any URL) and it is used.
   If the file is missing, a gentle generated piano/pad loop plays instead. */
export const PHOTO_MUSIC = {
  src: 'assets/music/soft.mp3',
  volume: 0.35,
};

export const SEED_VERSION = 2;

// Seed content is stored dynamically in database — zero hardcoded URLs in code
export const SEED = {};

/* Row labels used for the Her / Secret profiles (Section 10 left these open —
   these are dynamic and only appear when there is content to fill them). */
export const ROW_LABELS = {
  featured: 'Because You Watched Us',
  recent: 'New For Madam G',
  videos: 'Our Little Movies',
  shorts: 'Shorts — Quick Little Moments',
  photos: 'Stills We Kept',
  list: 'My List',
  loved: 'Watch It Again',
};

export const enabledProfiles = () => PROFILES.filter((p) => p.enabled);
export const profileById = (id) => PROFILES.find((p) => p.id === id);
export const pick = (arr, seed = Math.random()) => arr[Math.floor(seed * arr.length) % arr.length];
