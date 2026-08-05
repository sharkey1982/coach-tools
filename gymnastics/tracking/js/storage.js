// gymnastics/tracking/js/storage.js
// Thin localStorage wrapper. All keys are prefixed 'gymTracking:' so this
// module can share a browser/device with other Coach Tools modules
// (e.g. ACROTRIX) without key collisions.

const STORAGE_PREFIX = "gymTracking:";

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error("gymTracking: failed to read", key, e);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error("gymTracking: failed to save", key, e);
    alert("Could not save - your browser storage may be full or private browsing may be blocking it.");
  }
}

// ---- Pupils ----
function getPupils() {
  return readJSON("pupils", []);
}
function savePupils(pupils) {
  writeJSON("pupils", pupils);
}
function addPupil(name) {
  const trimmed = name.trim();
  if (!trimmed) return getPupils();
  const pupils = getPupils();
  if (!pupils.includes(trimmed)) {
    pupils.push(trimmed);
    pupils.sort((a, b) => a.localeCompare(b));
    savePupils(pupils);
  }
  return pupils;
}
function removePupil(name) {
  const pupils = getPupils().filter((p) => p !== name);
  savePupils(pupils);
  return pupils;
}

// ---- Assessments ----
// Each record: { id, date, pupil, skill, type, rating, notes }
function getAssessments() {
  return readJSON("assessments", []);
}
function saveAssessments(list) {
  writeJSON("assessments", list);
}
function addAssessment(record) {
  const list = getAssessments();
  const withId = Object.assign({ id: makeId() }, record);
  list.unshift(withId); // newest first
  saveAssessments(list);
  return list;
}
function removeAssessment(id) {
  const list = getAssessments().filter((a) => a.id !== id);
  saveAssessments(list);
  return list;
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ---- Physical Readiness Logs ----
// Each record: { id, date, pupil, factor, rating, notes }
function getPhysicalLogs() {
  return readJSON("physicalLogs", []);
}
function savePhysicalLogs(list) {
  writeJSON("physicalLogs", list);
}
function addPhysicalLog(record) {
  const list = getPhysicalLogs();
  const withId = Object.assign({ id: makeId() }, record);
  list.unshift(withId); // newest first
  savePhysicalLogs(list);
  return list;
}
function removePhysicalLog(id) {
  const list = getPhysicalLogs().filter((a) => a.id !== id);
  savePhysicalLogs(list);
  return list;
}

// ---- Skill Targets ----
// Free-text "target / focus" note per skill, shown on the Skill Progression dashboard.
// Stored as a single object: { "Forward Roll": "...", "Handstand": "...", ... }
function getTargets() {
  return readJSON("targets", {});
}
function saveTargets(obj) {
  writeJSON("targets", obj);
}
