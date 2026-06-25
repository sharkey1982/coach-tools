/* ============================================================================
   Coach Tools · Lineup UI v1.0
   Activity-library UI surface for the per-discipline lineup (planning basket).

   Responsibilities:
     - Inject CSS for the per-card "+ Add / ✓ Added" toggle, the header badge,
       and the modal panel that lists queued activities.
     - Mount a "▸ Lineup (N)" badge into a host element on the page.
     - Open a modal listing queued activities with remove / clear-all /
       build-session controls.
     - Provide renderToggle(activityId) returning the toggle button HTML for
       use inside an activity card template.

   Public API:
     window.LineupUI.init({
       discipline:           'cricket' | 'football' | 'long-jump',
       badgeMountSelector:   CSS selector for an empty <div> that hosts the badge
       sessionPagePath:      relative href to the discipline's session-builder
                              page (e.g. '../sessions/'); used by the modal's
                              "Build session from lineup" button
       activities:           array of { id, name, ...} used by the modal to
                              resolve ids to human names (typically
                              manifest.activities)
     })
     window.LineupUI.renderToggle(activityId): string — HTML for the toggle.
                              Call inside the activity card template. The toggle
                              uses [data-lineup-toggle] and is wired by a
                              document-level delegated listener installed at
                              init() time.

   The card-internal toggle button has class .lineup-toggle and data attributes
   data-lineup-toggle=<id>. It stops event propagation so it doesn't navigate
   the card's anchor.

   The module is self-contained — no dependency on the host page's CSS variables
   (hex values inlined as fallbacks; var() references used opportunistically).
   ============================================================================ */

