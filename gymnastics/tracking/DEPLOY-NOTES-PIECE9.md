# DEPLOY NOTES - Gymnastics Tracking, Piece 9 (Printable sheets)

## Where this goes
Same folder: `gymnastics/tracking/`. Extract over what's already there.

## Files in this drop

| File | Status | What changed |
|---|---|---|
| `gymnastics/tracking/js/app.js` | MODIFIED (additive only) | +149 lines, 0 removed (diff-verified). Added a print toolbar to the top of each skill's Skill Library detail view, plus `openPrintWindow()`, `printMasterChecklist()`, `printCoachSheet()`, `printSelfSheet()`, `printPeerSheet()`. |
| `gymnastics/tracking/css/tracking.css` | MODIFIED (additive only) | +4 lines, 0 removed. Styling for the small print-toolbar buttons in the app itself (the printed pages have their own separate, self-contained stylesheet baked into the generated print window, so it always looks right regardless of your site's styling). |
| Every other file | **UNCHANGED** | No new data needed - this reuses the exact same Skill Library content already in place since Piece 3. |

## What this does
Go to **Skill Library**, expand any skill, and there are now 4 print buttons at the top:

1. **Master checklist** - your own coaching reference (prerequisites, phases, cues, faults, deductions, progressions/regressions, prep, readiness) laid out cleanly for a lesson-prep pack
2. **Coach assessment sheet** - the 8-12 criteria with NY/D/S/E boxes to circle by hand, blank pupil/date/assessor lines, and an Overall judgement + Strengths + Targets section at the bottom - for using pen-and-paper during a practical lesson
3. **Self-assessment card** - the "I can..." statements with Red/Amber/Green boxes, for pupils to fill in themselves
4. **Peer observation card** - the watch-for points with Yes/Not yet boxes, for partner assessment

Each opens in a new browser tab as a clean, minimal page (no app navigation, no colour chrome, just the content) and automatically triggers your browser's print dialog. From there it's the normal print flow - choose your printer, or "Save as PDF" if you'd rather build up a lesson pack digitally before printing.

## A couple of practical notes
- If your browser blocks the print tab as a pop-up, there's an alert telling you to allow pop-ups for the site and try again - some browsers are stricter about this than others.
- The print pages deliberately use black text and minimal ink (small boxes to circle rather than filled colour badges) since these are meant to go through a real printer, possibly a lot of times for a whole class.
- Right now printing is per-skill, one sheet at a time. If you find yourself wanting to print several skills' sheets in one go for a lesson pack, that's a very doable next addition - just say so.

## Testing done before this was sent to you
- All 5 JS files pass `node --check`
- Ran the full existing 68-check suite unmodified first - no regression
- Added 6 new checks: stubbed `window.open` to capture the generated HTML instead of actually opening a browser window, then for each of the 4 print types confirmed the right number of rows/boxes appear (matching the real Skill Library data, not a hardcoded count), confirmed real content text appears (not placeholders), and specifically confirmed that printing a different skill (Vault) produces genuinely different content and does NOT contain leftover text from the previous skill (Forward Roll) - i.e. it's not accidentally reusing a stale template. 84 checks total, all passed.
- Caught one test mistake along the way (comparing raw text against HTML-escaped output, since several coaching cues contain literal quote marks that get converted to `&quot;`) - fixed and reran clean.
- Not tested: an actual physical print-out, or how it looks in a real browser's print preview (the CSS is standard and should render fine, but a quick real test before relying on it for lesson prep is sensible).

## What's left
Just the visual restyle now.
