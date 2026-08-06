# DEPLOY NOTES - Gymnastics Tracking, Piece 13 (New skills batch 1: Rolls + Headstand)

## Where this goes
Same folder: `gymnastics/tracking/`. Extract over what's already there.

## Files in this drop

| File | Status | What changed |
|---|---|---|
| `gymnastics/tracking/js/skills-data.js` | MODIFIED (additive only) | +17 lines, 0 removed. Added the 7 new skill names to `SKILL_ORDER`, and a `SKILL_META` entry (category/level/prerequisites) for each. |
| `gymnastics/tracking/js/skill-library-data.js` | MODIFIED | The file is one long minified line of JSON, so a diff shows it as a handful of changed lines even though it's additive - all 14 original skills are byte-identical inside that JSON, confirmed separately below. |
| `gymnastics/tracking/js/app.js` | **UNCHANGED** | Byte-identical to Piece 12. |
| `gymnastics/tracking/js/storage.js` | **UNCHANGED** | |
| `gymnastics/tracking/js/physical-data.js` | **UNCHANGED** | |
| `gymnastics/tracking/css/tracking.css` | **UNCHANGED** | |
| `gymnastics/tracking/index.html` | **UNCHANGED** | |

Every screen in the app (dashboards, print sheets, logging forms) is built by looping over the skill list rather than assuming a fixed count of 14, so none of that code needed to change to pick up the 7 new skills - it just does, automatically.

## The 7 new skills
Written to match the BG Learning Assistant Foundation & Foundation Coach Gymnastics Skills Syllabus pages you shared (Acrobatic skills with & without flight):

| Skill | Category | Level | Prerequisites |
|---|---|---|---|
| Log Roll | Rotation | 1 | None |
| Egg Roll | Rotation | 1 | None |
| Teddy Bear Roll | Rotation | 1 | None |
| Side Roll | Rotation | 2 | None |
| Dish to Arch Roll | Rotation | 2 | None |
| Headstand | Inversion & Support | 2 | None |
| Backwards Roll to Handstand | Rotation | 3 | Backward Roll, Handstand |

Each has the full set of content - physical/safety prerequisites, technical phases, coaching points, common faults, cues, competition deductions, progressions/regressions, physical prep, readiness indicators, plus the 8-12 coach assessment criteria and up to 6 self/peer statements each.

**Two things worth flagging on the content itself:**
- **Headstand's safety section explicitly notes it must be exited the way it was entered, never forwards into a roll or bridge** - I've written that in deliberately, because a forward-continuation exit from headstand edges toward a headspring, which your syllabus regulations list as not permitted. Worth double-checking that note reads correctly to you.
- **Backwards Roll to Handstand** requires real pushing strength beyond a standard backward roll - I've written the prerequisites and safety notes to reflect that it needs coach spotting until it's very secure, but you know your own qualification's scope better than I do for anything in this more advanced group.

## Testing done before this was sent to you
- Validated the 7 new skills' content against the schema before touching any live files: every one has all 15 required fields, 8-12 assessment criteria, and no more than 6 self/peer statements each
- Checked the merge itself: confirmed the final file has exactly 21 skills, confirmed the original 14 keys are still present and unchanged, confirmed no duplicate skill names
- Re-ran the cycle-detection check on the expanded prerequisite graph (now with Backwards Roll to Handstand's two-skill dependency added) - still a valid DAG, no skill can depend on itself
- Cross-checked that skills-data.js and skill-library-data.js reference exactly the same 21 skill names in both directions (nothing orphaned in one file but missing from the other)
- Ran the full existing 107-check suite - it caught several genuine test bugs of mine (not app bugs): I'd hardcoded the number 14 in four different assertions and a column index of 15 for the Class Overview average cell, both of which were only ever correct because there happened to be exactly 14 skills before now. Fixed all of them to compute expected counts/positions from the actual skill list dynamically, so they won't silently go stale again next time skills are added.
- Added 8 new checks specific to this batch: confirmed all 7 new skills exist with valid content, confirmed Backwards Roll to Handstand's prerequisites are exactly Backward Roll + Handstand, confirmed the new skills are genuinely selectable and loggable in Log Assessment, and confirmed the lock advisory correctly fires for Backwards Roll to Handstand and correctly names Backward Roll as the missing prerequisite
- 118 checks total, all passed
- Not tested: real-browser/device check, and the actual technical accuracy of the new content is my best written interpretation of your syllabus pages, not something you've reviewed yet - worth a proper read-through, especially Headstand's exit safety note and the two advanced/flighted-adjacent skills.

## What's left
Next batch when you're ready: Bridge & Walkover variants (Bridge Kickover, Handstand to Bridge, Standing Drop Back to Bridge, Tinsica, Valdez), then Handsprings & Salto last. Plus the visual restyle still open from before.