(function () {
  'use strict';

  if (!window.Lineup) {
    console.error('LineupUI requires Lineup (lineup.js) to be loaded first.');
    return;
  }

  var STYLE_TAG_ID = 'lineup-ui-styles';
  var CSS = [
    /* per-card toggle */
    '.lineup-toggle {',
    '  position: absolute; top: 8px; right: 8px; z-index: 2;',
    '  display: inline-flex; align-items: center; gap: 4px;',
    '  padding: 5px 9px;',
    '  background: var(--paper, #FBF8F1);',
    '  color: var(--ink, #15191E);',
    '  border: 1.5px solid var(--ink, #15191E);',
    '  border-radius: 4px;',
    '  font-family: "JetBrains Mono", monospace;',
    '  font-size: 10px; font-weight: 700;',
    '  letter-spacing: 0.08em; text-transform: uppercase;',
    '  cursor: pointer; transition: all 0.12s;',
    '  line-height: 1; user-select: none;',
    '}',
    '.lineup-toggle:hover {',
    '  transform: translate(-1px, -1px);',
    '  box-shadow: 2px 2px 0 var(--ink, #15191E);',
    '}',
    '.lineup-toggle.in-lineup {',
    '  background: var(--ink, #15191E);',
    '  color: var(--paper, #FBF8F1);',
    '}',
    '.activity-card { position: relative; }',

    /* badge */
    '.lineup-badge {',
    '  display: inline-flex; align-items: center; gap: 6px;',
    '  padding: 8px 14px;',
    '  background: var(--paper, #FBF8F1);',
    '  color: var(--ink, #15191E);',
    '  border: 1.5px solid var(--ink, #15191E);',
    '  border-radius: 999px;',
    '  font-family: "JetBrains Mono", monospace;',
    '  font-size: 11px; font-weight: 700;',
    '  letter-spacing: 0.08em; text-transform: uppercase;',
    '  cursor: pointer; transition: all 0.12s;',
    '  user-select: none;',
    '}',
    '.lineup-badge:hover {',
    '  transform: translate(-1px, -1px);',
    '  box-shadow: 3px 3px 0 var(--ink, #15191E);',
    '}',
    '.lineup-badge[hidden] { display: none; }',
    '.lineup-badge .lineup-badge-count {',
    '  display: inline-flex; align-items: center; justify-content: center;',
    '  min-width: 20px; height: 20px;',
    '  padding: 0 6px;',
    '  background: var(--ink, #15191E); color: var(--paper, #FBF8F1);',
    '  border-radius: 999px;',
    '  font-size: 10px;',
    '}',

    /* modal */
    '.lineup-modal-backdrop {',
    '  position: fixed; inset: 0;',
    '  background: rgba(21, 25, 30, 0.55);',
    '  display: flex; align-items: flex-start; justify-content: center;',
    '  padding: 60px 16px 24px;',
    '  z-index: 9999;',
    '  overflow-y: auto;',
    '}',
    '.lineup-modal-backdrop[hidden] { display: none; }',
    '.lineup-modal {',
    '  background: var(--paper, #FBF8F1);',
    '  border: 1.5px solid var(--ink, #15191E);',
    '  border-radius: 8px;',
    '  padding: 22px 24px;',
    '  max-width: 520px; width: 100%;',
    '  font-family: "Manrope", sans-serif;',
    '  color: var(--ink, #15191E);',
    '  box-shadow: 6px 6px 0 var(--ink, #15191E);',
    '}',
    '.lineup-modal-head {',
    '  display: flex; align-items: baseline; justify-content: space-between;',
    '  gap: 12px; margin-bottom: 14px;',
    '  padding-bottom: 12px;',
    '  border-bottom: 1.5px solid var(--rule, #DAD3C4);',
    '}',
    '.lineup-modal-title {',
    '  font-family: "Oswald", sans-serif; font-weight: 700;',
    '  font-size: 22px; letter-spacing: 0.04em; text-transform: uppercase;',
    '  line-height: 1;',
    '}',
    '.lineup-modal-close {',
    '  background: transparent; border: 0; padding: 4px 8px;',
    '  font-family: "JetBrains Mono", monospace; font-size: 14px;',
    '  color: var(--muted, #6B7280); cursor: pointer;',
    '  line-height: 1;',
    '}',
    '.lineup-modal-close:hover { color: var(--ink, #15191E); }',
    '.lineup-modal-empty {',
    '  font-family: "JetBrains Mono", monospace;',
    '  font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;',
    '  color: var(--muted, #6B7280);',
    '  padding: 14px 0; text-align: center;',
    '}',
    '.lineup-modal-list {',
    '  list-style: none; margin: 0; padding: 0;',
    '  max-height: 50vh; overflow-y: auto;',
    '  margin-bottom: 14px;',
    '}',
    '.lineup-modal-item {',
    '  display: flex; align-items: center; gap: 10px;',
    '  padding: 10px 0;',
    '  border-bottom: 1px solid var(--rule, #DAD3C4);',
    '}',
    '.lineup-modal-item:last-child { border-bottom: 0; }',
    '.lineup-modal-item-name {',
    '  flex: 1; font-weight: 600; font-size: 14px;',
    '  color: var(--ink, #15191E);',
    '}',
    '.lineup-modal-item-name.missing {',
    '  color: var(--muted, #6B7280); font-style: italic;',
    '}',
    '.lineup-modal-item-remove {',
    '  background: transparent; border: 1.5px solid var(--rule, #DAD3C4);',
    '  color: var(--muted, #6B7280);',
    '  padding: 4px 9px; border-radius: 4px;',
    '  font-family: "JetBrains Mono", monospace;',
    '  font-size: 10px; font-weight: 700; letter-spacing: 0.06em;',
    '  text-transform: uppercase; cursor: pointer;',
    '  transition: all 0.12s;',
    '}',
    '.lineup-modal-item-remove:hover {',
    '  border-color: var(--ink, #15191E); color: var(--ink, #15191E);',
    '}',
    '.lineup-modal-actions {',
    '  display: flex; gap: 8px; flex-wrap: wrap;',
    '  padding-top: 12px;',
    '  border-top: 1.5px solid var(--rule, #DAD3C4);',
    '}',
    '.lineup-modal-btn {',
    '  padding: 11px 16px;',
    '  border: 1.5px solid var(--ink, #15191E);',
    '  border-radius: 6px;',
    '  font-family: "JetBrains Mono", monospace;',
    '  font-size: 11px; font-weight: 700;',
    '  letter-spacing: 0.08em; text-transform: uppercase;',
    '  cursor: pointer; transition: all 0.12s;',
    '  background: var(--paper, #FBF8F1);',
    '  color: var(--ink, #15191E);',
    '}',
    '.lineup-modal-btn:hover {',
    '  transform: translate(-1px, -1px);',
    '  box-shadow: 3px 3px 0 var(--ink, #15191E);',
    '}',
    '.lineup-modal-btn.primary {',
    '  flex: 1; background: var(--ink, #15191E); color: var(--paper, #FBF8F1);',
    '}',
    '.lineup-modal-btn.primary:hover {',
    '  background: var(--theme, var(--ink, #15191E));',
    '}',
    '.lineup-modal-btn[disabled] {',
    '  opacity: 0.4; cursor: not-allowed; pointer-events: none;',
    '}'
  ].join('\n');

  function injectStylesOnce() {
    if (document.getElementById(STYLE_TAG_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_TAG_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* per-init state */
  var state = {
    discipline: null,
    sessionPagePath: null,
    activitiesById: null,
    store: null,
    badgeEl: null,
    modalEl: null,
    backdropEl: null,
    unsubChange: null,
    listenersWired: false
  };

  function renderToggle(activityId) {
    if (!state.store) {
      // init() hasn't run yet — emit a placeholder; refreshAllToggles() will fix
      // it once init runs and renderGrid is called again. In practice consumers
      // call init() after rendering, so we read state at render time.
      return '<button type="button" class="lineup-toggle" data-lineup-toggle="' + escapeAttr(activityId) + '">+ Add</button>';
    }
    var inLineup = state.store.has(activityId);
    var label = inLineup ? '✓ Added' : '+ Add';
    var cls = 'lineup-toggle' + (inLineup ? ' in-lineup' : '');
    return '<button type="button" class="' + cls + '" data-lineup-toggle="' + escapeAttr(activityId) + '" aria-pressed="' + (inLineup ? 'true' : 'false') + '">' + label + '</button>';
  }

  function refreshAllToggles() {
    if (!state.store) return;
    var nodes = document.querySelectorAll('[data-lineup-toggle]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var id = el.getAttribute('data-lineup-toggle');
      var inLineup = state.store.has(id);
      if (inLineup) {
        el.classList.add('in-lineup');
        el.textContent = '✓ Added';
        el.setAttribute('aria-pressed', 'true');
      } else {
        el.classList.remove('in-lineup');
        el.textContent = '+ Add';
        el.setAttribute('aria-pressed', 'false');
      }
    }
  }

  function refreshBadge() {
    if (!state.badgeEl || !state.store) return;
    var n = state.store.count();
    state.badgeEl.querySelector('.lineup-badge-count').textContent = String(n);
    if (n === 0) {
      state.badgeEl.setAttribute('hidden', '');
    } else {
      state.badgeEl.removeAttribute('hidden');
    }
  }

  function escapeAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function openModal() {
    if (!state.store) return;
    var ids = state.store.getAll();
    var items = ids.map(function (id) {
      var act = state.activitiesById ? state.activitiesById[id] : null;
      return { id: id, name: act ? act.name : id, missing: !act };
    });

    state.modalEl.querySelector('.lineup-modal-body').innerHTML = items.length === 0
      ? '<div class="lineup-modal-empty">No activities queued yet. Tap "+ Add" on any activity card to start a lineup.</div>'
      : '<ul class="lineup-modal-list">' + items.map(function (it) {
          return '<li class="lineup-modal-item">'
            + '<span class="lineup-modal-item-name' + (it.missing ? ' missing' : '') + '">' + escapeHTML(it.name) + '</span>'
            + '<button type="button" class="lineup-modal-item-remove" data-lineup-modal-remove="' + escapeAttr(it.id) + '">✕ Remove</button>'
            + '</li>';
        }).join('') + '</ul>';

    var buildBtn = state.modalEl.querySelector('[data-lineup-modal-build]');
    var clearBtn = state.modalEl.querySelector('[data-lineup-modal-clear]');
    if (items.length === 0) {
      buildBtn.setAttribute('disabled', '');
      clearBtn.setAttribute('disabled', '');
    } else {
      buildBtn.removeAttribute('disabled');
      clearBtn.removeAttribute('disabled');
    }

    state.backdropEl.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!state.backdropEl) return;
    state.backdropEl.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  function mountBadge(selector) {
    var host = document.querySelector(selector);
    if (!host) {
      console.warn('LineupUI: badge mount selector not found:', selector);
      return null;
    }
    host.innerHTML = '<button type="button" class="lineup-badge" data-lineup-open>'
      + '▸ Lineup '
      + '<span class="lineup-badge-count">0</span>'
      + '</button>';
    return host.querySelector('.lineup-badge');
  }

  function mountModal() {
    var existing = document.getElementById('lineup-modal-backdrop');
    if (existing) return existing;
    var backdrop = document.createElement('div');
    backdrop.id = 'lineup-modal-backdrop';
    backdrop.className = 'lineup-modal-backdrop';
    backdrop.setAttribute('hidden', '');
    backdrop.innerHTML = ''
      + '<div class="lineup-modal" role="dialog" aria-modal="true" aria-labelledby="lineup-modal-title">'
      + '  <div class="lineup-modal-head">'
      + '    <div class="lineup-modal-title" id="lineup-modal-title">▸ Lineup</div>'
      + '    <button type="button" class="lineup-modal-close" data-lineup-close>✕ Close</button>'
      + '  </div>'
      + '  <div class="lineup-modal-body"></div>'
      + '  <div class="lineup-modal-actions">'
      + '    <button type="button" class="lineup-modal-btn" data-lineup-modal-clear>↺ Clear all</button>'
      + '    <button type="button" class="lineup-modal-btn primary" data-lineup-modal-build>▸ Build session from lineup</button>'
      + '  </div>'
      + '</div>';
    document.body.appendChild(backdrop);
    return backdrop;
  }

  function wireDelegatedListeners() {
    if (state.listenersWired) return;
    state.listenersWired = true;

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t) return;

      // toggle on a card
      var toggle = t.closest && t.closest('[data-lineup-toggle]');
      if (toggle) {
        e.preventDefault();
        e.stopPropagation();
        var id = toggle.getAttribute('data-lineup-toggle');
        if (state.store) state.store.toggle(id);
        return;
      }

      // open modal
      if (t.closest && t.closest('[data-lineup-open]')) {
        e.preventDefault();
        openModal();
        return;
      }

      // close modal — explicit close button
      if (t.closest && t.closest('[data-lineup-close]')) {
        e.preventDefault();
        closeModal();
        return;
      }

      // close modal — backdrop click (only when clicking the backdrop itself,
      // not its descendants)
      if (state.backdropEl && t === state.backdropEl) {
        closeModal();
        return;
      }

      // remove an item from inside the modal
      var rem = t.closest && t.closest('[data-lineup-modal-remove]');
      if (rem) {
        e.preventDefault();
        var rid = rem.getAttribute('data-lineup-modal-remove');
        if (state.store) {
          state.store.remove(rid);
          openModal(); // re-render
        }
        return;
      }

      // clear all
      if (t.closest && t.closest('[data-lineup-modal-clear]')) {
        e.preventDefault();
        if (state.store && state.store.count() > 0) {
          state.store.clear();
          openModal(); // re-render
        }
        return;
      }

      // build session
      if (t.closest && t.closest('[data-lineup-modal-build]')) {
        e.preventDefault();
        if (state.store && state.store.count() > 0 && state.sessionPagePath) {
          window.location.href = state.sessionPagePath + '?use-lineup=1';
        }
        return;
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.backdropEl && !state.backdropEl.hasAttribute('hidden')) {
        closeModal();
      }
    });
  }

  function init(opts) {
    opts = opts || {};
    if (!opts.discipline) throw new Error('LineupUI.init: missing discipline');
    injectStylesOnce();

    state.discipline = opts.discipline;
    state.sessionPagePath = opts.sessionPagePath || null;
    state.store = window.Lineup.forDiscipline(opts.discipline);

    state.activitiesById = {};
    if (Array.isArray(opts.activities)) {
      for (var i = 0; i < opts.activities.length; i++) {
        var a = opts.activities[i];
        if (a && a.id) state.activitiesById[a.id] = a;
      }
    }

    state.badgeEl = opts.badgeMountSelector ? mountBadge(opts.badgeMountSelector) : null;
    state.backdropEl = mountModal();
    state.modalEl = state.backdropEl.querySelector('.lineup-modal');

    wireDelegatedListeners();

    // Sync everything with current store state
    if (state.unsubChange) state.unsubChange();
    state.unsubChange = state.store.onChange(function () {
      refreshAllToggles();
      refreshBadge();
      // If modal is open, re-render its contents to reflect changes
      if (state.backdropEl && !state.backdropEl.hasAttribute('hidden')) {
        openModal();
      }
    });

    refreshAllToggles();
    refreshBadge();
  }

  window.LineupUI = {
    init: init,
    renderToggle: renderToggle,
    refreshAllToggles: refreshAllToggles // exposed in case a page re-renders the grid
  };
})();
