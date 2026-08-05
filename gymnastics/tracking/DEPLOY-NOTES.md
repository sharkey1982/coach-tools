# DEPLOY NOTES - Gymnastics Tracking, Piece 1 (Pupil roster + Assessment logging)

## Where this goes
Extract into your local repo at: `gymnastics/tracking/` (new folder - nothing existing is touched or overwritten).

## Files in this drop (all NEW)

| File | Status | What it does |
|---|---|---|
| `gymnastics/tracking/index.html` | NEW | Page shell - loads the CSS and the 3 JS files below, renders the nav + tab content into `#tt-nav` / `#tt-main`. |
| `gymnastics/tracking/css/tracking.css` | NEW | All styling. Uses a fresh navy/gold palette (CSS variables at the top) since I don't have visibility into Coach Tools' existing site CSS - tweak `--tt-navy` / `--tt-gold` etc. to match your site if you want a closer visual fit. |
| `gymnastics/tracking/js/skills-data.js` | NEW | The 14 skill names, 4 rating levels, 3 assessment types, and rating colours. Deliberately lightweight - the full master-checklist content (phases, cues, faults, progressions) will be added here in a later piece for a Skill Library tab, without touching the other two JS files. |
| `gymnastics/tracking/js/storage.js` | NEW | All `localStorage` read/write logic. Keys are prefixed `gymTracking:` so they won't collide with ACROTRIX or any other module's storage. |
| `gymnastics/tracking/js/app.js` | NEW | Tab navigation + the two views built so far: **Pupils** (add/remove roster) and **Log Assessment** (date/pupil/skill/type/rating/notes form, with a recent-entries table you can delete from). |

## What this piece does
- Add pupils to a class roster (stored in `localStorage` under `gymTracking:pupils`)
- Log an assessment (Coach/Self/Peer, any of the 14 skills, 4 rating levels) in a few taps - the pupil and assessment-type stay selected after each save so logging a whole class back-to-back is fast
- See the 15 most recent entries with a delete option
- Everything persists in the browser's `localStorage`, same pattern as ACROTRIX

## What's NOT in this piece yet (coming in later drops, as agreed)
- Skill Library tab (full master checklist per skill)
- Physical Readiness logging
- The four dashboards (Pupil Tracking, Class Overview, Skill Progression, Physical Readiness diagnostic matrix)
- A hub tile on `gymnastics/index.html` linking here - I've left that file untouched; add a tile pointing at `tracking/index.html` whenever you're ready, same as you did for ACROTRIX

## Testing done before this was sent to you
- All 3 JS files pass `node --check` (syntax valid)
- Full functional test using a headless DOM (jsdom) against the actual files: added 2 pupils, logged an assessment, confirmed it saved correctly to `localStorage`, confirmed the rating badge and recent-entries table rendered, confirmed delete works, confirmed the pupil-count-per-roster-entry updates correctly. All 8 checks passed.
- Not tested: real-browser rendering/visual check, or on an actual phone/tablet - worth a quick look on your end before relying on it in a live session.

## Suggested next step
Once you're happy with this, the next piece would be Physical Readiness logging (mirrors this same pattern: a `js/physical-data.js` + additions to `storage.js` + a new tab in `app.js`), then the dashboards after that.
