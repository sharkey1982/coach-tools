# DEPLOY NOTES - Gymnastics Tracking, Piece 8 (Full per-criterion assessment breakdown)

## Where this goes
Same folder: `gymnastics/tracking/`. Extract over what's already there.

## This one is different from Pieces 2-7
Every piece since the first has been purely additive - new lines only, nothing existing changed. This one genuinely modifies the Log Assessment form, because that's what was asked for: the original design's per-criterion checklists (Coach Assessment Sheet, Self-Assessment "I can..." statements, Partner Observation points) were never wired into the app - it only ever asked for one holistic rating with no guidance on what to actually look for. This piece fixes that properly.

## Files in this drop

| File | Status | What changed |
|---|---|---|
| `gymnastics/tracking/js/skills-data.js` | MODIFIED (additive only) | +15 lines, 0 removed. Added the confidence scale (Self type: Red/Amber/Green) and Yes/Not yet scale (Peer type). |
| `gymnastics/tracking/js/app.js` | MODIFIED | **+94 lines, 7 removed.** The 7 removed lines are the old "always show one Rating dropdown, require it for every type" logic - replaced with type-aware behaviour (see below). Added the breakdown checklist rendering (`renderBreakdownChecklist`, `buildBreakdownTemplate`, `breakdownConfig`). |
| `gymnastics/tracking/css/tracking.css` | MODIFIED (additive only) | +15 lines, 0 removed. |
| `gymnastics/tracking/js/skill-library-data.js` | **UNCHANGED** | This piece reuses the exact same criteria/statements/points already stored here from Piece 3 - no duplication. |
| `gymnastics/tracking/js/physical-data.js` | **UNCHANGED** | |
| `gymnastics/tracking/js/storage.js` | **UNCHANGED** | `addAssessment()` already stored whatever record shape it was given, so no change was needed to support the new `breakdown` field. |
| `gymnastics/tracking/index.html` | **UNCHANGED** | |

## What changed in the Log Assessment form
1. **Pick a Skill and Type** - a checklist now appears showing the actual criteria for that specific skill:
   - **Coach**: the 8-12 assessment criteria from the Skill Library, each with its own Not Yet/Developing/Secure/Exceeding dropdown - plus you still set one **Overall judgement** (this is what feeds all four dashboards, exactly as before)
   - **Self**: the "I can..." statements, each rated on the Red/Amber/Green confidence scale from the original design - no overall rating, since Self-assessment never had one
   - **Peer**: the observation points, each Yes/Not yet - no overall rating
2. You don't have to fill in every row - only the ones you actually mark get saved. Setting just the Overall judgement (Coach) still works exactly like before, for quick 30-second checks; the breakdown is there when you want the detail.
3. Each row tints with the same colour as its rating once you pick one (red/amber/green/violet), same visual language as everywhere else in the app.
4. For Self and Peer types, the Overall judgement field disappears entirely, since it never meant anything for those two.

## Why the dashboards are all still safe
Every one of the four dashboards (Pupil Tracking, Class Overview, Skill Progression, Physical Readiness diagnostic) filters `type === "Coach"` and reads the single `rating` field - exactly as before. Self and Peer entries now save with `rating: ""`, which those dashboards already ignore by virtue of the type filter. I specifically re-ran the whole test suite after adding Self/Peer entries with no overall rating and confirmed Class Overview still renders Amelia's row correctly with no corruption (`undefined`/`NaN` creeping in anywhere) - see the test notes below.

## Testing done before this was sent to you
- All 5 JS files pass `node --check`
- Ran the entire existing 53-check suite from Pieces 1-7 completely unmodified first, to confirm nothing regressed before adding anything new - all 53 still passed
- Then added 15 new checks specifically for this piece:
  - Coach: selected Backward Roll, confirmed exactly 8 breakdown rows appeared matching the real Skill Library criteria text (not a hand-typed copy - the test independently loads the same data file to compare against), filled in 2 of the 8 rows plus the Overall judgement, saved, and confirmed only those 2 rows were stored (not all 8 blank ones) with the correct values
  - Self: switched type to Self, confirmed the Overall rating field disappears from the DOM entirely, confirmed the statements shown match Bridge's actual self-assessment text, confirmed the dropdown offers the Red/Amber/Green confidence scale, filled one in, saved with no overall rating, confirmed it saved correctly with an empty `rating` field
  - Peer: confirmed Straddle Jump's observation points appear with a Yes/Not yet dropdown
  - Confirmed Class Overview still renders correctly after all of this, with no corrupted values
- 68 checks total, all passed
- While writing the tests I hit the same category of mistake as a couple of pieces ago - referencing data from the injected `<script>` files directly in my Node test script's own scope, which doesn't work because they're different JavaScript environments. Fixed properly this time by loading the actual data files independently through Node's `vm` module, so the test compares against the real file contents rather than anything I might mistype by hand.
- Not tested: real-browser/device check, and I haven't added a way to view a saved breakdown back in the "Recent entries" table (it's stored and safe, just not surfaced there yet) - flagging that as a reasonable next small addition if you want it, rather than assuming.

## What's left
Just the visual restyle now.
