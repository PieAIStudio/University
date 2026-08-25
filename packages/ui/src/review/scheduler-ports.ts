/**
 * The review ports, in one implementation for both campuses.
 *
 * There used to be four factories — `createHttpReviewPort`,
 * `createOnlineReviewPort`, `createLocalVocabularyReviewPort`,
 * `createOnlineVocabularyReviewPort` — and they looked like a real difference
 * between the campuses. They were not. Every one of them wrote to the same
 * cloud progress document with the same FSRS grades; the only shell-dependent
 * line in the whole set was *where the back of the card comes from*, which is
 * `ContentPort`. Two of the four were byte-for-byte the same function with a
 * different lexicon import — and the two lexicon files were the same 90 KB.
 */

import type { LexiconEntry, ProgressPort, RatingName } from "@pieai/university-core";

import type { ContentPort } from "../content/port.js";
import type { PriorAttempt, ReviewCardLocator } from "../view/lesson-view.js";
import type { ReviewCardPort, VocabularyDueWord, VocabularyReviewPort } from "./ports.js";

const RATINGS: readonly RatingName[] = ["again", "hard", "good", "easy"];

/** How many earlier answers a learner is shown beside the card. */
const PRIOR_ATTEMPTS_SHOWN = 3;

/**
 * A card nobody can serve yet.
 *
 * Neither campus schedules knowledge cards, and the message says what is true
 * rather than which half of the product is speaking — the two used to differ
 * only in the words 「本地端」 and 「在线端」, which told a learner nothing.
 */
const UNSUPPORTED_CARD = "这类复习卡还不能在这里复习";

export function createReviewCardPort(content: ContentPort, progress: ProgressPort): ReviewCardPort {
  return {
    async reveal(card: ReviewCardLocator, input) {
      if (card.kind !== "course-card") throw new Error(UNSUPPORTED_CARD);
      const body = await content.card(card);
      /*
        A card scheduled against an older revision is not this card. The
        authoring campus can edit a lesson under a learner mid-schedule, and
        answering the new back against the old front is worse than asking them
        to reload.
      */
      if (body.contentRevision !== card.contentRevision) {
        throw new Error("复习卡内容已更新，请重新加载");
      }
      const cardKey = cardKeyOf(card);
      const priorAttempts = progress
        .retrievalAttempts(cardKey)
        .slice(0, PRIOR_ATTEMPTS_SHOWN)
        .map(
          (attempt): PriorAttempt => ({
            answer: attempt.answer,
            revealedAt: attempt.revealedAt,
            contentRevision: attempt.contentRevision,
          }),
        );
      const startedAt = input.startedAt ? Date.parse(input.startedAt) : Date.now();
      progress.recordRetrievalAttempt({
        commandId: input.commandId,
        cardKey,
        contentRevision: card.contentRevision,
        answer: input.answer,
        revealedAt: new Date().toISOString(),
        durationMs: Math.max(0, Date.now() - (Number.isFinite(startedAt) ? startedAt : Date.now())),
        usedHint: false,
      });
      return { back: body.back, priorAttempts };
    },

    async rate(card, rating) {
      if (card.kind !== "course-card") throw new Error(UNSUPPORTED_CARD);
      const cardKey = cardKeyOf(card);
      progress.gradeCard(cardKey, RATINGS[rating - 1]!);
      const dueAt = progress.snapshot().cards[cardKey]?.dueAt;
      if (dueAt === undefined) throw new Error("复习结果没有写入云端缓存");
      return { dueAt: new Date(dueAt).toISOString() };
    },
  };
}

/**
 * Words that are due, from the same document the cards are in.
 *
 * The lexicon is injected rather than imported: it is 90 KB of data that
 * belongs to a build, not to this package.
 */
export function createVocabularyReviewPort(
  progress: ProgressPort,
  lexicon: readonly LexiconEntry[],
): VocabularyReviewPort {
  const entries = new Map(lexicon.map((entry) => [entry.senseId, entry]));
  return {
    async load() {
      const now = Date.now();
      const due: VocabularyDueWord[] = progress
        .vocabularyStates()
        .filter((state) => state.stage === "learning" && state.dueAt !== null)
        .filter((state) => Date.parse(state.dueAt!) <= now)
        .flatMap((state) => {
          const entry = entries.get(state.senseId);
          return entry ? [{ senseId: state.senseId, stage: state.stage, entry }] : [];
        });
      return { due, reviewedToday: 0 };
    },
    async rate(senseId, rating) {
      progress.gradeWord(senseId, RATINGS[rating - 1]!);
    },
  };
}

export function cardKeyOf(
  card: Extract<ReviewCardLocator, { readonly kind: "course-card" }>,
): string {
  return `${card.studyId}/${card.courseId}/${card.lessonId}/${card.cardId}`;
}
