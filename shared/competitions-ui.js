/* ============================================================================
   Coach Tools · Competitions UI v1.0
   Shared, discipline-neutral helpers for pages that display the Airtable-
   backed Competition Events / Formats & Rules / Gymnastics Requirements
   architecture (see netlify/functions/competitions.mts).

   This module intentionally does NOT dictate a full page layout — each
   discipline's data (gymnastics apparatus prep vs. football match rules)
   is different enough that composing sections is left to the page. What it
   provides are the small reusable atoms every one of those pages needs:
   fetching, TBC-safe formatting, status badges, section chrome, a source
   link, and loading/empty/error states — so neither page reinvents them
   and neither silently falls back to stale hard-coded content on failure.

   Public API (window.CompetitionsUI):
     fetchEvents({ discipline, season }) -> Promise<Array<CompetitionEvent>>
     fmt(value, fallback?)      -> string        // TBC-safe text formatter
     fmtNum(value, unit?)       -> string         // never renders a blank as 0
     badge(text, tone)          -> string (HTML)  // status pill
     participationBadge(status) -> string (HTML)  // Entering/Potential/Not entering/etc.
     section(title, innerHtml, opts?) -> string (HTML)
     sourceLink(source)         -> string (HTML)
     loadingState(message)      -> string (HTML)
     emptyState(message)        -> string (HTML)
     errorState(message, opts?) -> string (HTML)  // opts.onRetry: function
     injectStyles()             -> void            // idempotent, call once per page
   ============================================================================ */

(function () {
  'use strict';

  const STYLE_ID = 'competitions-ui-styles';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .cui-section {
        background: var(--paper, #FBF8F1); border: 1.5px solid var(--ink, #15191E);
        border-radius: 6px; padding: 16px 18px 18px; margin-bottom: 12px;
      }
      .cui-section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
      .cui-section-head h3 {
        font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 16px;
        letter-spacing: 0.03em; text-transform: uppercase;
      }
      .cui-badge {
        display: inline-block; font-family: 'JetBrains Mono', monospace; font-size: 10px;
        letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 9px;
        border-radius: 12px; border: 1.5px solid var(--ink, #15191E); background: var(--bg, #F5F1E8);
        white-space: nowrap;
      }
      .cui-badge.tone-confirmed   { background: #E5F3E8; border-color: #2F6B3E; color: #1E4B2A; }
      .cui-badge.tone-tbc         { background: #FBF0D9; border-color: #A87A12; color: #6B4E0C; }
      .cui-badge.tone-entering    { background: #E5F3E8; border-color: #2F6B3E; color: #1E4B2A; }
      .cui-badge.tone-potential   { background: #FBF0D9; border-color: #A87A12; color: #6B4E0C; }
      .cui-badge.tone-not-entering{ background: #F1F1EF; border-color: var(--muted, #6B7280); color: var(--muted, #6B7280); }
      .cui-badge.tone-neutral     { background: var(--bg, #F5F1E8); }
      .cui-row {
        font-size: 12.5px; line-height: 1.6; display: flex; justify-content: space-between;
        gap: 10px; border-bottom: 1px dashed var(--rule, #DAD3C4); padding: 5px 0;
      }
      .cui-row:last-child { border-bottom: none; }
      .cui-row .k { color: var(--muted, #6B7280); font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; flex-shrink: 0; }
      .cui-row .v { color: var(--ink, #15191E); text-align: right; }
      .cui-row .v.na { color: var(--muted, #6B7280); font-style: italic; }
      .cui-source { font-size: 11.5px; margin-top: 4px; }
      .cui-source a { color: var(--secondary, #142850); }
      .cui-state { text-align: center; padding: 28px 16px; font-size: 13px; color: var(--ink-soft, #3A4049); }
      .cui-state.error { color: #8A2A1F; }
      .cui-retry {
        margin-top: 10px; font-family: 'JetBrains Mono', monospace; font-size: 11px;
        letter-spacing: 0.08em; text-transform: uppercase; padding: 7px 14px;
        border: 1.5px solid var(--ink, #15191E); border-radius: 5px; background: var(--ink, #15191E);
        color: var(--paper, #FBF8F1); cursor: pointer;
      }
      .cui-retry:hover { opacity: 0.85; }
    `;
    document.head.appendChild(style);
  }

  async function fetchEvents(opts) {
    opts = opts || {};
    const params = new URLSearchParams();
    if (opts.discipline) params.set('discipline', opts.discipline);
    if (opts.season) params.set('season', opts.season);
    const qs = params.toString();
    const res = await fetch(`/.netlify/functions/competitions${qs ? '?' + qs : ''}`);
    if (!res.ok) {
      let msg = `Request failed (${res.status})`;
      try { const body = await res.json(); if (body && body.error) msg = body.error; } catch (_) {}
      throw new Error(msg);
    }
    const body = await res.json();
    return body.events || [];
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function fmt(value, fallback) {
    fallback = fallback === undefined ? 'Not specified' : fallback;
    if (value === undefined || value === null || value === '') return fallback;
    return esc(value);
  }

  function fmtNum(value, unit) {
    if (typeof value !== 'number') return 'Not specified';
    return unit ? `${value} ${unit}` : String(value);
  }

  const BADGE_TONES = {
    Confirmed: 'confirmed', TBC: 'tbc', Entering: 'entering', Potential: 'potential',
    'Not entering': 'not-entering', 'Not applicable': 'neutral',
    Partial: 'tbc',
  };

  function badge(text, tone) {
    if (!text) return '';
    const t = tone || BADGE_TONES[text] || 'neutral';
    return `<span class="cui-badge tone-${esc(t)}">${esc(text)}</span>`;
  }

  function participationBadge(status) {
    return badge(status || 'Not applicable');
  }

  function section(title, innerHtml, opts) {
    opts = opts || {};
    return `
      <div class="cui-section">
        <div class="cui-section-head"><h3>${esc(title)}</h3>${opts.headExtra || ''}</div>
        ${innerHtml}
      </div>
    `;
  }

  function sourceLink(source) {
    if (!source || (!source.description && !source.url)) return '';
    const desc = source.description ? esc(source.description) : 'Source';
    return `<div class="cui-source">${source.url ? `<a href="${esc(source.url)}" target="_blank" rel="noopener">${desc} ↗</a>` : desc}</div>`;
  }

  function loadingState(message) {
    return `<div class="cui-state">${esc(message || 'Loading…')}</div>`;
  }

  function emptyState(message) {
    return `<div class="cui-state">${esc(message || 'Nothing to show yet.')}</div>`;
  }

  function errorState(message, opts) {
    opts = opts || {};
    const id = 'cui-retry-' + Math.random().toString(36).slice(2, 9);
    if (opts.onRetry) {
      setTimeout(() => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', opts.onRetry);
      }, 0);
    }
    return `
      <div class="cui-state error">
        ${esc(message || 'Something went wrong loading this data.')}
        ${opts.onRetry ? `<div><button class="cui-retry" id="${id}">Retry</button></div>` : ''}
      </div>
    `;
  }

  window.CompetitionsUI = {
    fetchEvents, fmt, fmtNum, badge, participationBadge, section, sourceLink,
    loadingState, emptyState, errorState, injectStyles, esc,
  };
})();
