# Quiz core-skills-only fix — deploy notes

## Files in this zip

| File | Status | What changed |
|---|---|---|
| `quiz/js/adapters/gymnastics.js` | **REPLACE** | `buildCards()` now takes an `includeHkFallback` option (default `false`). HK Reference is no longer pulled in unless explicitly enabled. |
| `quiz/index.html` | **REPLACE** | Calls the adapter with `includeHkFallback: false`. Skill families are now computed **within each category separately** instead of across the whole pool, and category sub-headings appear when no single category is selected. |

`quiz/js/quiz-engine.js` untouched, no need to re-copy.

## What was wrong

1. **Too many skills/categories**: the HK Reference fallback (built for skills outside your 26 curated `SKILL_LIBRARY` entries) was contributing ~90 extra minor skills and 9 extra categories (Hurdling, Landing, Running, Statics, etc). Now off by default — only the 26 core skills appear, across your original 6 categories.
2. **Giant merged "Bridge family"**: with no category selected, family-grouping ran across the *entire* skill pool at once. Because Handstand and Bridge are shared prerequisites reaching into multiple categories, everything chained together into one sprawling group. Families are now computed separately per category, so Rotation's roll chain and Flexibility's bridge chain stay in their own sections — each with its own heading when you haven't filtered to one category yet.

## Result

- 228 cards total (down from 412), 6 categories (down from 15)
- With no category selected: 6 clearly headed sections, each with its own small family groups + "Other skills" — not one long unbroken list
- Rotation family: Forward Roll, Backward Roll, Backwards Roll to Handstand, Handstand Forward Roll (unchanged from before, correctly scoped)
- Flexibility & Extension family: Bridge, Front Walkover, Back Walkover, Bridge Kickover, Handstand to Bridge, Standing Drop Back to Bridge, Tinsica, Valdez — its own section, no longer swallowing Rotation or Inversion & Support

## What was tested (headless)

- Full pool confirmed at 228 cards / 6 categories (no HK skills leaking in)
- With no category filter: 6 category sub-headings render, in the right names
- Every family group checked individually - none contains skills from more than one category (e.g. Rotation family never includes Bridge or Cartwheel)
- Previous family-grouping and full review-flow tests re-run clean against this change
