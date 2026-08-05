// gymnastics/tracking/js/physical-data.js
// Physical readiness factors + rating levels used by the Physical Readiness log.
// Mirrors skills-data.js. The skill<->factor relevance map (which factors
// matter for which skill, used for the automatic diagnostic dashboard) will
// be added here in a later piece, without requiring changes to storage.js
// or the logging parts of app.js.

const FACTORS = [
  "Shoulder Flexibility",
  "Core Strength",
  "Bridge Flexibility",
  "Ankle Mobility",
  "Handstand Alignment",
  "Hip Flexibility",
  "Weight Transfer",
];

const FACTOR_LEVELS = ["Limiting", "Developing", "Adequate", "Strong"];

const FACTOR_COLORS = {
  "Limiting":   { bg: "#FBE4E2", fg: "#A32E26", ring: "#D6453F" },
  "Developing": { bg: "#FBEBD2", fg: "#8A5A0E", ring: "#E6A73A" },
  "Adequate":   { bg: "#DFF0E6", fg: "#1F6B45", ring: "#3E9B6D" },
  "Strong":     { bg: "#EBE4F6", fg: "#4B3480", ring: "#6B4FA0" },
};
