import { z } from "zod";

import { readLatestCard, readLatestExercise, readLatestLesson } from "../content/repository.js";
import type { SqliteLearningStore } from "../learning/sqlite-learning-store.js";
import {
  cardContentKey,
  exerciseContentKey,
  lessonContentKey,
  type ExerciseContentKey,
} from "../learning/types.js";

/**
 * What an attempted-but-unsolved lesson shows, so a learner who has started
 * does not see a flat zero. It stays small on purpose: a lesson with four
 * exercises reads 0.25 once one is passed, and a floor that high would make
 * "typed something" look identical to "answered a quarter of it".
 *
 * There used to be a second copy of this number in the HTTP layer, at 0.25.
 * Submitting wrote 0.25, then a host grade of `passed: false` tried to write
 * 0.05, and the store correctly refused to move progress backward — so every
 * failing grade came back 409 and the learner got no feedback at all. One
 * constant and one advancement function is the fix; see `advanceLessonProgress`.
 */
const ATTEMPTED_LESSON_PROGRESS = 0.05;

export const HostExerciseGradeProposalSchema = z
  .object({
    schemaVersion: z.literal(1).default(1),
    commandId: z.string().uuid(),
    contentRevision: z.number().int().positive(),
    passed: z.boolean(),
    evaluation: z.string().min(1).max(20_000),
    extensions: z.array(z.string().min(1).max(2_000)).max(12).default([]),
    learnerAnswer: z.string().max(20_000).optional(),
    host: z.string().min(1).max(100).optional(),
    // Present in CLI packets so one JSON file carries the full route.
    courseId: z.string().min(2).max(64).optional(),
    unitId: z.string().min(2).max(64).optional(),
    lessonId: z.string().min(2).max(64).optional(),
    exerciseId: z.string().min(2).max(64).optional(),
  })
  .strict();

export type HostExerciseGradeProposal = z.infer<typeof HostExerciseGradeProposalSchema>;

/** CLI input: proposal fields plus required route IDs. */
export const HostExerciseGradeCliProposalSchema = z
  .object({
    schemaVersion: z.literal(1).default(1),
    commandId: z.string().uuid(),
    contentRevision: z.number().int().positive(),
    passed: z.boolean(),
    evaluation: z.string().min(1).max(20_000),
    extensions: z.array(z.string().min(1).max(2_000)).max(12).default([]),
    learnerAnswer: z.string().max(20_000).optional(),
    host: z.string().min(1).max(100).optional(),
    courseId: z.string().min(2).max(64),
    unitId: z.string().min(2).max(64),
    lessonId: z.string().min(2).max(64),
    exerciseId: z.string().min(2).max(64),
  })
  .strict();

interface LessonProgressRoute {
  readonly studyId: string;
  readonly courseId: string;
  readonly unitId: string;
  readonly lessonId: string;
}

interface HostExerciseRoute extends LessonProgressRoute {
  readonly exerciseId: string;
}

/**
 * Records an AI-host grade as a scored exercise attempt (phase host-grade) and
 * advances lesson completion / card enrollment. Short-answer learner submits
 * no longer set score=1 by string match.
 */
export function applyHostExerciseGrade(input: {
  readonly studiesRoot: string;
  readonly store: SqliteLearningStore;
  readonly route: HostExerciseRoute;
  readonly proposal: unknown;
}): {
  readonly attemptId: string;
  readonly passed: boolean;
  readonly lessonComplete: boolean;
  readonly hostGrade: {
    readonly evaluation: string;
    readonly extensions: readonly string[];
    readonly host: string | null;
  };
} {
  const proposal = HostExerciseGradeProposalSchema.parse(input.proposal);
  const exercise = readLatestExercise(
    input.studiesRoot,
    input.route.studyId,
    input.route.courseId,
    input.route.unitId,
    input.route.lessonId,
    input.route.exerciseId,
  );
  if (exercise.status !== "active") {
    throw new Error("Exercise is not active");
  }
  if (exercise.contentRevision !== proposal.contentRevision) {
    throw new Error("Exercise content revision changed; reload the packet before grading");
  }

  const exerciseKey = exerciseContentKey({
    courseId: input.route.courseId,
    unitId: input.route.unitId,
    lessonId: input.route.lessonId,
    exerciseId: input.route.exerciseId,
  });
  const lesson = readLatestLesson(
    input.studiesRoot,
    input.route.studyId,
    input.route.courseId,
    input.route.unitId,
    input.route.lessonId,
  ).manifest;
  if (lesson.status !== "active") {
    throw new Error("Lesson is not active");
  }
  const lessonKey = lessonContentKey({
    courseId: input.route.courseId,
    unitId: input.route.unitId,
    lessonId: input.route.lessonId,
  });

  const maxScore = 1;
  const score = proposal.passed ? 1 : 0;
  const response = {
    phase: "host-grade" as const,
    answer: proposal.learnerAnswer ?? "",
    evaluation: proposal.evaluation.trim(),
    extensions: proposal.extensions.map((item) => item.trim()).filter(Boolean),
    host: proposal.host?.trim() || null,
    passed: proposal.passed,
  };

  const attemptId = input.store.transaction(() => {
    const recorded = input.store.recordExerciseAttempt({
      commandId: proposal.commandId,
      exerciseKey,
      contentRevision: exercise.contentRevision,
      score,
      maxScore,
      response,
    });
    advanceLessonProgress(input.store, input.studiesRoot, input.route, lesson, lessonKey);
    return recorded;
  });

  const lessonComplete = isLessonComplete(input.store, input.studiesRoot, input.route, lesson);

  return {
    attemptId,
    passed: proposal.passed,
    lessonComplete,
    hostGrade: {
      evaluation: response.evaluation,
      extensions: response.extensions,
      host: response.host,
    },
  };
}

