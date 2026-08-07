import { existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Grade } from "ts-fsrs";
import { z } from "zod";

import { StableId } from "../src/domain/schemas.js";
import { loadUniversityLocalConfig } from "./config/load-config.js";
import { HttpError } from "./http/errors.js";
import {
  CardRevealSchema,
  CardReviewSchema,
  ExerciseAttemptSchema,
  VOCABULARY_DUE_LIMIT,
  VocabularyGradeSchema,
  VocabularyPresentedSchema,
  VocabularyStageSchema,
} from "./http/request-schemas.js";
import {
  parseEvidenceRoute,
  parseKnowledgeCardRoute,
  parseKnowledgeEvidenceRoute,
  parseRoute,
} from "./http/routes.js";
import {
  readJsonBody,
  rejectNonLoopbackHost,
  requireMutationAccess,
  sendJson,
} from "./http/wire.js";
import { createServerContext } from "./http/context.js";
import { buildCoachingPacketResponse, buildLessonView, buildStudyView } from "./http/views.js";
import { serializeProgress } from "./http/serialize.js";
import {
  countCourseManifests,
  countSnapshotManifests,
  countUaAnalyses,
  courseReviewableCard,
  knowledgeReviewableCard,
  listActiveCourses,
  requireActiveCard,
  requireActiveExercise,
  requireActiveLesson,
  revealReviewableCard,
  reviewReviewableCard,
  runWithCommandConflictMapped,
  type DueCard,
} from "./http/content-access.js";
import { readEvidenceSnippet } from "./content/evidence.js";
import { readCourse, readLatestLesson, readUnit } from "./content/repository.js";
import { readActiveKnowledgeCard, readLatestKnowledgeNote } from "./knowledge/repository.js";
import {
  exerciseContentKey,
  lessonContentKey,
  parseReviewContentKey,
  type StoredCardState,
} from "./learning/types.js";
import { selectLexicon } from "./language/lexicon.js";
import { readCourseClock } from "./airlock/course-clock.js";
import { inspectAirlock } from "./airlock/inspect.js";
import { getStudyPaths } from "./studies/paths.js";
import { inspectStudyShelf, readSourceRegistration, readStudy } from "./studies/repository.js";
import { advanceLessonProgress, applyHostExerciseGrade } from "./workflows/host-exercise-grade.js";
import { buildExpressionReview } from "./workflows/expression-review.js";

const DEFAULT_PORT = 4317;

function defaultProjectRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../..");
}

