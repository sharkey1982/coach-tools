/* ============================================================================
   Coach Tools · shared practice-effort widget
   A collapsed-by-default "weekly effort" panel: a 7-day bar chart, a streak
   line with escalating badges, a tap-to-edit daily target, and a coin
   reward + toast celebration on the attempt that crosses the daily target —
   tracking practice VOLUME, not accuracy (a wrong answer still counts as
   effort). First built for the Spelling game
   (tutoring/english/spelling/game.html); pulled out here so any game can
   reuse it without copy-pasting.

   Usage (see tutoring/maths/number-bonds/game.html for a full example):
     <div id="effortWidget"></div>
     <script src="../../../shared/effort-tracker.js"></script>
     <script>
       const effort = EffortTracker({
         containerId: "effortWidget",
         storagePrefix: "maths:",   // shared across all maths games, like maths:coins
         defaultTarget: 10,
         onBonus: (amount, label) => {
           // Fired at most once per day, on the attempt that first reaches
           // the daily target. Apply it to THIS page's own coin balance —
           // the tracker doesn't touch coins itself, since each game owns
           // its own live coins variable/display.
           coins += amount;
           saveNum("coins", coins);
           updateTopStats();
         },
       });
       // once per question/word/attempt, regardless of right or wrong:
       effort.logAttempt();
     </script>

   Storage keys used (under storagePrefix): "effort" (a {dateKey: count} map)
   and "target" (a number). Sharing storagePrefix across games/pages combines
   their practice into one shared daily count — e.g. every maths game logging
   under "maths:" means 5 number-bond + 5 addition questions hits a 10/day
   target together, the same way maths:coins is already one shared balance.

   Streak rewards: every day the target is met gives a small, streak-scaled
   coin bonus (5 coins on day 1, +1 per extra consecutive day up to +10), and
   hitting 3/7/14/30 days in a row adds a bigger one-off milestone bonus with
   its own badge (🔥/⭐/🏅/🏆) — shown in a toast and in the streak line.
   ============================================================================ */

function EffortTracker(opts) {
  const prefix = opts.storagePrefix;
  const container = document.getElementById(opts.containerId);
  const defaultTarget = opts.defaultTarget || 10;
  const onBonus = typeof opts.onBonus === "function" ? opts.onBonus : function () {};
  const uid = opts.containerId;

  const STREAK_MILESTONES = [
    { days: 3, emoji: "\u{1F525}", label: "3-day streak", bonus: 10 },
    { days: 7, emoji: "\u2B50", label: "1-week streak", bonus: 20 },
    { days: 14, emoji: "\u{1F3C5}", label: "2-week streak", bonus: 30 },
    { days: 30, emoji: "\u{1F3C6}", label: "1-month streak", bonus: 50 },
  ];

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

  function computeStreak(days) {
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].count >= dailyTarget && dailyTarget > 0) streak++; else break;
    }
    return streak;
  }

  function badgeForStreak(streak) {
    let badge = null;
    STREAK_MILESTONES.forEach((m) => { if (streak >= m.days) badge = m; });
    return badge;
  }

  function streakText(days) {
    const streak = computeStreak(days);
    if (streak === 0) return "no streak yet today";
    const badge = badgeForStreak(streak);
    const emoji = badge ? badge.emoji + " " : "";
    return `${emoji}${streak} day streak`;
  }

  function showToast(message) {
    const el = document.createElement("div");
    el.textContent = message;
    el.style.cssText = [
      "position:fixed", "left:50%", "top:14px", "transform:translateX(-50%) translateY(-20px)",
      "background:#15191E", "color:#FBF8F1", "font-family:'JetBrains Mono',monospace",
      "font-weight:700", "font-size:13px", "letter-spacing:0.02em",
      "padding:10px 18px", "border-radius:20px", "box-shadow:0 4px 14px rgba(0,0,0,0.25)",
      "z-index:9999", "opacity:0", "transition:opacity 0.25s, transform 0.25s", "pointer-events:none",
      "white-space:nowrap",
    ].join(";");
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = "translateX(-50%) translateY(0)";
    });
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateX(-50%) translateY(-20px)";
      setTimeout(() => el.remove(), 300);
    }, 2600);
  }

  function maybeAwardDailyBonus() {
    if (dailyTarget <= 0) return;
    const todayCount = effortLog[todayKey()] || 0;
    if (todayCount !== dailyTarget) return; // only the exact attempt that reaches the target, once
    const streak = computeStreak(last7Days());
    const milestone = STREAK_MILESTONES.find((m) => m.days === streak);
    const dailyBonus = 5 + Math.min(streak - 1, 10);
    const bonus = dailyBonus + (milestone ? milestone.bonus : 0);
    const label = milestone ? `${milestone.emoji} ${milestone.label}!` : "\u2705 Daily target hit!";
    showToast(`${label} +${bonus} coins`);
    onBonus(bonus, label);
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
    const earnedHtml = days.map((d) => {
      const hit = d.count >= dailyTarget && dailyTarget > 0;
      return `<div class="et-earned-col">${hit ? "\u2713" : ""}</div>`;
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
        <div class="et-earned-row">${earnedHtml}</div>
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
    maybeAwardDailyBonus();
    render();
  }

  render();
  return { logAttempt, render };
}
