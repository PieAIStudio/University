import { z } from "zod";
import { createHash } from "node:crypto";
import { DETERMINISTIC_GRADER_HOST } from "@pieai/university-core";

import { StableId } from "@pieai/university-core/domain/schemas.js";
import {
  requireActiveExercise,
  requireActiveLesson,
  runWithCommandConflictMapped,
} from "../content-access.js";
import { HttpError } from "../errors.js";
import { ExerciseAttemptSchema } from "../request-schemas.js";
import { parseRoute } from "../routes.js";
import { buildCoachingPacketResponse, buildExerciseView } from "../views.js";
import { readJsonBody, requireMutationAccess, sendJson } from "../wire.js";
import { exerciseContentKey, lessonContentKey } from "../../learning/types.js";
import {
  advanceLessonProgress,
  applyHostExerciseGrade,
} from "../../workflows/host-exercise-grade.js";
import { buildExpressionReview } from "../../workflows/expression-review.js";
import type { Handler } from "./types.js";

/**
 * Exercise attempt, host-grade, retired rubric, coaching packet, expression
 * packet. Rubric stays as a clear 410 so old clients do not hang.
 */
export const handleExercise: Handler = async (ctx, request, response, url) => {
  const exerciseContentRoute = parseRoute(
    url.pathname,
    /^\/api\/studies\/([^/]+)\/courses\/([^/]+)\/units\/([^/]+)\/lessons\/([^/]+)\/exercises\/([^/]+)$/,
  );
  if (request.method === "GET" && exerciseContentRoute) {
    sendJson(response, 200, buildExerciseView(ctx.studiesRoot, exerciseContentRoute));
    return true;
  }

  const exerciseRoute = parseRoute(
    url.pathname,
    /^\/api\/studies\/([^/]+)\/courses\/([^/]+)\/units\/([^/]+)\/lessons\/([^/]+)\/exercises\/([^/]+)\/attempt$/,
  );
  if (request.method === "POST" && exerciseRoute) {
    requireMutationAccess(request, ctx.requestToken);
    const body = ExerciseAttemptSchema.parse(await readJsonBody(request));
    const exercise = requireActiveExercise(ctx.studiesRoot, exerciseRoute);
    if (exercise.contentRevision !== body.contentRevision) {
      throw new HttpError(409, "Exercise content revision changed; reload before submitting");
    }
    // Open answers keep the host-grade contract. A native choice uses its
    // stable option ID and the same persisted grade/confirmation pipeline.
    if (body.met !== undefined) {
      throw new HttpError(
        400,
        "Self-assessment is disabled; submit the answer and use host-grade write-back",
      );
    }
    const maxScore = 1;
    const score = 0;
    const choice = exercise.kind === "choice" ? exercise : null;
    const picked = choice?.options.find((option) => option.id === body.answer);
    if (choice && !picked) throw new HttpError(400, "Choose one of this exercise's option IDs");
    const awaitingHostGrade = choice === null;
    const correct = choice !== null && body.answer === choice.correctOptionId;
    // A namespaced deterministic UUID makes the server grade idempotent too.
    const digest = createHash("sha256")
      .update(`university-choice-grade:${body.commandId}`)
      .digest("hex");
    const gradeCommandId = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
    const store = ctx.getStore(exerciseRoute.studyId, true)!;
    const exerciseKey = exerciseContentKey({
      courseId: exerciseRoute.courseId,
      unitId: exerciseRoute.unitId,
      lessonId: exerciseRoute.lessonId,
      exerciseId: exercise.id,
    });
    const lesson = requireActiveLesson(ctx.studiesRoot, exerciseRoute).lesson;
    const lessonKey = lessonContentKey({
      courseId: exerciseRoute.courseId,
      unitId: exerciseRoute.unitId,
      lessonId: exerciseRoute.lessonId,
    });
    const attemptId = runWithCommandConflictMapped(
      "Command ID was already used for another exercise attempt",
      () =>
        store.transaction(() => {
          const recordedAttemptId = store.recordExerciseAttempt({
            commandId: body.commandId,
            exerciseKey,
            contentRevision: exercise.contentRevision,
            score,
            maxScore,
            response: { phase: "learner-submit", answer: body.answer },
          });
          if (choice && picked) {
            applyHostExerciseGrade({
              studiesRoot: ctx.studiesRoot,
              store,
              route: { ...exerciseRoute, exerciseId: exercise.id },
              proposal: {
                schemaVersion: 1,
                commandId: gradeCommandId,
                contentRevision: exercise.contentRevision,
                passed: correct,
                evaluation: picked.explanation,
                extensions: [],
                learnerAnswer: body.answer,
                host: DETERMINISTIC_GRADER_HOST,
              },
            });
          }
          // Same advancement the host-grade write-back runs. Two copies of
          // this drifted once already, and the drift made every failing
          // grade unrecordable.
          advanceLessonProgress(store, ctx.studiesRoot, exerciseRoute, lesson, lessonKey);
          return recordedAttemptId;
        }),
    );
    const attemptCount = choice
      ? store.countLearnerSubmissions(exerciseKey, exercise.contentRevision)
      : store.countExerciseAttempts(exerciseKey, exercise.contentRevision);
    const persistedChoice = choice ? store.getExerciseAttemptByCommandId(gradeCommandId) : null;
    const hostGrade =
      choice && picked && persistedChoice
        ? {
            passed: correct,
            evaluation: picked.explanation,
            extensions: [],
            host: DETERMINISTIC_GRADER_HOST,
            learnerAnswer: body.answer,
            occurredAt: persistedChoice.occurredAt,
          }
        : store.getLatestHostExerciseGrade(exerciseKey, exercise.contentRevision);
    sendJson(response, 200, {
      attemptId,
      correct,
      score: choice && correct ? 1 : score,
      maxScore,
      attemptCount,
      awaitingHostGrade,
      hostGrade: hostGrade
        ? {
            passed: hostGrade.passed,
            evaluation: hostGrade.evaluation,
            extensions: hostGrade.extensions,
            host: hostGrade.host,
            learnerAnswer: hostGrade.learnerAnswer,
            occurredAt: hostGrade.occurredAt.toISOString(),
          }
        : null,
    });
    return true;
  }

  const hostGradeRoute = parseRoute(
    url.pathname,
    /^\/api\/studies\/([^/]+)\/courses\/([^/]+)\/units\/([^/]+)\/lessons\/([^/]+)\/exercises\/([^/]+)\/host-grade$/,
  );
  if (request.method === "POST" && hostGradeRoute) {
    requireMutationAccess(request, ctx.requestToken);
    if (!hostGradeRoute.contentId) throw new HttpError(404, "Exercise ID is missing");
    const body = await readJsonBody(request);
    const store = ctx.getStore(hostGradeRoute.studyId, true)!;
    try {
      const result = runWithCommandConflictMapped(
        "Command ID was already used for another exercise attempt",
        () =>
          applyHostExerciseGrade({
            studiesRoot: ctx.studiesRoot,
            store,
            route: {
              studyId: hostGradeRoute.studyId,
              courseId: hostGradeRoute.courseId,
              unitId: hostGradeRoute.unitId,
              lessonId: hostGradeRoute.lessonId,
              exerciseId: hostGradeRoute.contentId!,
            },
            proposal: body,
          }),
      );
      sendJson(response, 200, {
        attemptId: result.attemptId,
        correct: result.passed,
        passed: result.passed,
        lessonComplete: result.lessonComplete,
        hostGrade: result.hostGrade,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new HttpError(400, error.issues.map((issue) => issue.message).join("; "));
      }
      throw new HttpError(409, error instanceof Error ? error.message : "Host grade failed");
    }
    return true;
  }

  // Rubric self-assessment retired: explain exercises use host-grade like
  // short-answer. Keep the route as a clear 410 so old clients do not hang.
  const exerciseRubricRoute = parseRoute(
    url.pathname,
    /^\/api\/studies\/([^/]+)\/courses\/([^/]+)\/units\/([^/]+)\/lessons\/([^/]+)\/exercises\/([^/]+)\/rubric$/,
  );
  if (request.method === "POST" && exerciseRubricRoute) {
    throw new HttpError(
      410,
      "Self-assessment rubric is retired; submit the answer and use host-grade write-back",
    );
  }

  const coachingPacketRoute = parseRoute(
    url.pathname,
    /^\/api\/studies\/([^/]+)\/courses\/([^/]+)\/units\/([^/]+)\/lessons\/([^/]+)\/exercises\/([^/]+)\/coaching-packet$/,
  );
  if (request.method === "GET" && coachingPacketRoute) {
    sendJson(
      response,
      200,
      buildCoachingPacketResponse(ctx.studiesRoot, coachingPacketRoute, ctx.getStore),
    );
    return true;
  }

  const expressionPacketRoute = /^\/api\/studies\/([^/]+)\/expression-packet$/.exec(url.pathname);
  if (request.method === "GET" && expressionPacketRoute) {
    const studyId = StableId.parse(decodeURIComponent(expressionPacketRoute[1]!));
    const store = ctx.getStore(studyId);
    if (!store) throw new HttpError(404, "Study has no learning data yet");
    const goal = url.searchParams.get("goal");
    try {
      const review = buildExpressionReview(store, {
        studiesRoot: ctx.studiesRoot,
        studyId,
        ...(goal ? { goal } : {}),
      });
      sendJson(response, 200, {
        packet: review.packet,
        sampleCount: review.sampleCount,
      });
    } catch (error) {
      // The one expected failure is an empty writing history, and it is the
      // learner's next step, not a server fault.
      throw new HttpError(409, error instanceof Error ? error.message : "No writing yet");
    }
    return true;
  }

  return false;
};
