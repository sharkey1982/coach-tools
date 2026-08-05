// gymnastics/tracking/js/app.js
// Piece 1: pupil roster + assessment logging.
// Later pieces will add renderPupilTracking(), renderClassOverview(),
// renderSkillProgression(), renderPhysicalReadiness() the same way these
// two render functions work, and add their tab buttons to the nav below.

const TABS = [
  { id: "log", label: "Log Assessment" },
  { id: "pupils", label: "Pupils" },
];

let currentTab = "log";
let logForm = { date: todayISO(), pupil: "", skill: "", type: "Coach", rating: "", notes: "" };

function init() {
  renderNav();
  renderTab();
}

function renderNav() {
  const nav = document.getElementById("tt-nav");
  nav.innerHTML = "";
  TABS.forEach((t) => {
    const btn = document.createElement("button");
    btn.className = "tt-nav-btn" + (currentTab === t.id ? " tt-nav-btn-active" : "");
    btn.textContent = t.label;
    btn.addEventListener("click", () => {
      currentTab = t.id;
      renderNav();
      renderTab();
    });
    nav.appendChild(btn);
  });
}

function renderTab() {
  const main = document.getElementById("tt-main");
  main.innerHTML = "";
  if (currentTab === "log") main.appendChild(renderLogAssessment());
  if (currentTab === "pupils") main.appendChild(renderPupils());
}

/* ---------------------------------------------------------------
   PUPILS TAB
   --------------------------------------------------------------- */
function renderPupils() {
  const wrap = document.createElement("div");

  const card = document.createElement("div");
  card.className = "tt-card";
  card.innerHTML = `
    <div class="tt-card-head"><span>Class roster</span></div>
    <div class="tt-card-body">
      <div class="tt-row-form">
        <input type="text" id="tt-pupil-name" class="tt-input" placeholder="Add a pupil's name" />
        <button class="tt-btn tt-btn-primary" id="tt-add-pupil">+ Add pupil</button>
      </div>
      <div id="tt-pupil-list"></div>
    </div>
  `;
  wrap.appendChild(card);

  const nameInput = card.querySelector("#tt-pupil-name");
  const addBtn = card.querySelector("#tt-add-pupil");
  const doAdd = () => {
    addPupil(nameInput.value);
    nameInput.value = "";
    renderTab();
  };
  addBtn.addEventListener("click", doAdd);
  nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doAdd(); });

  const listEl = card.querySelector("#tt-pupil-list");
  const pupils = getPupils();
  const assessments = getAssessments();

  if (pupils.length === 0) {
    listEl.innerHTML = `<div class="tt-empty">
        <div class="tt-empty-title">No pupils yet</div>
        <div class="tt-empty-body">Add your class list above - every dropdown reads from this roster.</div>
      </div>`;
  } else {
    const grid = document.createElement("div");
    grid.className = "tt-pupil-grid";
    pupils.forEach((p) => {
      const count = assessments.filter((a) => a.pupil === p).length;
      const chip = document.createElement("div");
      chip.className = "tt-pupil-chip";
      chip.innerHTML = `
        <div>
          <div class="tt-pupil-name">${escapeHtml(p)}</div>
          <div class="tt-pupil-meta">${count} assessment${count !== 1 ? "s" : ""} logged</div>
        </div>
        <button class="tt-icon-btn" title="Remove pupil">&times;</button>
      `;
      chip.querySelector("button").addEventListener("click", () => {
        if (confirm(`Remove ${p} from the roster? Their logged assessments will be kept.`)) {
          removePupil(p);
          renderTab();
        }
      });
      grid.appendChild(chip);
    });
    listEl.appendChild(grid);
  }

  return wrap;
}

/* ---------------------------------------------------------------
   LOG ASSESSMENT TAB
   --------------------------------------------------------------- */
