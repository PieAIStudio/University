import type { LanguageAnchor, LexiconEntry } from "../../src/domain/schemas.js";
import { findProtectedRegions, type Region } from "./resolve-anchors.js";

/**
 * Finds the foreign-language words a lesson can teach, from the lesson itself.
 *
 * The layer used to be hand-authored per lesson revision, which made coverage
 * accidental: a lesson whose prose says "file", "load" and "open" showed those
 * three only because somebody typed three anchors, and the lesson next to it
 * showed nothing. Deriving the anchors from the text means every lesson has a
 * layer, and rewriting a lesson cannot leave its layer behind.
 *
 * Nothing here is English-specific beyond the suffix table. The lexicon carries
 * the language; this file carries the policy of *which* entries are worth a
 * learner's attention today.
 */

export type VocabularyStage = "learning" | "familiar" | "paused";

/** Why a word was surfaced. The UI styles `familiar` more quietly. */
export type DetectionReason = "new" | "learning" | "familiar";

interface DetectedAnchor {
  readonly anchor: LanguageAnchor;
  readonly reason: DetectionReason;
}

interface DetectOptions {
  /** senseId → what the learner has said about it. Absent means never seen. */
  readonly stages: ReadonlyMap<string, VocabularyStage>;
  /** How many senses to surface. See `adaptiveTargetCount`. */
  readonly targetCount: number;
}

/**
 * Inflections a headword is allowed to appear as.
 *
 * Deliberately a short, readable table rather than a stemmer. A real stemmer
 * (Porter and friends) is built to collapse a corpus for search, where being
 * wrong on one word in fifty costs nothing. Here a wrong match puts a gloss
 * under a word it does not define, inside teaching material — so this errs
 * toward missing a form rather than inventing one, and every rule is one a
 * reader can check by eye.
 *
 * Each entry turns a headword into the extra surface forms to look for.
 */
const INFLECTION_RULES: readonly ((headword: string) => readonly string[])[] = [
  // run → runs, watch → watches, try → tries
  (word) => {
    if (/(?:s|sh|ch|x|z)$/.test(word)) return [`${word}es`];
    if (/[^aeiou]y$/.test(word)) return [`${word.slice(0, -1)}ies`];
    return [`${word}s`];
  },
  // load → loaded, use → used, carry → carried, stop → stopped
  (word) => {
    if (word.endsWith("e")) return [`${word}d`];
    if (/[^aeiou]y$/.test(word)) return [`${word.slice(0, -1)}ied`];
    if (isShortDoubling(word)) return [`${word + word.at(-1)!}ed`, `${word}ed`];
    return [`${word}ed`];
  },
  // load → loading, use → using, run → running
  (word) => {
    if (word.endsWith("e") && !word.endsWith("ee")) return [`${word.slice(0, -1)}ing`];
    if (isShortDoubling(word)) return [`${word + word.at(-1)!}ing`, `${word}ing`];
    return [`${word}ing`];
  },
];

/**
 * Consonant-doubling shape: one syllable, ending consonant-vowel-consonant.
 *
 * `run` → `running` but `open` → `opening`. Approximate on purpose — the cost
 * of guessing wrong is one form that never matches, not a wrong gloss.
 */
function isShortDoubling(word: string): boolean {
  return word.length <= 4 && /[^aeiou][aeiou][^aeiouwxy]$/.test(word);
}

/** Every spelling that should point at this sense, longest first. */
function surfaceForms(headword: string): readonly string[] {
  const base = headword.toLowerCase();
  // Multi-word headwords ("pull request") have no inflections worth guessing.
  const forms = base.includes(" ")
    ? [base]
    : [base, ...INFLECTION_RULES.flatMap((rule) => rule(base))];
  return [...new Set(forms)].sort((left, right) => right.length - left.length);
}

function overlaps(region: Region, candidate: Region): boolean {
  return candidate.start < region.end && region.start < candidate.end;
}

/** Whole-word only: `file` must not be found inside `profile`. */
function isWordBoundary(content: string, start: number, end: number): boolean {
  const before = content[start - 1];
  const after = content[end];
  return (
    !(before !== undefined && /[A-Za-z]/.test(before)) &&
    !(after !== undefined && /[A-Za-z]/.test(after))
  );
}

interface Candidate {
  readonly senseId: string;
  readonly start: number;
  readonly end: number;
  readonly quote: string;
  readonly reason: DetectionReason;
}

const REASON_ORDER: Record<DetectionReason, number> = { new: 0, learning: 1, familiar: 2 };

