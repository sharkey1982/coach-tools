// 11plus/js/app.js
// Shared utilities for the CSSE 11+ Maths section.
// localStorage namespace: all keys prefixed "11plus:"

const ELEVENPLUS = {
  async loadJSON(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error('Failed to load ' + path);
    return res.json();
  },

  // subject defaults to 'maths' everywhere below so every existing call site
  // (browse.html, generate.html, and any old bookmarked calls) keeps working
  // unchanged and keeps hitting the original maths data files.
  SUBJECTS: ['maths', 'english'],
  YEARS: [2021, 2022, 2023],

  async loadTaxonomy(subject = 'maths') {
    const path = subject === 'english' ? 'data/taxonomy-english.json' : 'data/taxonomy.json';
    return this.loadJSON(path);
  },

  async loadPaper(subjectOrYear, maybeYear) {
    // Backward-compatible signature: loadPaper(year) still works (maths).
    let subject = 'maths', year;
    if (maybeYear === undefined) { year = subjectOrYear; }
    else { subject = subjectOrYear; year = maybeYear; }
    const path = subject === 'english' ? `data/english-${year}.json` : `data/${year}.json`;
    return this.loadJSON(path);
  },

  async loadAllPapers(subject = 'maths') {
    const papers = await Promise.all(this.YEARS.map(y => this.loadPaper(subject, y)));
    return papers;
  },

  // Flatten a paper's nested structure into a flat array of answerable items.
  // Handles both shapes:
  //  - maths legacy: paper.questions[].parts[]
  //  - english: paper.sections[].questions[].parts[] (has an extra
  //    section_id/section_name, and each part carries an answer_type)
  flattenPaper(paper) {
    const items = [];
    const subject = paper.subject || 'maths';

    if (paper.sections) {
      for (const section of paper.sections) {
        for (const q of section.questions) {
          for (const p of q.parts) {
            items.push({
              id: `${paper.paper_year}-${section.section_id}-q${q.q}-${p.part}`,
              subject,
              section_id: section.section_id,
              section_name: section.section_name,
              paper_year: paper.paper_year,
              q: q.q,
              part: p.part,
              text: p.text,
              answer: p.answer,
              marks: p.marks,
              answer_type: p.answer_type || 'short',
              accept_notes: p.accept_notes || null,
              domain: p.domain,
              topic: p.topic,
              archetype: p.archetype,
              thinking_skill: p.thinking_skill,
              importance: p.importance,
              explanation: p.explanation,
              text_quality: p.text_quality || null
            });
          }
        }
      }
      return items;
    }

    for (const q of paper.questions) {
      for (const p of q.parts) {
        items.push({
          id: `${paper.paper_year}-q${q.q}-${p.part}`,
          subject,
          section_id: null,
          section_name: null,
          paper_year: paper.paper_year,
          q: q.q,
          part: p.part,
          text: p.text,
          answer: p.answer,
          marks: p.marks,
          answer_type: 'short',
          accept_notes: null,
          domain: p.domain,
          topic: p.topic,
          archetype: p.archetype,
          thinking_skill: p.thinking_skill,
          importance: p.importance,
          explanation: p.explanation,
          text_quality: p.text_quality || null
        });
      }
    }
    return items;
  },

  // Converts plain-text fractions like "17/30" or "3 3/4" into stacked HTML
  // fractions using the .frac CSS class. Run this on text/answer/explanation
  // fields at render time - the underlying JSON data stays plain text.
  formatFractions(str) {
    if (!str) return str;
    // Mixed numbers first: "3 3/4" -> whole number + stacked fraction
    str = str.replace(/\b(\d+)\s(\d{1,2})\/(\d{1,2})\b/g, (m, whole, num, den) =>
      `${whole}<span class="frac"><span class="num">${num}</span><span class="den">${den}</span></span>`
    );
    // Remaining simple fractions: "17/30" -> stacked fraction
    str = str.replace(/\b(\d{1,3})\/(\d{1,3})\b/g, (m, num, den) =>
      `<span class="frac"><span class="num">${num}</span><span class="den">${den}</span></span>`
    );
    return str;
  },

  importanceClass(importance) {
    if (!importance) return '';
    return 'importance-' + importance.toLowerCase().replace(/\s+/g, '-');
  },

  // --- localStorage progress tracking ---
  // Maths keeps its original unprefixed key ("11plus:progress:2023") so existing
  // users don't lose progress. English gets its own namespaced key so the two
  // subjects' 2021/2022/2023 progress never collide.
  storageKey(paperYear, subject = 'maths') {
    return subject === 'english'
      ? `11plus:progress:english:${paperYear}`
      : `11plus:progress:${paperYear}`;
  },

  getProgress(paperYear, subject = 'maths') {
    try {
      const raw = localStorage.getItem(this.storageKey(paperYear, subject));
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  },

  setAnswerResult(paperYear, itemId, correct, subject = 'maths') {
    const progress = this.getProgress(paperYear, subject);
    progress[itemId] = { correct, attemptedAt: new Date().toISOString() };
    localStorage.setItem(this.storageKey(paperYear, subject), JSON.stringify(progress));
  },

  // For "extended" English items with no single checkable answer - records
  // that a model answer was viewed, without claiming it was marked correct.
  setViewed(paperYear, itemId, subject = 'english') {
    const progress = this.getProgress(paperYear, subject);
    progress[itemId] = { correct: null, viewed: true, attemptedAt: new Date().toISOString() };
    localStorage.setItem(this.storageKey(paperYear, subject), JSON.stringify(progress));
  },

  clearProgress(paperYear, subject = 'maths') {
    localStorage.removeItem(this.storageKey(paperYear, subject));
  },

  // --- localStorage continuous-writing drafts (English only) ---
  writingDraftKey(paperYear, promptNumber) {
    return `11plus:writing:${paperYear}:${promptNumber}`;
  },

  getWritingDraft(paperYear, promptNumber) {
    try {
      return localStorage.getItem(this.writingDraftKey(paperYear, promptNumber)) || '';
    } catch (e) {
      return '';
    }
  },

  saveWritingDraft(paperYear, promptNumber, text) {
    localStorage.setItem(this.writingDraftKey(paperYear, promptNumber), text);
  },

  // Very forgiving answer check: strips whitespace/case/punctuation and
  // checks if the student's answer appears within the accepted answer text.
  // This is intentionally lenient - it's a study tool, not an exam marker.
  checkAnswer(studentAnswer, acceptedAnswer) {
    const norm = s => (s || '').toString().toLowerCase().replace(/[£$,\s]/g, '').replace(/^0+/, '');
    const a = norm(studentAnswer);
    const b = norm(acceptedAnswer);
    if (!a) return false;
    return b.includes(a) || a === b;
  }
};
