/* Content store — link parsing, kind/orientation auto-detection, localStorage.
   Section 6: a single pasted link is all that's needed; the system works out
   whether it's a video or a photo, and for photos, which way up it is.

   MongoDB is the source of truth. localStorage is a fast cache.
   All write operations await the server — if the server fails, the user is told. */

import { SEED, SEED_VERSION, enabledProfiles, US_SECTIONS } from './config.js';

const KEY = 'madam.netflix.v1';

// Assigned at the bottom of this module — the link patterns it depends on are
// `const`, so they have to be initialised first.
let state;

/* ---------- toast helper (lazy import to avoid circular deps) ---------- */
let _toast = null;
function showToast(msg) {
  if (!_toast) {
    import('./ui.js').then((m) => { _toast = m.toast; _toast(msg); }).catch(() => {});
  } else {
    _toast(msg);
  }
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return autoCategorizeCollegeSnippets(syncSeed(JSON.parse(raw)));
  } catch (_) {}
  return autoCategorizeCollegeSnippets(seeded());
}

function autoCategorizeCollegeSnippets(s) {
  if (!s) return s;
  if (!s.customSections) s.customSections = {};
  if (!s.profiles || !s.profiles.us) return s;
  const collegeKeywords = ['she walked into my world', 'she became part of my e', 'from faculty to family', 'faculty', 'college'];
  let updated = false;
  for (const item of s.profiles.us) {
    const t = (item.title || '').toLowerCase();
    if (collegeKeywords.some((kw) => t.includes(kw))) {
      if (item.section !== 'College Snippets') {
        item.section = 'College Snippets';
        updated = true;
      }
    }
  }
  if (updated) {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (_) {}
  }
  return s;
}

function seeded() {
  const s = { profiles: {}, customSections: {}, createdAt: Date.now(), seedVersion: SEED_VERSION };
  for (const p of enabledProfiles()) s.profiles[p.id] = [];
  for (const [profileId, links] of Object.entries(SEED)) {
    s.profiles[profileId] = links.map((link) => makeItem({ link }));
  }
  return s;
}

/* Appends seed links added since this browser last loaded, matched by link so
   nothing is duplicated and nothing already saved is disturbed. Only runs when
   SEED_VERSION has moved on, so a link removed by hand stays removed. */
function syncSeed(s) {
  if (!s) return seeded();
  if (!s.customSections) s.customSections = {};
  if (s.seedVersion === SEED_VERSION) return s;
  let added = 0;
  for (const [profileId, links] of Object.entries(SEED)) {
    if (!s.profiles) s.profiles = {};
    if (!s.profiles[profileId]) s.profiles[profileId] = [];
    const have = new Set(s.profiles[profileId].map((i) => i.link));
    for (const link of links) {
      if (have.has(link)) continue;
      s.profiles[profileId].push(makeItem({ link }));
      added++;
    }
  }
  s.seedVersion = SEED_VERSION;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch (_) {}
  if (added) console.debug(`[madam] added ${added} new seed item(s)`);
  return s;
}

function persist() {
  state.updatedAt = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('[madam] could not persist content', e);
  }
  window.dispatchEvent(new CustomEvent('madam:content-changed'));
}

/* ---------- server communication helpers -------------------------------- */

function getAuthHeaders() {
  const token = sessionStorage.getItem('madam.admin.session');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

async function serverPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Server returned ${res.status}`);
  return res.json();
}

async function serverPut(url, body) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Server returned ${res.status}`);
  return res.json();
}

