/* ============================================================================
   Coach Tools · Session Engine v1.2
   Shared session-builder engine used by per-discipline session-builder pages.

   v1.2 changes (non-breaking; existing consumers keep working unchanged):
     - cfg.lineupGetter — optional function returning an array of activity ids
                          queued in the discipline's lineup (planning basket).
                          When non-empty, the form-card shows a "Build from
                          lineup" banner above the generate row.
     - URL parameter ?use-lineup=1 — if present on load AND lineupGetter
                          returns items, the engine skips the form and renders
                          the session directly via buildFromLineup(). Guarded
                          by window.__lineupAutoTriggered to prevent re-fires.
     - renderSession adds a dropped-count notice between the session-header
                          and the first slot when CURRENT_SESSION.droppedCount
                          is set, naming activities that didn't fit the tier.

   v1.1 changes (non-breaking):
     - cfg.formCalloutHTML    — optional HTML rendered inside form-card, below
                                 the generate buttons.
     - cfg.closingCalloutHTML — optional HTML rendered between the last slot
                                 and the equipment summary.

   Each consumer page provides:
     - its own page chrome and CSS (kind-XXX colours, theming, print rules,
       and — new in v1.2 — .lineup-banner styling)
     - a single mount point: <div id="board"></div>
     - <script src="…/shared/session-engine.js"></script>
     - (for v1.2 lineupGetter) <script src="…/shared/lineup.js"></script>
     - a <script> block calling SessionEngine.create({ …discipline config… })

   The engine owns: state, fetch/cache, form rendering, session rendering,
   shuffle, manual mode, slot pickers, add/remove slots, equipment summary,
   and (v1.2) building sessions from a lineup of activity ids.

   Discipline-supplied generateAlgorithm is async and receives (state, ctx);
   ctx exposes helpers (parseDuration, pick, pickPreferringPairs, …) plus
   getCandidates / getCandidatesByKind / bucketize / fetchDetail that read
   from the bound config + manifest.

   Cues:
     - Class names emitted by the engine: .slot, .slot-head, .kind-${kindId}, …
       Per-discipline CSS styles the kind-${kindId} variants.
     - All paths in config are interpreted relative to the page that loads
       the engine (so cricket passes "../activities/data/_manifest.json").
   ============================================================================ */

