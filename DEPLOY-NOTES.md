# Deploy Notes — Gymnastics Session Builder v2.0

## What this does
Replaces the broken Discover/Explore grid session builder with an AI-assisted,
time-blocked session builder for the after-school club, following the 45-minute
structure (Arrival → Warm-up → Stations → Apparatus → Team Game → Reflection),
with station-level differentiation (Support / Core / Extension), pulling content
from your existing RISE activity cards AND a new custom-activity library you
can author yourself.

Persistence is via browser localStorage for now (no backend). Everything is
wrapped behind a small storage abstraction so it's a clean swap to Supabase
later — only the load/save function bodies change, not the UI code.

## Files — copy these into your `gymnastics/` folder on disk

| Path | Status | Notes |
|---|---|---|
| `gymnastics/sessions/index.html` | **REPLACES** existing file | Old Discover/Explore grid builder fully removed. New builder lives here. |
| `gymnastics/sessions/activities/index.html` | **NEW** | Custom activity authoring page (separate from session builder, as agreed). |
| `gymnastics/sessions/data/syllabus.json` | **NEW** | 18-week rolling theme/apparatus table, arrival/team-game libraries, age-group station caps, safety lists — all the static data from the planning doc. |
| `gymnastics/sessions/data/custom-activities.json` | **NEW** | Seed file with schema notes + one example activity ("Wobbly Bridge Builders"). Used only to seed localStorage on first load per device — not written back to after that. |
| `gymnastics/sessions/data/saved-sessions.json` | **NEW** | Empty seed file (sessions live in localStorage; this file is just there for shape/reference and as a future Supabase migration anchor). |
| `gymnastics/index.html` | **REPLACES** existing file | One change only: the "Session Builder" nav card description/tags updated to describe the new tool. Hero, pathway tiers, tracks grid, Skill Library card, Activity Cards card — all untouched. |

## Files — NOT touched (left exactly as they are)
- `gymnastics/activities/` (skill library + `_manifest.json` + HK reference) — untouched
- `gymnastics/activity-cards/` (all four packs: locomotion, balance, rotation, spring + images + viewer) — untouched
- `gymnastics/indexOLD.html` — untouched

## Important: persistence model
Custom activities and saved sessions are stored in the browser's `localStorage`,
keyed per-device:
- `coachtools_gym_custom_activities_v1`
- `coachtools_gym_saved_sessions_v1`

This means:
- Data does **not** sync between your phone and laptop, or across browsers.
- Clearing browser data / site data wipes it.
- Custom activities use **Export JSON** (button on the activities page) to back up — do this periodically.
- Saved sessions don't yet have an export button — let me know if you want one added before this goes further, since it's currently print/PDF only as a backup route.

This is a known, explicit limitation — we agreed to ship localStorage now and
move to Supabase later once the workflow is proven. The storage functions
(`loadCustomActivities`/`persistActivities` in the activities page;
`loadSavedSessions`/`persistSavedSessions` in the session builder) are the only
places that will need to change for that migration.

## AI generation
"Generate session draft" calls `https://api.anthropic.com/v1/messages` directly
from the browser (same pattern as the existing illustration generator in
`activity-cards/index.html`), using `claude-sonnet-4-6`. The system prompt
encodes the full coaching philosophy, safety rules, and 45-minute structure from
your planning document. The user prompt sends the selected age group, week/theme
from the syllabus, and the full pool of RISE + custom activities so the model
prefers existing content over inventing new activities.

## Testing performed
Before this was packaged, every page was loaded in a headless browser
(Playwright) against the full real file tree, and the following were verified
to work with no console/JS errors:
- Session builder loads, week dropdown populates from syllabus.json
- A generated plan renders all 6 time blocks, all stations, with correct station counts
- Inline editing of every field (text, differentiation pills, reflection questions) updates the underlying plan object
- Content picker search/filter works across RISE + custom activities; picking one applies it to the station including differentiation/coaching/safety data
- Save → persists to localStorage → reappears correctly in the Saved Sessions tab
- Custom activity authoring: create, edit (pre-fills correctly), delete, and persistence across a full page reload
- A custom activity created in the authoring page appears immediately in the session builder's content picker (shared localStorage)
- Mobile viewport (390×844) rendering checked via screenshot — station cards, differentiation pills, and safety warnings are legible at phone width
- One real bug was found and fixed during testing: a CSS/JS class name mismatch (`extend` vs `extension`) meant the Extension differentiation tier didn't get its green styling — confirmed fixed via before/after screenshot

## Not yet done / open follow-ups
- No export/backup button yet for saved sessions (only print/PDF)
- Supabase migration for custom-activities and saved-sessions (parked, by agreement)
- No Excel/Discover-tier-specific logic carried over from the old builder — this new builder is purpose-built for the after-school club model, not the RISE Discover/Explore framework. If you still need the RISE-tier builder for other coaching contexts, say so before old `sessions/index.html` is overwritten on your machine — right now this drop fully replaces it.
