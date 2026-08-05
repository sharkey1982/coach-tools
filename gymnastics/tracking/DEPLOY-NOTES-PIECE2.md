# DEPLOY NOTES - Gymnastics Tracking, Piece 2 (Physical Readiness logging)

## Where this goes
Same folder as before: `gymnastics/tracking/`. This is an update on top of Piece 1 - extract and let it merge in (nothing is deleted, files listed as MODIFIED below get replaced with an updated version that only adds to what was there).

## Files in this drop

| File | Status | What changed |
|---|---|---|
| `gymnastics/tracking/js/physical-data.js` | **NEW** | The 7 physical factors, 4 rating levels (Limiting/Developing/Adequate/Strong), and their badge colours. Same shape as `skills-data.js`. |
| `gymnastics/tracking/js/storage.js` | MODIFIED (additive only) | Added 4 new functions at the end: `getPhysicalLogs`, `savePhysicalLogs`, `addPhysicalLog`, `removePhysicalLog`. Every line from Piece 1 is untouched - verified with a diff against what I sent you last time, not just checked by eye. |
| `gymnastics/tracking/js/app.js` | MODIFIED (additive only) | Added a "Physical Readiness" tab (now the 2nd of 3 tabs, between Log Assessment and Pupils), its `renderPhysicalReadiness()` view, and a `factorBadge()` helper. Same diff-checked guarantee - nothing from Piece 1 was changed, only added to. |
| `gymnastics/tracking/index.html` | MODIFIED (additive only) | One new line: `<script src="js/physical-data.js"></script>`. |
| `gymnastics/tracking/css/tracking.css` | **UNCHANGED** | The new tab reuses the existing card/form/table/badge styles - no new CSS was needed. |

## What this piece does
- New **Physical Readiness** tab: log a check (date, pupil, one of the 7 factors, rating, optional notes) in a few taps
- Same fast-repeat pattern as assessment logging - pupil stays selected after each save
- Recent checks table (last 15) with delete
- Stored in `localStorage` under `gymTracking:physicalLogs` - separate key from pupils/assessments, so nothing here can corrupt existing data

## What's NOT in this piece yet
- The diagnostic dashboard that cross-references a struggling skill against a pupil's limiting factors (that needs the skill<->factor relevance map, which is a later piece alongside the other three dashboards)
- Skill Library tab
- Visual restyle to match your actual Coach Tools design system (agreed to do this at the end, after all features are built)

## Testing done before this was sent to you
- All 4 JS files pass `node --check`
- Extended the same jsdom functional test from Piece 1 to also cover Physical Readiness: logged a check, confirmed it saved correctly to `localStorage` under the new key, confirmed the factor badge rendered, confirmed delete works, and specifically confirmed the existing `gymTracking:assessments` data was **untouched** by any physical-log operation (isolation check). 13 checks total, all passed against the real files.
- Also diffed every changed file against the exact Piece 1 files you already deployed, to confirm the changes really are additive-only, not just written that way.
- Not tested: real-browser/device check - worth a quick look once deployed.

## Suggested next step
Same plan as before: the four dashboards next (Pupil Tracking, Class Overview, Skill Progression, and the Physical Readiness diagnostic matrix), then the visual restyle to match your actual Coach Tools design system at the end.
