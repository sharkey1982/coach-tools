# DEPLOY NOTES - Gymnastics Tracking, Piece 12 (Numeric levels + level filter)

## Where this goes
Same folder: `gymnastics/tracking/`. Extract over what's already there.

## Files in this drop

| File | Status | What changed |
|---|---|---|
| `gymnastics/tracking/js/skills-data.js` | MODIFIED | 22 lines added, 21 removed - this is a rename, not new content: `SKILL_TIERS` and every skill's `tier` value changed from Discover/Explore/Excel to 1/2/3 (Discover→1, Explore→2, Excel→3, so the same relative difficulty ordering is preserved). |
| `gymnastics/tracking/js/app.js` | MODIFIED | +25 lines, 5 removed. Added the level-filter dropdown to Skill Library, updated `tierBadge()` to display "Level 1/2/3", removed a now-redundant "Level:" label next to it. |
| `gymnastics/tracking/css/tracking.css` | **UNCHANGED** | Reused the existing inline-select and tier-badge styles from Piece 10 - no new CSS needed. |
| Every other file | **UNCHANGED** | |

## What changed
1. **Numeric levels instead of RISE names.** Every tier badge, dropdown label, and Skill Library detail now shows "Level 1", "Level 2", "Level 3" instead of Discover/Explore/Excel. No assessment data is affected - level is skill metadata, not something stored per pupil-record, so nothing you've already logged changes.
2. **Level filter on Skill Library.** A dropdown in the card header - "All Levels" (the default) plus Level 1/2/3. Choosing a level hides everything else, including category headers that end up with nothing in them. Switching back to "All Levels" restores the full list.

## Testing done before this was sent to you
- Both JS files pass `node --check`
- Ran the full existing 101-check suite - one test checked for the old "Explore" tier text on Vault's dropdown option, updated to expect "Level 2" instead, then confirmed everything else needed no changes
- Added 6 new checks: confirmed the filter defaults to "All Levels" showing all 14 skills, confirmed filtering to Level 1 shows exactly the 4 Level 1 skills and specifically does NOT include a Level 3 skill (Round-off), and confirmed switching back to "All Levels" restores everything correctly
- 107 checks total, all passed

## Next
You said you can do the 18 new syllabus skills gradually - happy to start with the first batch (Rolls + Headstand) whenever you're ready, or if you'd like anything else first, just say.
