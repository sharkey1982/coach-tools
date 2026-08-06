// gymnastics/tracking/js/skills-data.js
// Lightweight skill + rating reference used by the logging UI.
// The full master-checklist content (phases, cues, faults, progressions...)
// will be added here in a later piece when the Skill Library tab is built -
// it will not require any changes to storage.js or app.js.

const SKILL_ORDER = [
  "Forward Roll",
  "Backward Roll",
  "Handstand",
  "Handstand Forward Roll",
  "Cartwheel",
  "Round-off",
  "Bridge",
  "Front Walkover",
  "Back Walkover",
  "Straight Jump",
  "Straddle Jump",
  "Tuck Jump",
  "Balance",
  "Vault",
  // Batch 1 additions - BG Learning Assistant Foundation & Foundation Coach
  // syllabus, "Acrobatic skills with & without flight"
  "Log Roll",
  "Egg Roll",
  "Teddy Bear Roll",
  "Side Roll",
  "Dish to Arch Roll",
  "Headstand",
  "Backwards Roll to Handstand",
  // Batch 2 additions - Bridge & Walkover variants
  "Bridge Kickover",
  "Handstand to Bridge",
  "Standing Drop Back to Bridge",
  "Tinsica",
  "Valdez",
];

const RATING_LEVELS = ["Not Yet", "Developing", "Secure", "Exceeding"];
const ASSESSMENT_TYPES = ["Coach", "Self", "Peer"];

const RATING_COLORS = {
  "Not Yet":    { bg: "#FBE4E2", fg: "#A32E26", ring: "#D6453F" },
  "Developing": { bg: "#FBEBD2", fg: "#8A5A0E", ring: "#E6A73A" },
  "Secure":     { bg: "#DFF0E6", fg: "#1F6B45", ring: "#3E9B6D" },
  "Exceeding":  { bg: "#EBE4F6", fg: "#4B3480", ring: "#6B4FA0" },
};

// Numeric value per rating, used by the dashboards to compare
// latest-vs-previous and to compute class averages.
const RATING_VALUE = { "Not Yet": 1, "Developing": 2, "Secure": 3, "Exceeding": 4 };

// Confidence scale for Self-assessment statements, and Yes/Not yet for
// Partner observation points - added for the full per-criterion breakdown.
const CONFIDENCE_LEVELS = ["Red - Not confident", "Amber - Getting there", "Green - Confident"];
const CONFIDENCE_COLORS = {
  "Red - Not confident":   { bg: "#FBE4E2", fg: "#A32E26", ring: "#D6453F" },
  "Amber - Getting there": { bg: "#FBEBD2", fg: "#8A5A0E", ring: "#E6A73A" },
  "Green - Confident":     { bg: "#DFF0E6", fg: "#1F6B45", ring: "#3E9B6D" },
};

const PEER_LEVELS = ["Yes", "Not yet"];
const PEER_COLORS = {
  "Yes":     { bg: "#DFF0E6", fg: "#1F6B45", ring: "#3E9B6D" },
  "Not yet": { bg: "#FBEBD2", fg: "#8A5A0E", ring: "#E6A73A" },
};

// Category groups - used to organise the skill list as it grows beyond
// a flat list of 14. Movement-type based, complementing (not duplicating)
// the Track/Tier/FIG Category filters already used in the main Skill
// Library (gymnastics/activities/).
const SKILL_CATEGORIES = [
  "Rotation",
  "Inversion & Support",
  "Flexibility & Extension",
  "Jumps & Landings",
  "Balance",
  "Vault",
];

// Level - plain numeric 1/2/3 (easier to work with day-to-day than trying
// to remember RISE tier names). tierBadge() in app.js displays these as
// "Level 1" / "Level 2" / "Level 3".
const SKILL_TIERS = ["1", "2", "3"];
const TIER_COLORS = {
  "1": { bg: "#FAEADE", fg: "#B0511F", ring: "#E26D2B" },
  "2": { bg: "#D6EEF5", fg: "#145470", ring: "#1A6B8A" },
  "3": { bg: "#EDE5F7", fg: "#5E2B80", ring: "#7B3FA0" },
};

// Per-skill metadata: category, level, and prerequisite skills.
// Prerequisites are soft-lock only - a skill is "locked" for a pupil
// until every listed prerequisite is rated Secure or Exceeding for them,
// but a locked skill can still be selected and logged (a coach should
// always be able to record a pupil working ahead of the usual sequence).
const SKILL_META = {
  "Forward Roll":           { category: "Rotation",                tier: "1", prerequisites: [] },
  "Backward Roll":          { category: "Rotation",                tier: "2", prerequisites: ["Forward Roll"] },
  "Handstand":              { category: "Inversion & Support",     tier: "2", prerequisites: [] },
  "Handstand Forward Roll": { category: "Rotation",                tier: "3", prerequisites: ["Handstand", "Forward Roll"] },
  "Cartwheel":              { category: "Inversion & Support",     tier: "2", prerequisites: ["Handstand"] },
  "Round-off":              { category: "Inversion & Support",     tier: "3", prerequisites: ["Cartwheel"] },
  "Bridge":                 { category: "Flexibility & Extension", tier: "2", prerequisites: [] },
  "Front Walkover":         { category: "Flexibility & Extension", tier: "3", prerequisites: ["Handstand", "Bridge"] },
  "Back Walkover":          { category: "Flexibility & Extension", tier: "3", prerequisites: ["Handstand", "Bridge"] },
  "Straight Jump":          { category: "Jumps & Landings",        tier: "1", prerequisites: [] },
  "Straddle Jump":          { category: "Jumps & Landings",        tier: "2", prerequisites: ["Straight Jump"] },
  "Tuck Jump":               { category: "Jumps & Landings",       tier: "1", prerequisites: ["Straight Jump"] },
  "Balance":                { category: "Balance",                 tier: "1", prerequisites: [] },
  "Vault":                  { category: "Vault",                   tier: "2", prerequisites: ["Straight Jump", "Tuck Jump"] },
  // Batch 1 additions
  "Log Roll":                    { category: "Rotation",            tier: "1", prerequisites: [] },
  "Egg Roll":                     { category: "Rotation",           tier: "1", prerequisites: [] },
  "Teddy Bear Roll":              { category: "Rotation",           tier: "1", prerequisites: [] },
  "Side Roll":                    { category: "Rotation",           tier: "2", prerequisites: [] },
  "Dish to Arch Roll":            { category: "Rotation",           tier: "2", prerequisites: [] },
  "Headstand":                    { category: "Inversion & Support", tier: "2", prerequisites: [] },
  "Backwards Roll to Handstand":  { category: "Rotation",           tier: "3", prerequisites: ["Backward Roll", "Handstand"] },
  // Batch 2 additions
  "Bridge Kickover":              { category: "Flexibility & Extension", tier: "2", prerequisites: ["Bridge"] },
  "Handstand to Bridge":          { category: "Flexibility & Extension", tier: "3", prerequisites: ["Handstand", "Bridge"] },
  "Standing Drop Back to Bridge": { category: "Flexibility & Extension", tier: "3", prerequisites: ["Bridge"] },
  "Tinsica":                      { category: "Flexibility & Extension", tier: "3", prerequisites: ["Cartwheel", "Front Walkover"] },
  "Valdez":                       { category: "Flexibility & Extension", tier: "3", prerequisites: ["Backward Roll", "Bridge"] },
};
