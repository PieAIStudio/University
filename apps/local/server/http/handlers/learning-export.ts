import { serializeCardState } from "../../learning/rows.js";
import { inspectStudyShelf } from "../../studies/repository.js";
import type { Handler } from "./types.js";
import { sendJson } from "../wire.js";

/**
 * Read-only bridge for old authoring learner databases.
 *
 * Course/source files remain local by design. Learner state does not: this
 * endpoint lets the browser move the existing SQLite projection into the
 * shared ProgressDocument once, after which the browser document is canonical.
 */
export const handleLearningExport: Handler = (ctx, request, response, url) => {
  if (url.pathname !== "/api/learning/export") return false;
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" });
    return true;
  }

  const studies = inspectStudyShelf(ctx.studiesRoot)
    .studies.filter((study) => study.status === "active")
    .flatMap((study) => {
      const store = ctx.getStore(study.id);
      if (!store) return [];
      const cards = store.listCards().map((card) => ({
        studyId: study.id,
        ...serializeCardState(card),
      }));
      return [
        {
          studyId: study.id,
          lessons: store.listLessonProgress().map((lesson) => ({
            lessonKey: lesson.lessonKey,
            contentRevision: lesson.contentRevision,
            status: lesson.status,
            progress: lesson.progress,
            updatedAt: lesson.updatedAt.toISOString(),
            readConfirmed: store.hasLessonCompletion(lesson.lessonKey, lesson.contentRevision),
          })),
          cards,
          exercises: store.listExerciseAttempts().map((attempt) => ({
            attemptId: attempt.attemptId,
            commandId: attempt.commandId,
            exerciseKey: attempt.exerciseKey,
            contentRevision: attempt.contentRevision,
            score: attempt.score,
            maxScore: attempt.maxScore,
            response: attempt.response,
            occurredAt: attempt.occurredAt.toISOString(),
          })),
          retrievalAttempts: store.listCards().flatMap((card) =>
            store.listRetrievalAttempts(card.cardKey, 1_000).map((attempt) => ({
              commandId: attempt.commandId,
              cardKey: `${study.id}/${attempt.cardKey}`,
              contentRevision: attempt.contentRevision,
              answer: attempt.answer,
              revealedAt: attempt.revealedAt.toISOString(),
              durationMs: attempt.durationMs,
              usedHint: attempt.usedHint,
              ...(attempt.confidence === undefined ? {} : { confidence: attempt.confidence }),
            })),
          ),
          readerMarks: store.listReaderMarks({ includeResolved: true, limit: 1_000 }),
        },
      ];
    });

  sendJson(response, 200, {
    studies,
    vocabulary: ctx.peekVocabularyStates(),
  });
  return true;
};
