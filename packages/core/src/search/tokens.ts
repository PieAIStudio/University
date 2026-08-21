/**
 * How a query becomes something three collections can match against.
 *
 * The problem this exists to fix is specific and was measured rather than
 * guessed. Every search here used to be "does the whole query appear verbatim
 * in some field", which works when a learner types 「回滚」 and fails the moment
 * they type the sentence they would actually say. 「怎么退回上一版」 returned
 * 「搜索」; 「第一次打开特别慢」 returned nothing at all. For a catalogue whose
 * entire entry point is "describe the symptom", that is the feature not working.
 *
 * Chinese has no spaces, so tokenising it is real work — and the platform
 * already does it. `Intl.Segmenter` is ICU, shipped inside every current engine
 * and Node, with no dependency to add and no dictionary to keep updated. It
 * segments 「怎么退回上一版」 to 怎么 / 退回 / 上 / 一 / 版, which is what makes
 * a partial match possible at all.
 *
 * The fallback is character bigrams. It is worse and it is never reached on a
 * supported runtime; it exists so that an old engine degrades to the old
 * behaviour rather than to an exception during a search.
 */

const SEGMENTER: Intl.Segmenter | undefined = (() => {
  try {
    return new Intl.Segmenter("zh-Hans", { granularity: "word" });
  } catch {
    return undefined;
  }
})();

function bigrams(value: string): string[] {
  if (value.length <= 2) return value.length > 0 ? [value] : [];
  const out: string[] = [];
  for (let index = 0; index + 2 <= value.length; index += 1) {
    out.push(value.slice(index, index + 2));
  }
  return out;
}

/** Lowercased so Latin matches case-insensitively; Chinese has no case. */
export function foldSearchText(value: string): string {
  return value.toLowerCase();
}

export function tokenize(text: string): readonly string[] {
  const folded = foldSearchText(text.trim());
  if (folded === "") return [];
  if (!SEGMENTER) return bigrams(folded);
  return [...SEGMENTER.segment(folded)]
    .filter((piece) => piece.isWordLike === true)
    .map((piece) => piece.segment.trim())
    .filter((piece) => piece.length > 0);
}

/**
 * Longer tokens count for more, capped at four characters.
 *
 * Without this, 「怎么退回上一版」 is five tokens of which 上, 一 and 版 are
 * nearly contentless, and an entry matching only those three would outrank one
 * matching 退回. Length is a crude stand-in for how much a token narrows the
 * field, and it is the one signal available without a corpus: a query is a
 * handful of words typed once, so there is nothing to compute a real frequency
 * weighting from.
 */
function weightOf(token: string): number {
  return Math.min(token.length, 4);
}

/**
 * How much of the query this text accounts for, from 0 to 1.
 *
 * Tokens are matched as substrings rather than as whole words, because the
 * segmenter splits the *query* but the indexed text is matched raw — 退回
 * should hit 「先退回上一版」 without the field needing to be segmented the same
 * way. Segmenting both sides would be stricter, slower, and would fail on the
 * boundary disagreements that segmenters routinely have with themselves.
 */
function scoreTokens(tokens: readonly string[], text: string): number {
  if (tokens.length === 0) return 0;
  let total = 0;
  let matched = 0;
  for (const token of tokens) {
    const weight = weightOf(token);
    total += weight;
    if (text.includes(token)) matched += weight;
  }
  return total === 0 ? 0 : matched / total;
}

/**
 * How much of the query has to land before a result is worth showing.
 *
 * Tuned against real queries rather than chosen for roundness. Below about
 * half, 「第一次打开特别慢」 starts returning every entry containing 打开; above
 * about three quarters it stops returning 「回滚」 for 「怎么退回上一版」, which
 * is the exact query the threshold exists to serve.
 */
export const MATCH_THRESHOLD = 0.6;

/**
 * A field and how much a match in it is worth.
 *
 * Without weights this ranking collapses, and the way it collapses is worth
 * recording. The body of an entry is thousands of characters, so almost any
 * short token appears somewhere in it, and an unweighted "best field wins"
 * returned 248 of 281 entries for 「回到上一个能用的版本」 — technically
 * matches, uselessly ranked.
 *
 * The weights are not a tuning knob so much as a statement of what the fields
 * are for. `colloquial` exists to hold the sentence a beginner would say, so a
 * symptom query landing there is the search working as designed. The body is a
 * fallback for "I remember the entry mentioned this", and at 0.7 a body-only
 * hit has to account for around 86% of the query before it clears the bar —
 * which is roughly the difference between remembering a phrase and sharing a
 * common word.
 */
export interface WeightedField {
  readonly text: string;
  readonly weight: number;
}

/**
 * The best weighted score any one field achieves, not the average across them.
 *
 * A term whose colloquial line paraphrases the query should rank first even
 * though its other fields say nothing about it. Averaging would punish an entry
 * for being thorough.
 */
export function scoreFields(tokens: readonly string[], fields: readonly WeightedField[]): number {
  let best = 0;
  for (const field of fields) {
    const score = scoreTokens(tokens, field.text) * field.weight;
    if (score > best) best = score;
    if (best >= 1) return 1;
  }
  return best;
}