(function () {
  'use strict';

  /* ============ HELPERS (pure) ============ */

  function parseDuration(s) {
    if (!s) return 15;
    const str = String(s);
    // detect seconds first — must round up to at least 1 min
    if (/\bsec(?:ond)?s?\b/i.test(str)) return 1;
    const m = str.match(/(\d+)(?:\s*[-–]\s*(\d+))?/);
    if (!m) return 15;
    const lo = +m[1];
    const hi = m[2] ? +m[2] : lo;
    return Math.round((lo + hi) / 2);
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /* ============ CORE ============ */

  function create(config) {
    /* --------- defaults --------- */
    const cfg = Object.assign({
      mountSelector: '#board',
      durations: [30, 45, 60, 75, 90],
      tiers: { ks1: 'KS1 · Y1–Y2', lks2: 'LKS2 · Y3–Y4', uks2: 'UKS2 · Y5–Y6' },
      groupSizes: [['small', 'Small (≤8)'], ['medium', 'Medium (9–16)'], ['large', 'Large (17+)']],
      defaultState: { tier: 'lks2', duration: 60, groupSize: 'medium', focus: [] },
      versionLabel: 'v1.0',
      heroIntro: '● Build a session in seconds',
      heroTitleSpanLabel: 'Builder', // the highlighted last word
      heroTitleLeadLabel: 'Session',
      sessionTitlePrefix: 'Session',
      shortName: 'Session Builder',
      // required from caller — no sensible default:
      kinds: null,
      typeBuckets: null,
      focusOptions: null,
      manifestPath: null,
      activityDataPath: null,
      activityPagePath: null,
      generateAlgorithm: null,
      crumbHTML: '',
      manualSlots: null,    // array of kind ids; falls back to all kinds in order
      addSlotKinds: null,   // array of kind ids; falls back to all kinds
      formCalloutHTML: null,    // optional HTML rendered in form-card under generate buttons
      closingCalloutHTML: null, // optional HTML rendered after last slot, before equipment
      lineupGetter: null,       // optional () => string[] of activity ids
    }, config || {});

    /* --------- validate minimal config --------- */
    const required = ['kinds', 'typeBuckets', 'focusOptions', 'manifestPath',
                      'activityDataPath', 'activityPagePath', 'generateAlgorithm'];
    for (const k of required) {
      if (cfg[k] == null) throw new Error('SessionEngine: missing config.' + k);
    }
    // index kinds by id for fast lookup
    const KIND_BY_ID = {};
    for (const k of cfg.kinds) KIND_BY_ID[k.id] = k;

    if (!cfg.manualSlots) cfg.manualSlots = cfg.kinds.map(k => k.id);
    if (!cfg.addSlotKinds) cfg.addSlotKinds = cfg.kinds.map(k => k.id);

    /* --------- state (closure-scoped) --------- */
    let MANIFEST = null;
    const ACTIVITY_DETAIL = {}; // cache: id → full activity JSON
    let CURRENT_SESSION = null;
    let FORM_STATE = Object.assign({}, cfg.defaultState, { focus: cfg.defaultState.focus.slice() });
    let mount = null;

    /* --------- lineup helpers --------- */
    function getLineupIds() {
      if (typeof cfg.lineupGetter !== 'function') return [];
      try {
        const v = cfg.lineupGetter();
        return Array.isArray(v) ? v : [];
      } catch (e) {
        console.error('SessionEngine: lineupGetter threw:', e);
        return [];
      }
    }

    /* --------- data plumbing --------- */
    async function fetchDetail(id) {
      if (ACTIVITY_DETAIL[id]) return ACTIVITY_DETAIL[id];
      try {
        const r = await fetch(cfg.activityDataPath + id + '.json');
        const data = await r.json();
        ACTIVITY_DETAIL[id] = data;
        return data;
      } catch (e) {
        return null;
      }
    }

    function focusMatches(activityFocus, selectedFocus) {
      if (!selectedFocus.length) return true; // 'any'
      if (activityFocus === 'mixed' || activityFocus === 'concept') return true;
      // 'mixed' and 'concept' activities pass any focus filter — they're generic
      return selectedFocus.some(fid => {
        const opt = cfg.focusOptions.find(o => o.id === fid);
        return opt && opt.matches.includes(activityFocus);
      });
    }

    function getCandidates(tier, focus) {
      return MANIFEST.activities.filter(a =>
        (a.ready !== false) &&
        a.tiers.includes(tier) &&
        focusMatches(a.focus, focus)
      );
    }

    // Candidates for a given kind, respecting kind.focusBypass
    function getCandidatesByKind(kindId, tier, focus) {
      const kind = KIND_BY_ID[kindId];
      if (!kind) return [];
      const types = cfg.typeBuckets[kindId] || [];
      const matchFocus = !kind.focusBypass;
      return MANIFEST.activities.filter(a =>
        (a.ready !== false) &&
        a.tiers.includes(tier) &&
        types.includes(a.type) &&
        (!matchFocus || focusMatches(a.focus, focus))
      );
    }

    function bucketize(activities) {
      const out = {};
      for (const k of cfg.kinds) out[k.id] = [];
      for (const a of activities) {
        for (const [kindId, types] of Object.entries(cfg.typeBuckets)) {
          if (types.includes(a.type)) { out[kindId].push(a); break; }
        }
      }
      return out;
    }

    function pickPreferringPairs(candidates, alreadyPicked) {
      if (!candidates.length) return null;
      if (!alreadyPicked.length) return pick(candidates);
      const pickedIds = alreadyPicked.map(a => a.id);
      const detail = id => ACTIVITY_DETAIL[id] || {};
      const scored = candidates.map(c => {
        const pw = detail(c.id).pairWith || [];
        const score = pw.filter(p => pickedIds.includes(p)).length;
        return { c, score };
      });
      const maxScore = Math.max(...scored.map(s => s.score));
      const top = scored.filter(s => s.score === maxScore).map(s => s.c);
      return pick(top);
    }

    /* --------- equipment aggregation --------- */
    function aggregateEquipment(slots) {
      const seen = new Set();
      const items = [];
      for (const slot of slots) {
        if (!slot.activity) continue;
        const detail = ACTIVITY_DETAIL[slot.activity.id];
        if (!detail || !detail.equipment) continue;
        for (const eq of detail.equipment) {
          const key = String(eq.item || '').toLowerCase().trim();
          if (!key || seen.has(key)) continue;
          seen.add(key);
          items.push(eq.item);
        }
      }
      return items;
    }

    /* --------- generation algorithm context --------- */
    function makeAlgoCtx() {
      return {
        manifest: MANIFEST,
        fetchDetail,
        focusMatches,
        getCandidates,
        getCandidatesByKind,
        bucketize,
        parseDuration,
        pick,
        pickPreferringPairs,
        kinds: cfg.kinds,
        typeBuckets: cfg.typeBuckets
      };
    }

    async function regenerate() {
      CURRENT_SESSION = await cfg.generateAlgorithm(FORM_STATE, makeAlgoCtx());
      if (!CURRENT_SESSION || !CURRENT_SESSION.slots || !CURRENT_SESSION.slots.length) {
        renderEmpty();
      } else {
        // recompute totalDuration in case algorithm forgot
        CURRENT_SESSION.totalDuration = CURRENT_SESSION.slots.reduce((s, x) => s + (x.duration || 0), 0);
        // prefetch detail for all slots so equipment + media render synchronously
        await Promise.all(CURRENT_SESSION.slots.filter(s => s.activity).map(s => fetchDetail(s.activity.id)));
        renderSession();
      }
    }

    /* --------- build session from lineup (v1.2) --------- */
    async function buildFromLineup() {
      const ids = getLineupIds();
      const tier = FORM_STATE.tier;
      const totalRequested = ids.length;

      const slots = [];
      let droppedCount = 0;

      // Build slots in lineup order — slots are then re-ordered by kind below
      for (const id of ids) {
        const act = MANIFEST.activities.find(a => a.id === id);
        if (!act) { droppedCount++; continue; }
        if (act.ready === false) { droppedCount++; continue; }
        if (!act.tiers || !act.tiers.includes(tier)) { droppedCount++; continue; }

        // Determine kind via typeBuckets
        let kindId = null;
        for (const [k, types] of Object.entries(cfg.typeBuckets)) {
          if (types.includes(act.type)) { kindId = k; break; }
        }
        if (!kindId) { droppedCount++; continue; }

        slots.push({ kind: kindId, activity: act, duration: parseDuration(act.duration) });
      }

      // Re-order by kind so the session flows naturally (warmup → drill → game …)
      const order = {};
      cfg.kinds.forEach((k, i) => { order[k.id] = (k.order != null) ? k.order : i; });
      slots.sort((a, b) => (order[a.kind] - order[b.kind]));

      // Prefetch detail JSONs so equipment + media render synchronously
      await Promise.all(slots.map(s => fetchDetail(s.activity.id)));

      CURRENT_SESSION = {
        meta: Object.assign({}, FORM_STATE, { focus: FORM_STATE.focus.slice() }),
        slots: slots,
        totalDuration: slots.reduce((s, x) => s + x.duration, 0),
        droppedCount: droppedCount,
        lineupRequested: totalRequested,
        fromLineup: true
      };

      if (!slots.length) {
        renderEmpty();
      } else {
        renderSession();
      }
    }

    /* --------- manual mode --------- */
    function buildManually() {
      CURRENT_SESSION = {
        meta: Object.assign({}, FORM_STATE, { focus: FORM_STATE.focus.slice() }),
        slots: cfg.manualSlots.map(kindId => ({ kind: kindId, activity: null, duration: 0 })),
        totalDuration: 0
      };
      renderSession();
    }

    async function pickActivityForSlot(slotIndex, activityId) {
      if (!activityId) {
        CURRENT_SESSION.slots[slotIndex].activity = null;
        CURRENT_SESSION.slots[slotIndex].duration = 0;
      } else {
        const act = MANIFEST.activities.find(a => a.id === activityId);
        if (!act) return;
        await fetchDetail(activityId);
        CURRENT_SESSION.slots[slotIndex].activity = act;
        CURRENT_SESSION.slots[slotIndex].duration = parseDuration(act.duration);
      }
      CURRENT_SESSION.totalDuration = CURRENT_SESSION.slots.reduce((s, x) => s + x.duration, 0);
      renderSession();
    }

    function addSlot(kindId) {
      const order = {};
      cfg.kinds.forEach((k, i) => { order[k.id] = (k.order != null) ? k.order : i; });
      const newSlot = { kind: kindId, activity: null, duration: 0 };
      let insertAt = CURRENT_SESSION.slots.length;
      for (let i = 0; i < CURRENT_SESSION.slots.length; i++) {
        if (order[CURRENT_SESSION.slots[i].kind] > order[kindId]) {
          insertAt = i;
          break;
        }
      }
      CURRENT_SESSION.slots.splice(insertAt, 0, newSlot);
      renderSession();
    }

    function removeSlot(slotIndex) {
      CURRENT_SESSION.slots.splice(slotIndex, 1);
      CURRENT_SESSION.totalDuration = CURRENT_SESSION.slots.reduce((s, x) => s + x.duration, 0);
      renderSession();
    }

    async function shuffleSlot(slotIndex) {
      const state = CURRENT_SESSION.meta;
      const currentKind = CURRENT_SESSION.slots[slotIndex].kind;
      const currentId = CURRENT_SESSION.slots[slotIndex].activity?.id;
      const pool = getCandidatesByKind(currentKind, state.tier, state.focus)
        .filter(a => a.id !== currentId);
      if (!pool.length) { alert('No other activities match for this slot.'); return; }
      const others = CURRENT_SESSION.slots
        .filter((_, i) => i !== slotIndex && CURRENT_SESSION.slots[i].activity)
        .map(s => s.activity);
      const picked = pickPreferringPairs(pool, others);
      if (!picked) return;
      await fetchDetail(picked.id);
      CURRENT_SESSION.slots[slotIndex] = {
        kind: currentKind, activity: picked, duration: parseDuration(picked.duration)
      };
      CURRENT_SESSION.totalDuration = CURRENT_SESSION.slots.reduce((s, x) => s + x.duration, 0);
      renderSession();
    }

    /* --------- manual picker options --------- */
    function getPickableActivities(kindId, tier) {
      const types = cfg.typeBuckets[kindId] || [];
      return MANIFEST.activities.filter(a =>
        (a.ready !== false) && a.tiers.includes(tier) && types.includes(a.type)
      );
    }

    /* --------- label helpers --------- */
    function tierLabel(t) { return cfg.tiers[t] || t; }
    function groupLabel(g) {
      const found = cfg.groupSizes.find(([id]) => id === g);
      return found ? found[1] : g;
    }
    function focusLabel(f) {
      if (!f.length) return 'Any focus';
      return f.map(id => {
        const opt = cfg.focusOptions.find(o => o.id === id);
        return opt ? opt.label : id;
      }).join(' + ');
    }
    function kindLabel(k) { return (KIND_BY_ID[k] || {}).label || k; }
    function kindNum(k) { return (KIND_BY_ID[k] || {}).num || '●'; }

    /* --------- rendering --------- */
    function renderForm() {
      const dCount = MANIFEST.activities.filter(a => a.ready !== false).length;
      const lineupIds = getLineupIds();
      const lineupCount = lineupIds.length;

      mount.innerHTML = `
        ${cfg.crumbHTML ? `<div class="crumb">${cfg.crumbHTML}</div>` : ''}

        <header class="hero">
          <div class="hero-text">
            <div class="hero-top">${cfg.heroIntro}</div>
            <h1>${cfg.heroTitleLeadLabel} <span class="accent">${cfg.heroTitleSpanLabel}</span></h1>
            <div class="hero-sub">${dCount} ${cfg.discipline ? cfg.discipline + ' ' : ''}activit${dCount === 1 ? 'y' : 'ies'} · pick your constraints</div>
          </div>
        </header>

        <div class="form-card">

          <div class="form-row">
            <div class="label">▸ Tier <span class="hint">age group</span></div>
            <div class="chip-group" data-field="tier">
              ${Object.keys(cfg.tiers).map(t => `
                <div class="chip ${FORM_STATE.tier === t ? 'selected' : ''}" data-value="${t}">${tierLabel(t)}</div>
              `).join('')}
            </div>
          </div>

          <div class="form-row">
            <div class="label">▸ Duration <span class="hint">total session minutes</span></div>
            <div class="chip-group" data-field="duration">
              ${cfg.durations.map(d => `
                <div class="chip ${FORM_STATE.duration === d ? 'selected' : ''}" data-value="${d}">${d} min</div>
              `).join('')}
            </div>
          </div>

          <div class="form-row">
            <div class="label">▸ Group size <span class="hint">number of children</span></div>
            <div class="chip-group" data-field="groupSize">
              ${cfg.groupSizes.map(([id, label]) => `
                <div class="chip ${FORM_STATE.groupSize === id ? 'selected' : ''}" data-value="${id}">${label}</div>
              `).join('')}
            </div>
          </div>

          <div class="form-row">
            <div class="label">▸ Focus <span class="hint">tap multiple, or leave all unselected for anything</span></div>
            <div class="chip-group" data-field="focus">
              ${cfg.focusOptions.map(o => `
                <div class="chip ${FORM_STATE.focus.includes(o.id) ? 'selected' : ''}" data-value="${o.id}">${o.label}</div>
              `).join('')}
            </div>
          </div>

          ${lineupCount > 0 ? `
            <div class="lineup-banner">
              <div class="lineup-banner-text">
                <span class="lineup-banner-eyebrow">▸ Lineup ready</span>
                <span class="lineup-banner-detail"><strong>${lineupCount}</strong> activit${lineupCount === 1 ? 'y' : 'ies'} queued — build a session from just these</span>
              </div>
              <button type="button" class="lineup-banner-btn" id="build-from-lineup">▸ Build from lineup</button>
            </div>
          ` : ''}

          <div class="generate-row">
            <button class="generate-btn" id="generate">⚙ Auto-generate</button>
            <button class="generate-btn secondary" id="build-manual">✎ Build manually</button>
          </div>

          ${cfg.formCalloutHTML ? `<div class="form-callout">${cfg.formCalloutHTML}</div>` : ''}
        </div>

        <footer class="footer">
          <span><span class="accent">●</span> <a href="../../">Coach Tools</a></span>
          <span>${cfg.footerLabel || 'Session Builder'}</span>
          <span>${cfg.versionLabel}</span>
        </footer>
      `;

      // wire chips
      mount.querySelectorAll('.chip-group').forEach(group => {
        const field = group.dataset.field;
        group.querySelectorAll('.chip').forEach(chip => {
          chip.addEventListener('click', () => {
            const val = chip.dataset.value;
            if (field === 'focus') {
              if (FORM_STATE.focus.includes(val)) {
                FORM_STATE.focus = FORM_STATE.focus.filter(f => f !== val);
                chip.classList.remove('selected');
              } else {
                FORM_STATE.focus.push(val);
                chip.classList.add('selected');
              }
            } else {
              FORM_STATE[field] = field === 'duration' ? +val : val;
              group.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
              chip.classList.add('selected');
            }
          });
        });
      });

      mount.querySelector('#generate').addEventListener('click', async () => {
        const btn = mount.querySelector('#generate');
        btn.disabled = true;
        btn.textContent = '⚙ Generating...';
        try {
          await regenerate();
        } catch (e) {
          console.error(e);
          btn.disabled = false;
          btn.textContent = '⚙ Auto-generate';
        }
      });

      mount.querySelector('#build-manual').addEventListener('click', () => buildManually());

      const lineupBtn = mount.querySelector('#build-from-lineup');
      if (lineupBtn) {
        lineupBtn.addEventListener('click', async () => {
          lineupBtn.disabled = true;
          const orig = lineupBtn.textContent;
          lineupBtn.textContent = '▸ Building...';
          try {
            await buildFromLineup();
          } catch (e) {
            console.error(e);
            lineupBtn.disabled = false;
            lineupBtn.textContent = orig;
          }
        });
      }
    }

    function renderEmpty() {
      mount.innerHTML += `
        <div class="empty-state">
          <h3>No activities match those constraints</h3>
          <p>Try widening the focus or changing the tier. ${MANIFEST.activities.filter(a => a.ready !== false).length} activities are available in total.</p>
          <button class="generate-btn" data-action="back-to-form">← Edit constraints</button>
        </div>
      `;
      const btn = mount.querySelector('[data-action="back-to-form"]');
      if (btn) btn.addEventListener('click', renderForm);
    }

    function renderSession() {
      const s = CURRENT_SESSION;
      const equipment = aggregateEquipment(s.slots);
      const hasAnyFilled = s.slots.some(sl => sl.activity);

      // position-within-kind for numbering
      const positionInKind = {};
      s.slots.forEach((sl, i) => {
        positionInKind[i] = s.slots.slice(0, i + 1).filter(x => x.kind === sl.kind).length;
      });

      // dropped-count notice (only when buildFromLineup actually dropped some)
      const droppedNotice = (s.droppedCount && s.droppedCount > 0) ? `
        <div class="lineup-dropped-notice" style="
          margin-top: 10px;
          padding: 10px 16px;
          background: var(--theme-soft, #E8F0E0);
          border: 1.5px solid var(--ink, #15191E);
          border-radius: 6px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink, #15191E);
        ">
          ▸ ${s.droppedCount} of ${s.lineupRequested} lineup activit${s.lineupRequested === 1 ? 'y' : 'ies'} skipped — not available at ${tierLabel(s.meta.tier)}
        </div>
      ` : '';

      mount.innerHTML = `
        ${cfg.crumbHTML ? `<div class="crumb">${cfg.crumbHTML.replace('<span>Session Builder</span>', '<a href="?">Session Builder</a><span class="sep">/</span><span>Session plan</span>')}</div>` : ''}

        <header class="hero">
          <div class="hero-text">
            <div class="hero-top">● ${tierLabel(s.meta.tier)} · ${groupLabel(s.meta.groupSize)} · ${focusLabel(s.meta.focus)}</div>
            <h1>${cfg.heroTitleLeadLabel} <span class="accent">Plan</span></h1>
            <div class="hero-sub">${s.slots.length} slot${s.slots.length === 1 ? '' : 's'} · target ${s.meta.duration} min · ${hasAnyFilled ? 'actual ' + s.totalDuration + ' min' : 'no activities picked yet'}</div>
          </div>
        </header>

        <div class="session-header">
          <div class="session-meta">
            <span>▸ ${s.slots.length} slot${s.slots.length === 1 ? '' : 's'}</span>
            <span>▸ ${focusLabel(s.meta.focus)}</span>
            <span>▸ ${groupLabel(s.meta.groupSize)}</span>
            ${s.fromLineup ? '<span>▸ From lineup</span>' : ''}
          </div>
          <div class="session-title">${cfg.sessionTitlePrefix} · ${tierLabel(s.meta.tier)}</div>
          <div class="session-actions">
            <span class="duration-total"><span class="lbl">TOTAL</span> ${s.totalDuration} MIN</span>
            <button data-action="edit-constraints">← Edit constraints</button>
            <button data-action="print">⎙ Print</button>
            <button data-action="regenerate">↻ Re-generate</button>
          </div>
        </div>

        ${droppedNotice}

        ${s.slots.map((slot, idx) => renderSlot(slot, idx, positionInKind)).join('')}

        ${cfg.closingCalloutHTML ? `<div class="closing-callout">${cfg.closingCalloutHTML}</div>` : ''}

        <div class="add-slot-row">
          <span class="add-slot-label">▸ Add another slot:</span>
          ${cfg.addSlotKinds.map(kindId => `
            <button class="add-slot-btn kind-${kindId}" data-add-kind="${kindId}">+ ${kindLabel(kindId)}</button>
          `).join('')}
        </div>

        ${equipment.length ? `
          <div class="equipment-card">
            <h2>Combined equipment</h2>
            <div class="equipment-list">
              ${equipment.map(e => `<div class="eq-item">${escapeHTML(e)}</div>`).join('')}
            </div>
          </div>
        ` : ''}

        <footer class="footer">
          <span><span class="accent">●</span> <a href="../../">Coach Tools</a></span>
          <span>${cfg.footerLabel || 'Session Builder'}</span>
          <span>${cfg.versionLabel}</span>
        </footer>
      `;

      // wire actions
      mount.querySelectorAll('[data-action]').forEach(el => {
        const a = el.dataset.action;
        if (a === 'edit-constraints') el.addEventListener('click', renderForm);
        if (a === 'print') el.addEventListener('click', () => window.print());
        if (a === 'regenerate') el.addEventListener('click', regenerate);
      });
      mount.querySelectorAll('[data-add-kind]').forEach(el => {
        el.addEventListener('click', () => addSlot(el.dataset.addKind));
      });
      mount.querySelectorAll('[data-shuffle-idx]').forEach(el => {
        el.addEventListener('click', () => shuffleSlot(+el.dataset.shuffleIdx));
      });
      mount.querySelectorAll('[data-remove-idx]').forEach(el => {
        el.addEventListener('click', () => removeSlot(+el.dataset.removeIdx));
      });
      mount.querySelectorAll('.slot-picker').forEach(sel => {
        sel.addEventListener('change', (e) => {
          pickActivityForSlot(+e.target.dataset.slotIdx, e.target.value);
        });
      });
    }

    function renderSlot(slot, idx, positionInKind) {
      const isEmpty = !slot.activity;
      const pickable = getPickableActivities(slot.kind, CURRENT_SESSION.meta.tier);
      const pickerOptions = pickable.map(a =>
        `<option value="${a.id}" ${a.id === slot.activity?.id ? 'selected' : ''}>${escapeAttr(a.name)} · ${escapeAttr(a.duration)} · ${escapeAttr(a.focusLabel || a.focus || '')}</option>`
      ).join('');

      const headerRight = isEmpty
        ? `<span class="slot-duration">no activity selected</span>
           <button class="slot-remove" data-remove-idx="${idx}">✕ Remove</button>`
        : `<span class="slot-duration">${slot.duration} min · ${escapeHTML(slot.activity.duration)}</span>
           <button class="slot-shuffle" data-shuffle-idx="${idx}">↻ Shuffle</button>
           <button class="slot-remove" data-remove-idx="${idx}">✕ Remove</button>`;

      const positionLabel = positionInKind[idx] > 1 ? ` <span style="opacity:0.7">${positionInKind[idx]}</span>` : '';

      let body;
      if (isEmpty) {
        body = `<div class="slot-empty-note">Pick an activity below to fill this slot.</div>`;
      } else {
        const detail = ACTIVITY_DETAIL[slot.activity.id];
        const media = detail && detail.media && detail.media.length ? detail.media : null;
        body = `
          <div class="slot-name"><a href="${cfg.activityPagePath}?id=${slot.activity.id}">${escapeHTML(slot.activity.name)}</a></div>
          <div class="slot-focus">${escapeHTML(slot.activity.focusLabel || slot.activity.focus || '')}${slot.activity.source ? ' · ' + escapeHTML(slot.activity.source) : ''}</div>
          <div class="slot-summary">${escapeHTML(slot.activity.summary || '')}</div>
          <div class="slot-action-row">
            <a class="slot-link" href="${cfg.activityPagePath}?id=${slot.activity.id}">→ Open full activity plan</a>
            ${media ? media.map(m => `<a class="slot-video-link" href="${escapeAttr(m.url)}" target="_blank" rel="noopener" title="${escapeAttr(m.title || 'Watch demo')}">▶ Watch demo</a>`).join('') : ''}
          </div>
        `;
      }

      return `
        <div class="slot kind-${slot.kind} ${isEmpty ? 'empty' : ''}">
          <div class="slot-head">
            <span class="slot-kind">${kindNum(slot.kind)} ${kindLabel(slot.kind)}${positionLabel}</span>
            ${headerRight}
          </div>
          <div class="slot-body">
            ${body}
            <div class="slot-picker-row">
              <label for="picker-${idx}">Activity:</label>
              <select id="picker-${idx}" class="slot-picker" data-slot-idx="${idx}">
                <option value="">— Pick a ${kindLabel(slot.kind).toLowerCase()} —</option>
                ${pickerOptions}
              </select>
            </div>
          </div>
        </div>
      `;
    }

    function escapeHTML(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function escapeAttr(s) {
      return escapeHTML(s).replace(/"/g, '&quot;');
    }

    /* --------- boot --------- */
    async function boot() {
      mount = document.querySelector(cfg.mountSelector);
      if (!mount) {
        console.error('SessionEngine: mount not found:', cfg.mountSelector);
        return;
      }
      try {
        const r = await fetch(cfg.manifestPath);
        MANIFEST = await r.json();

        // v1.2: optional auto-trigger via ?use-lineup=1
        const params = new URLSearchParams(window.location.search);
        const wantsLineup = params.get('use-lineup') === '1';
        const lineupReady = wantsLineup && getLineupIds().length > 0 && !window.__lineupAutoTriggered;
        if (lineupReady) {
          window.__lineupAutoTriggered = true;
          await buildFromLineup();
        } else {
          renderForm();
        }
      } catch (e) {
        console.error(e);
        mount.innerHTML = '<p style="padding:20px">Error loading activity manifest.</p>';
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }

    // return a small handle (optional, not used by current consumers)
    return {
      regenerate, renderForm, addSlot, removeSlot, buildFromLineup
    };
  }

  window.SessionEngine = { create };
})();
