/* ============================================================================
   Coach Tools · Coaching Card v1.0
   Per-activity, per-user "10-question coaching card" — a standardised
   pre-delivery checklist the coach fills in for each activity they plan
   to deliver.

   The 10 questions follow the IDEA-informed framework:
     1. Objective                — what problem am I solving?
     2. Set-up                   — is the setup right?
     3. IDEA                     — Introduce, Demonstrate, Explain, Activate
     4. Observation              — what's the ONE thing I'm watching first?
     5. Coaching cues            — 2–4 short prompts
     6. Interventions            — when will I stop, why, what will I change?
     7. Progressions             — how will I increase the challenge?
     8. Differentiation          — how will I support / stretch?
     9. Behaviour & safety       — problems expected, how to prevent
    10. Finish & reflect         — memorable end + reflective questions

   Storage:
     localStorage key 'coach-tools.card.<discipline>.<activityId>'
     Value: JSON blob { objective, setup, idea, observation, cues,
                        interventions, progressions, differentiation,
                        behaviourSafety, finishReflect, expanded }

   Authored defaults:
     Optional 'coachingCard' field on the activity JSON provides
     placeholder guidance for each question. Placeholders are shown
     when the field is empty; typed answers replace them and save
     to localStorage. On print, empty fields fall back to the
     placeholder rendered in italic.

   Public API:
     window.CoachingCard.init({
       discipline:      'football' | 'cricket' | 'long-jump',
       activityId:      the activity's id (matches the JSON's id field),
       activityName:    the activity's name (for the print header),
       mountSelector:   CSS selector for an empty <div> that hosts the card,
       defaults:        optional { objective: '…', setup: '…', … } — the
                        `coachingCard` field on the activity JSON, if present.
     })
   ============================================================================ */

