// 11plus/js/app.js
// Shared utilities for the CSSE 11+ Maths section.
// localStorage namespace: all keys prefixed "11plus:"

const ELEVENPLUS = {
  async loadJSON(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error('Failed to load ' + path);
    return res.json();
  },

  async loadTaxonomy() {
    return this.loadJSON('data/taxonomy.json');
  },

  async loadPaper(year) {
    return this.loadJSON(`data/${year}.json`);
  },

  async loadAllPapers() {
    const years = [2021, 2022, 2023];
    const papers = await Promise.all(years.map(y => this.loadPaper(y)));
    return papers;
  },

  // Flatten a paper's nested question/parts structure into a flat array
  // of answerable items, each tagged with a stable id like "2023-q4-c".
  flattenPaper(paper) {
    const items = [];
    for (const q of paper.questions) {
      for (const p of q.parts) {
        items.push({
          id: `${paper.paper_year}-q${q.q}-${p.part}`,
          paper_year: paper.paper_year,
          q: q.q,
          part: p.part,
          text: p.text,
          answer: p.answer,
          marks: p.marks,
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
  storageKey(paperYear) {
    return `11plus:progress:${paperYear}`;
  },

  getProgress(paperYear) {
    try {
      const raw = localStorage.getItem(this.storageKey(paperYear));
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  },

  setAnswerResult(paperYear, itemId, correct) {
    const progress = this.getProgress(paperYear);
    progress[itemId] = { correct, attemptedAt: new Date().toISOString() };
    localStorage.setItem(this.storageKey(paperYear), JSON.stringify(progress));
  },

  clearProgress(paperYear) {
    localStorage.removeItem(this.storageKey(paperYear));
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