async function serverDelete(url) {
  const res = await fetch(url, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Server returned ${res.status}`);
  return res.json();
}

/* ---------- link parsing ---------------------------------------------- */

const YT_PATTERNS = [
  /(?:youtube\.com\/shorts\/)([\w-]{6,})/i,
  /(?:youtu\.be\/)([\w-]{6,})/i,
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|live\/))([\w-]{6,})/i,
];

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|bmp|heic)(\?|#|$)/i;

export function parseLink(rawLink) {
  const link = (rawLink || '').trim();
  if (!link) return null;

  for (const re of YT_PATTERNS) {
    const m = link.match(re);
    if (m) {
      const ytId = m[1].split('?')[0].split('&')[0].split('#')[0].split('/')[0];
      return {
        kind: 'video',
        ytId,
        // Auto-detect: /shorts/ links are the vertical, reels-style content (4.10)
        orientation: /\/shorts\//i.test(link) ? 'vertical' : 'horizontal',
      };
    }
  }

  // Google Drive shares → direct view URL so <img> can render them
  const drive = link.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?[^#]*id=)([\w-]{10,})/i);
  if (drive) {
    return { kind: 'photo', src: `https://drive.google.com/thumbnail?id=${drive[1]}&sz=w2000`, orientation: null };
  }

  if (IMAGE_EXT.test(link) || /(imgur|unsplash|pexels|cloudinary|githubusercontent|imgbb|postimg)/i.test(link)) {
    return { kind: 'photo', src: link, orientation: null };
  }

  // Unknown: treat as a photo attempt (harmless — the viewer shows a fallback)
  return { kind: 'photo', src: link, orientation: null };
}

/* Section 3.6 — poster is always auto-extracted from the video itself.
   YouTube exposes real frame grabs: hq1 ≈ 25%, hq2 ≈ middle, hq3 ≈ later. */
export function posterFor(item) {
  if (item.kind === 'photo') return item.src;
  return `https://i.ytimg.com/vi/${item.ytId}/hq2.jpg`;
}
export function posterFallbacks(item) {
  if (item.kind === 'photo') return [];
  return [
    `https://i.ytimg.com/vi/${item.ytId}/hq3.jpg`,
    `https://i.ytimg.com/vi/${item.ytId}/hqdefault.jpg`,
    `https://i.ytimg.com/vi/${item.ytId}/mqdefault.jpg`,
  ];
}

let seq = 0;
export function getItemSection(item) {
  if (item.section) return item.section;
  return item.orientation === 'vertical' ? 'Short and Sweet Memories of Us' : 'Random Us';
}

export function getSections(profileId) {
  if (!state) return profileId === 'us' ? US_SECTIONS : [];
  if (!state.customSections) state.customSections = {};
  const custom = state.customSections[profileId] || [];
  const base = profileId === 'us' ? US_SECTIONS : [];

  // Also include any section assigned to items in this profile
  const itemSections = (state.profiles[profileId] || [])
    .map((i) => i.section)
    .filter(Boolean);

  const set = new Set([...base, ...custom, ...itemSections]);
  return Array.from(set);
}

export async function addCustomSection(profileId, sectionName) {
  const name = (sectionName || '').trim();
  if (!name) return false;
  if (!state.customSections) state.customSections = {};
  if (!state.customSections[profileId]) state.customSections[profileId] = [];
  const existing = getSections(profileId);
  if (!existing.includes(name)) {
    state.customSections[profileId].push(name);
    persist();
    try {
      await serverPost('/api/sections', { profileId, name });
    } catch (err) {
      console.warn('[madam] Failed to save section to server:', err);
      showToast('⚠️ Section saved locally but failed to sync to server');
    }
    return true;
  }
  return false;
}

export function makeItem({ title = '', description = '', link, section = '' }) {
  const parsed = parseLink(link);
  const id = `c${Date.now().toString(36)}${(seq++).toString(36)}`;
  const defaultSection = parsed?.orientation === 'vertical' ? 'Short and Sweet Memories of Us' : 'Random Us';
  return {
    id,
    title: title.trim(),
    description: description.trim(),
    link: link.trim(),
    section: (section && section.trim()) ? section.trim() : defaultSection,
    kind: parsed?.kind || 'photo',
    ytId: parsed?.ytId || null,
    src: parsed?.src || null,
    orientation: parsed?.orientation || null, // photos resolve async (4.11)
    addedAt: Date.now(),
    liked: false,
    inList: false,
    badge: null, // assigned at render time from the badge pool
  };
}

