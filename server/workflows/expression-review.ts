import { readLatestExercise, readLatestLesson } from "../content/repository.js";
import { SqliteLearningStore } from "../learning/sqlite-learning-store.js";
import { parseExerciseContentKey } from "../learning/types.js";
import { getStudyPaths } from "../studies/paths.js";
import {
  buildExpressionCoachingPacket,
  EXPRESSION_PACKET_SAMPLE_LIMIT,
  type ExpressionPacketSample,
} from "./expression-coaching-packet.js";

export interface ExpressionReviewInput {
  readonly studiesRoot: string;
  readonly studyId: string;
  readonly limit?: number;
  readonly goal?: string;
}

export interface ExpressionReviewReceipt {
  readonly schemaVersion: 1;
  readonly operation: "express-review";
  readonly studyId: string;
  readonly sampleCount: number;
  readonly packet: string;
}

/**
 * Gathers the learner's most recent writing and turns it into one coaching
 * brief.
 *
 * The lesson title and prompt are looked up per sample so the coach can see the
 * question the answer was written for — an answer judged without knowing what
 * was asked invites advice about a piece of writing that never existed. A
 * lookup that fails is not fatal: content can be retired or revised after the
 * fact, and losing a title is not a reason to lose the sample.
 *
 * Takes the store as an argument because the HTTP server already holds one
 * open, with its own file-identity checks; opening a second connection behind
 * its back is how the restore bug this codebase already fixed once happened.
 */
export function buildExpressionReview(
  store: SqliteLearningStore,
  input: ExpressionReviewInput,
): ExpressionReviewReceipt {
  {
    const limit = Math.max(1, Math.min(input.limit ?? 3, EXPRESSION_PACKET_SAMPLE_LIMIT));
    const samples: ExpressionPacketSample[] = store
      .listRecentWrittenAttempts(limit)
      .map((attempt) => {
        const route = parseExerciseContentKey(attempt.exerciseKey);
        let lessonTitle: string | null = null;
        let prompt: string | null = null;
        try {
          lessonTitle = readLatestLesson(
            input.studiesRoot,
            input.studyId,
            route.courseId,
            route.unitId,
            route.lessonId,
          ).manifest.title;
          prompt = readLatestExercise(
            input.studiesRoot,
            input.studyId,
            route.courseId,
            route.unitId,
            route.lessonId,
            route.exerciseId,
          ).prompt;
        } catch {
          // Retired or revised content: the learner's words are still theirs.
        }
        return { attempt, lessonTitle, prompt };
      });

    return {
      schemaVersion: 1,
      operation: "express-review",
      studyId: input.studyId,
      sampleCount: samples.length,
      packet: buildExpressionCoachingPacket({
        studyId: input.studyId,
        samples,
        goal: input.goal ?? null,
      }),
    };
  }
}

/** CLI entry: owns the store lifetime that the HTTP server manages itself. */
export function reviewExpression(input: ExpressionReviewInput): ExpressionReviewReceipt {
  const store = new SqliteLearningStore(
    getStudyPaths(input.studiesRoot, input.studyId).learner.database,
  );
  try {
    return buildExpressionReview(store, input);
  } finally {
    store.close();
  }
}