export function isLessonComplete(
  store: SqliteLearningStore,
  studiesRoot: string,
  route: LessonProgressRoute,
  lesson: { readonly exerciseIds: readonly string[]; readonly contentRevision: number },
): boolean {
  const allExercisesPassed = lesson.exerciseIds.every((exerciseId) => {
    const exercise = readLatestExercise(
      studiesRoot,
      route.studyId,
      route.courseId,
      route.unitId,
      route.lessonId,
      exerciseId,
    );
    if (exercise.status !== "active") return true;
    return store.hasCorrectExerciseAttempt(
      exerciseContentKey({
        courseId: route.courseId,
        unitId: route.unitId,
        lessonId: route.lessonId,
        exerciseId,
      }),
      exercise.contentRevision,
    );
  });
  return (
    allExercisesPassed &&
    store.hasLessonCompletion(
      lessonContentKey({
        courseId: route.courseId,
        unitId: route.unitId,
        lessonId: route.lessonId,
      }),
      lesson.contentRevision,
    )
  );
}

/**
 * Recomputes lesson progress from the attempt log and enrols the lesson's cards
 * once every exercise has been graded a pass.
 *
 * Both entry points — the learner submitting an answer and a host writing back
 * a verdict — go through here. When they had separate copies the two disagreed
 * about the unsolved floor, which made a failing grade unrecordable.
 */
export function advanceLessonProgress(
  store: SqliteLearningStore,
  studiesRoot: string,
  route: LessonProgressRoute,
  lesson: {
    readonly exerciseIds: readonly string[];
    readonly contentRevision: number;
    readonly cardIds: readonly string[];
  },
  lessonKey: ReturnType<typeof lessonContentKey>,
): void {
  const gradableKeys: Array<{ key: ExerciseContentKey; revision: number }> = [];
  for (const exerciseId of lesson.exerciseIds) {
    const exercise = readLatestExercise(
      studiesRoot,
      route.studyId,
      route.courseId,
      route.unitId,
      route.lessonId,
      exerciseId,
    );
    if (exercise.status !== "active") continue;
    gradableKeys.push({
      key: exerciseContentKey({
        courseId: route.courseId,
        unitId: route.unitId,
        lessonId: route.lessonId,
        exerciseId,
      }),
      revision: exercise.contentRevision,
    });
  }
  const solved = gradableKeys.filter((item) =>
    store.hasCorrectExerciseAttempt(item.key, item.revision),
  ).length;
  const exercisesComplete = solved === gradableKeys.length;
  const readConfirmed = store.hasLessonCompletion(lessonKey, lesson.contentRevision);
  const lessonComplete = exercisesComplete && readConfirmed;
  const previous = store.getLessonProgress(lessonKey);
  if (previous?.contentRevision !== lesson.contentRevision || previous.status !== "completed") {
    // Progress within one revision is monotonic by contract, and the store
    // enforces it. Honour that here rather than compute a value it will reject:
    // a failing grade after an earlier submission legitimately recomputes to
    // the same floor or lower, and refusing to record it would throw away the
    // one thing the learner came back for — the explanation.
    const earned = lessonComplete
      ? 1
      : Math.min(
          0.95,
          Math.max(solved / Math.max(gradableKeys.length, 1), ATTEMPTED_LESSON_PROGRESS),
        );
    const floor = previous?.contentRevision === lesson.contentRevision ? previous.progress : 0;
    store.recordLessonProgress({
      lessonKey,
      contentRevision: lesson.contentRevision,
      status: lessonComplete ? "completed" : "in-progress",
      progress: Math.max(earned, floor),
    });
  }
  if (!lessonComplete) return;
  for (const cardId of lesson.cardIds) {
    const card = readLatestCard(
      studiesRoot,
      route.studyId,
      route.courseId,
      route.unitId,
      route.lessonId,
      cardId,
    );
    if (card.status !== "active") continue;
    store.ensureCard(
      cardContentKey({
        courseId: route.courseId,
        unitId: route.unitId,
        lessonId: route.lessonId,
        cardId,
      }),
      card.contentRevision,
    );
  }
}
