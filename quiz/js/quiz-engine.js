// quiz/js/quiz-engine.js
// Generic SM-2 style spaced repetition engine for the Coach Tools quiz module.
// Sport-agnostic: works on plain card objects {id, sport, category, skill, type,
// question, answerFn} produced by a per-sport adapter (see js/adapters/gymnastics.js).
// Review state is stored separately from card content so re-generating cards
// from source data (e.g. after editing skill-library-data.js) never wipes
// progress, as long as card ids stay stable.

const QuizEngine = (function () {
  const REVIEW_KEY = "quiz:reviews";
  const SESSION_LOG_KEY = "quiz:sessionLog";

  // ---- storage -------------------------------------------------------

  function loadReviews() {
    try {
      const raw = localStorage.getItem(REVIEW_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.error("QuizEngine: failed to read reviews", e);
      return {};
    }
  }

  function saveReviews(reviews) {
    try {
      localStorage.setItem(REVIEW_KEY, JSON.stringify(reviews));
    } catch (e) {
      console.error("QuizEngine: failed to save reviews", e);
    }
  }

  function defaultState() {
    return {
      repetitions: 0,
      interval: 0, // days
      easeFactor: 2.5,
      dueDate: Date.now(), // due immediately until first review
      lastReviewed: null,
    };
  }

  function getState(reviews, cardId) {
    return reviews[cardId] ? { ...defaultState(), ...reviews[cardId] } : defaultState();
  }

  // ---- SM-2 scheduling -------------------------------------------------
  // rating: "again" | "hard" | "good" | "easy"

  function schedule(state, rating) {
    const next = { ...state };
    const DAY = 24 * 60 * 60 * 1000;

    if (rating === "again") {
      next.repetitions = 0;
      next.easeFactor = Math.max(1.3, next.easeFactor - 0.2);
      next.interval = 1; // persisted fallback if session ends before requeue is seen again
      next.dueDate = Date.now() + 10 * 60 * 1000; // 10 min - short-term, handled by in-session requeue
    } else {
      next.repetitions += 1;
      if (rating === "hard") next.easeFactor = Math.max(1.3, next.easeFactor - 0.15);
      if (rating === "easy") next.easeFactor = next.easeFactor + 0.15;

      if (next.repetitions === 1) {
        next.interval = 1;
      } else if (next.repetitions === 2) {
        next.interval = 6;
      } else {
        next.interval = Math.round(next.interval * next.easeFactor) || 1;
      }
      if (rating === "hard") next.interval = Math.max(1, Math.round(next.interval * 0.8));
      if (rating === "easy") next.interval = Math.round(next.interval * 1.3);

      next.dueDate = Date.now() + next.interval * DAY;
    }
    next.lastReviewed = Date.now();
    return next;
  }

  function recordReview(cardId, rating) {
    const reviews = loadReviews();
    const current = getState(reviews, cardId);
    const updated = schedule(current, rating);
    reviews[cardId] = updated;
    saveReviews(reviews);
    return updated;
  }

  // ---- session building -------------------------------------------------
  // Builds a review queue from a card pool, prioritising due/overdue cards,
  // then filling with new (never-reviewed) cards up to sessionSize.

  function buildSession(cardPool, sessionSize = 20) {
    const reviews = loadReviews();
    const now = Date.now();

    const withState = cardPool.map((card) => ({
      card,
      state: getState(reviews, card.id),
      isNew: !reviews[card.id],
    }));

    const due = withState
      .filter((c) => !c.isNew && c.state.dueDate <= now)
      .sort((a, b) => a.state.dueDate - b.state.dueDate);

    const fresh = withState.filter((c) => c.isNew);

    const queue = [...due, ...fresh].slice(0, sessionSize).map((c) => c.card);
    return queue;
  }

  // In-session requeue: when a card is marked "again", reinsert it a few
  // cards later in the current queue so it comes back around this session.
  function requeueAfterAgain(queue, currentIndex, card) {
    const insertAt = Math.min(queue.length, currentIndex + 3);
    const copy = queue.slice();
    copy.splice(insertAt, 0, card);
    return copy;
  }

  // ---- stats -------------------------------------------------

  function poolStats(cardPool) {
    const reviews = loadReviews();
    const now = Date.now();
    let due = 0, newCount = 0, learned = 0;
    cardPool.forEach((card) => {
      const r = reviews[card.id];
      if (!r) { newCount++; return; }
      if (r.dueDate <= now) due++;
      if (r.repetitions >= 2) learned++;
    });
    return { total: cardPool.length, due, new: newCount, learned };
  }

  return {
    loadReviews,
    saveReviews,
    getState,
    recordReview,
    buildSession,
    requeueAfterAgain,
    poolStats,
  };
})();