/* Photos: work out orientation from the image itself, then remember it. */
export function resolveOrientation(item) {
  if (item.kind !== 'photo' || item.orientation) return Promise.resolve(item.orientation || 'horizontal');
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const o = img.naturalHeight > img.naturalWidth * 1.05 ? 'vertical' : 'horizontal';
      patchItemRaw(item.id, { orientation: o, w: img.naturalWidth, h: img.naturalHeight });
      resolve(o);
    };
    img.onerror = () => {
      patchItemRaw(item.id, { orientation: 'horizontal' });
      resolve('horizontal');
    };
    img.src = item.src;
  });
}

/* ---------- duplicate detection ---------------------------------------- */

/* Returns the unique content key for an item — ytId for videos, src for photos.
   Used to check for duplicates within the same profile+section. */
function contentKey(item) {
  if (item.kind === 'video' && item.ytId) return `yt:${item.ytId}`;
  if (item.src) return `src:${item.src}`;
  return `link:${item.link}`;
}

/* Check if a duplicate item already exists in the same profile and section.
   Returns the duplicate item if found, null otherwise. */
function findDuplicate(profileId, newItem) {
  const key = contentKey(newItem);
  const section = getItemSection(newItem);
  const existing = (state.profiles[profileId] || []);
  return existing.find((i) => contentKey(i) === key && getItemSection(i) === section) || null;
}

/* ---------- reads ------------------------------------------------------ */

export const allProfileIds = () => enabledProfiles().map((p) => p.id);

export function itemsFor(profileId, sectionFilter = null) {
  const list = (state.profiles[profileId] || []).slice();
  if (!sectionFilter || sectionFilter === 'All') return list;
  return list.filter((item) => getItemSection(item) === sectionFilter);
}

export function findItem(profileId, itemId) {
  return (state.profiles[profileId] || []).find((i) => i.id === itemId) || null;
}

export function neighbours(profileId, itemId) {
  const list = itemsFor(profileId);
  const i = list.findIndex((x) => x.id === itemId);
  return { prev: list[i - 1] || null, next: list[i + 1] || null, index: i, total: list.length };
}

export function searchAll(profileId, q) {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  return itemsFor(profileId).filter(
    (i) => (i.title || '').toLowerCase().includes(needle) || (i.description || '').toLowerCase().includes(needle)
  );
}

/* ---------- writes ----------------------------------------------------- */

/* addContent is now async. Awaits the server write and reports errors.
   Returns { item } on success, or { error, duplicate } on failure. */
export async function addContent(profileId, { title, description, link, section }) {
  if (!state.profiles[profileId]) state.profiles[profileId] = [];
  const item = makeItem({ title, description, link, section });

  // Duplicate check — same ytId or src in the same section
  const dup = findDuplicate(profileId, item);
  if (dup) {
    const sec = getItemSection(item);
    return { item: null, error: `This link already exists in "${sec}"`, duplicate: dup };
  }

  // Save to server first (source of truth)
  try {
    await serverPost('/api/content', { ...item, profileId });
  } catch (err) {
    console.error('[madam] Failed to save content to server:', err);
    showToast('❌ Failed to save to database — please check your connection and try again');
    return { item: null, error: 'Server save failed' };
  }

  // Server succeeded — now update local state
  state.profiles[profileId].push(item);
  persist();
  if (item.kind === 'photo') resolveOrientation(item);
  return { item, error: null };
}

