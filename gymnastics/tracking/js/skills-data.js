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
