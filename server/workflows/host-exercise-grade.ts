import { z } from "zod";

import { readLatestCard, readLatestExercise, readLatestLesson } from "../content/repository.js";
import type { SqliteLearningStore } from "../learning/sqlite-learning-store.js";
import {
  cardContentKey,
  exerciseContentKey,
  lessonContentKey,
  type ExerciseContentKey,
} from "../learning/types.js";

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

export interface HostExerciseRoute {
  readonly studyId: string;
  readonly courseId: string;
  readonly unitId: string;
  readonly lessonId: string;
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
    advanceLessonFromGradable(input.store, input.studiesRoot, input.route, lesson, lessonKey);
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

function isLessonComplete(
  store: SqliteLearningStore,
  studiesRoot: string,
  route: HostExerciseRoute,
  lesson: { readonly exerciseIds: readonly string[] },
): boolean {
  if (lesson.exerciseIds.length === 0) return false;
  return lesson.exerciseIds.every((exerciseId) => {
    const exercise = readLatestExercise(
      studiesRoot,
      route.studyId,
      route.courseId,
      route.unitId,
      route.lessonId,
      exerciseId,
    );
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
}

function advanceLessonFromGradable(
  store: SqliteLearningStore,
  studiesRoot: string,
  route: HostExerciseRoute,
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
  const lessonComplete = gradableKeys.length > 0 && solved === gradableKeys.length;
  const previous = store.getLessonProgress(lessonKey);
  if (previous?.contentRevision !== lesson.contentRevision || previous.status !== "completed") {
    store.recordLessonProgress({
      lessonKey,
      contentRevision: lesson.contentRevision,
      status: lessonComplete ? "completed" : "in-progress",
      progress: lessonComplete
        ? 1
        : Math.max(solved / Math.max(gradableKeys.length, 1), ATTEMPTED_LESSON_PROGRESS),
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