export function createUniversityLocalHttpServer(projectRoot: string): Server {
  const config = loadUniversityLocalConfig({ projectRoot });
  const context = createServerContext(config.studiesRoot);

  // Archived studies keep their data but leave the shelf; a superseded study
  // that still greets the learner every day is clutter wearing a title.
  for (const study of inspectStudyShelf(context.studiesRoot).studies.filter(
    (candidate) => candidate.status === "active",
  )) {
    if (existsSync(getStudyPaths(context.studiesRoot, study.id).learner.database)) {
      context.getStore(study.id);
    }
  }

  const server = createServer((request, response) => {
    void (async () => {
      if (rejectNonLoopbackHost(request, response)) return;
      const url = new URL(request.url ?? "/", "http://127.0.0.1");

      if (request.method === "GET" && url.pathname === "/api/health") {
        sendJson(response, 200, { status: "ok", service: "university-local" });
        return;
      }
      if (url.pathname === "/api/health" && request.method !== "GET") {
        sendJson(response, 405, { error: "Method not allowed" });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/bootstrap") {
        const shelf = inspectStudyShelf(context.studiesRoot);
        // Same rule as the store warm-up above: archived studies keep their
        // data and stay off the shelf.
        const studies = shelf.studies
          .filter((study) => study.status === "active")
          .map((study) => {
            const paths = getStudyPaths(context.studiesRoot, study.id);
            const ua = countUaAnalyses(paths.ua);
            let defaultCourse: { id: string; title: string; status: string } | null = null;
            if (study.defaultCourseId) {
              try {
                const course = readCourse(context.studiesRoot, study.id, study.defaultCourseId);
                defaultCourse = { id: course.id, title: course.title, status: course.status };
              } catch {
                defaultCourse = null;
              }
            }
            return {
              ...study,
              sourceRegistered: existsSync(paths.source.registration),
              snapshotCount: countSnapshotManifests(paths.source.snapshots),
              uaAnalysisCount: ua.total,
              readyUaAnalysisCount: ua.ready,
              courseCount: countCourseManifests(paths.courses),
              activeCourseCount: listActiveCourses(context.studiesRoot, study).length,
              defaultCourse,
              hasLearningDatabase: existsSync(paths.learner.database),
              // Derived from the events themselves rather than stored on open,
              // so it cannot drift from what the learner actually did. The
              // shelf needs it because a title-sorted list always opens on
              // whichever study sorts first, which is rarely the live one.
              lastActivityAt:
                context.getStore(study.id)?.getLastActivityAt()?.toISOString() ?? null,
            };
          });

        const dueCards: DueCard[] = [];
        let nextLesson: Record<string, unknown> | null = null;
        const learningIssues: string[] = [];
        // `nextLesson` is whatever incomplete lesson the walk meets first, so the
        // walk order is the curriculum order. Focus moves the chosen study and
        // course to the front rather than filtering the rest out: finishing the
        // focused study should roll on to the next one, not report nothing left.
        // Due cards are unaffected — they are sorted by due date afterwards.
        const focusedStudies = shelf.studies
          .filter((study) => study.status === "active")
          .sort((left, right) => {
            const rank = (id: string): number => (id === config.focus?.studyId ? 0 : 1);
            return rank(left.id) - rank(right.id);
          });
        for (const study of focusedStudies) {
          const store = context.getStore(study.id);
          // A focused run is walked in the order it was written, and everything
          // it does not name keeps its own order behind it.
          const focusedCourseIds = study.id === config.focus?.studyId ? config.focus.courseIds : [];
          const activeCourses = [...listActiveCourses(context.studiesRoot, study)].sort(
            (left, right) => {
              const rank = (id: string): number => {
                const position = focusedCourseIds.indexOf(id);
                return position === -1 ? focusedCourseIds.length : position;
              };
              return rank(left.id) - rank(right.id);
            },
          );
          const coursesById = new Map(activeCourses.map((course) => [course.id, course]));
          for (const course of activeCourses) {
            try {
              for (const unitId of course.unitIds) {
                const unit = readUnit(context.studiesRoot, study.id, course.id, unitId);
                if (unit.status !== "active") continue;
                for (const lessonId of unit.lessonIds) {
                  const lesson = readLatestLesson(
                    context.studiesRoot,
                    study.id,
                    course.id,
                    unit.id,
                    lessonId,
                  ).manifest;
                  if (lesson.status !== "active") continue;
                  const key = lessonContentKey({ courseId: course.id, unitId: unit.id, lessonId });
                  const progress = store?.getLessonProgress(key) ?? null;
                  // Completion belongs to the revision it was earned on. A
                  // revised lesson re-enrolls its cards only when it is
                  // completed again, so treating an old completion as current
                  // left the learner with a course that looked finished and a
                  // review queue that had quietly gone empty.
                  const finished =
                    progress?.status === "completed" &&
                    progress.contentRevision === lesson.contentRevision;
                  if (!nextLesson && !finished) {
                    nextLesson = {
                      studyId: study.id,
                      studyTitle: study.title,
                      courseId: course.id,
                      courseTitle: course.title,
                      unitId: unit.id,
                      lessonId,
                      lessonTitle: lesson.title,
                      contentRevision: lesson.contentRevision,
                      progress: serializeProgress(progress),
                    };
                  }
                }
              }
            } catch (error) {
              learningIssues.push(
                `${study.id}/${course.id}: course: ${error instanceof Error ? error.message : "invalid course learning data"}`,
              );
            }
          }

          let states: readonly StoredCardState[] = [];
          try {
            states = store?.listDueCards(new Date(), 1_000) ?? [];
          } catch (error) {
            learningIssues.push(
              `${study.id}: due queue: ${error instanceof Error ? error.message : "invalid learner data"}`,
            );
          }
          for (const state of states) {
            try {
              const identity = parseReviewContentKey(state.cardKey);
              if (identity.kind === "course-card") {
                if (!coursesById.has(identity.courseId)) continue;
                const card = requireActiveCard(context.studiesRoot, {
                  studyId: study.id,
                  ...identity,
                  contentId: identity.cardId,
                });
                if (card.contentRevision !== state.contentRevision) continue;
                dueCards.push({
                  kind: "course-card",
                  studyId: study.id,
                  courseId: identity.courseId,
                  unitId: identity.unitId,
                  lessonId: identity.lessonId,
                  cardId: identity.cardId,
                  front: card.front,
                  contentRevision: card.contentRevision,
                  dueAt: state.due.toISOString(),
                });
                continue;
              }

              let active;
              try {
                active = readActiveKnowledgeCard(
                  context.studiesRoot,
                  study.id,
                  identity.noteId,
                  identity.cardId,
                );
              } catch (error) {
                if (
                  error instanceof Error &&
                  error.message.startsWith("Knowledge note is not active:")
                ) {
                  continue;
                }
                throw error;
              }
              if (active.note.contentRevision !== state.contentRevision) continue;
              dueCards.push({
                kind: "knowledge-card",
                studyId: study.id,
                noteId: active.note.id,
                cardId: active.card.id,
                front: active.card.front,
                contentRevision: active.note.contentRevision,
                dueAt: state.due.toISOString(),
              });
            } catch (error) {
              learningIssues.push(
                `${study.id}: due ${state.cardKey}: ${error instanceof Error ? error.message : "invalid review item"}`,
              );
            }
          }
        }
        dueCards.sort((left, right) => left.dueAt.localeCompare(right.dueAt));
        sendJson(response, 200, {
          product: "UniversityLocal",
          requestToken: context.requestToken,
          studiesRoot: context.studiesRoot,
          studies,
          shelfIssues: shelf.issues,
          today: {
            dueCount: dueCards.length,
            card: dueCards[0] ?? null,
            nextLesson,
            focus: config.focus ?? null,
            issues: learningIssues,
          },
        });
        return;
      }
      if (url.pathname === "/api/bootstrap" && request.method !== "GET") {
        sendJson(response, 405, { error: "Method not allowed" });
        return;
      }

      const studyMatch = /^\/api\/studies\/([^/]+)$/.exec(url.pathname);
      if (request.method === "GET" && studyMatch) {
        let studyId: string;
        try {
          studyId = StableId.parse(decodeURIComponent(studyMatch[1] ?? ""));
        } catch {
          throw new HttpError(400, "Route contains an invalid study ID");
        }
        const study = readStudy(context.studiesRoot, studyId);
        sendJson(
          response,
          200,
          buildStudyView(context.studiesRoot, study, context.getStore(study.id)),
        );
        return;
      }

      const lessonRoute = parseRoute(
        url.pathname,
        /^\/api\/studies\/([^/]+)\/courses\/([^/]+)\/units\/([^/]+)\/lessons\/([^/]+)$/,
      );
      if (request.method === "GET" && lessonRoute) {
        sendJson(
          response,
          200,
          buildLessonView(
            context.studiesRoot,
            lessonRoute,
            context.getStore(lessonRoute.studyId),
            context.peekVocabularyStates(),
          ),
        );
        return;
      }

      const evidenceRoute = parseEvidenceRoute(url.pathname);
      if (request.method === "GET" && evidenceRoute) {
        const { lesson } = requireActiveLesson(context.studiesRoot, evidenceRoute.lesson);
        const evidence = lesson.evidence[evidenceRoute.index];
        if (!evidence) throw new HttpError(404, "Lesson evidence index does not exist");
        try {
          sendJson(
            response,
            200,
            readEvidenceSnippet(context.studiesRoot, evidenceRoute.lesson.studyId, evidence),
          );
        } catch (error) {
          throw new HttpError(
            422,
            `Lesson evidence cannot be displayed: ${error instanceof Error ? error.message : "invalid immutable evidence"}`,
          );
        }
        return;
      }

      const knowledgeEvidenceRoute = parseKnowledgeEvidenceRoute(url.pathname);
      if (request.method === "GET" && knowledgeEvidenceRoute) {
        const stored = readLatestKnowledgeNote(
          context.studiesRoot,
          knowledgeEvidenceRoute.studyId,
          knowledgeEvidenceRoute.noteId,
        );
        const evidence = stored.note.evidence[knowledgeEvidenceRoute.index];
        if (!evidence) throw new HttpError(404, "Knowledge note evidence index does not exist");
        try {
          sendJson(
            response,
            200,
            readEvidenceSnippet(context.studiesRoot, knowledgeEvidenceRoute.studyId, evidence),
          );
        } catch (error) {
          throw new HttpError(
            422,
            `Knowledge note evidence cannot be displayed: ${error instanceof Error ? error.message : "invalid immutable evidence"}`,
          );
        }
        return;
      }

      const exerciseRoute = parseRoute(
        url.pathname,
        /^\/api\/studies\/([^/]+)\/courses\/([^/]+)\/units\/([^/]+)\/lessons\/([^/]+)\/exercises\/([^/]+)\/attempt$/,
      );
      if (request.method === "POST" && exerciseRoute) {
        requireMutationAccess(request, context.requestToken);
        const body = ExerciseAttemptSchema.parse(await readJsonBody(request));
        const exercise = requireActiveExercise(context.studiesRoot, exerciseRoute);
        if (exercise.contentRevision !== body.contentRevision) {
          throw new HttpError(409, "Exercise content revision changed; reload before submitting");
        }
        // All exercise kinds: record learner answer only (score 0). Semantic
        // pass/fail comes from AI host write-back (host-grade). Self-rubric is
        // no longer used for completion.
        if (body.met !== undefined) {
          throw new HttpError(
            400,
            "Self-assessment is disabled; submit the answer and use host-grade write-back",
          );
        }
        const maxScore = 1;
        const score = 0;
        const awaitingHostGrade = true;
        const correct = false;
        const store = context.getStore(exerciseRoute.studyId, true)!;
        const exerciseKey = exerciseContentKey({
          courseId: exerciseRoute.courseId,
          unitId: exerciseRoute.unitId,
          lessonId: exerciseRoute.lessonId,
          exerciseId: exercise.id,
        });
        const lesson = requireActiveLesson(context.studiesRoot, exerciseRoute).lesson;
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
              // Same advancement the host-grade write-back runs. Two copies of
              // this drifted once already, and the drift made every failing
              // grade unrecordable.
              advanceLessonProgress(
                store,
                context.studiesRoot,
                { ...exerciseRoute, exerciseId: exercise.id },
                lesson,
                lessonKey,
              );
              return recordedAttemptId;
            }),
        );
        const attemptCount = store.countExerciseAttempts(exerciseKey, exercise.contentRevision);
        const hostGrade = store.getLatestHostExerciseGrade(exerciseKey, exercise.contentRevision);
        sendJson(response, 200, {
          attemptId,
          correct,
          score,
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
        return;
      }

      const hostGradeRoute = parseRoute(
        url.pathname,
        /^\/api\/studies\/([^/]+)\/courses\/([^/]+)\/units\/([^/]+)\/lessons\/([^/]+)\/exercises\/([^/]+)\/host-grade$/,
      );
      if (request.method === "POST" && hostGradeRoute) {
        requireMutationAccess(request, context.requestToken);
        if (!hostGradeRoute.contentId) throw new HttpError(404, "Exercise ID is missing");
        const body = await readJsonBody(request);
        const store = context.getStore(hostGradeRoute.studyId, true)!;
        try {
          const result = runWithCommandConflictMapped(
            "Command ID was already used for another exercise attempt",
            () =>
              applyHostExerciseGrade({
                studiesRoot: context.studiesRoot,
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
        return;
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
          buildCoachingPacketResponse(context.studiesRoot, coachingPacketRoute, context.getStore),
        );
        return;
      }

      const expressionPacketRoute = /^\/api\/studies\/([^/]+)\/expression-packet$/.exec(
        url.pathname,
      );
      if (request.method === "GET" && expressionPacketRoute) {
        const studyId = StableId.parse(decodeURIComponent(expressionPacketRoute[1]!));
        const store = context.getStore(studyId);
        if (!store) throw new HttpError(404, "Study has no learning data yet");
        const goal = url.searchParams.get("goal");
        try {
          const review = buildExpressionReview(store, {
            studiesRoot: context.studiesRoot,
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
        return;
      }

      /**
       * The three clocks, for a study whose source happens to be an airlock.
       *
       * No new configuration: a study already records where its source lives,
       * and an airlock is a source with a seal in it. A study pointed at an
       * ordinary checkout simply has no seal, which is reported as "not an
       * airlock" rather than as a fault — most studies are not.
       */
      const airlockRoute = /^\/api\/studies\/([^/]+)\/airlock$/.exec(url.pathname);
      if (request.method === "GET" && airlockRoute) {
        const studyId = StableId.parse(decodeURIComponent(airlockRoute[1]!));
        try {
          const registration = readSourceRegistration(context.studiesRoot, studyId);
          const inspection = inspectAirlock(registration.sourceRoot);
          sendJson(response, 200, {
            airlock: true,
            verdict: inspection.verdict,
            problems: inspection.problems,
            upstream: inspection.upstream,
            promotedCommit: inspection.seal.promotedCommit,
            promotedAt: inspection.seal.promotedAt,
            course: readCourseClock(context.studiesRoot, studyId, inspection.seal.promotedCommit),
          });
        } catch {
          sendJson(response, 200, { airlock: false });
        }
        return;
      }

      // Vocabulary is not scoped to a study: one word, one state, wherever it
      // was met. These routes therefore sit outside /api/studies/:id.
      if (request.method === "GET" && url.pathname === "/api/vocabulary") {
        const vocabulary = context.getVocabulary();
        const due = vocabulary.listDue(VOCABULARY_DUE_LIMIT);
        // A due row is a schedule, not a word: it carries a senseId and nothing
        // a learner could read. The entry is attached here because a review
        // screen that has to fetch each word separately is a review screen that
        // shows blank cards while it waits.
        const entries = new Map(
          selectLexicon(due.map((state) => state.senseId)).map((entry) => [entry.senseId, entry]),
        );
        sendJson(response, 200, {
          budget: vocabulary.budget(),
          due: due.flatMap((state) => {
            const entry = entries.get(state.senseId);
            // A word dropped from the lexicon keeps its state — the learner may
            // have known it for months — but it cannot be asked, so it is not
            // offered for review.
            return entry ? [{ ...state, entry }] : [];
          }),
          states: vocabulary.listStates(),
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/vocabulary/presented") {
        requireMutationAccess(request, context.requestToken);
        const body = VocabularyPresentedSchema.parse(await readJsonBody(request));
        context.getVocabulary().recordPresented(body.senseIds, {
          studyId: body.studyId,
          lessonId: body.lessonId,
        });
        sendJson(response, 202, { recorded: body.senseIds.length });
        return;
      }

      const vocabularyStageRoute = /^\/api\/vocabulary\/([^/]+)\/stage$/.exec(url.pathname);
      if (request.method === "POST" && vocabularyStageRoute) {
        requireMutationAccess(request, context.requestToken);
        const body = VocabularyStageSchema.parse(await readJsonBody(request));
        const senseId = decodeURIComponent(vocabularyStageRoute[1]!);
        context.assertKnownSense(senseId);
        sendJson(response, 200, { state: context.getVocabulary().setStage(senseId, body.stage) });
        return;
      }

      const vocabularyGradeRoute = /^\/api\/vocabulary\/([^/]+)\/grade$/.exec(url.pathname);
      if (request.method === "POST" && vocabularyGradeRoute) {
        requireMutationAccess(request, context.requestToken);
        const body = VocabularyGradeSchema.parse(await readJsonBody(request));
        const senseId = decodeURIComponent(vocabularyGradeRoute[1]!);
        context.assertKnownSense(senseId);
        sendJson(response, 200, {
          state: context.getVocabulary().grade(senseId, body.rating as Grade),
        });
        return;
      }

      const cardRevealRoute = parseRoute(
        url.pathname,
        /^\/api\/studies\/([^/]+)\/courses\/([^/]+)\/units\/([^/]+)\/lessons\/([^/]+)\/cards\/([^/]+)\/reveal$/,
      );
      if (request.method === "POST" && cardRevealRoute) {
        requireMutationAccess(request, context.requestToken);
        const body = CardRevealSchema.parse(await readJsonBody(request));
        const store = context.getStore(cardRevealRoute.studyId, true)!;
        revealReviewableCard(
          response,
          body,
          courseReviewableCard(context.studiesRoot, cardRevealRoute),
          store,
        );
        return;
      }

      const cardReviewRoute = parseRoute(
        url.pathname,
        /^\/api\/studies\/([^/]+)\/courses\/([^/]+)\/units\/([^/]+)\/lessons\/([^/]+)\/cards\/([^/]+)\/review$/,
      );
      if (request.method === "POST" && cardReviewRoute) {
        requireMutationAccess(request, context.requestToken);
        const body = CardReviewSchema.parse(await readJsonBody(request));
        const store = context.getStore(cardReviewRoute.studyId, true)!;
        reviewReviewableCard(
          response,
          body,
          courseReviewableCard(context.studiesRoot, cardReviewRoute),
          store,
        );
        return;
      }

      const knowledgeCardRoute = parseKnowledgeCardRoute(url.pathname);
      if (request.method === "POST" && knowledgeCardRoute?.action === "reveal") {
        requireMutationAccess(request, context.requestToken);
        const body = CardRevealSchema.parse(await readJsonBody(request));
        const store = context.getStore(knowledgeCardRoute.studyId, true)!;
        revealReviewableCard(
          response,
          body,
          knowledgeReviewableCard(context.studiesRoot, knowledgeCardRoute),
          store,
        );
        return;
      }
      if (request.method === "POST" && knowledgeCardRoute?.action === "review") {
        requireMutationAccess(request, context.requestToken);
        const body = CardReviewSchema.parse(await readJsonBody(request));
        const store = context.getStore(knowledgeCardRoute.studyId, true)!;
        reviewReviewableCard(
          response,
          body,
          knowledgeReviewableCard(context.studiesRoot, knowledgeCardRoute),
          store,
        );
        return;
      }

      if (request.method !== "GET" && request.method !== "POST") {
        sendJson(response, 405, { error: "Method not allowed" });
        return;
      }
      sendJson(response, 404, { error: "Not found" });
    })().catch((error: unknown) => {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      if (error instanceof HttpError) {
        sendJson(response, error.status, { error: error.message });
        return;
      }
      if (error instanceof z.ZodError) {
        sendJson(response, 400, { error: "Request validation failed", issues: error.issues });
        return;
      }
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? (error as { code?: unknown }).code
          : undefined;
      if (code === "ENOENT") {
        sendJson(response, 404, { error: "Requested learning content was not found" });
        return;
      }
      console.error("UniversityLocal API error", error);
      sendJson(response, 500, { error: "UniversityLocal could not complete the request" });
    });
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 5_000;
  server.on("close", () => {
    context.close();
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const projectRoot = process.env["UNIVERSITY_LOCAL_PROJECT_ROOT"] ?? defaultProjectRoot();
  const port = Number(process.env["UNIVERSITY_LOCAL_PORT"] ?? DEFAULT_PORT);
  const server = createUniversityLocalHttpServer(projectRoot);
  server.listen(port, "127.0.0.1", () => {
    console.log(`UniversityLocal API listening on http://127.0.0.1:${port}`);
  });
}