/* updateContent is now async. Awaits the server and reports errors. */
export async function updateContent(profileId, itemId, patch) {
  const list = state.profiles[profileId] || [];
  const item = list.find((i) => i.id === itemId);
  if (!item) return null;

  // If link is changing, check for duplicates with the new link
  if (patch.link !== undefined && patch.link.trim() !== item.link) {
    const parsed = parseLink(patch.link);
    const tempItem = { ...item, link: patch.link.trim(), kind: parsed?.kind || 'photo', ytId: parsed?.ytId || null, src: parsed?.src || null, orientation: parsed?.orientation || null };
    if (patch.section !== undefined) tempItem.section = patch.section.trim();
    const dup = findDuplicate(profileId, tempItem);
    if (dup && dup.id !== itemId) {
      showToast(`⚠️ This link already exists in "${getItemSection(tempItem)}"`);
      return null;
    }
  }

  // Save to server first
  try {
    await serverPut(`/api/content/${itemId}`, patch);
  } catch (err) {
    console.error('[madam] Failed to update content on server:', err);
    showToast('❌ Failed to save changes to database — please try again');
    return null;
  }

  // Server succeeded — now update local state
  if (patch.link !== undefined && patch.link.trim() !== item.link) {
    const parsed = parseLink(patch.link);
    Object.assign(item, {
      link: patch.link.trim(),
      kind: parsed?.kind || 'photo',
      ytId: parsed?.ytId || null,
      src: parsed?.src || null,
      orientation: parsed?.orientation || null,
    });
    if (item.kind === 'photo') setTimeout(() => resolveOrientation(item), 0);
  }
  if (patch.title !== undefined) item.title = patch.title.trim();
  if (patch.description !== undefined) item.description = patch.description.trim();
  if (patch.section !== undefined) item.section = patch.section.trim();
  persist();
  return item;
}

/* removeContent is now async. Awaits the server and reports errors. */
export async function removeContent(profileId, itemId) {
  // Delete from server first
  try {
    await serverDelete(`/api/content/${itemId}`);
  } catch (err) {
    console.error('[madam] Failed to delete content from server:', err);
    showToast('❌ Failed to delete from database — please try again');
    return false;
  }

  // Server succeeded — now update local state
  state.profiles[profileId] = (state.profiles[profileId] || []).filter((i) => i.id !== itemId);
  persist();
  return true;
}

export async function syncWithServer() {
  try {
    const resContent = await fetch('/api/content');
    if (resContent.ok) {
      const { items } = await resContent.json();
      if (Array.isArray(items) && items.length) {
        // Server is source of truth — rebuild profile lists from server data
        // but keep any local-only items that haven't been synced yet
        const serverIds = new Set(items.map((i) => i.id));
        for (const item of items) {
          const pid = item.profileId || 'us';
          if (!state.profiles[pid]) state.profiles[pid] = [];
          const idx = state.profiles[pid].findIndex((x) => x.id === item.id);
          if (idx >= 0) {
            // Server version wins — merge server data over local
            state.profiles[pid][idx] = { ...state.profiles[pid][idx], ...item };
          } else {
            state.profiles[pid].push(item);
          }
        }
        console.debug(`[madam] Synced ${items.length} item(s) from server`);
      }
    }
  } catch (err) {
    console.warn('[madam] Could not sync content from server:', err.message);
  }

  try {
    const resSec = await fetch('/api/sections');
    if (resSec.ok) {
      const { sections } = await resSec.json();
      if (Array.isArray(sections)) {
        if (!state.customSections) state.customSections = {};
        for (const sec of sections) {
          if (sec.profileId && sec.name) {
            if (!state.customSections[sec.profileId]) state.customSections[sec.profileId] = [];
            if (!state.customSections[sec.profileId].includes(sec.name)) {
              state.customSections[sec.profileId].push(sec.name);
            }
          }
        }
      }
    }
  } catch (_) {}

  persist();
}
syncWithServer();

export function moveContent(profileId, itemId, delta) {
  const list = state.profiles[profileId] || [];
  const i = list.findIndex((x) => x.id === itemId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  persist();
}

/* silent patch used by orientation detection / like / list toggles */
function patchItemRaw(itemId, patch) {
  for (const list of Object.values(state.profiles)) {
    const item = (list || []).find((i) => i.id === itemId);
    if (item) {
      Object.assign(item, patch);
      persist();
      return item;
    }
  }
  return null;
}

export const toggleLike = (item) => patchItemRaw(item.id, { liked: !item.liked });
export const toggleList = (item) => patchItemRaw(item.id, { inList: !item.inList });

export function resetToSeed() {
  state = seeded();
  persist();
}

/* boot: load saved content, or lay down the Section 9 seed list */
state = load();
