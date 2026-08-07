import type { LanguageAnchor } from "../../src/domain/schemas.js";
import {
  adaptiveTargetCount,
  detectAnchors,
  type DetectionReason,
  type VocabularyStage as DetectStage,
} from "./detect.js";
import { loadLexicon } from "./lexicon.js";
import { readLessonLanguageLayer, type LanguageCode, type OverlayStatus } from "./overlay.js";
import { resolveAnchors } from "./resolve-anchors.js";
import type { VocabularyStage, VocabularyState } from "./vocabulary-store.js";

/**
 * Composes the foreign-language layer a lesson is served with.
 *
 * Two sources, in a deliberate order. A hand-authored overlay is curated — a
 * person chose that word in that sentence — so it goes first and always
 * survives. Detection then fills the rest of the learner's budget, which is
 * what makes coverage a property of the system rather than of whether anyone
 * got around to annotating this particular lesson.
 */

export interface ComposedLanguageLayer {
  readonly status: OverlayStatus;
  readonly ranges: readonly {
    readonly start: number;
    readonly end: number;
    readonly senseId: string;
  }[];
  readonly senseIds: readonly string[];
  /** senseId → why it is on the page, so the sidebar can rank and the body can dim. */
  readonly reasons: Readonly<Record<string, DetectionReason>>;
}

/**
 * The store tracks five stages; the detector only needs to know three things.
 *
 * `candidate` means presented but never judged — the learner has not said
 * anything, so it is still new to them in the only sense that matters here.
 * `stable` means retired by review, which for placement purposes is `familiar`:
 * still allowed on the page, still dimmed, never taking a slot from a word the
 * learner has not met.
 */
function toDetectStage(stage: VocabularyStage): DetectStage | null {
  switch (stage) {
    case "paused":
      return "paused";
    case "learning":
      return "learning";
    case "familiar":
    case "stable":
      return "familiar";
    case "candidate":
      return null;
  }
}

export function composeLanguageLayer(input: {
  readonly studiesRoot: string;
  readonly studyId: string;
  readonly language: LanguageCode;
  readonly courseId: string;
  readonly unitId: string;
  readonly lessonId: string;
  readonly contentRevision: number;
  readonly content: string;
  readonly vocabulary: readonly VocabularyState[];
}): ComposedLanguageLayer {
  const stages = new Map<string, DetectStage>();
  let familiarCount = 0;
  for (const state of input.vocabulary) {
    const mapped = toDetectStage(state.stage);
    if (mapped) stages.set(state.senseId, mapped);
    if (state.stage === "familiar" || state.stage === "stable") familiarCount += 1;
  }

  const authored = readLessonLanguageLayer(input);
  // A stale overlay was written against different bytes, so its positions mean
  // nothing. Detection does not have that problem — it reads the text in front
  // of it — so a revised lesson degrades to a derived layer instead of none.
  const authoredAnchors: LanguageAnchor[] =
    authored.status === "annotated"
      ? authored.ranges
          .filter((range) => stages.get(range.senseId) !== "paused")
          .map((range) => ({
            quote: input.content.slice(range.start, range.end),
            occurrence: occurrenceAt(
              input.content,
              input.content.slice(range.start, range.end),
              range.start,
            ),
            senseId: range.senseId,
          }))
      : [];

  const target = adaptiveTargetCount(familiarCount);
  const covered = new Set(authoredAnchors.map((anchor) => anchor.senseId));
  // Only words that still ask for attention count against the budget. A word
  // the learner has retired is rendered dimmed and costs them nothing, so
  // letting it occupy a slot would spend a beginner's whole allowance on words
  // they already told us they know — which is what an authored overlay full of
  // familiar words was doing.
  const authoredCost = authoredAnchors.filter(
    (anchor) => stages.get(anchor.senseId) !== "familiar",
  ).length;
  const remaining = Math.max(target - authoredCost, 0);

  const detected = remaining
    ? detectAnchors(
        input.content,
        [...loadLexicon().values()].filter((entry) => !covered.has(entry.senseId)),
        { stages, targetCount: remaining },
      )
    : [];

  const reasons: Record<string, DetectionReason> = {};
  for (const anchor of authoredAnchors) {
    const stage = stages.get(anchor.senseId);
    reasons[anchor.senseId] =
      stage === "familiar" ? "familiar" : stage === "learning" ? "learning" : "new";
  }
  for (const item of detected) reasons[item.anchor.senseId] = item.reason;

  // One resolve for the combined list. Anchors that would overlap are dropped
  // here rather than merged, which keeps the invariant the renderer relies on:
  // no character belongs to two senses.
  const { resolved } = resolveAnchors(input.content, [
    ...authoredAnchors,
    ...detected.map((item) => item.anchor),
  ]);

  const ranges = resolved.map((item) => ({
    start: item.start,
    end: item.end,
    senseId: item.anchor.senseId,
  }));
  const senseIds = [...new Set(ranges.map((range) => range.senseId))];

  return {
    // "annotated" now means "has a layer", which after this change is every
    // lesson that contains a word the lexicon knows.
    status: ranges.length > 0 ? "annotated" : "not-annotated",
    ranges,
    senseIds,
    reasons: Object.fromEntries(senseIds.map((id) => [id, reasons[id] ?? "new"])),
  };
}

function occurrenceAt(content: string, quote: string, start: number): number {
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
