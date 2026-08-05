# DEPLOY NOTES - Gymnastics Tracking, Piece 7 (Physical Readiness diagnostic matrix)

## Where this goes
Same folder: `gymnastics/tracking/`. Extract over what's already there.

## Files in this drop

| File | Status | What changed |
|---|---|---|
| `gymnastics/tracking/js/app.js` | MODIFIED (additive only) | +111 lines, 0 removed (diff-verified against Piece 6). Extended the existing `renderPhysicalReadiness()` function (from Piece 2) with a new diagnostic section appended below the logging form and recent-checks table - the existing logging code above it is untouched. Added `renderPhysicalDiagnostic()` and `latestFactorRating()`. |
| `gymnastics/tracking/css/tracking.css` | MODIFIED (additive only) | +19 lines, 0 removed. |
| Every other file | **UNCHANGED** | Byte-identical to Piece 6 (skills-data.js, skill-library-data.js, physical-data.js, storage.js, index.html) - no new tab was needed, this extends the existing Physical Readiness tab rather than adding a new one. |

## What this piece does
This is the last of the four dashboards, and the one with real logic in it - it cross-references a pupil's skill ratings against their physical factor ratings to flag *why* they might be stuck on something:

- On the **Physical Readiness** tab, below the logging form, there's now a "Diagnostic" section
- Select a pupil - see their current rating for all 7 physical factors, then a row for every one of the 14 skills showing:
  - their latest rating for that skill
  - only the factors actually relevant to that skill (reusing the same factor list from the Skill Library, so e.g. Straight Jump never mentions Shoulder Flexibility, but Handstand does)
  - a flag: **"Likely limiting: [factor]"** if the skill is rated Not Yet/Developing and a relevant factor is Limiting, a softer "Check developing" flag if the factor is merely Developing, or **"On track"** if the skill is already Secure/Exceeding

## Testing done before this was sent to you
This piece got the most thorough testing of any so far, because the flagging logic is genuinely the most complex part of the whole build:
- Set up a real scenario: logged Amelia as "Not Yet" on Handstand (relevant factors: Shoulder Flexibility, Core Strength, Handstand Alignment, Hip Flexibility) and logged her Shoulder Flexibility as "Limiting"
- Confirmed the Handstand row correctly shows "Likely limiting: Shoulder Flexibility"
- Confirmed her Cartwheel row (already rated Secure) shows "On track", not a false flag
- Confirmed a skill whose relevant factors *don't* include Shoulder Flexibility (Straight Jump) never mentions it at all, even though Amelia's Shoulder Flexibility is Limiting - i.e. the relevance filter genuinely works, it's not just flagging everything
- **Caught a real bug in my own test while doing this**, worth being upfront about: my first attempt at finding "the Handstand row" in the test used a loose text search, which also matched other skills' rows because their factor chips happen to say "Handstand Alignment" (Cartwheel, Round-off, and Front Walkover all list it as a relevant factor) - so the test was silently checking the wrong row. Fixed by matching the exact skill name element instead of loose text search, then re-ran and confirmed all 53 checks pass for real. Nothing wrong with the shipped app here - this was purely a flaw in how precisely my test was finding elements - but I'd rather show the process than hide it.
- Not tested: real-browser/device check.

## What's left
Just the visual restyle now - this was the last dashboard. All four dashboards, the Skill Library, and both logging tabs are complete.
