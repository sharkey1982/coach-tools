# DEPLOY NOTES - Gymnastics Tracking, Piece 6 (Skill Progression dashboard)

## Where this goes
Same folder: `gymnastics/tracking/`. Extract over what's already there.

## Files in this drop

| File | Status | What changed |
|---|---|---|
| `gymnastics/tracking/js/storage.js` | MODIFIED (additive only) | +10 lines, 0 removed. Added `getTargets()` / `saveTargets()` - stores one free-text "target/focus" note per skill under a new `gymTracking:targets` key. |
| `gymnastics/tracking/js/app.js` | MODIFIED (additive only) | +79 lines, 0 removed. Added the "Skill Progression" tab, `renderSkillProgression()`, and a `readinessFor()` helper. |
| `gymnastics/tracking/css/tracking.css` | MODIFIED (additive only) | +3 lines, 0 removed. |
| `gymnastics/tracking/js/skills-data.js` | **UNCHANGED** | |
| `gymnastics/tracking/js/skill-library-data.js` | **UNCHANGED** | |
| `gymnastics/tracking/js/physical-data.js` | **UNCHANGED** | |
| `gymnastics/tracking/index.html` | **UNCHANGED** | |

## What this piece does
- New **Skill Progression** tab, 6th in the nav
- One row per skill: how many pupils have been assessed, the count at each rating level, the class average, and a plain-English readiness label ("Whole-class ready to progress" down to "Early stage - focus on prerequisites")
- An editable **Target / focus** text box per skill, saved as you type

## A deliberate technical decision worth knowing about
The target text box saves on every keystroke but does **not** trigger a full tab re-render while you're typing - if it did, rebuilding the HTML mid-keystroke would kick focus out of the input and you'd only ever be able to type one character at a time. I specifically tested this: typed a full sentence, confirmed it saved to `localStorage` correctly, then forced a re-render (simulating switching tabs and back) and confirmed the saved text reloads into the box correctly. Both behaviours are in the test suite now, not just assumed.

## What's NOT in this piece yet
- Physical Readiness diagnostic matrix (the last dashboard)
- Visual restyle

## Testing done before this was sent to you
- All 5 JS files pass `node --check`
- Extended the jsdom test: verified Cartwheel's row shows the exact right numbers (1 pupil assessed, 1 Secure, average 3.00) against the specific data logged earlier in the test run, then did the target-input focus/persistence check described above. 45 checks total, all passed.
- Caught and fixed one mistake in the test script itself along the way (calling a function in the wrong JavaScript scope) - the app code was fine, my test call was wrong. Fixed before re-running.
- Not tested: real-browser/device check.

## Suggested next step
Physical Readiness diagnostic matrix - the last dashboard - then the visual restyle to close out the whole build.
