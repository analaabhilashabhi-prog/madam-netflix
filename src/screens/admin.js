/* Section 7 — private Admin Panel. Not part of her experience.
   Login, pick a profile, add content by link, and edit/reorder/remove anything
   that was already posted. */

import { enabledProfiles, profileById, US_SECTIONS } from '../config.js';
import { addContent, updateContent, removeContent, moveContent, itemsFor, parseLink, posterFor, posterFallbacks, resetToSeed, getSections, addCustomSection, getItemSection, pushLocalToCloud, fetchGallery, addGalleryPhoto, removeGalleryPhoto } from '../store.js';
import { h, icon, toast } from '../ui.js';

const SESSION = 'madam.admin.session';

export function adminScreen(nav) {
  const el = h('div', { class: 'admin' });
  const authed = Boolean(sessionStorage.getItem(SESSION));
  authed ? renderPanel() : renderLogin();
  return { el };

  /* ---------- login ---------------------------------------------------- */
  function renderLogin() {
    const email = h('input', { type: 'email', class: 'adm-input', placeholder: 'Email', autocomplete: 'username' });
    const pass = h('input', { type: 'password', class: 'adm-input', placeholder: 'Password', autocomplete: 'current-password' });
    const err = h('div', { class: 'admin-err' });

    const submit = async () => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.value.trim(), password: pass.value }),
        });
        const data = await res.json();
        if (res.ok && data.success && data.token) {
          sessionStorage.setItem(SESSION, data.token);
          renderPanel();
          return;
        }
      } catch (_) {}
      err.textContent = 'Wrong email or password.';
      form.classList.add('shake');
      setTimeout(() => form.classList.remove('shake'), 500);
    };
    const form = h('form', { class: 'admin-card', onSubmit: (e) => { e.preventDefault(); submit(); } },
      h('div', { class: 'wordmark' }, 'MADAM'),
      h('h2', {}, 'Admin sign in'),
      h('p', { class: 'dim' }, 'Private. This is not part of her side of the app.'),
      email, pass, err,
      h('button', { class: 'btn-red', type: 'submit' }, 'Sign in'),
      h('button', { class: 'btn-ghost', type: 'button', onClick: () => nav.landing() }, icon('back'), 'Back to the site')
    );
    el.replaceChildren(h('div', { class: 'admin-center' }, form));
  }

  /* ---------- panel ---------------------------------------------------- */
  function renderPanel() {
    let profileId = enabledProfiles()[0].id;
    let currentSectionFilter = 'All';

    const profileTabs = h('div', { class: 'admin-tabs' });
    const listHost = h('div', { class: 'admin-list' });
    const sectionBar = h('div', { class: 'admin-section-bar' });

    const title = h('input', { class: 'adm-input', placeholder: 'Title (optional)' });
    const desc = h('textarea', { class: 'adm-input', rows: '3', placeholder: 'Description (optional)' });
    const link = h('input', { class: 'adm-input', placeholder: 'Link — YouTube video, YouTube Short, or photo URL', required: true });

    const sectionSelect = h('select', { class: 'adm-input' });

    function updateSectionSelect() {
      const options = getSections(profileId);
      const items = options.length ? options : ['Main'];
      sectionSelect.replaceChildren(
        ...items.map((sec) => h('option', { value: sec }, sec)),
        h('option', { value: '+new' }, '+ Create New Section...')
      );
    }
    updateSectionSelect();

    sectionSelect.addEventListener('change', () => {
      if (sectionSelect.value === '+new') {
        promptCreateSection();
      }
    });

    const kindHint = h('div', { class: 'kind-hint' }, 'Paste a link and I’ll work out what it is.');

    link.addEventListener('input', () => {
      const p = parseLink(link.value);
      if (!link.value.trim()) return (kindHint.textContent = 'Paste a link and I’ll work out what it is.');
      if (p?.kind === 'video' && profileId === 'us') {
        const target = p.orientation === 'vertical' ? 'Short and Sweet Memories of Us' : 'Random Us';
        const avail = getSections(profileId);
        if (avail.includes(target)) sectionSelect.value = target;
      }
      kindHint.textContent = !p
        ? 'Not a link I recognise.'
        : p.kind === 'video'
        ? `Detected: ${p.orientation === 'vertical' ? 'vertical Short' : 'horizontal video'} · YouTube id ${p.ytId} · poster auto-grabbed from mid-video`
        : 'Detected: photo · orientation auto-detected once it loads';
    });

    const form = h('form', { class: 'admin-form', onSubmit: async (e) => {
        e.preventDefault();
        if (!link.value.trim()) return toast('A link is required');
        let sec = sectionSelect.value;
        if (!sec || sec === '+new') {
          promptCreateSection();
          sec = sectionSelect.value;
          if (!sec || sec === '+new') sec = 'Main';
        }
        const result = await addContent(profileId, { title: title.value, description: desc.value, link: link.value, section: sec });
        if (result.error) {
          toast(result.duplicate ? `\u26A0\uFE0F ${result.error}` : `\u274C ${result.error}`);
          return;
        }
        toast(`Added to ${profileById(profileId).name} in section "${result.item.section}"`);
        title.value = desc.value = link.value = '';
        kindHint.textContent = 'Paste a link and I’ll work out what it is.';
        paintSectionBar();
        paintList();
      } },
      h('h3', {}, 'Add content'),
      title, desc, link,
      h('label', { class: 'dim', style: { fontSize: '12px', display: 'block', marginTop: '4px' } }, 'Section:'),
      sectionSelect,
      kindHint,
      h('button', { class: 'btn-red', type: 'submit' }, icon('plus'), 'Add')
    );

    function paintTabs() {
      profileTabs.replaceChildren(
        ...enabledProfiles().map((p) =>
          h('button', { class: `admin-tab ${p.id === profileId ? 'active' : ''}`, onClick: () => {
            profileId = p.id;
            currentSectionFilter = 'All';
            updateSectionSelect();
            paintTabs();
            paintSectionBar();
            paintList();
          } },
            h('span', { class: 'tab-dot', style: { background: p.tint } }),
            p.name,
            h('span', { class: 'tab-count' }, String(itemsFor(p.id).length)))
        )
      );
    }

    function promptCreateSection() {
      const name = prompt('Enter name for the new section (e.g. "Trip to Goa", "Graduation"):');
      if (!name || !name.trim()) return;
      const cleanName = name.trim();
      const added = addCustomSection(profileId, cleanName);
      if (added) {
        currentSectionFilter = cleanName;
        updateSectionSelect();
        sectionSelect.value = cleanName;
        paintTabs();
        paintSectionBar();
        paintList();
        toast(`Created section "${cleanName}"`);
      } else {
        toast(`Section "${cleanName}" already exists`);
      }
    }

    function paintSectionBar() {
      const sections = ['All', ...getSections(profileId)];
      sectionBar.replaceChildren(
        ...sections.map((sec) => {
          const count = itemsFor(profileId, sec).length;
          return h('button', {
            type: 'button',
            class: `sec-pill ${sec === currentSectionFilter ? 'active' : ''}`,
            onClick: () => {
              currentSectionFilter = sec;
              if (sec !== 'All') {
                sectionSelect.value = sec;
              }
              paintSectionBar();
              paintList();
            }
          }, sec, h('span', { class: 'dim', style: { fontSize: '11px', marginLeft: '2px', opacity: '0.8' } }, `(${count})`));
        }),
        h('button', {
          type: 'button',
          class: 'sec-pill add-btn',
          onClick: () => promptCreateSection()
        }, icon('plus'), 'New Section')
      );
    }

    function paintList() {
      const items = itemsFor(profileId, currentSectionFilter);
      const totalCount = itemsFor(profileId).length;
      const secLabel = currentSectionFilter === 'All' ? 'All Sections' : currentSectionFilter;

      listHost.replaceChildren(
        h('div', { class: 'admin-list-head' },
          h('h3', {}, `${profileById(profileId).name} — ${secLabel} (${items.length} item${items.length === 1 ? '' : 's'})`),
          sectionBar,
          h('span', { class: 'dim' }, currentSectionFilter === 'All' ? `Showing all ${totalCount} posts.` : `Showing only posts in "${currentSectionFilter}".`)),
        ...(items.length ? items.map(row) : [h('div', { class: 'empty-state' }, `No posts in ${secLabel} yet. Add content on the left!`)])
      );
    }

    function row(item) {
      const img = h('img', { class: 'admin-thumb', alt: '' });
      const fb = posterFallbacks(item);
      let i = 0;
      img.addEventListener('error', () => { if (i < fb.length) img.src = fb[i++]; });
      img.src = posterFor(item);

      const t = h('input', { class: 'adm-input small', value: item.title, placeholder: 'Title (optional)' });
      const d = h('textarea', { class: 'adm-input small', rows: '2', placeholder: 'Description (optional)' }, item.description);
      const l = h('input', { class: 'adm-input small', value: item.link });

      const currentSec = getItemSection(item);
      const availableSections = getSections(profileId);
      const secSel = h('select', { class: 'adm-input small' },
        ...availableSections.map((sec) => h('option', { value: sec, selected: sec === currentSec }, sec))
      );

      return h('div', { class: 'admin-row' },
        img,
        h('div', { class: 'admin-fields' }, t, d, l, secSel,
          h('div', { class: 'admin-row-meta' },
            h('span', { class: 'tag' }, item.kind === 'photo' ? 'Photo' : item.orientation === 'vertical' ? 'Short' : 'Video'),
            h('span', { class: 'dim' }, item.orientation || 'orientation pending'),
            h('span', { class: 'dim' }, new Date(item.addedAt).toLocaleString()))),
        h('div', { class: 'admin-row-actions' },
          h('button', { class: 'btn-red small', onClick: async () => {
            const updated = await updateContent(profileId, item.id, { title: t.value, description: d.value, link: l.value, section: secSel.value });
            if (updated) {
              toast('Saved \u2705');
              paintSectionBar();
              paintList();
            }
          } }, icon('edit'), 'Save'),
          h('button', { class: 'btn-ghost small', onClick: async () => { await moveContent(profileId, item.id, -1, currentSectionFilter); paintList(); } }, '↑'),
          h('button', { class: 'btn-ghost small', onClick: async () => { await moveContent(profileId, item.id, 1, currentSectionFilter); paintList(); } }, '↓'),
          h('button', { class: 'btn-ghost small danger', onClick: async () => { if (confirm('Remove this item?')) { const ok = await removeContent(profileId, item.id); if (ok) { paintList(); paintTabs(); paintSectionBar(); } } } }, icon('trash'), 'Remove'))
      );
    }

    /* ---------- letter background gallery ------------------------------ */
    const galleryGrid = h('div', { class: 'gal-grid' });
    const galleryCount = h('div', { class: 'gal-count dim' });
    const galleryInput = h('input', { class: 'adm-input', placeholder: 'Photo link (https://…)' });
    let galleryPhotos = [];

    function paintGallery() {
      const n = galleryPhotos.length;
      galleryCount.replaceChildren(
        n === 0
          ? 'Nothing added yet — placeholder photos are drifting behind her letter right now.'
          : n < 10
          ? `${n} photo${n === 1 ? '' : 's'}. The wall repeats them until there are 10.`
          : `${n} photos drifting behind the letter.`
      );
      galleryGrid.replaceChildren(
        ...galleryPhotos.map((p) =>
          h('div', { class: 'gal-cell' },
            h('img', { src: p.url, alt: '', loading: 'lazy' }),
            h('button', {
              class: 'gal-del', title: 'Remove', type: 'button',
              onClick: async () => {
                try {
                  await removeGalleryPhoto(p.id);
                  galleryPhotos = galleryPhotos.filter((x) => x.id !== p.id);
                  paintGallery();
                  toast('Removed from the letter wall');
                } catch (err) {
                  toast(`❌ ${err.message}`);
                }
              },
            }, icon('trash')))
        )
      );
    }

    async function loadGallery() {
      galleryPhotos = await fetchGallery();
      paintGallery();
    }

    const galleryForm = h('form', { class: 'admin-form gal-form', onSubmit: async (e) => {
        e.preventDefault();
        const url = galleryInput.value.trim();
        if (!url) return toast('Paste a photo link first');
        try {
          const res = await addGalleryPhoto(url);
          if (res?.photo) {
            galleryPhotos.push(res.photo);
            galleryInput.value = '';
            paintGallery();
            toast('Added to the letter wall');
          } else {
            toast(`❌ ${res?.error || 'Could not add that link'}`);
          }
        } catch (err) {
          toast(`❌ ${err.message}`);
        }
      } },
      h('h3', {}, 'Letter background wall'),
      h('p', { class: 'dim', style: { fontSize: '12px', margin: '0 0 6px' } },
        'Photos that drift behind the letter while she reads. Needs 10 or more to look full; after that add as many as you like.'),
      galleryInput,
      h('button', { class: 'btn-red', type: 'submit' }, icon('plus'), 'Add photo'),
      galleryCount,
      galleryGrid
    );

    paintTabs();
    paintSectionBar();
    paintList();
    paintGallery();
    loadGallery();

    el.replaceChildren(
      h('header', { class: 'admin-head' },
        h('div', { class: 'wordmark' }, 'MADAM'),
        h('span', { class: 'admin-chip' }, 'Admin'),
        h('div', { class: 'admin-head-right' },
          h('button', { class: 'btn-ghost small', onClick: async () => { await pushLocalToCloud(); paintTabs(); paintSectionBar(); paintList(); } }, '☁️ Sync to cloud'),
          h('button', { class: 'btn-ghost small', onClick: () => nav.profiles() }, 'Open her site'),
          h('button', { class: 'btn-ghost small', onClick: () => { if (confirm('Reset all content back to the seed/test list?')) { resetToSeed(); paintTabs(); paintList(); toast('Reset to seed content'); } } }, 'Reset to seed'),
          h('button', { class: 'btn-ghost small', onClick: () => { sessionStorage.removeItem(SESSION); renderLogin(); } }, 'Sign out'))),
      h('div', { class: 'admin-body' },
        h('div', { class: 'admin-side' }, h('h3', {}, 'Post into'), profileTabs, form, galleryForm),
        listHost)
    );
  }
}
