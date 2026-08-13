# MADAM — Madam G's Netflix

A birthday gift website built exactly to `madamjii-netflix-website-spec.md`. Netflix, rebuilt from
scratch, with every corner of it secretly about the two of you.

## Run it locally

```
cd madam-netflix
node server.js
```

…or just double-click **`start.cmd`**. It opens <http://localhost:5173/> automatically.

No `npm install`, no build step, no dependencies. A server *is* required (not `file://`) because the
app uses ES modules and the YouTube player needs a real origin.

## The two doors

| | URL | Credentials |
|---|---|---|
| Her side | <http://localhost:5173/> | — |
| Admin panel (yours) | <http://localhost:5173/#/admin> | Stored securely in MongoDB |

The admin panel is also reachable from the almost-invisible full stop in the bottom-right corner of
the landing page. Nothing anywhere in her experience links to it.

**Secret profile PIN: `1614`**

## What's wired up

- **Journey** — landing → intro bumper → profile picker → (PIN if Secret) → profile Home.
- **Intro bumper** before *every* video anywhere in the app; never before photos. Mute/unmute toggle,
  smooth fade-out into the content with no hard cut.
- **Buffered before playback.** The target video is mounted *behind* the bumper and pre-buffers while
  the bumper plays, so the hand-off is instant. Loading always shows the heart loader, never a spinner.
- **Highest quality** is requested on ready, on every play event and on every quality change (best
  available level, `vq=hd1080`, full-viewport player). Note: YouTube deprecated `setPlaybackQuality`,
  so it treats this as a hint — on a normal desktop browser at a large window it settles on 1080p, but
  YouTube has the final say. Path 2 below is the only way to guarantee it.
- **No native branding or controls** — native controls disabled, `youtube-nocookie` host, annotations
  and related videos off, and a transparent click-shield over the frame so no YouTube surface is ever
  clickable. (See "Known constraint" below.)
- **Custom player** with back arrow, scrubber + playhead + time remaining, contextual Skip Intro pill,
  play/pause · ±10s · volume, centre title + label, next · autoplay · captions · speed · fullscreen,
  and the persistent black right-side panel keeping the title and description on screen the whole time.
  No top-right icon cluster.
- **Posters are auto-extracted frames** — `.../vi/<id>/hq2.jpg` is YouTube's own mid-video frame grab
  (with later-frame and default fallbacks). Nothing is ever uploaded separately. Photos are their own poster.
- **Shorts** get their own row with tall 9:16 cards and the split-screen vertical player.
- **Photos** auto-detect orientation from the image itself and route to the vertical or horizontal
  layout. No bumper — a fade-in instead. Soft music plays and ducks itself while she reads the text.
- **Home** — hero with gradient scrim, brush-font title, metadata row, description, Play / More Info,
  floating cute badges; rows with dashes indicator, edge peek, hover arrows; hero keeps playing behind
  the scroll. Search, notifications bell, profile badge and menu all live.
- **More Info modal** — muted autoplay preview with mute toggle, brush title, Play / Teleparty /
  Add to List / Like, two-column info block.
- **Admin panel** — pick a profile, paste a link (type + orientation detected for you), optional title
  and description, then edit / reorder / remove anything afterwards. Changes appear on her side instantly.
- **Us profile** is a single simple row, in the order you added things — no chapters, no date sorting.

Content lives in `localStorage`, so it persists per browser. "Reset to seed" in the admin header
restores the four test videos from Section 9.

## Things you still owe her (Section 8)

All four pools are in [`src/config.js`](src/config.js) — edit the arrays and reload:

- `BADGES` — cute badge tags (hero + cards)
- `OUTRO_NOTES` — love notes shown after each video ends
- `NOTIFICATIONS` — bell panel messages
- `PHOTO_MUSIC` — drop your track at `assets/music/soft.mp3` and it is used automatically. Until then
  a gentle generated piano/pad loop plays so the ducking behaviour is testable.

Also in `src/config.js`: `PROFILES` — her display name, taglines, tile colours, and `photo` (add a URL
and it replaces the gradient tile / nav avatar).

## Open decisions from the spec

- **4th profile** (Section 10): built but switched off. Flip `enabled: true` on the `dreams` entry in
  `src/config.js` and rename it whenever you decide.
- **Teleparty button** (Section 10): present and styled, decorative — it shows a small note when clicked.
- **Row labels** for Her / Secret (Section 10): rows are generated from whatever content exists, using
  the labels in `ROW_LABELS`. Rename them freely.

## Known constraint (Section 11)

Implementation path 1 was used: YouTube IFrame embed, native controls off, custom control layer on top.
The click-shield means she can never click through to YouTube, but YouTube can still surface a small
mark in rare states (e.g. an embed error), and it keeps final say over playback resolution. If either
turns out to be visible or bothersome in testing, path 2 (self-hosted video files) is the fix — it
would replace `src/yt.js` and swap the Admin Panel's link field for file hosting.

One more note: the admin credentials are hardcoded in `src/config.js`, so anyone who reads the source
can see them. Fine for a private gift; move them out if this ever goes somewhere public.
