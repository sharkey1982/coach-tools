// gymnastics/core-skills/js/app.js
// Core Skills Library - master coaching reference for the floor/body skills
// track (rolls, balances, jumps, handstands, acrobatic sequences).
//
// This was originally the "Skill Library" tab inside Pupil Tracking. Moved
// out to its own page on the main Gymnastics hub so it's reachable without
// going into the assessment-logging tool, and to distinguish it from the
// RISE Skill Library (all three RISE tracks, at gymnastics/activities/).
// Pupil Tracking keeps its own copies of skills-data.js and
// skill-library-data.js, since its Physical Readiness diagnostic, Skill
// Progression and Log Assessment tabs still read from SKILL_LIBRARY/
// SKILL_META directly - only this browsing/printing UI moved.

let libraryOpenSkill = SKILL_ORDER[0];
let libraryLevelFilter = ""; // "" = All Levels
let packSelectedSkills = new Set();
let packSheetTypes = new Set(["master"]); // default: just the master checklist

function init() {
  render();
}

function render() {
  const main = document.getElementById("cs-main");
  main.innerHTML = "";
  main.appendChild(renderCoreSkillsLibrary());
}

function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tierBadge(tier) {
  if (!tier || !TIER_COLORS[tier]) return "";
  const c = TIER_COLORS[tier];
  return `<span class="tt-tier-badge" style="background:${c.bg};color:${c.fg};box-shadow:inset 0 0 0 1.5px ${c.ring}55;">Level ${escapeHtml(tier)}</span>`;
}