(function () {
  'use strict';

  var STYLE_TAG_ID = 'coaching-card-styles';
  var KEY_PREFIX = 'coach-tools.card.';

  var FIELDS = [
    { id: 'objective',       label: 'Objective',           question: 'What is the objective?',                       hint: 'What football / coaching problem am I trying to solve?' },
    { id: 'setup',           label: 'Set-up',              question: 'Is the set-up right?',                         hint: 'Right area size? Everyone active? Safe? All equipment ready?' },
    { id: 'idea',            label: 'IDEA',                question: 'How will I use IDEA?',                         hint: 'Introduce · Demonstrate · Explain · Activate — under 90 seconds' },
    { id: 'observation',     label: 'Observation',         question: 'What am I observing?',                         hint: 'What is the ONE thing I am watching first?' },
    { id: 'cues',            label: 'Coaching cues',       question: 'What are my coaching cues?',                   hint: '2–4 short prompts I will reinforce with the children' },
    { id: 'interventions',   label: 'Interventions',       question: 'When will I intervene?',                       hint: 'When will I stop? Why? What will I change?' },
    { id: 'progressions',    label: 'Progressions',        question: 'What progressions are planned?',               hint: 'How will I increase the challenge as the session runs?' },
    { id: 'differentiation', label: 'Differentiation',     question: 'How will I differentiate?',                    hint: 'How will I support beginners and stretch stronger players?' },
    { id: 'behaviourSafety', label: 'Behaviour & safety',  question: 'What behaviour / safety issues do I expect?',  hint: 'What problems am I expecting and how will I prevent them?' },
    { id: 'finishReflect',   label: 'Finish & reflect',    question: 'How will I finish and reflect?',               hint: 'Memorable ending + which reflection questions will I ask?' }
  ];

  var CSS = [
    '/* screen styles */',
    '.coaching-card {',
    '  background: var(--paper, #FBF8F1);',
    '  border: 1.5px solid var(--ink, #15191E);',
    '  border-radius: 6px;',
    '  margin: 14px 0;',
    '  overflow: hidden;',
    '}',
    '.coaching-card-head {',
    '  display: flex; align-items: center; justify-content: space-between;',
    '  gap: 12px;',
    '  padding: 12px 18px;',
    '  cursor: pointer; user-select: none;',
    '  background: var(--paper, #FBF8F1);',
    '  border-bottom: 1.5px solid transparent;',
    '  transition: background 0.12s;',
    '}',
    '.coaching-card.expanded .coaching-card-head {',
    '  border-bottom-color: var(--rule, #DAD3C4);',
    '}',
    '.coaching-card-head:hover { background: rgba(21,25,30,0.04); }',
    '.coaching-card-title {',
    '  display: flex; align-items: center; gap: 10px;',
    '  font-family: "Oswald", sans-serif; font-weight: 700;',
    '  font-size: 16px; letter-spacing: 0.06em; text-transform: uppercase;',
    '  color: var(--ink, #15191E);',
    '}',
    '.coaching-card-status {',
    '  font-family: "JetBrains Mono", monospace;',
    '  font-size: 10px; font-weight: 700;',
    '  letter-spacing: 0.08em; text-transform: uppercase;',
    '  color: var(--muted, #6B7280);',
    '}',
    '.coaching-card-status.saved { color: var(--grass, #6B8E4E); }',
    '.coaching-card-chevron {',
    '  font-family: "JetBrains Mono", monospace;',
    '  font-size: 14px; color: var(--muted, #6B7280);',
    '  transition: transform 0.15s;',
    '}',
    '.coaching-card.expanded .coaching-card-chevron { transform: rotate(90deg); }',
    '.coaching-card-body {',
    '  display: none; padding: 4px 18px 18px;',
    '}',
    '.coaching-card.expanded .coaching-card-body { display: block; }',
    '.coaching-card-field {',
    '  padding: 12px 0;',
    '  border-bottom: 1px solid var(--rule, #DAD3C4);',
    '}',
    '.coaching-card-field:last-of-type { border-bottom: 0; }',
    '.coaching-card-field-head {',
    '  display: flex; align-items: baseline; gap: 10px;',
    '  margin-bottom: 6px;',
    '}',
    '.coaching-card-field-num {',
    '  font-family: "JetBrains Mono", monospace;',
    '  font-size: 10px; font-weight: 700;',
    '  letter-spacing: 0.08em;',
    '  color: var(--muted, #6B7280);',
    '  min-width: 26px;',
    '}',
    '.coaching-card-field-q {',
    '  font-family: "Oswald", sans-serif; font-weight: 700;',
    '  font-size: 14px; letter-spacing: 0.04em; text-transform: uppercase;',
    '  color: var(--ink, #15191E);',
    '  flex: 1;',
    '}',
    '.coaching-card-field-hint {',
    '  font-family: "JetBrains Mono", monospace;',
    '  font-size: 10px; letter-spacing: 0.04em;',
    '  color: var(--muted, #6B7280);',
    '  margin: 2px 0 8px 36px;',
    '  font-style: italic;',
    '}',
    '.coaching-card-textarea {',
    '  width: 100%;',
    '  margin-left: 36px;',
    '  width: calc(100% - 36px);',
    '  min-height: 60px;',
    '  padding: 10px 12px;',
    '  background: #FDFBF6;',
    '  border: 1.5px solid var(--rule, #DAD3C4);',
    '  border-radius: 4px;',
    '  font-family: "Manrope", sans-serif;',
    '  font-size: 14px; line-height: 1.5;',
    '  color: var(--ink, #15191E);',
    '  resize: vertical;',
    '  transition: border-color 0.12s;',
    '}',
    '.coaching-card-textarea:focus {',
    '  outline: none;',
    '  border-color: var(--ink, #15191E);',
    '}',
    '.coaching-card-textarea::placeholder {',
    '  color: var(--muted, #6B7280);',
    '  font-style: italic;',
    '  opacity: 0.75;',
    '}',
    '.coaching-card-actions {',
    '  display: flex; gap: 8px; flex-wrap: wrap;',
    '  padding-top: 14px;',
    '  border-top: 1.5px solid var(--rule, #DAD3C4);',
    '  margin-top: 6px;',
    '}',
    '.coaching-card-btn {',
    '  padding: 9px 14px;',
    '  background: var(--paper, #FBF8F1);',
    '  color: var(--ink, #15191E);',
    '  border: 1.5px solid var(--ink, #15191E);',
    '  border-radius: 4px;',
    '  font-family: "JetBrains Mono", monospace;',
    '  font-size: 10px; font-weight: 700;',
    '  letter-spacing: 0.08em; text-transform: uppercase;',
    '  cursor: pointer; transition: all 0.12s;',
    '}',
    '.coaching-card-btn:hover {',
    '  transform: translate(-1px, -1px);',
    '  box-shadow: 2px 2px 0 var(--ink, #15191E);',
    '}',
    '.coaching-card-btn.danger { color: #C8102E; border-color: #C8102E; }',
    '.coaching-card-btn.danger:hover { box-shadow: 2px 2px 0 #C8102E; }',
    '',
    '/* print styles */',
    '@media print {',
    '  .coaching-card { break-inside: avoid; page-break-inside: avoid; border-width: 1px; }',
    '  .coaching-card-head { cursor: default; padding: 8px 12px; }',
    '  .coaching-card-body { display: block !important; padding: 8px 12px 12px; }',
    '  .coaching-card-chevron, .coaching-card-actions, .coaching-card-status { display: none !important; }',
    '  .coaching-card-textarea { display: none !important; }',
    '  .coaching-card-print-answer { display: block !important; }',
    '  .coaching-card-field { padding: 6px 0; }',
    '  .coaching-card-field-hint { display: none; }',
    '}',
    '.coaching-card-print-answer {',
    '  display: none;',
    '  margin-left: 36px;',
    '  font-size: 12px; line-height: 1.5;',
    '  color: var(--ink, #15191E);',
    '  white-space: pre-wrap;',
    '}',
    '.coaching-card-print-answer.placeholder {',
    '  font-style: italic; color: var(--muted, #6B7280);',
    '}'
  ].join('\n');

  function injectStylesOnce() {
    if (document.getElementById(STYLE_TAG_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_TAG_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function storageKey(discipline, activityId) {
    return KEY_PREFIX + discipline + '.' + activityId;
  }

  function read(discipline, activityId) {
    try {
      var raw = localStorage.getItem(storageKey(discipline, activityId));
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function write(discipline, activityId, data) {
    try {
      localStorage.setItem(storageKey(discipline, activityId), JSON.stringify(data));
    } catch (e) {
      // quota / private mode — silent fail
    }
  }

  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escapeAttr(s) {
    return escapeHTML(s).replace(/"/g, '&quot;');
  }

  function countFilled(data) {
    var n = 0;
    for (var i = 0; i < FIELDS.length; i++) {
      var v = data[FIELDS[i].id];
      if (typeof v === 'string' && v.trim().length > 0) n++;
    }
    return n;
  }

  function render(opts) {
    var mount = document.querySelector(opts.mountSelector);
    if (!mount) {
      console.warn('CoachingCard: mount not found:', opts.mountSelector);
      return;
    }

    var data = read(opts.discipline, opts.activityId);
    var defaults = opts.defaults || {};
    var expanded = data.expanded === true;
    var filled = countFilled(data);
    var total = FIELDS.length;

    var fieldHTML = FIELDS.map(function (f, i) {
      var val = typeof data[f.id] === 'string' ? data[f.id] : '';
      var placeholder = (typeof defaults[f.id] === 'string' && defaults[f.id].trim()) ? defaults[f.id] : (f.hint || '');
      var printAnswerText = val.trim() ? val : (defaults[f.id] || '');
      var printAnswerCls = val.trim() ? '' : ' placeholder';
      return ''
        + '<div class="coaching-card-field">'
        +   '<div class="coaching-card-field-head">'
        +     '<span class="coaching-card-field-num">' + String(i + 1).padStart(2, '0') + '</span>'
        +     '<span class="coaching-card-field-q">' + escapeHTML(f.question) + '</span>'
        +   '</div>'
        +   '<div class="coaching-card-field-hint">' + escapeHTML(f.hint) + '</div>'
        +   '<textarea class="coaching-card-textarea"'
        +     ' data-cc-field="' + escapeAttr(f.id) + '"'
        +     ' placeholder="' + escapeAttr(placeholder) + '"'
        +     ' rows="2">' + escapeHTML(val) + '</textarea>'
        +   '<div class="coaching-card-print-answer' + printAnswerCls + '">'
        +     escapeHTML(printAnswerText || '—')
        +   '</div>'
        + '</div>';
    }).join('');

    mount.innerHTML = ''
      + '<section class="coaching-card' + (expanded ? ' expanded' : '') + '" data-cc-root>'
      +   '<header class="coaching-card-head" data-cc-toggle>'
      +     '<div class="coaching-card-title">'
      +       '<span class="coaching-card-chevron">▸</span>'
      +       '<span>▸ Coaching card</span>'
      +     '</div>'
      +     '<span class="coaching-card-status' + (filled ? ' saved' : '') + '" data-cc-status>'
      +       (filled ? filled + ' / ' + total + ' answered' : 'Not started')
      +     '</span>'
      +   '</header>'
      +   '<div class="coaching-card-body">'
      +     fieldHTML
      +     '<div class="coaching-card-actions">'
      +       '<button type="button" class="coaching-card-btn" data-cc-print>⎙ Print activity + card</button>'
      +       '<button type="button" class="coaching-card-btn danger" data-cc-clear>↺ Clear my answers</button>'
      +     '</div>'
      +   '</div>'
      + '</section>';

    wire(mount, opts);
  }

  function wire(mount, opts) {
    var root = mount.querySelector('[data-cc-root]');
    if (!root) return;

    root.querySelector('[data-cc-toggle]').addEventListener('click', function () {
      root.classList.toggle('expanded');
      var data = read(opts.discipline, opts.activityId);
      data.expanded = root.classList.contains('expanded');
      write(opts.discipline, opts.activityId, data);
    });

    // Autosave on input (debounced per-field via requestAnimationFrame is
    // overkill for this scale — localStorage.setItem on every keystroke is
    // fine for ~10 short textareas)
    var textareas = root.querySelectorAll('[data-cc-field]');
    textareas.forEach(function (ta) {
      ta.addEventListener('input', function () {
        var fieldId = ta.getAttribute('data-cc-field');
        var data = read(opts.discipline, opts.activityId);
        data[fieldId] = ta.value;
        write(opts.discipline, opts.activityId, data);
        updateStatus(root, data);
        // Also update the printable fallback line for this field
        var printAns = ta.parentElement.querySelector('.coaching-card-print-answer');
        if (printAns) {
          var val = ta.value.trim();
          if (val) {
            printAns.textContent = ta.value;
            printAns.classList.remove('placeholder');
          } else {
            var def = (opts.defaults && opts.defaults[fieldId]) || '';
            printAns.textContent = def || '—';
            printAns.classList.add('placeholder');
          }
        }
      });
    });

    root.querySelector('[data-cc-print]').addEventListener('click', function () {
      window.print();
    });

    root.querySelector('[data-cc-clear]').addEventListener('click', function () {
      if (!confirm('Clear your answers for this activity? The prompts will stay.')) return;
      // Preserve expanded state; clear only field data
      write(opts.discipline, opts.activityId, { expanded: root.classList.contains('expanded') });
      render(opts); // re-render to reset all textareas
    });
  }

  function updateStatus(root, data) {
    var status = root.querySelector('[data-cc-status]');
    if (!status) return;
    var filled = countFilled(data);
    if (filled === 0) {
      status.textContent = 'Not started';
      status.classList.remove('saved');
    } else {
      status.textContent = filled + ' / ' + FIELDS.length + ' answered';
      status.classList.add('saved');
    }
  }

  function init(opts) {
    if (!opts || !opts.discipline || !opts.activityId || !opts.mountSelector) {
      throw new Error('CoachingCard.init: discipline, activityId, mountSelector are required');
    }
    injectStylesOnce();
    render(opts);
  }

  window.CoachingCard = { init: init, FIELDS: FIELDS };
})();
