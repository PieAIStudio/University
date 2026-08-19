/**
 * Tier one: decide what can be decided for free, and admit the rest.
 *
 * The measurement behind this file is the one that changed the whole cost plan.
 * All 673 short-answer exercises in the library carry an `expectedAnswer`, which
 * looked like a free deterministic tier — but the values are Chinese sentences
 * with a median length of nine characters, and the authoring side has no
 * deterministic grading at all: its coding host decides `passed`. So a string
 * comparison here can only settle the short, factual ones.
 *
 * That is not a failure to hide behind fuzzy matching. A tier that guesses
 * produces false passes, and a learner who is told they were right when they
 * were wrong has been taught something false. This returns `undecided` instead,
 * and the caller says so plainly. Closing that gap for real is an import-time
 * compile step — decision card D8 — not a cleverer regex.
 */
export type Verdict =
  | { readonly outcome: "pass"; readonly tier: 1 }
  | { readonly outcome: "fail"; readonly tier: 1 }
  | { readonly outcome: "undecided"; readonly tier: 1; readonly reason: string };

/**
 * Case, spacing and punctuation carry no meaning in these answers.
 *
 * Chinese full-width punctuation is stripped alongside ASCII: a learner who
 * types `due_at。` has answered `due_at`, and a product that disagrees is
 * teaching keyboard habits rather than the subject.
 */
export function normalise(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s　]+/g, "")
    .replace(/[.,;:!?'"`·。，、；：！？“”‘’（）()[\]{}]/g, "");
}

/** Answers at or below this length are single facts: a name, a column, a word. */
const FACTUAL_LENGTH = 12;

export function gradeDeterministically(
  learnerAnswer: string,
  expected: string | undefined,
): Verdict {
  if (!expected) {
    return { outcome: "undecided", tier: 1, reason: "这道题没有参考答案，只能交给上一层判。" };
  }
  const answer = normalise(learnerAnswer);
  const key = normalise(expected);
  if (answer.length === 0) {
    return { outcome: "undecided", tier: 1, reason: "先写下你的判断，再提交。" };
  }
  if (answer === key) return { outcome: "pass", tier: 1 };

  if (key.length <= FACTUAL_LENGTH) {
    // A single fact, wrapped in a sentence, is still that fact.
    if (answer.includes(key)) return { outcome: "pass", tier: 1 };
    return { outcome: "fail", tier: 1 };
  }

  return {
    outcome: "undecided",
    tier: 1,
    reason: "参考答案是一句话，不是一个词——第 1 层判不了语义，要升到第 2 层。",
  };
}

/** How much of the library tier one can actually settle, computed, not claimed. */
export function coverage(expectedAnswers: readonly (string | undefined)[]) {
  const total = expectedAnswers.length;
  const decidable = expectedAnswers.filter(
    (expected) => expected !== undefined && normalise(expected).length <= FACTUAL_LENGTH,
  ).length;
  return { total, decidable, share: total === 0 ? 0 : decidable / total };
}