/**
 * The anchors to render for one lesson.
 *
 * Pure: no filesystem, no clock. Everything that varies — the learner's stages,
 * how many words they can take — arrives as an argument, so the policy is
 * testable without a database.
 */
export function detectAnchors(
  content: string,
  lexicon: readonly LexiconEntry[],
  options: DetectOptions,
): readonly DetectedAnchor[] {
  const protectedRegions = findProtectedRegions(content);
  const lowered = content.toLowerCase();
  const candidates: Candidate[] = [];

  for (const entry of lexicon) {
    const stage = options.stages.get(entry.senseId);
    // The learner said "not this one". Honouring that is the only thing that
    // makes the button worth pressing.
    if (stage === "paused") continue;
    const reason: DetectionReason =
      stage === "familiar" ? "familiar" : stage === "learning" ? "learning" : "new";

    const hit = firstOccurrence(content, lowered, entry.headword, protectedRegions);
    if (hit) candidates.push({ senseId: entry.senseId, ...hit, reason });
  }

  // Two senses can want the same characters — `commit` in Git and `commit` in a
  // database share a spelling. First past the ranking keeps the position.
  const ranked = candidates.toSorted(
    (left, right) =>
      REASON_ORDER[left.reason] - REASON_ORDER[right.reason] || left.start - right.start,
  );

  const claimed: Region[] = [];
  const chosen: Candidate[] = [];
  for (const candidate of ranked) {
    if (chosen.length >= options.targetCount) break;
    if (claimed.some((region) => overlaps(region, candidate))) continue;
    claimed.push({ start: candidate.start, end: candidate.end });
    chosen.push(candidate);
  }

  // Back into reading order, so the sidebar list matches the page.
  return chosen
    .toSorted((left, right) => left.start - right.start)
    .map((candidate) => ({
      anchor: {
        quote: candidate.quote,
        // Always the first prose occurrence of that exact spelling, so the
        // anchor survives a round trip through `resolveAnchors`.
        occurrence: occurrenceIndexOf(content, candidate.quote, candidate.start),
        senseId: candidate.senseId,
      },
      reason: candidate.reason,
    }));
}

/** First prose hit of any surface form, or nothing. */
function firstOccurrence(
  content: string,
  lowered: string,
  headword: string,
  protectedRegions: readonly Region[],
): { readonly start: number; readonly end: number; readonly quote: string } | null {
  let best: { start: number; end: number; quote: string } | null = null;
  for (const form of surfaceForms(headword)) {
    let from = 0;
    for (;;) {
      const index = lowered.indexOf(form, from);
      if (index < 0) break;
      const end = index + form.length;
      from = index + 1;
      if (!isWordBoundary(content, index, end)) continue;
      if (protectedRegions.some((region) => overlaps(region, { start: index, end }))) continue;
      if (!best || index < best.start) {
        // The quote is sliced from the source, never from the lexicon: the
        // resolver searches for it literally, so a case-normalised quote would
        // simply fail to resolve.
        best = { start: index, end, quote: content.slice(index, end) };
      }
      break;
    }
  }
  return best;
}

/** Which occurrence of `quote` sits at `start` — 1-based, as the schema wants. */
function occurrenceIndexOf(content: string, quote: string, start: number): number {
  let count = 0;
  let from = 0;
  for (;;) {
    const index = content.indexOf(quote, from);
    if (index < 0 || index > start) break;
    count += 1;
    if (index === start) break;
    from = index + 1;
  }
  return Math.max(count, 1);
}

/**
 * How many words to surface, given how many the learner has already retired.
 *
 * The shape matters more than the numbers. Starting high is the failure mode
 * that matters: a page with twenty unknown words is not a lesson with
 * vocabulary support, it is a page the learner cannot read, and the words are
 * what they will drop first. Comprehensible-input teaching puts the useful
 * zone just past current ability, which at zero known words is very few.
 *
 * It saturates because attention does. Past a dozen glossed words on one page
 * the learner is not learning more of them, they are skimming all of them.
 */
const TARGET_STEPS: readonly (readonly [familiarAtLeast: number, target: number])[] = [
  [0, 3],
  [10, 5],
  [30, 7],
  [60, 9],
  [100, 11],
  [160, 12],
];

export function adaptiveTargetCount(familiarCount: number): number {
  let target = TARGET_STEPS[0]![1];
  for (const [threshold, value] of TARGET_STEPS) {
    if (familiarCount >= threshold) target = value;
  }
  return target;
}