/* ---------------------------------------------------------------
   SKILL LIBRARY
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
  const meta = SKILL_META[skill];
  const phaseRows = d.phases.map(([phase, detail]) => `
    <div class="tt-lib-phase-row">
      <div class="tt-lib-phase-name">${escapeHtml(phase)}</div>
      <div class="tt-lib-phase-detail">${escapeHtml(detail)}</div>
    </div>
  `).join("");

  return `
    <div class="tt-lib-detail">
      <div class="tt-lib-print-bar">
        <span class="tt-lib-print-label">Print:</span>
        <button class="tt-btn tt-btn-print" onclick='printMasterChecklist(${JSON.stringify(skill)})'>Master checklist</button>
        <button class="tt-btn tt-btn-print" onclick='printCoachSheet(${JSON.stringify(skill)})'>Coach assessment sheet</button>
        <button class="tt-btn tt-btn-print" onclick='printSelfSheet(${JSON.stringify(skill)})'>Self-assessment card</button>
        <button class="tt-btn tt-btn-print" onclick='printPeerSheet(${JSON.stringify(skill)})'>Peer observation card</button>
      </div>
      ${d.video ? `
      <div class="tt-lib-video-link">
        <a href="${escapeHtml(d.video.url)}" target="_blank" rel="noopener noreferrer" class="tt-btn">
          &#9654; Watch: ${escapeHtml(d.video.label)}
        </a>
      </div>` : ""}
      <div class="tt-lib-factors">
        ${tierBadge(meta.tier)}
        <span style="margin-left:10px;">Prerequisite skills:</span>
        ${meta.prerequisites.length
          ? meta.prerequisites.map((p) => `<span class="tt-lib-factor-pill">${escapeHtml(p)}</span>`).join("")
          : `<span class="tt-muted">None - entry-level skill</span>`}
      </div>
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

function renderCoreSkillsLibrary() {
  const wrap = document.createElement("div");
  const card = document.createElement("div");
  card.className = "tt-card";
  card.innerHTML = `
    <div class="tt-card-head">
      <span>Core skills library - master coaching reference</span>
      <select id="tt-lib-level-filter" class="tt-select tt-select-inline">
        <option value="">All Levels</option>
        ${SKILL_TIERS.map((t) => `<option value="${t}" ${libraryLevelFilter === t ? "selected" : ""}>Level ${t}</option>`).join("")}
      </select>
    </div>
    <div class="tt-card-body">
      <div class="tt-pack-bar">
        <div class="tt-pack-bar-row">
          <span class="tt-pack-label">Build a pack:</span>
          <label class="tt-pack-check"><input type="checkbox" id="tt-pack-type-master" ${packSheetTypes.has("master") ? "checked" : ""}> Master checklist</label>
          <label class="tt-pack-check"><input type="checkbox" id="tt-pack-type-coach" ${packSheetTypes.has("coach") ? "checked" : ""}> Coach sheet</label>
          <label class="tt-pack-check"><input type="checkbox" id="tt-pack-type-self" ${packSheetTypes.has("self") ? "checked" : ""}> Self card</label>
          <label class="tt-pack-check"><input type="checkbox" id="tt-pack-type-peer" ${packSheetTypes.has("peer") ? "checked" : ""}> Peer card</label>
        </div>
        <div class="tt-pack-bar-row">
          <button class="tt-btn tt-btn-print" id="tt-pack-select-visible">Select all shown</button>
          <button class="tt-btn tt-btn-print" id="tt-pack-select-none">Clear selection</button>
          <button class="tt-btn tt-btn-primary" id="tt-pack-print">Print pack (${packSelectedSkills.size} skill${packSelectedSkills.size === 1 ? "" : "s"})</button>
        </div>
      </div>
      <div class="tt-lib-accordion" id="tt-lib-accordion"></div>
    </div>
  `;
  wrap.appendChild(card);

  card.querySelector("#tt-lib-level-filter").addEventListener("change", (e) => {
    libraryLevelFilter = e.target.value;
    render();
  });

  const typeCheckboxMap = { master: "#tt-pack-type-master", coach: "#tt-pack-type-coach", self: "#tt-pack-type-self", peer: "#tt-pack-type-peer" };
  Object.entries(typeCheckboxMap).forEach(([type, sel]) => {
    card.querySelector(sel).addEventListener("change", (e) => {
      if (e.target.checked) packSheetTypes.add(type); else packSheetTypes.delete(type);
    });
  });

  const acc = card.querySelector("#tt-lib-accordion");
  let anyVisible = false;
  const visibleSkills = [];
  SKILL_CATEGORIES.forEach((category) => {
    const skillsInCategory = SKILL_ORDER.filter((s) =>
      SKILL_META[s].category === category && (!libraryLevelFilter || SKILL_META[s].tier === libraryLevelFilter)
    );
    if (skillsInCategory.length === 0) return;
    anyVisible = true;
    visibleSkills.push(...skillsInCategory);

    const catHeader = document.createElement("div");
    catHeader.className = "tt-lib-category-header";
    catHeader.textContent = category;
    acc.appendChild(catHeader);

    skillsInCategory.forEach((skill) => {
      const item = document.createElement("div");
      item.className = "tt-lib-accordion-item";
      const isOpen = libraryOpenSkill === skill;
      const isChecked = packSelectedSkills.has(skill);
      item.innerHTML = `
        <div class="tt-lib-accordion-head">
          <input type="checkbox" class="tt-pack-skill-check" data-skill="${escapeHtml(skill)}" ${isChecked ? "checked" : ""} title="Add to pack" />
          <button class="tt-lib-accordion-toggle">
            <span class="tt-lib-chevron">${isOpen ? "&#9662;" : "&#9656;"}</span>
            <span>${escapeHtml(skill)}</span>
            ${tierBadge(SKILL_META[skill].tier)}
          </button>
        </div>
        ${isOpen ? skillDetailHtml(skill) : ""}
      `;
      item.querySelector(".tt-lib-accordion-toggle").addEventListener("click", () => {
        libraryOpenSkill = libraryOpenSkill === skill ? null : skill;
        render();
      });
      item.querySelector(".tt-pack-skill-check").addEventListener("change", (e) => {
        if (e.target.checked) packSelectedSkills.add(skill); else packSelectedSkills.delete(skill);
        render();
      });
      acc.appendChild(item);
    });
  });

  card.querySelector("#tt-pack-select-visible").addEventListener("click", () => {
    visibleSkills.forEach((s) => packSelectedSkills.add(s));
    render();
  });
  card.querySelector("#tt-pack-select-none").addEventListener("click", () => {
    packSelectedSkills.clear();
    render();
  });
  card.querySelector("#tt-pack-print").addEventListener("click", () => {
    printPack(Array.from(packSelectedSkills), Array.from(packSheetTypes));
  });

  if (!anyVisible) {
    acc.innerHTML = `<div class="tt-empty"><div class="tt-empty-title">No skills at this level</div><div class="tt-empty-body">Try a different level, or switch back to "All Levels".</div></div>`;
  }

  return wrap;
}

/* ---------------------------------------------------------------
   PRINTABLE SHEETS
   Opens a clean, chrome-free print window built from the same
   SKILL_LIBRARY data shown on screen - one source of truth for both.
   --------------------------------------------------------------- */
