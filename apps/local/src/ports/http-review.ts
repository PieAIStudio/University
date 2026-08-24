import type { ProgressPort } from "@pieai/university-core";
import type { LexiconEntry } from "@pieai/university-core/domain/schemas.js";
import type {
  ReviewCardPort,
  VocabularyDueWord,
  VocabularyReviewPort,
} from "@pieai/university-ui/review/ports.js";
import type { PriorAttempt, ReviewCardLocator } from "@pieai/university-ui/view/lesson-view.js";
import { cardContentPath, readJson } from "@pieai/university-ui/api/client.js";
import lexiconFile from "../../data/vocabulary/en.json";

const LEXICON = lexiconFile.entries as readonly LexiconEntry[];

/** Local content access plus the same cloud scheduler as the online shell. */
export function createHttpReviewPort(progress: ProgressPort): ReviewCardPort {
  return {
    async reveal(card, input) {
      if (card.kind !== "course-card") throw new Error("本地端暂不支持这类复习卡");
      const content = await readJson<{
        readonly back: string;
        readonly contentRevision: number;
      }>(await fetch(cardContentPath(card)));
      if (content.contentRevision !== card.contentRevision) {
        throw new Error("复习卡内容已更新，请重新加载");
      }
      const cardKey = cardKeyOf(card);
      const priorAttempts = progress
        .retrievalAttempts(cardKey)
        .slice(0, 3)
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
      return { back: content.back, priorAttempts };
    },

    async rate(card, rating) {
      if (card.kind !== "course-card") throw new Error("本地端暂不支持这类复习卡");
      const cardKey = cardKeyOf(card);
      progress.gradeCard(cardKey, RATINGS[rating - 1]!);
      const dueAt = progress.snapshot().cards[cardKey]?.dueAt;
      if (dueAt === undefined) throw new Error("复习结果没有写入云端缓存");
      return { dueAt: new Date(dueAt).toISOString() };
    },
  };
}

export function createLocalVocabularyReviewPort(progress: ProgressPort): VocabularyReviewPort {
  const entries = new Map(LEXICON.map((entry) => [entry.senseId, entry]));
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

const RATINGS = ["again", "hard", "good", "easy"] as const;

function cardKeyOf(card: Extract<ReviewCardLocator, { readonly kind: "course-card" }>): string {
  return `${card.studyId}/${card.courseId}/${card.lessonId}/${card.cardId}`;
}
