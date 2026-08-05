# DEPLOY NOTES - Gymnastics Tracking, Piece 10 (Categories, levels, soft-lock progression)

## Where this goes
Same folder: `gymnastics/tracking/`. Extract over what's already there.

## Files in this drop

| File | Status | What changed |
|---|---|---|
| `gymnastics/tracking/js/skills-data.js` | MODIFIED (additive only) | +44 lines, 0 removed. Added `SKILL_CATEGORIES` (6 movement-type groups), `SKILL_TIERS` (Discover/Explore/Excel, matching your existing RISE language), and `SKILL_META` (category + tier + prerequisite skills for each of the 14 skills). |
| `gymnastics/tracking/js/app.js` | MODIFIED | +111 lines, 28 removed/changed. Full list of what changed is below - nothing here is silent, every removed line is accounted for. |
| `gymnastics/tracking/css/tracking.css` | MODIFIED (additive only) | +20 lines, 0 removed. |
| Every other file | **UNCHANGED** | |

## What changed in app.js (the 28 non-additive lines)
- The skill `<select>` in Log Assessment used to be one flat list built from `SKILL_ORDER` - it's now grouped into `<optgroup>`s by category, with each option showing its tier and (when a pupil is selected) a padlock if it's not yet unlocked for them.
- The Skill Library accordion used to loop straight over `SKILL_ORDER` - it now loops over categories first, with a section header per category, and each skill's header now shows a tier badge.
- Pupil Tracking's per-skill row used to always show "No data" for an unrated skill - it now checks whether that skill is actually unlocked for the selected pupil first, and shows "Locked" (with the specific missing prerequisites in a hover tooltip) if not.
- Also fixed a real, if minor, latent bug I found while making this change: the Recent Entries table in Log Assessment was building its rows from the *full* unsliced assessment list instead of the last-15 slice it was supposed to use - it would have shown every assessment ever logged once your history grew past 15, rather than staying capped. Fixed as part of this same edit.

## The taxonomy (a draft - happy to adjust)
**Categories:** Rotation - Inversion & Support - Flexibility & Extension - Jumps & Landings - Balance - Vault

**Tiers:** Discover (Forward Roll, Straight Jump, Tuck Jump, Balance) - Explore (Backward Roll, Handstand, Cartwheel, Straddle Jump, Bridge, Vault) - Excel (Handstand Forward Roll, Round-off, Front Walkover, Back Walkover)

**Prerequisites (soft-lock):**
- Backward Roll ← Forward Roll
- Handstand Forward Roll ← Handstand, Forward Roll
- Cartwheel ← Handstand
- Round-off ← Cartwheel
- Front Walkover ← Handstand, Bridge
- Back Walkover ← Handstand, Bridge
- Straddle Jump ← Straight Jump
- Tuck Jump ← Straight Jump
- Vault ← Straight Jump, Tuck Jump
- Forward Roll, Handstand, Bridge, Straight Jump, Balance have no prerequisites (entry points)

A skill is "locked" for a specific pupil until every prerequisite is rated Secure or Exceeding **for that pupil** - it's calculated live from their actual logged ratings, not a fixed curriculum order. Locking is advisory only: a locked skill still appears fully, can still be selected, and can still be logged - Log Assessment just shows a note explaining what it's usually taught after, in case a pupil is working ahead.

## Where this shows up
- **Skill Library**: skills grouped under category headers, tier badge on each, a new "Prerequisite skills" line in each skill's detail (static - not tied to any pupil)
- **Log Assessment**: skill dropdown grouped by category with tier shown; once you pick a pupil, locked skills get a padlock prefix in the dropdown, and a banner appears above the form explaining what's still needed (e.g. "Vault isn't usually taught to Amelia Jones yet - it's normally introduced after: Straight Jump (currently No data), Tuck Jump (currently No data) reach Secure")
- **Pupil Tracking**: a skill with no data shows "Locked" instead of blank "No data" if the pupil hasn't met its prerequisites yet, with the specific missing skills in a hover tooltip

## What this deliberately does NOT touch yet
Class Overview, Skill Progression, and the printable sheets are unchanged - lock status isn't shown there yet. Given how this piece already turned out, I'd suggest seeing how the taxonomy feels in real use for a bit before deciding whether those need it too, rather than pushing it everywhere immediately.

## Testing done before this was sent to you
- All 5 JS files pass `node --check`
- Validated the taxonomy data itself before writing any UI code: confirmed every one of the 14 skills has a category/tier/prerequisite entry, confirmed every prerequisite reference points to a real skill name, and ran a proper cycle-detection check on the prerequisite graph to confirm it's a valid DAG (no skill can end up depending on itself, directly or indirectly)
- Ran the full existing 84-check suite first - it caught a real, expected behavioural change (my old test assumed Vault would show "No data" for an unrated pupil; it now correctly shows "Locked" instead, since Vault has unmet prerequisites) - updated that test to use Balance (which has no prerequisites) for the original check, and added a dedicated new test confirming Vault's "Locked" state specifically
- Added 9 more new checks: category header count, tier badges present, dropdown optgroup count, the lock banner appearing with the *correct* named prerequisites for a locked skill, the banner correctly absent for a skill with no prerequisites, and - importantly - confirmed a locked skill still saves successfully when logged, proving the soft-lock is genuinely soft and never blocks you
- 93 checks total, all passed
- Not tested: real-browser/device check, or how the grouped dropdown and lock banner feel in actual use during a lesson - the prerequisite graph in particular is a professional judgement call I've made from the coaching content already written, and you're better placed than me to say if any of it doesn't match how you actually sequence teaching.
