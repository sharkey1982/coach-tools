/* ============================================================================
   Coach Tools · shared practice-effort widget
   A collapsed-by-default "weekly effort" panel: a 7-day bar chart, a streak
   line, and a tap-to-edit daily target — tracking practice VOLUME, not
   accuracy (a wrong answer still counts as effort). First built for the
   Spelling game (tutoring/english/spelling/game.html); pulled out here so
   maths games can reuse it without copy-pasting.

   Usage (see tutoring/maths/number-bonds/game.html for a full example):
     <div id="effortWidget"></div>
     <script src="../../../shared/effort-tracker.js"></script>
     <script>
       const effort = EffortTracker({
         containerId: "effortWidget",
         storagePrefix: "maths:",   // shared across all maths games, like maths:coins
         defaultTarget: 10,
       });
       // once per question/word/attempt, regardless of right or wrong:
       effort.logAttempt();
     </script>

   Storage keys used (under storagePrefix): "effort" (a {dateKey: count} map)
   and "target" (a number). Sharing storagePrefix across games/pages combines
   their practice into one shared daily count — e.g. every maths game logging
   under "maths:" means 5 number-bond + 5 addition questions hits a 10/day
   target together, the same way maths:coins is already one shared balance.
   ============================================================================ */

function EffortTracker(opts) {
  const prefix = opts.storagePrefix;
  const container = document.getElementById(opts.containerId);
  const defaultTarget = opts.defaultTarget || 10;
  const uid = opts.containerId;

  function loadNum(key, fallback) {
    const v = parseInt(localStorage.getItem(prefix + key), 10);
    return Number.isFinite(v) ? v : fallback;
  }
  function saveNum(key, val) { localStorage.setItem(prefix + key, String(val)); }
  function loadJSON(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(prefix + key)); return v || fallback; }
    catch (e) { return fallback; }
  }
  function saveJSON(key, val) { localStorage.setItem(prefix + key, JSON.stringify(val)); }
  function dateKey(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function todayKey() { return dateKey(new Date()); }

  let dailyTarget = loadNum("target", defaultTarget);
  let effortLog = loadJSON("effort", {});
  let expanded = false;

  function last7Days() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = dateKey(d);
      days.push({ key: k, label: d.toLocaleDateString(undefined, { weekday: "narrow" }), count: effortLog[k] || 0 });
    }
    return days;
  }

  function streakText(days) {
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].count >= dailyTarget && dailyTarget > 0) streak++; else break;
    }
    if (streak === 0) return "no streak yet today";
    return streak === 1 ? "1 day streak" : streak + " day streak";
  }

  function render() {
    if (!container) return;
    const days = last7Days();
    const max = Math.max(dailyTarget, ...days.map((d) => d.count), 1);
    const barsHtml = days.map((d) => {
      const pct = Math.max(3, (d.count / max) * 100);
      const hit = d.count >= dailyTarget && dailyTarget > 0;
      return `<div class="et-bar-col"><div class="et-bar${hit ? " et-bar-hit" : ""}" style="height:${pct}%"></div><div class="et-bar-day">${d.label}</div></div>`;
    }).join("");
    const todayCount = effortLog[todayKey()] || 0;
    const lineText = todayCount >= dailyTarget
      ? `Today's target hit (${todayCount}/${dailyTarget}) \u2014 ${streakText(days)}`
      : `${todayCount}/${dailyTarget} today \u2014 ${streakText(days)}`;

    container.innerHTML = `
      <div class="et-header${expanded ? " et-expanded" : ""}" id="${uid}-header">
        <span class="et-chevron">${expanded ? "\u25be" : "\u25b8"}</span>
        <span class="et-header-title">Practice effort</span>
        <span class="et-header-summary">${todayCount}/${dailyTarget} today</span>
      </div>
      <div class="et-body" id="${uid}-body" style="display:${expanded ? "block" : "none"};">
        <div class="et-head">
          <div class="et-title">Last 7 days</div>
          <button class="et-target-btn" id="${uid}-target">Target: <span>${dailyTarget}</span>/day</button>
        </div>
        <div class="et-bars">${barsHtml}</div>
        <div class="et-line">${lineText}</div>
      </div>
    `;
    document.getElementById(`${uid}-header`).addEventListener("click", () => {
      expanded = !expanded;
      render();
    });
    document.getElementById(`${uid}-target`).addEventListener("click", (e) => {
      e.stopPropagation();
      const next = prompt("Daily question-practice target:", String(dailyTarget));
      const n = parseInt(next, 10);
      if (Number.isFinite(n) && n > 0) { dailyTarget = n; saveNum("target", n); render(); }
    });
  }

  function logAttempt() {
    const k = todayKey();
    effortLog[k] = (effortLog[k] || 0) + 1;
    saveJSON("effort", effortLog);
    render();
  }

  render();
  return { logAttempt, render };
}
