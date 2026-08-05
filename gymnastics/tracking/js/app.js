// gymnastics/tracking/js/app.js
// Piece 1: pupil roster + assessment logging.
// Later pieces will add renderPupilTracking(), renderClassOverview(),
// renderSkillProgression(), renderPhysicalReadiness() the same way these
// two render functions work, and add their tab buttons to the nav below.

const TABS = [
  { id: "log", label: "Log Assessment" },
  { id: "physical", label: "Physical Readiness" },
  { id: "library", label: "Skill Library" },
  { id: "pupil-tracking", label: "Pupil Tracking" },
  { id: "class-overview", label: "Class Overview" },
  { id: "progression", label: "Skill Progression" },
  { id: "pupils", label: "Pupils" },
];

let currentTab = "log";
let logForm = { date: todayISO(), pupil: "", skill: "", type: "Coach", rating: "", notes: "" };
let physicalForm = { date: todayISO(), pupil: "", factor: "", rating: "", notes: "" };
let libraryOpenSkill = SKILL_ORDER[0];
let pupilTrackingSelected = "";
let physicalDiagnosticPupil = "";

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
  if (currentTab === "physical") main.appendChild(renderPhysicalReadiness());
  if (currentTab === "library") main.appendChild(renderSkillLibrary());
  if (currentTab === "pupil-tracking") main.appendChild(renderPupilTracking());
  if (currentTab === "class-overview") main.appendChild(renderClassOverview());
  if (currentTab === "progression") main.appendChild(renderSkillProgression());
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
   PHYSICAL READINESS TAB
   --------------------------------------------------------------- */
