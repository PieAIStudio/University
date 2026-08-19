/**
 * Tier one: decide what can be decided for free, without shipping the answer.
 *
 * Two problems meet in this file, and solving one without the other is how the
 * bug got in.
 *
 * The first is cost. All 673 short-answer exercises carry an `expectedAnswer`,
 * which looked like a free deterministic tier — but the values are Chinese
 * sentences with a median length of nine characters, and the authoring side has
 * no deterministic grading at all: its coding host decides `passed`. So a
 * string comparison can only settle the short, factual ones. A tier that
 * guesses produces false passes, and a learner told they were right when they
 * were wrong has been taught something false. This returns `undecided` instead
 * and the caller says so plainly.
 *
 * The second is that the online shell was serving `expectedAnswer` inside its
 * lesson JSON. Every answer in the product was sitting in plain text one
 * network tab away, before the learner had typed anything. The authoring shell
 * had this right from the start — it discloses a reference answer only after
 * repeated attempts or a pass — and the delivery shell, which is the one people
 * pay for, was giving it away.
 *
 * So the key never leaves the build. What ships is a fingerprint of the
 * normalised answer plus its length, and grading compares fingerprints.
 *
 * On what the fingerprint is and is not: FNV-1a, not a cryptographic hash. It
 * stops the answer being *readable*; it would not stop someone determined to
 * brute-force a four-character string. That is the right level of effort,
 * because the answer is also derivable by reading the lesson — which is the
 * activity being sold. The threat being closed is "trips over the answer while
 * poking at the page", not "adversary with a GPU".
 */

const PUNCTUATION = /[.,;:!?'"`·。，、；：！？“”‘’（）()[\]{}]/g;

/** Case and spacing never carry meaning. Punctuation sometimes does. */
function squash(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s　]+/g, "");
}

/**
 * Case, spacing and punctuation carry no meaning in these answers.
 *
 * Chinese full-width punctuation is stripped alongside ASCII: a learner who
 * types `due_at。` has answered `due_at`, and a product that disagrees is
 * teaching keyboard habits rather than the subject.
 */
export function normalise(text: string): string {
  return squash(text).replace(PUNCTUATION, "");
}

/**
 * The same, except punctuation survives — because in a programming course it is
 * sometimes the entire answer.
 *
 * `normalise` alone was silently destroying a whole class of correct answer.
 * Six of the 673 exercises here ask what `...`, `??`, `?.`, `?` or `[]` do, and
 * every one of those normalised to the empty string. An empty key fingerprints
 * to a value that the substring scan then matches at every position, so those
 * six exercises passed *any* answer a learner typed — while an empty answer,
 * being caught earlier, was still refused. Writing nonsense scored better than
 * writing nothing.
 *
 * Keeping both forms rather than choosing one: prose answers need punctuation
 * gone (`due_at。` is `due_at`), symbol answers need it kept, and which kind an
 * exercise is cannot be known from the fingerprint that ships in its place. So
 * both are compiled and either may match.
 */
export function normaliseKeepingSymbols(text: string): string {
  return squash(text);
}

/** FNV-1a over UTF-16 code units. Stable across Node and every browser. */
export function fingerprint(text: string): string {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(36);
}

/** Answers at or below this length are single facts: a name, a column, a word. */
export const FACTUAL_LENGTH = 12;

/** What ships in place of the answer. */
export interface AnswerKey {
  readonly fp: string;
  /** Length of the normalised answer, so a substring window can be sized. */
  readonly len: number;
  /** The same for the form that keeps punctuation. Absent when identical. */
  readonly symFp?: string;
  readonly symLen?: number;
}

/** Build the key at import time, where the answer is still allowed to exist. */
export function compileAnswerKey(expected: string): AnswerKey {
  const key = normalise(expected);
  const symbols = normaliseKeepingSymbols(expected);
  // Most answers contain no punctuation at all, and carrying a second identical
  // fingerprint on every one of them would be bytes that say nothing.
  if (symbols === key) return { fp: fingerprint(key), len: key.length };
  return {
    fp: fingerprint(key),
    len: key.length,
    symFp: fingerprint(symbols),
    symLen: symbols.length,
  };
}

export type Verdict =
  | { readonly outcome: "pass"; readonly tier: 1 }
  | { readonly outcome: "fail"; readonly tier: 1 }
  | { readonly outcome: "undecided"; readonly tier: 1; readonly reason: string };

export function gradeDeterministically(learnerAnswer: string, key: AnswerKey | undefined): Verdict {
  if (!key) {
    return { outcome: "undecided", tier: 1, reason: "这道题没有参考答案，只能交给上一层判。" };
  }
  if (normaliseKeepingSymbols(learnerAnswer).length === 0) {
    return { outcome: "undecided", tier: 1, reason: "先写下你的判断，再提交。" };
  }

  // Two readings of the same answer: one with punctuation gone, one with it
  // kept. An exercise is prose or it is syntax, and the key cannot say which,
  // so whichever reading matches is the one that was meant.
  const attempts: readonly {
    readonly answer: string;
    readonly fp: string;
    readonly len: number;
  }[] = [
    { answer: normalise(learnerAnswer), fp: key.fp, len: key.len },
    ...(key.symFp !== undefined && key.symLen !== undefined
      ? [
          {
            answer: normaliseKeepingSymbols(learnerAnswer),
            fp: key.symFp,
            len: key.symLen,
          },
        ]
      : []),
  ];

  // A key of length zero fingerprints to a value the window scan below finds at
  // every position, which would pass any answer at all. It means the expected
  // answer normalised away to nothing, so this reading of it decides nothing.
  const usable = attempts.filter((attempt) => attempt.len > 0);
  if (usable.length === 0) {
    return {
      outcome: "undecided",
      tier: 1,
      reason: "这道题的参考答案无法比对，只能交给上一层判。",
    };
  }

  for (const { answer, fp, len } of usable) {
    if (answer.length === len && fingerprint(answer) === fp) {
      return { outcome: "pass", tier: 1 };
    }
  }

  const factual = usable.filter((attempt) => attempt.len <= FACTUAL_LENGTH);
  if (factual.length > 0) {
    // A single fact, wrapped in a sentence, is still that fact. Without the
    // answer in hand this cannot be `includes`, so it slides a window of the
    // key's length and fingerprints each position — the same result, and cheap,
    // because it only runs for keys of twelve characters or fewer.
    for (const { answer, fp, len } of factual) {
      for (let start = 0; start + len <= answer.length; start += 1) {
        if (fingerprint(answer.slice(start, start + len)) === fp) {
          return { outcome: "pass", tier: 1 };
        }
      }
    }
    return { outcome: "fail", tier: 1 };
  }

  return {
    outcome: "undecided",
    tier: 1,
    reason: "参考答案是一句话，不是一个词——第 1 层判不了语义，要升到第 2 层。",
  };
}

/** How much of a library tier one can actually settle, computed, not claimed. */
export function coverage(keys: readonly (AnswerKey | undefined)[]) {
  const total = keys.length;
  const decidable = keys.filter(
    (key) =>
      key !== undefined && decidableLength(key) > 0 && decidableLength(key) <= FACTUAL_LENGTH,
  ).length;
  return { total, decidable, share: total === 0 ? 0 : decidable / total };
}

/** The length tier one actually compares against: the longer usable reading. */
function decidableLength(key: AnswerKey): number {
  return Math.max(key.len, key.symLen ?? 0);
}
