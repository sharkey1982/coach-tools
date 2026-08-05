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
