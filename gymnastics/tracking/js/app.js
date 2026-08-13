// gymnastics/tracking/js/app.js
// Piece 1: pupil roster + assessment logging.
// Later pieces will add renderPupilTracking(), renderClassOverview(),
// renderSkillProgression(), renderPhysicalReadiness() the same way these
// two render functions work, and add their tab buttons to the nav below.

const TABS = [
  { id: "log", label: "Log Assessment" },
  { id: "physical", label: "Physical Readiness" },
  { id: "pupil-tracking", label: "Pupil Tracking" },
  { id: "class-overview", label: "Class Overview" },
  { id: "progression", label: "Skill Progression" },
  { id: "pupils", label: "Pupils" },
];

let currentTab = "log";
let logForm = { date: todayISO(), pupil: "", skill: "", type: "Coach", rating: "", reflectionA: "", reflectionB: "" };
let physicalForm = { date: todayISO(), pupil: "", factor: "", rating: "", notes: "" };
let pupilTrackingSelected = "";
let physicalDiagnosticPupil = "";
let logBreakdown = [];
let logBreakdownKey = "";

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
  const assessments = getAssessments();

  const skillOptionsHtml = SKILL_CATEGORIES.map((category) => {
    const skillsInCategory = SKILL_ORDER.filter((s) => SKILL_META[s].category === category);
    if (skillsInCategory.length === 0) return "";
    const opts = skillsInCategory.map((s) => {
      const tier = SKILL_META[s].tier;
      const locked = logForm.pupil && !isSkillUnlocked(logForm.pupil, s, assessments);
      const prefix = locked ? "\uD83D\uDD12 " : "";
      return `<option value="${s}" ${logForm.skill === s ? "selected" : ""}>${prefix}${s} (Level ${tier})</option>`;
    }).join("");
    return `<optgroup label="${escapeHtml(category)}">${opts}</optgroup>`;
  }).join("");

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
            ${skillOptionsHtml}
          </select>
        </label>
        <label class="tt-field"><span>Type</span>
          <select id="tt-f-type" class="tt-select">
            ${ASSESSMENT_TYPES.map((t) => `<option value="${t}" ${logForm.type === t ? "selected" : ""}>${t}</option>`).join("")}
          </select>
        </label>
        ${logForm.type === "Coach" ? `
        <label class="tt-field"><span>Overall judgement</span>
          <select id="tt-f-rating" class="tt-select">
            <option value="">Choose rating</option>
            ${RATING_LEVELS.map((r) => `<option value="${r}" ${logForm.rating === r ? "selected" : ""}>${r}</option>`).join("")}
          </select>
        </label>` : ""}
        <label class="tt-field tt-field-wide"><span>${escapeHtml(reflectionConfig(logForm.type).aLabel)} (optional)</span>
          <input type="text" id="tt-f-reflectionA" class="tt-input" value="${escapeHtml(logForm.reflectionA)}" />
        </label>
        <label class="tt-field tt-field-wide"><span>${escapeHtml(reflectionConfig(logForm.type).bLabel)} (optional)</span>
          <input type="text" id="tt-f-reflectionB" class="tt-input" value="${escapeHtml(logForm.reflectionB)}" />
        </label>
      </div>
      <div id="tt-lock-advisory"></div>
      <div id="tt-breakdown-slot"></div>
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
  if (logForm.type === "Coach") bind("#tt-f-rating", "rating");
  bind("#tt-f-reflectionA", "reflectionA");
  bind("#tt-f-reflectionB", "reflectionB");

  // Skill, Type and Pupil changes need to rebuild the breakdown checklist
  // and/or lock-status display below (different skill = different
  // criteria and prerequisites; different pupil = different unlock
  // status), so - unlike the other fields above - these three also
  // trigger a full tab re-render. Text/date fields deliberately don't,
  // to avoid stealing focus mid-keystroke.
  formCard.querySelector("#tt-f-pupil").addEventListener("change", () => renderTab());
  formCard.querySelector("#tt-f-skill").addEventListener("change", () => renderTab());
  formCard.querySelector("#tt-f-type").addEventListener("change", () => renderTab());

  renderBreakdownChecklist(formCard.querySelector("#tt-breakdown-slot"));
  renderLockAdvisory(formCard.querySelector("#tt-lock-advisory"), assessments);

  formCard.querySelector("#tt-save-assessment").addEventListener("click", () => {
    if (!logForm.pupil || !logForm.skill || !logForm.type) {
      alert("Please choose a pupil, skill and assessment type before saving.");
      return;
    }
    if (logForm.type === "Coach" && !logForm.rating) {
      alert("Please choose an overall judgement before saving a Coach assessment.");
      return;
    }
    const breakdownToSave = logBreakdown.filter((r) => r.value).map((r) => ({ label: r.label, value: r.value }));
    const rc = reflectionConfig(logForm.type);
    const reflectionToSave = [];
    if (logForm.reflectionA) reflectionToSave.push({ label: rc.aLabel, value: logForm.reflectionA });
    if (logForm.reflectionB) reflectionToSave.push({ label: rc.bLabel, value: logForm.reflectionB });
    addAssessment({
      date: logForm.date, pupil: logForm.pupil, skill: logForm.skill,
      type: logForm.type, rating: logForm.type === "Coach" ? logForm.rating : "",
      breakdown: breakdownToSave, reflection: reflectionToSave,
    });
    // keep pupil + type selected for fast repeated entry; clear skill/rating/reflection/breakdown
    logForm = { date: logForm.date, pupil: logForm.pupil, skill: "", type: logForm.type, rating: "", reflectionA: "", reflectionB: "" };
    logBreakdownKey = "";
    logBreakdown = [];
    renderTab();
  });

  // recent entries table
  const recentCard = document.createElement("div");
  recentCard.className = "tt-card";
  const recentAssessments = assessments.slice(0, 15);
  if (recentAssessments.length === 0) {
    recentCard.innerHTML = `
      <div class="tt-card-head"><span>Recent entries</span></div>
      <div class="tt-card-body">
        <div class="tt-empty">
          <div class="tt-empty-title">Nothing logged yet</div>
          <div class="tt-empty-body">Assessments you save will appear here, most recent first.</div>
        </div>
      </div>`;
  } else {
    const rows = recentAssessments.map((a) => `
      <tr>
        <td class="tt-nowrap">${formatDate(a.date)}</td>
        <td>${escapeHtml(a.pupil)}</td>
        <td>${escapeHtml(a.skill)}</td>
        <td>${escapeHtml(a.type)}</td>
        <td>${ratingBadge(a.rating)}</td>
        <td class="tt-muted">${escapeHtml(assessmentNotesSummary(a))}</td>
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
   LOG ASSESSMENT - PER-CRITERION BREAKDOWN CHECKLIST
   (the specific things to look for, shown once a skill + type are
   both chosen - mirrors the Coach Assessment Sheet / Self-Assessment /
   Partner Observation Card content from the Skill Library)
   --------------------------------------------------------------- */
function breakdownConfig(type) {
  if (type === "Coach") return { title: "Coach assessment criteria (optional detail)", options: RATING_LEVELS, colors: RATING_COLORS };
  if (type === "Self") return { title: "Self-assessment statements (I can...)", options: CONFIDENCE_LEVELS, colors: CONFIDENCE_COLORS };
  if (type === "Peer") return { title: "Partner observation points", options: PEER_LEVELS, colors: PEER_COLORS };
  return { title: "", options: [], colors: {} };
}

// Type-specific reflection prompts, matching the original Coach Assessment
// Sheet / Self-Assessment / Partner Observation design (Strengths & Targets,
// What I did well & What I want to improve, etc.) rather than one generic
// catch-all Notes field.
function reflectionConfig(type) {
  if (type === "Coach") return { aLabel: "Strengths", aKey: "strengths", bLabel: "Targets", bKey: "targets" };
  if (type === "Self") return { aLabel: "What I did well", aKey: "wentWell", bLabel: "What I want to improve", bKey: "toImprove" };
  if (type === "Peer") return { aLabel: "One thing you did well", aKey: "peerWentWell", bLabel: "One coaching tip for you", bKey: "peerTip" };
  return { aLabel: "Notes", aKey: "notes", bLabel: "", bKey: "" };
}

// Recent Entries display helper - new records carry a labelled `reflection`
// array (Strengths/Targets, etc.); older records saved before this existed
// only have a plain `notes` string. Fall back gracefully so old entries
// still display something sensible.
function assessmentNotesSummary(a) {
  if (a.reflection && a.reflection.length) {
    return a.reflection.filter((r) => r.value).map((r) => r.label + ": " + r.value).join(" | ");
  }
  return a.notes || "";
}

function buildBreakdownTemplate(skill, type) {
  if (!skill || !SKILL_LIBRARY[skill]) return [];
  const d = SKILL_LIBRARY[skill];
  if (type === "Coach") return d.assess_criteria.map((c) => ({ label: c, value: "" }));
  if (type === "Self") return d.self_statements.map((s) => ({ label: s, value: "" }));
  if (type === "Peer") return d.peer_points.map((p) => ({ label: p, value: "" }));
  return [];
}

function renderBreakdownChecklist(slotEl) {
  const key = logForm.skill + "|" + logForm.type;
  if (key !== logBreakdownKey) {
    logBreakdown = buildBreakdownTemplate(logForm.skill, logForm.type);
    logBreakdownKey = key;
  }
  if (!logForm.skill || !logForm.type || logBreakdown.length === 0) {
    slotEl.innerHTML = "";
    return;
  }

  const config = breakdownConfig(logForm.type);
  const rows = logBreakdown.map((row, i) => {
    const c = config.colors[row.value];
    const style = c ? `background:${c.bg};border-color:${c.ring};` : "";
    return `
      <div class="tt-breakdown-row" style="${style}">
        <div class="tt-breakdown-label">${escapeHtml(row.label)}</div>
        <select class="tt-select tt-breakdown-select" data-index="${i}">
          <option value="">-</option>
          ${config.options.map((o) => `<option value="${o}" ${row.value === o ? "selected" : ""}>${o}</option>`).join("")}
        </select>
      </div>
    `;
  }).join("");

  slotEl.innerHTML = `
    <div class="tt-lib-block-title" style="margin-top:6px;">${escapeHtml(config.title)}</div>
    <div class="tt-breakdown-list">${rows}</div>
  `;

  slotEl.querySelectorAll(".tt-breakdown-select").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const idx = parseInt(e.target.getAttribute("data-index"), 10);
      logBreakdown[idx].value = e.target.value;
      const rowEl = e.target.closest(".tt-breakdown-row");
      const c = config.colors[e.target.value];
      rowEl.style.background = c ? c.bg : "";
      rowEl.style.borderColor = c ? c.ring : "";
    });
  });
}

function renderLockAdvisory(slotEl, assessments) {
  if (!logForm.pupil || !logForm.skill) { slotEl.innerHTML = ""; return; }
  const missing = missingPrerequisites(logForm.pupil, logForm.skill, assessments);
  if (missing.length === 0) { slotEl.innerHTML = ""; return; }

  const details = missing.map((p) => {
    const { latest } = latestAndPrevious(assessments, logForm.pupil, "skill", p, "Coach");
    const current = latest ? latest.rating : "No data";
    return `${escapeHtml(p)} (currently ${escapeHtml(current)})`;
  }).join(", ");

  slotEl.innerHTML = `
    <div class="tt-lock-banner">
      &#128274; <strong>${escapeHtml(logForm.skill)}</strong> isn't usually taught to ${escapeHtml(logForm.pupil)} yet -
      it's normally introduced after: ${details} reach Secure. You can still log it if this pupil is working ahead.
    </div>
  `;
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
      <div id="tt-p-test-guide"></div>
      <button class="tt-btn tt-btn-primary tt-btn-lg" id="tt-save-physical">+ Save check</button>
    </div>
  `;
  wrap.appendChild(formCard);

  const renderTestGuide = () => {
    const guideEl = formCard.querySelector("#tt-p-test-guide");
    const testInfo = FACTOR_TESTS[physicalForm.factor];
    if (!testInfo) { guideEl.innerHTML = ""; return; }
    const bandRows = FACTOR_LEVELS.map((level) => `
      <div class="tt-test-band-row ${physicalForm.rating === level ? "tt-test-band-row-active" : ""}">
        ${factorBadge(level)}
        <span class="tt-test-band-text">${escapeHtml(testInfo.bands[level])}</span>
      </div>
    `).join("");
    guideEl.innerHTML = `
      <div class="tt-lib-block tt-test-guide">
        <div class="tt-lib-block-title">Test: ${escapeHtml(testInfo.test)}</div>
        <div class="tt-test-guide-setup"><strong>Setup:</strong> ${escapeHtml(testInfo.setup)}</div>
        <div class="tt-test-guide-lookfor"><strong>Look for:</strong> ${escapeHtml(testInfo.lookFor)}</div>
        <div class="tt-test-band-list">${bandRows}</div>
      </div>
    `;
  };
  renderTestGuide();

  const bind = (id, key, extra) => formCard.querySelector(id).addEventListener("input", (e) => {
    physicalForm[key] = e.target.value;
    if (extra) extra();
  });
  bind("#tt-p-date", "date");
  bind("#tt-p-pupil", "pupil");
  bind("#tt-p-factor", "factor", renderTestGuide);
  bind("#tt-p-rating", "rating", renderTestGuide);
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
   SKILL LOCK STATUS (soft-lock - advisory only, never blocks logging)
   A skill is "unlocked" for a pupil once every prerequisite skill is
   rated Secure or Exceeding for them. Locked skills remain fully
   selectable everywhere - this only affects how they're displayed.
   --------------------------------------------------------------- */
function missingPrerequisites(pupil, skill, assessments) {
  const meta = SKILL_META[skill];
  if (!meta || !meta.prerequisites.length) return [];
  return meta.prerequisites.filter((p) => {
    const { latest } = latestAndPrevious(assessments, pupil, "skill", p, "Coach");
    return !latest || (latest.rating !== "Secure" && latest.rating !== "Exceeding");
  });
}
function isSkillUnlocked(pupil, skill, assessments) {
  return missingPrerequisites(pupil, skill, assessments).length === 0;
}
function tierBadge(tier) {
  if (!tier || !TIER_COLORS[tier]) return "";
  const c = TIER_COLORS[tier];
  return `<span class="tt-tier-badge" style="background:${c.bg};color:${c.fg};box-shadow:inset 0 0 0 1.5px ${c.ring}55;">Level ${escapeHtml(tier)}</span>`;
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

  const tableRows = rows.map((r) => {
    const noDataCell = isSkillUnlocked(pupilTrackingSelected, r.skill, assessments)
      ? `<span class="tt-muted">No data</span>`
      : `<span class="tt-locked-pill" title="Prerequisites: ${escapeHtml(SKILL_META[r.skill].prerequisites.join(", "))}">&#128274; Locked</span>`;
    return `
    <tr>
      <td class="tt-strong">${escapeHtml(r.skill)} ${tierBadge(SKILL_META[r.skill].tier)}</td>
      <td>${r.latest ? ratingBadge(r.latest.rating) : noDataCell}</td>
      <td class="tt-nowrap tt-muted">${r.latest ? formatDate(r.latest.date) : ""}</td>
      <td>${r.previous ? ratingBadge(r.previous.rating) : `<span class="tt-muted">&mdash;</span>`}</td>
      <td class="tt-nowrap tt-muted">${r.previous ? formatDate(r.previous.date) : ""}</td>
      <td>${progressTag(r.progress)}</td>
      <td class="tt-center">${r.count}</td>
    </tr>
  `;
  }).join("");

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
