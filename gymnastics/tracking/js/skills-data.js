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

// Level - reuses the same Discover / Explore / Excel tier language as
// the rest of Coach Tools' RISE pathway, rather than inventing new terms.
const SKILL_TIERS = ["Discover", "Explore", "Excel"];
const TIER_COLORS = {
  "Discover": { bg: "#FAEADE", fg: "#B0511F", ring: "#E26D2B" },
  "Explore":  { bg: "#D6EEF5", fg: "#145470", ring: "#1A6B8A" },
  "Excel":    { bg: "#EDE5F7", fg: "#5E2B80", ring: "#7B3FA0" },
};

// Per-skill metadata: category, tier, and prerequisite skills.
// Prerequisites are soft-lock only - a skill is "locked" for a pupil
// until every listed prerequisite is rated Secure or Exceeding for them,
// but a locked skill can still be selected and logged (a coach should
// always be able to record a pupil working ahead of the usual sequence).
const SKILL_META = {
  "Forward Roll":           { category: "Rotation",                tier: "Discover", prerequisites: [] },
  "Backward Roll":          { category: "Rotation",                tier: "Explore",  prerequisites: ["Forward Roll"] },
  "Handstand":              { category: "Inversion & Support",     tier: "Explore",  prerequisites: [] },
  "Handstand Forward Roll": { category: "Rotation",                tier: "Excel",    prerequisites: ["Handstand", "Forward Roll"] },
  "Cartwheel":              { category: "Inversion & Support",     tier: "Explore",  prerequisites: ["Handstand"] },
  "Round-off":              { category: "Inversion & Support",     tier: "Excel",    prerequisites: ["Cartwheel"] },
  "Bridge":                 { category: "Flexibility & Extension", tier: "Explore",  prerequisites: [] },
  "Front Walkover":         { category: "Flexibility & Extension", tier: "Excel",    prerequisites: ["Handstand", "Bridge"] },
  "Back Walkover":          { category: "Flexibility & Extension", tier: "Excel",    prerequisites: ["Handstand", "Bridge"] },
  "Straight Jump":          { category: "Jumps & Landings",        tier: "Discover", prerequisites: [] },
  "Straddle Jump":          { category: "Jumps & Landings",        tier: "Explore",  prerequisites: ["Straight Jump"] },
  "Tuck Jump":               { category: "Jumps & Landings",       tier: "Discover", prerequisites: ["Straight Jump"] },
  "Balance":                { category: "Balance",                 tier: "Discover", prerequisites: [] },
  "Vault":                  { category: "Vault",                   tier: "Explore",  prerequisites: ["Straight Jump", "Tuck Jump"] },
};