function renderPhysicalReadiness() {
  const wrap = document.createElement("div");
  const pupils = getPupils();

  const formCard = document.createElement("div");
  formCard.className = "tt-card";
  formCard.innerHTML = `
    <div class="tt-card-head"><span>Log a physical readiness check</span></div>
    <div class="tt-card-body">
      ${pupils.length === 0 ? `<div class="tt-warn-strip">Add pupils on the Pupils tab first.</div>` : ""}
      <div class="tt-form-grid">
        <label class="tt-field"><span>Date</span>
          <input type="date" id="tt-p-date" class="tt-input" value="${physicalForm.date}" />
        </label>
        <label class="tt-field"><span>Pupil</span>
          <select id="tt-p-pupil" class="tt-select">
            <option value="">Choose pupil</option>
            ${pupils.map((p) => `<option value="${escapeHtml(p)}" ${physicalForm.pupil === p ? "selected" : ""}>${escapeHtml(p)}</option>`).join("")}
          </select>
        </label>
        <label class="tt-field"><span>Factor</span>
          <select id="tt-p-factor" class="tt-select">
            <option value="">Choose factor</option>
            ${FACTORS.map((f) => `<option value="${f}" ${physicalForm.factor === f ? "selected" : ""}>${f}</option>`).join("")}
          </select>
        </label>
        <label class="tt-field"><span>Rating</span>
          <select id="tt-p-rating" class="tt-select">
            <option value="">Choose rating</option>
            ${FACTOR_LEVELS.map((r) => `<option value="${r}" ${physicalForm.rating === r ? "selected" : ""}>${r}</option>`).join("")}
          </select>
        </label>
        <label class="tt-field tt-field-wide"><span>Notes (optional)</span>
          <input type="text" id="tt-p-notes" class="tt-input" placeholder="e.g. improving with weekly wall-walk drills" value="${escapeHtml(physicalForm.notes)}" />
        </label>
      </div>
      <button class="tt-btn tt-btn-primary tt-btn-lg" id="tt-save-physical">+ Save check</button>
    </div>
  `;
  wrap.appendChild(formCard);

  const bind = (id, key) => formCard.querySelector(id).addEventListener("input", (e) => { physicalForm[key] = e.target.value; });
  bind("#tt-p-date", "date");
  bind("#tt-p-pupil", "pupil");
  bind("#tt-p-factor", "factor");
  bind("#tt-p-rating", "rating");
  bind("#tt-p-notes", "notes");

  formCard.querySelector("#tt-save-physical").addEventListener("click", () => {
    if (!physicalForm.pupil || !physicalForm.factor || !physicalForm.rating) {
      alert("Please choose a pupil, factor and rating before saving.");
      return;
    }
    addPhysicalLog({
      date: physicalForm.date, pupil: physicalForm.pupil, factor: physicalForm.factor,
      rating: physicalForm.rating, notes: physicalForm.notes,
    });
    // keep pupil selected for fast repeated entry; clear factor/rating/notes
    physicalForm = { date: physicalForm.date, pupil: physicalForm.pupil, factor: "", rating: "", notes: "" };
    renderTab();
  });

  // recent entries table
  const recentCard = document.createElement("div");
  recentCard.className = "tt-card";
  const logs = getPhysicalLogs().slice(0, 15);
  if (logs.length === 0) {
    recentCard.innerHTML = `
      <div class="tt-card-head"><span>Recent checks</span></div>
      <div class="tt-card-body">
        <div class="tt-empty">
          <div class="tt-empty-title">Nothing logged yet</div>
          <div class="tt-empty-body">Physical readiness checks you save will appear here, most recent first.</div>
        </div>
      </div>`;
  } else {
    const rows = logs.map((a) => `
      <tr>
        <td class="tt-nowrap">${formatDate(a.date)}</td>
        <td>${escapeHtml(a.pupil)}</td>
        <td>${escapeHtml(a.factor)}</td>
        <td>${factorBadge(a.rating)}</td>
        <td class="tt-muted">${escapeHtml(a.notes || "")}</td>
        <td><button class="tt-icon-btn" data-id="${a.id}" title="Delete">&times;</button></td>
      </tr>
    `).join("");
    recentCard.innerHTML = `
      <div class="tt-card-head"><span>Recent checks</span></div>
      <div class="tt-card-body">
        <div class="tt-table-wrap">
          <table class="tt-table">
            <thead><tr><th>Date</th><th>Pupil</th><th>Factor</th><th>Rating</th><th>Notes</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
    recentCard.querySelectorAll("button[data-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        removePhysicalLog(btn.getAttribute("data-id"));
        renderTab();
      });
    });
  }
  wrap.appendChild(recentCard);

  wrap.appendChild(renderPhysicalDiagnostic());

  return wrap;
}

/* ---------------------------------------------------------------
   PHYSICAL READINESS - DIAGNOSTIC MATRIX
   (extends the Physical Readiness tab - selects a pupil and cross-
   references their factor ratings against every skill to flag
   likely reasons they're struggling)
   --------------------------------------------------------------- */
function latestFactorRating(logs, pupil, factor) {
  const matches = logs
    .filter((l) => l.pupil === pupil && l.factor === factor)
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return matches[0] || null;
}

function renderPhysicalDiagnostic() {
  const card = document.createElement("div");
  card.className = "tt-card";
  const pupils = getPupils();
  if (!physicalDiagnosticPupil && pupils.length) physicalDiagnosticPupil = pupils[0];
  if (physicalDiagnosticPupil && !pupils.includes(physicalDiagnosticPupil)) physicalDiagnosticPupil = pupils[0] || "";

  card.innerHTML = `
    <div class="tt-card-head">
      <span>Diagnostic - likely limiting factors per skill</span>
      <select id="tt-pd-pupil" class="tt-select tt-select-inline">
        <option value="">Select pupil</option>
        ${pupils.map((p) => `<option value="${escapeHtml(p)}" ${physicalDiagnosticPupil === p ? "selected" : ""}>${escapeHtml(p)}</option>`).join("")}
      </select>
    </div>
    <div class="tt-card-body" id="tt-pd-body"></div>
  `;

  card.querySelector("#tt-pd-pupil").addEventListener("change", (e) => {
    physicalDiagnosticPupil = e.target.value;
    renderTab();
  });

  const body = card.querySelector("#tt-pd-body");

  if (pupils.length === 0) {
    body.innerHTML = `<div class="tt-empty"><div class="tt-empty-title">No pupils yet</div><div class="tt-empty-body">Add pupils on the Pupils tab, then select one here.</div></div>`;
    return card;
  }
  if (!physicalDiagnosticPupil) {
    body.innerHTML = `<div class="tt-empty"><div class="tt-empty-title">Select a pupil</div><div class="tt-empty-body">Choose a name above to see their physical readiness profile.</div></div>`;
    return card;
  }

  const physicalLogs = getPhysicalLogs();
  const assessments = getAssessments();

  const factorEntries = {};
  FACTORS.forEach((f) => { factorEntries[f] = latestFactorRating(physicalLogs, physicalDiagnosticPupil, f); });

  const factorCardsHtml = FACTORS.map((f) => {
    const entry = factorEntries[f];
    return `
      <div class="tt-factor-card">
        <div class="tt-factor-card-name">${escapeHtml(f)}</div>
        ${entry ? `${factorBadge(entry.rating)}<div class="tt-factor-card-date">${formatDate(entry.date)}</div>` : `<span class="tt-muted">No data</span>`}
      </div>
    `;
  }).join("");

  const diagRows = SKILL_ORDER.map((skill) => {
    const { latest } = latestAndPrevious(assessments, physicalDiagnosticPupil, "skill", skill, "Coach");
    const rating = latest ? latest.rating : null;
    const relevant = SKILL_LIBRARY[skill].factors;
    const struggling = rating === "Not Yet" || rating === "Developing";
    const limiting = relevant.filter((f) => factorEntries[f] && factorEntries[f].rating === "Limiting");
    const developing = relevant.filter((f) => factorEntries[f] && factorEntries[f].rating === "Developing");

    let flagHtml = "";
    if (struggling && limiting.length) {
      flagHtml = `<span class="tt-tag tt-tag-bad">Likely limiting: ${escapeHtml(limiting.join(", "))}</span>`;
    } else if (struggling && developing.length) {
      flagHtml = `<span class="tt-tag tt-tag-warn">Check developing: ${escapeHtml(developing.join(", "))}</span>`;
    } else if (rating === "Secure" || rating === "Exceeding") {
      flagHtml = `<span class="tt-tag tt-tag-good">On track</span>`;
    }

    const factorChipsHtml = relevant.map((f) => {
      const entry = factorEntries[f];
      return `<span class="tt-diag-chip">${escapeHtml(f)}: ${entry ? factorBadge(entry.rating) : `<span class="tt-muted">no data</span>`}</span>`;
    }).join("");

    return `
      <div class="tt-diag-row ${flagHtml.includes('tt-tag-bad') ? 'tt-diag-row-flagged' : ''}">
        <div class="tt-diag-skill">
          <span class="tt-strong">${escapeHtml(skill)}</span>
          ${rating ? ratingBadge(rating) : `<span class="tt-muted">No data</span>`}
        </div>
        <div class="tt-diag-factors">${factorChipsHtml}</div>
        <div class="tt-diag-flag">${flagHtml}</div>
      </div>
    `;
  }).join("");

  body.innerHTML = `
    <div class="tt-lib-block-title" style="margin-bottom:10px;">Current physical factor ratings</div>
    <div class="tt-factor-grid" style="margin-bottom:20px;">${factorCardsHtml}</div>
    <div class="tt-lib-block-title" style="margin-bottom:10px;">Skill-by-skill diagnostic</div>
    <div class="tt-diag-list">${diagRows}</div>
  `;

  return card;
}

/* ---------------------------------------------------------------
   SKILL LIBRARY TAB
   --------------------------------------------------------------- */
function listBlock(title, items) {
  return `
    <div class="tt-lib-block">
      <div class="tt-lib-block-title">${escapeHtml(title)}</div>
      <ul class="tt-lib-list">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>
    </div>
  `;
}

function skillDetailHtml(skill) {
  const d = SKILL_LIBRARY[skill];
  const phaseRows = d.phases.map(([phase, detail]) => `
    <div class="tt-lib-phase-row">
      <div class="tt-lib-phase-name">${escapeHtml(phase)}</div>
      <div class="tt-lib-phase-detail">${escapeHtml(detail)}</div>
    </div>
  `).join("");

  return `
    <div class="tt-lib-detail">
      <div class="tt-lib-factors">
        <span>Key physical factors:</span>
        ${d.factors.map((f) => `<span class="tt-lib-factor-pill">${escapeHtml(f)}</span>`).join("")}
      </div>
      <div class="tt-lib-two-col">
        ${listBlock("Physical prerequisites", d.physical_prereq)}
        ${listBlock("Safety prerequisites", d.safety_prereq)}
      </div>
      <div class="tt-lib-block">
        <div class="tt-lib-block-title">Technical phases</div>
        <div class="tt-lib-phase-table">${phaseRows}</div>
      </div>
      <div class="tt-lib-two-col">
        ${listBlock("Detailed coaching points", d.coaching_points)}
        ${listBlock("Common faults", d.common_faults)}
      </div>
      <div class="tt-lib-two-col">
        ${listBlock("Coaching cues", d.coaching_cues)}
        ${listBlock("Likely competition deductions", d.competition_deductions)}
      </div>
      <div class="tt-lib-two-col">
        ${listBlock("Progressions", d.progressions)}
        ${listBlock("Regressions", d.regressions)}
      </div>
      <div class="tt-lib-two-col">
        ${listBlock("Physical preparation exercises", d.physical_prep)}
        ${listBlock("Readiness indicators to progress", d.readiness_indicators)}
      </div>
      <div class="tt-lib-two-col">
        <div class="tt-lib-block">
          <div class="tt-lib-block-title">Coach assessment criteria</div>
          <ol class="tt-lib-list tt-lib-list-numbered">${d.assess_criteria.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ol>
        </div>
        <div>
          ${listBlock('Child self-assessment ("I can...")', d.self_statements)}
          ${listBlock("Partner observation points", d.peer_points)}
        </div>
      </div>
    </div>
  `;
}

function renderSkillLibrary() {
  const wrap = document.createElement("div");
  const card = document.createElement("div");
  card.className = "tt-card";
  card.innerHTML = `
    <div class="tt-card-head"><span>Skill library - master coaching reference</span></div>
    <div class="tt-card-body">
      <div class="tt-lib-accordion" id="tt-lib-accordion"></div>
    </div>
  `;
  wrap.appendChild(card);

  const acc = card.querySelector("#tt-lib-accordion");
  SKILL_ORDER.forEach((skill) => {
    const item = document.createElement("div");
    item.className = "tt-lib-accordion-item";
    const isOpen = libraryOpenSkill === skill;
    item.innerHTML = `
      <button class="tt-lib-accordion-head">
        <span class="tt-lib-chevron">${isOpen ? "&#9662;" : "&#9656;"}</span>
        <span>${escapeHtml(skill)}</span>
      </button>
      ${isOpen ? skillDetailHtml(skill) : ""}
    `;
    item.querySelector(".tt-lib-accordion-head").addEventListener("click", () => {
      libraryOpenSkill = libraryOpenSkill === skill ? null : skill;
      renderTab();
    });
    acc.appendChild(item);
  });

  return wrap;
}

/* ---------------------------------------------------------------
   DASHBOARD HELPERS  (shared by Pupil Tracking and future dashboards)
   --------------------------------------------------------------- */
function latestAndPrevious(entries, pupil, keyField, keyValue, type) {
  const matches = entries
    .filter((e) => e.pupil === pupil && e[keyField] === keyValue && (type ? e.type === type : true))
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // newest first
  return { latest: matches[0] || null, previous: matches[1] || null, count: matches.length };
}

function progressTag(progress) {
  if (progress === "Improved") return `<span class="tt-tag tt-tag-good">&#9650; Improved</span>`;
  if (progress === "Review") return `<span class="tt-tag tt-tag-bad">Review</span>`;
  if (progress === "No change") return `<span class="tt-tag tt-tag-neutral">No change</span>`;
  return "";
}

/* ---------------------------------------------------------------
   PUPIL TRACKING TAB
   --------------------------------------------------------------- */
function renderPupilTracking() {
  const wrap = document.createElement("div");
  const pupils = getPupils();
  if (!pupilTrackingSelected && pupils.length) pupilTrackingSelected = pupils[0];
  if (pupilTrackingSelected && !pupils.includes(pupilTrackingSelected)) pupilTrackingSelected = pupils[0] || "";

  const card = document.createElement("div");
  card.className = "tt-card";
  card.innerHTML = `
    <div class="tt-card-head">
      <span>Individual pupil tracking</span>
      <select id="tt-pt-pupil" class="tt-select tt-select-inline">
        <option value="">Select pupil</option>
        ${pupils.map((p) => `<option value="${escapeHtml(p)}" ${pupilTrackingSelected === p ? "selected" : ""}>${escapeHtml(p)}</option>`).join("")}
      </select>
    </div>
    <div class="tt-card-body" id="tt-pt-body"></div>
  `;
  wrap.appendChild(card);

  card.querySelector("#tt-pt-pupil").addEventListener("change", (e) => {
    pupilTrackingSelected = e.target.value;
    renderTab();
  });

  const body = card.querySelector("#tt-pt-body");

  if (pupils.length === 0) {
    body.innerHTML = `<div class="tt-empty"><div class="tt-empty-title">No pupils yet</div><div class="tt-empty-body">Add pupils on the Pupils tab, then select one here to see their progress.</div></div>`;
    return wrap;
  }
  if (!pupilTrackingSelected) {
    body.innerHTML = `<div class="tt-empty"><div class="tt-empty-title">Select a pupil</div><div class="tt-empty-body">Choose a name above to see their skill-by-skill progress.</div></div>`;
    return wrap;
  }

  const assessments = getAssessments();
  const rows = SKILL_ORDER.map((skill) => {
    const { latest, previous, count } = latestAndPrevious(assessments, pupilTrackingSelected, "skill", skill, "Coach");
    let progress = "";
    if (latest && previous) {
      const lv = RATING_VALUE[latest.rating], pv = RATING_VALUE[previous.rating];
      progress = lv > pv ? "Improved" : lv < pv ? "Review" : "No change";
    }
    return { skill, latest, previous, count, progress };
  });

  const tableRows = rows.map((r) => `
    <tr>
      <td class="tt-strong">${escapeHtml(r.skill)}</td>
      <td>${r.latest ? ratingBadge(r.latest.rating) : `<span class="tt-muted">No data</span>`}</td>
      <td class="tt-nowrap tt-muted">${r.latest ? formatDate(r.latest.date) : ""}</td>
      <td>${r.previous ? ratingBadge(r.previous.rating) : `<span class="tt-muted">&mdash;</span>`}</td>
      <td class="tt-nowrap tt-muted">${r.previous ? formatDate(r.previous.date) : ""}</td>
      <td>${progressTag(r.progress)}</td>
      <td class="tt-center">${r.count}</td>
    </tr>
  `).join("");

  body.innerHTML = `
    <div class="tt-table-wrap">
      <table class="tt-table">
        <thead><tr><th>Skill</th><th>Latest rating</th><th>Latest date</th><th>Previous rating</th><th>Previous date</th><th>Progress</th><th>Times assessed</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  `;

  return wrap;
}

/* ---------------------------------------------------------------
   CLASS OVERVIEW TAB
   --------------------------------------------------------------- */
function renderClassOverview() {
  const wrap = document.createElement("div");
  const pupils = getPupils();
  const assessments = getAssessments();

  const card = document.createElement("div");
  card.className = "tt-card";
  card.innerHTML = `<div class="tt-card-head"><span>Class overview</span></div><div class="tt-card-body" id="tt-co-body"></div>`;
  wrap.appendChild(card);
  const body = card.querySelector("#tt-co-body");

  if (pupils.length === 0) {
    body.innerHTML = `<div class="tt-empty"><div class="tt-empty-title">No pupils yet</div><div class="tt-empty-body">Add pupils on the Pupils tab to build the whole-class grid.</div></div>`;
    return wrap;
  }

  const rows = pupils.map((p) => {
    const cells = SKILL_ORDER.map((skill) => {
      const { latest } = latestAndPrevious(assessments, p, "skill", skill, "Coach");
      return latest ? latest.rating : null;
    });
    const values = cells.filter(Boolean).map((r) => RATING_VALUE[r]);
    const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    const secureCount = cells.filter((r) => r === "Secure" || r === "Exceeding").length;
    return { pupil: p, cells, avg, secureCount };
  });

  const headCells = SKILL_ORDER.map((s) => `<th class="tt-rot-head"><span>${escapeHtml(s)}</span></th>`).join("");
  const bodyRows = rows.map((r) => {
    const cellsHtml = r.cells.map((c) => `<td class="tt-center">${c ? ratingBadge(c) : `<span class="tt-muted">&mdash;</span>`}</td>`).join("");
    return `
      <tr>
        <td class="tt-sticky-col tt-strong">${escapeHtml(r.pupil)}</td>
        ${cellsHtml}
        <td class="tt-center tt-strong">${r.avg !== null ? r.avg.toFixed(2) : ""}</td>
        <td class="tt-center">${r.secureCount}</td>
      </tr>
    `;
  }).join("");

  body.innerHTML = `
    <div class="tt-table-wrap">
      <table class="tt-table tt-table-grid">
        <thead><tr><th class="tt-sticky-col">Pupil</th>${headCells}<th>Avg</th><th>Secure+</th></tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  `;

  return wrap;
}

/* ---------------------------------------------------------------
   SKILL PROGRESSION TAB
   --------------------------------------------------------------- */
function readinessFor(avg, n) {
  if (n === 0) return { label: "No data", cls: "tt-tag-neutral" };
  if (avg >= 3.5) return { label: "Whole-class ready to progress", cls: "tt-tag-exceeding" };
  if (avg >= 2.5) return { label: "Majority secure - progress in groups", cls: "tt-tag-good" };
  if (avg >= 1.5) return { label: "Developing - keep consolidating", cls: "tt-tag-warn" };
  return { label: "Early stage - focus on prerequisites", cls: "tt-tag-bad" };
}

function renderSkillProgression() {
  const wrap = document.createElement("div");
  const pupils = getPupils();
  const assessments = getAssessments();
  const targets = getTargets();

  const card = document.createElement("div");
  card.className = "tt-card";
  card.innerHTML = `<div class="tt-card-head"><span>Skill progression - class distribution</span></div><div class="tt-card-body" id="tt-sp-body"></div>`;
  wrap.appendChild(card);
  const body = card.querySelector("#tt-sp-body");

  if (pupils.length === 0) {
    body.innerHTML = `<div class="tt-empty"><div class="tt-empty-title">No data yet</div><div class="tt-empty-body">Log some assessments to see the class distribution per skill.</div></div>`;
    return wrap;
  }

  const rows = SKILL_ORDER.map((skill) => {
    const latestPerPupil = pupils.map((p) => latestAndPrevious(assessments, p, "skill", skill, "Coach").latest);
    const rated = latestPerPupil.filter(Boolean);
    const counts = { "Not Yet": 0, "Developing": 0, "Secure": 0, "Exceeding": 0 };
    rated.forEach((a) => { counts[a.rating] = (counts[a.rating] || 0) + 1; });
    const avg = rated.length ? rated.reduce((s, a) => s + RATING_VALUE[a.rating], 0) / rated.length : 0;
    const readiness = readinessFor(avg, rated.length);
    return { skill, n: rated.length, counts, avg, readiness };
  });

  const bodyRows = rows.map((r) => `
    <tr>
      <td class="tt-strong">${escapeHtml(r.skill)}</td>
      <td class="tt-center">${r.n}</td>
      <td class="tt-center">${r.counts["Not Yet"]}</td>
      <td class="tt-center">${r.counts["Developing"]}</td>
      <td class="tt-center">${r.counts["Secure"]}</td>
      <td class="tt-center">${r.counts["Exceeding"]}</td>
      <td class="tt-center tt-strong">${r.n ? r.avg.toFixed(2) : ""}</td>
      <td><span class="tt-tag ${r.readiness.cls}">${escapeHtml(r.readiness.label)}</span></td>
      <td><input type="text" class="tt-input tt-input-sm tt-target-input" data-skill="${escapeHtml(r.skill)}" placeholder="Add a target..." value="${escapeHtml(targets[r.skill] || "")}" /></td>
    </tr>
  `).join("");

  body.innerHTML = `
    <div class="tt-table-wrap">
      <table class="tt-table">
        <thead><tr>
          <th>Skill</th><th>Assessed</th><th>Not Yet</th><th>Developing</th><th>Secure</th><th>Exceeding</th>
          <th>Avg (1-4)</th><th>Class readiness</th><th>Target / focus</th>
        </tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  `;

  body.querySelectorAll(".tt-target-input").forEach((input) => {
    input.addEventListener("input", (e) => {
      const currentTargets = getTargets();
      currentTargets[e.target.getAttribute("data-skill")] = e.target.value;
      saveTargets(currentTargets);
      // deliberately no renderTab() here - re-rendering on every keystroke
      // would rebuild the input and steal focus mid-type.
    });
  });

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

function factorBadge(rating) {
  if (!rating) return `<span class="tt-muted">&mdash;</span>`;
  const c = FACTOR_COLORS[rating] || { bg: "#EEE", fg: "#666", ring: "#CCC" };
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