const PRINT_CSS = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 0 0 20px; font-size: 12px; line-height: 1.5; }
  h1 { font-size: 19px; margin: 0 0 3px; }
  .meta { font-size: 11.5px; color: #444; margin-bottom: 14px; }
  .section-title { font-weight: bold; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; margin: 14px 0 6px; border-bottom: 1px solid #999; padding-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th, td { border: 1px solid #999; padding: 5px 7px; text-align: left; vertical-align: top; font-size: 11.5px; }
  th { background: #eee; }
  ul, ol { margin: 0 0 4px 18px; padding: 0; }
  li { margin-bottom: 3px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .fill-line { border-bottom: 1px solid #333; display: inline-block; min-width: 150px; }
  .checkbox-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; border: 1px solid #999; padding: 7px 9px; margin-bottom: 6px; }
  .checkbox-row .stmt { flex: 1; }
  .box-group { display: flex; gap: 6px; flex-shrink: 0; }
  .box { border: 1px solid #333; padding: 3px 9px; font-size: 10px; white-space: nowrap; }
  .fill-block { border: 1px solid #999; min-height: 42px; margin-bottom: 12px; }
  .legend { font-size: 10.5px; color: #555; margin-bottom: 8px; }
  .footer-note { margin-top: 18px; font-size: 10px; color: #888; border-top: 1px solid #ccc; padding-top: 6px; }
  .print-page { page-break-after: always; break-after: page; }
  .print-page:last-child { page-break-after: auto; break-after: auto; }
  @media print { .no-print { display: none; } }
`;

function openPrintWindow(title, bodyHtml) {
  const win = window.open("", "_blank");
  if (!win) {
    alert("Your browser blocked the print window. Please allow pop-ups for this site and try again.");
    return;
  }
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title>
    <style>${PRINT_CSS}</style></head><body>${bodyHtml}
    <script>window.onload = function () { window.print(); };</script>
    </body></html>`;
  win.document.open();
  win.document.write(html);
  win.document.close();
}

// Content builders - each returns the HTML for one skill's one sheet type,
// with no page/window logic. Reused by both the single-skill print buttons
// and the multi-skill pack printer below, so there's one source of truth
// for what each sheet type looks like.
function masterChecklistContent(skill) {
  const d = SKILL_LIBRARY[skill];
  const phaseRows = d.phases.map(([phase, detail]) => `<tr><td style="width:150px"><strong>${escapeHtml(phase)}</strong></td><td>${escapeHtml(detail)}</td></tr>`).join("");
  const ul = (items) => `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
  return `
    <h1>${escapeHtml(skill)} - Master Coach Checklist</h1>
    <div class="meta">Primary Gymnastics Coaching &amp; Assessment System</div>
    <div class="two-col">
      <div><div class="section-title">Physical prerequisites</div>${ul(d.physical_prereq)}</div>
      <div><div class="section-title">Safety prerequisites</div>${ul(d.safety_prereq)}</div>
    </div>
    <div class="section-title">Technical phases</div>
    <table><tbody>${phaseRows}</tbody></table>
    <div class="two-col">
      <div><div class="section-title">Detailed coaching points</div>${ul(d.coaching_points)}</div>
      <div><div class="section-title">Common faults</div>${ul(d.common_faults)}</div>
    </div>
    <div class="two-col">
      <div><div class="section-title">Coaching cues</div>${ul(d.coaching_cues)}</div>
      <div><div class="section-title">Likely competition deductions</div>${ul(d.competition_deductions)}</div>
    </div>
    <div class="two-col">
      <div><div class="section-title">Progressions</div>${ul(d.progressions)}</div>
      <div><div class="section-title">Regressions</div>${ul(d.regressions)}</div>
    </div>
    <div class="two-col">
      <div><div class="section-title">Physical preparation exercises</div>${ul(d.physical_prep)}</div>
      <div><div class="section-title">Readiness indicators to progress</div>${ul(d.readiness_indicators)}</div>
    </div>
  `;
}

function coachSheetContent(skill) {
  const d = SKILL_LIBRARY[skill];
  const boxes = `<div class="box-group"><span class="box">NY</span><span class="box">D</span><span class="box">S</span><span class="box">E</span></div>`;
  const rows = d.assess_criteria.map((c, i) => `
    <tr><td style="width:22px">${i + 1}</td><td>${escapeHtml(c)}</td><td style="width:150px">${boxes}</td><td style="width:150px">&nbsp;</td></tr>
  `).join("");
  return `
    <h1>${escapeHtml(skill)} - Coach Assessment Sheet</h1>
    <div class="meta">
      Pupil name: <span class="fill-line">&nbsp;</span> &nbsp;&nbsp; Date: <span class="fill-line">&nbsp;</span> &nbsp;&nbsp; Assessor: <span class="fill-line">&nbsp;</span>
    </div>
    <div class="legend">NY = Not Yet &nbsp; D = Developing &nbsp; S = Secure &nbsp; E = Exceeding - circle one per row</div>
    <table>
      <thead><tr><th style="width:22px">#</th><th>Observable criterion</th><th>Rating</th><th>Notes</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <table style="margin-top:12px;">
      <tr><td style="width:150px"><strong>Overall judgement</strong></td><td>${boxes}</td></tr>
      <tr><td><strong>Strengths</strong></td><td>&nbsp;</td></tr>
      <tr><td><strong>Targets</strong></td><td>&nbsp;</td></tr>
    </table>
  `;
}

function selfSheetContent(skill) {
  const d = SKILL_LIBRARY[skill];
  const rows = d.self_statements.map((s) => `
    <div class="checkbox-row"><span class="stmt">${escapeHtml(s)}</span>
      <div class="box-group"><span class="box">Red</span><span class="box">Amber</span><span class="box">Green</span></div>
    </div>
  `).join("");
  return `
    <h1>${escapeHtml(skill)} - Self-Assessment</h1>
    <div class="meta">My name: <span class="fill-line">&nbsp;</span> &nbsp;&nbsp; Date: <span class="fill-line">&nbsp;</span></div>
    <div class="section-title">I can...</div>
    ${rows}
    <div class="section-title">What I did well</div>
    <div class="fill-block"></div>
    <div class="section-title">What I want to improve</div>
    <div class="fill-block"></div>
  `;
}

function peerSheetContent(skill) {
  const d = SKILL_LIBRARY[skill];
  const rows = d.peer_points.map((p) => `
    <div class="checkbox-row"><span class="stmt">${escapeHtml(p)}</span>
      <div class="box-group"><span class="box">Yes</span><span class="box">Not yet</span></div>
    </div>
  `).join("");
  return `
    <h1>${escapeHtml(skill)} - Partner Observation</h1>
    <div class="meta">Performer's name: <span class="fill-line">&nbsp;</span> &nbsp;&nbsp; Observer's name: <span class="fill-line">&nbsp;</span></div>
    <div class="section-title">Watch for...</div>
    ${rows}
    <div class="section-title">One thing you did well</div>
    <div class="fill-block"></div>
    <div class="section-title">One coaching tip for you</div>
    <div class="fill-block"></div>
  `;
}

// Thin single-skill wrappers - unchanged behaviour from before, used by
// the print buttons in the Skill Library detail view.
function printMasterChecklist(skill) { openPrintWindow(skill + " - Master Coach Checklist", masterChecklistContent(skill)); }
function printCoachSheet(skill) { openPrintWindow(skill + " - Coach Assessment Sheet", coachSheetContent(skill)); }
function printSelfSheet(skill) { openPrintWindow(skill + " - Self-Assessment", selfSheetContent(skill)); }
function printPeerSheet(skill) { openPrintWindow(skill + " - Partner Observation", peerSheetContent(skill)); }

// Pack printing - combines multiple skills and multiple sheet types into
// ONE print window with a page break after every sheet, so "Print" or
// "Save as PDF" in the browser's print dialog produces one document
// covering everything selected, rather than one document per click.
const PACK_CONTENT_BUILDERS = {
  master: masterChecklistContent,
  coach: coachSheetContent,
  self: selfSheetContent,
  peer: peerSheetContent,
};

function printPack(skills, sheetTypes) {
  if (!skills.length) { alert("Select at least one skill before printing a pack."); return; }
  if (!sheetTypes.length) { alert("Select at least one sheet type (Master checklist, Coach sheet, Self card, or Peer card) before printing a pack."); return; }
  const pages = [];
  skills.forEach((skill) => {
    sheetTypes.forEach((type) => {
      const builder = PACK_CONTENT_BUILDERS[type];
      if (builder) pages.push(`<div class="print-page">${builder(skill)}</div>`);
    });
  });
  const title = skills.length === 1 ? skills[0] + " pack" : skills.length + "-skill pack";
  openPrintWindow(title, pages.join(""));
}

document.addEventListener("DOMContentLoaded", init);
