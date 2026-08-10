// quiz/js/adapters/gymnastics.js
// Builds quiz cards for the gymnastics discipline from existing Coach Tools
// data sources - no duplicated content, no separate authoring required.
//
// Primary source: SKILL_LIBRARY + SKILL_META (gymnastics/tracking/js/) - rich
// per-skill coaching content (cues, faults, assess criteria, phases, safety).
// Fallback source: HK Reference (gymnastics-skills-reference.json) - used for
// any skill that has enriched content there but isn't in SKILL_LIBRARY yet.
//
// A "card" here is the persistent, schedulable unit (one per skill+type).
// Where a skill has several valid answers (e.g. 5 coaching cues), the card
// carries an answerPool and the UI picks one at random each time it's shown,
// so recall is tested against any correct answer, not one fixed phrase.

const GymnasticsAdapter = (function () {
  function cardId(skill, type, extra) {
    const base = `gymnastics:${skill}:${type}`;
    return extra ? `${base}:${extra}` : base;
  }

  function fromSkillLibrary(skillName, meta, lib) {
    const cards = [];
    const category = meta ? meta.category : "Uncategorised";

    if (lib.coaching_cues && lib.coaching_cues.length) {
      cards.push({
        id: cardId(skillName, "cue"),
        sport: "gymnastics",
        source: "library",
        category,
        skill: skillName,
        type: "cue",
        question: `What's a coaching cue for ${skillName}?`,
        answerPool: lib.coaching_cues,
      });
    }

    if (lib.common_faults && lib.common_faults.length) {
      cards.push({
        id: cardId(skillName, "fault"),
        sport: "gymnastics",
        source: "library",
        category,
        skill: skillName,
        type: "fault",
        question: `Name a common fault in ${skillName}.`,
        answerPool: lib.common_faults,
      });
    }

    if (lib.assess_criteria && lib.assess_criteria.length) {
      cards.push({
        id: cardId(skillName, "criteria"),
        sport: "gymnastics",
        source: "library",
        category,
        skill: skillName,
        type: "criteria",
        question: `What's an assess criterion for ${skillName}?`,
        answerPool: lib.assess_criteria,
      });
    }

    if (lib.safety_prereq && lib.safety_prereq.length) {
      cards.push({
        id: cardId(skillName, "safety"),
        sport: "gymnastics",
        source: "library",
        category,
        skill: skillName,
        type: "safety",
        question: `What's a safety requirement for ${skillName}?`,
        answerPool: lib.safety_prereq,
      });
    }

    if (lib.phases && lib.phases.length) {
      lib.phases.forEach(([phaseName, phaseDesc]) => {
        cards.push({
          id: cardId(skillName, "phase", phaseName),
          sport: "gymnastics",
          source: "library",
          category,
          skill: skillName,
          type: "phase",
          question: `What happens in the "${phaseName}" phase of ${skillName}?`,
          answerPool: [phaseDesc],
        });
      });
    }

    return cards;
  }

  function fromHkReference(skill) {
    const cards = [];
    if (!skill.enriched) return cards;
    const category = skill.category || "HK Reference";

    if (skill.description) {
      cards.push({
        id: `gymnastics-hk:${skill.id}:describe`,
        sport: "gymnastics",
        source: "hk",
        category,
        skill: skill.name,
        type: "describe",
        question: `Describe the ${skill.name}.`,
        answerPool: [skill.description],
      });
    }
    if (skill.keyPoints && skill.keyPoints.length) {
      cards.push({
        id: `gymnastics-hk:${skill.id}:keypoint`,
        sport: "gymnastics",
        source: "hk",
        category,
        skill: skill.name,
        type: "keypoint",
        question: `Name a key point for the ${skill.name}.`,
        answerPool: skill.keyPoints,
      });
    }
    return cards;
  }

  // data = { skillLibrary: SKILL_LIBRARY, skillMeta: SKILL_META, hkSkills: [...] }
  // options.includeHkFallback (default false) - when true, also generates
  // cards for HK Reference skills outside SKILL_LIBRARY. Off by default so
  // the quiz stays scoped to your curated 26 core skills rather than the
  // much larger raw HK Reference set (which includes minor drills and
  // warm-up movements not meant to be first-class quiz topics).
  function buildCards(data, options) {
    const opts = options || {};
    const cards = [];
    const libraryCovered = new Set();

    Object.keys(data.skillLibrary || {}).forEach((skillName) => {
      const meta = data.skillMeta ? data.skillMeta[skillName] : null;
      cards.push(...fromSkillLibrary(skillName, meta, data.skillLibrary[skillName]));
      libraryCovered.add(skillName);
    });

    if (opts.includeHkFallback) {
      (data.hkSkills || []).forEach((skill) => {
        if (libraryCovered.has(skill.name)) return; // richer source already covers this skill
        cards.push(...fromHkReference(skill));
      });
    }

    return cards;
  }

  // Distinct categories present in the card pool, for the filter UI.
  function categories(cards) {
    const set = new Set(cards.map((c) => c.category));
    return Array.from(set).sort();
  }

  // Distinct skill names within a category (or all, if category is null).
  function skillsInCategory(cards, category) {
    const set = new Set(
      cards.filter((c) => !category || c.category === category).map((c) => c.skill)
    );
    return Array.from(set).sort();
  }

  return { buildCards, categories, skillsInCategory };
})();