function renderLogAssessment() {
  const wrap = document.createElement("div");
  const pupils = getPupils();

  const formCard = document.createElement("div");
  formCard.className = "tt-card";
  formCard.innerHTML = `
    <div class="tt-card-head"><span>Log an assessment</span></div>
    <div class="tt-card-body">
      ${pupils.length === 0 ? `<div class="tt-warn-strip">Add pupils on the Pupils tab first.</div>` : ""}
      <div class="tt-form-grid">
        <label class="tt-field"><span>Date</span>
          <input type="date" id="tt-f-date" class="tt-input" value="${logForm.date}" />
        </label>
        <label class="tt-field"><span>Pupil</span>
          <select id="tt-f-pupil" class="tt-select">
            <option value="">Choose pupil</option>
            ${pupils.map((p) => `<option value="${escapeHtml(p)}" ${logForm.pupil === p ? "selected" : ""}>${escapeHtml(p)}</option>`).join("")}
          </select>
        </label>
        <label class="tt-field"><span>Skill</span>
          <select id="tt-f-skill" class="tt-select">
            <option value="">Choose skill</option>
            ${SKILL_ORDER.map((s) => `<option value="${s}" ${logForm.skill === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </label>
        <label class="tt-field"><span>Type</span>
          <select id="tt-f-type" class="tt-select">
            ${ASSESSMENT_TYPES.map((t) => `<option value="${t}" ${logForm.type === t ? "selected" : ""}>${t}</option>`).join("")}
          </select>
        </label>
        <label class="tt-field"><span>Rating</span>
          <select id="tt-f-rating" class="tt-select">
            <option value="">Choose rating</option>
            ${RATING_LEVELS.map((r) => `<option value="${r}" ${logForm.rating === r ? "selected" : ""}>${r}</option>`).join("")}
          </select>
        </label>
        <label class="tt-field tt-field-wide"><span>Notes (optional)</span>
          <input type="text" id="tt-f-notes" class="tt-input" placeholder="e.g. good tuck, needs hips higher at start" value="${escapeHtml(logForm.notes)}" />
        </label>
      </div>
      <button class="tt-btn tt-btn-primary tt-btn-lg" id="tt-save-assessment">+ Save assessment</button>
    </div>
  `;
  wrap.appendChild(formCard);

  // wire up form field persistence into logForm as the coach types/selects
  const bind = (id, key) => formCard.querySelector(id).addEventListener("input", (e) => { logForm[key] = e.target.value; });
  bind("#tt-f-date", "date");
  bind("#tt-f-pupil", "pupil");
  bind("#tt-f-skill", "skill");
  bind("#tt-f-type", "type");
  bind("#tt-f-rating", "rating");
  bind("#tt-f-notes", "notes");

  formCard.querySelector("#tt-save-assessment").addEventListener("click", () => {
    if (!logForm.pupil || !logForm.skill || !logForm.rating) {
      alert("Please choose a pupil, skill and rating before saving.");
      return;
    }
    addAssessment({
      date: logForm.date, pupil: logForm.pupil, skill: logForm.skill,
      type: logForm.type, rating: logForm.rating, notes: logForm.notes,
    });
    // keep pupil + type selected for fast repeated entry; clear skill/rating/notes
    logForm = { date: logForm.date, pupil: logForm.pupil, skill: "", type: logForm.type, rating: "", notes: "" };
    renderTab();
  });

  // recent entries table
  const recentCard = document.createElement("div");
  recentCard.className = "tt-card";
  const assessments = getAssessments().slice(0, 15);
  if (assessments.length === 0) {
    recentCard.innerHTML = `
      <div class="tt-card-head"><span>Recent entries</span></div>
      <div class="tt-card-body">
        <div class="tt-empty">
          <div class="tt-empty-title">Nothing logged yet</div>
          <div class="tt-empty-body">Assessments you save will appear here, most recent first.</div>
        </div>
      </div>`;
  } else {
    const rows = assessments.map((a) => `
      <tr>
        <td class="tt-nowrap">${formatDate(a.date)}</td>
        <td>${escapeHtml(a.pupil)}</td>
        <td>${escapeHtml(a.skill)}</td>
        <td>${escapeHtml(a.type)}</td>
        <td>${ratingBadge(a.rating)}</td>
        <td class="tt-muted">${escapeHtml(a.notes || "")}</td>
        <td><button class="tt-icon-btn" data-id="${a.id}" title="Delete">&times;</button></td>
      </tr>
    `).join("");
    recentCard.innerHTML = `
      <div class="tt-card-head"><span>Recent entries</span></div>
      <div class="tt-card-body">
        <div class="tt-table-wrap">
          <table class="tt-table">
            <thead><tr><th>Date</th><th>Pupil</th><th>Skill</th><th>Type</th><th>Rating</th><th>Notes</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
    recentCard.querySelectorAll("button[data-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        removeAssessment(btn.getAttribute("data-id"));
        renderTab();
      });
    });
  }
  wrap.appendChild(recentCard);

  return wrap;
}

/* ---------------------------------------------------------------
   HELPERS
   --------------------------------------------------------------- */
function ratingBadge(rating) {
  if (!rating) return `<span class="tt-muted">&mdash;</span>`;
  const c = RATING_COLORS[rating] || { bg: "#EEE", fg: "#666", ring: "#CCC" };
  return `<span class="tt-badge" style="background:${c.bg};color:${c.fg};box-shadow:inset 0 0 0 1.5px ${c.ring}55;">${rating}</span>`;
}

function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

document.addEventListener("DOMContentLoaded", init);
