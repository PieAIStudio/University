import { existsSync } from "node:fs";

import type { LearningFocus } from "../../../src/domain/schemas.js";
import {
  countCourseManifests,
  countSnapshotManifests,
  countUaAnalyses,
  listActiveCourses,
  requireActiveCard,
  type DueCard,
} from "../content-access.js";
import { serializeProgress } from "../serialize.js";
import { sendJson } from "../wire.js";
import { readCourse, readLatestLesson, readUnit } from "../../content/repository.js";
import { readActiveKnowledgeCard } from "../../knowledge/repository.js";
import {
  lessonContentKey,
  parseReviewContentKey,
  type StoredCardState,
} from "../../learning/types.js";
import { getStudyPaths } from "../../studies/paths.js";
import { inspectStudyShelf } from "../../studies/repository.js";
import type { Handler } from "./types.js";

/**
 * `/api/health` and `/api/bootstrap`. The bootstrap branch needs the learning
 * focus from config; that is not on ServerContext, so this is a factory.
 */
export function createBootstrapHandler(focus: LearningFocus | undefined): Handler {
  return (ctx, request, response, url) => {
    if (request.method === "GET" && url.pathname === "/api/health") {
      sendJson(response, 200, { status: "ok", service: "university-local" });
      return true;
    }
    if (url.pathname === "/api/health" && request.method !== "GET") {
      sendJson(response, 405, { error: "Method not allowed" });
      return true;
    }

    if (request.method === "GET" && url.pathname === "/api/bootstrap") {
      const shelf = inspectStudyShelf(ctx.studiesRoot);
      // Same rule as the store warm-up above: archived studies keep their
      // data and stay off the shelf.
      const studies = shelf.studies
        .filter((study) => study.status === "active")
        .map((study) => {
          const paths = getStudyPaths(ctx.studiesRoot, study.id);
          const ua = countUaAnalyses(paths.ua);
          let defaultCourse: { id: string; title: string; status: string } | null = null;
          if (study.defaultCourseId) {
            try {
              const course = readCourse(ctx.studiesRoot, study.id, study.defaultCourseId);
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
            activeCourseCount: listActiveCourses(ctx.studiesRoot, study).length,
            defaultCourse,
            hasLearningDatabase: existsSync(paths.learner.database),
            // Derived from the events themselves rather than stored on open,
            // so it cannot drift from what the learner actually did. The
            // shelf needs it because a title-sorted list always opens on
            // whichever study sorts first, which is rarely the live one.
            lastActivityAt: ctx.getStore(study.id)?.getLastActivityAt()?.toISOString() ?? null,
          };
        });

      const dueCards: DueCard[] = [];
      let nextLesson: Record<string, unknown> | null = null;
      const learningIssues: string[] = [];
      /*
        The focus is stored as ids, because that is what survives a course
        being renamed. The front page was printing one of them —
        「主攻 TuringPact · foundations-before-zero 起」 — so the first thing a
        learner read every morning was a slug. Titles are resolved here, where
        the course manifests are already open, and the id stays as the fallback
        for a focus that points at a course no longer on the shelf.
      */
      const focusCourseTitles = new Map<string, string>();
      // `nextLesson` is whatever incomplete lesson the walk meets first, so the
      // walk order is the curriculum order. Focus moves the chosen study and
      // course to the front rather than filtering the rest out: finishing the
      // focused study should roll on to the next one, not report nothing left.
      // Due cards are unaffected — they are sorted by due date afterwards.
      const focusedStudies = shelf.studies
        .filter((study) => study.status === "active")
        .sort((left, right) => {
          const rank = (id: string): number => (id === focus?.studyId ? 0 : 1);
          return rank(left.id) - rank(right.id);
        });
      for (const study of focusedStudies) {
        const store = ctx.getStore(study.id);
        // A focused run is walked in the order it was written, and everything
        // it does not name keeps its own order behind it.
        const focusedCourseIds = study.id === focus?.studyId ? focus.courseIds : [];
        const activeCourses = [...listActiveCourses(ctx.studiesRoot, study)].sort((left, right) => {
          const rank = (id: string): number => {
            const position = focusedCourseIds.indexOf(id);
            return position === -1 ? focusedCourseIds.length : position;
          };
          return rank(left.id) - rank(right.id);
        });
        const coursesById = new Map(activeCourses.map((course) => [course.id, course]));
        if (study.id === focus?.studyId) {
          for (const courseId of focus.courseIds) {
            const title = coursesById.get(courseId)?.title;
            if (title) focusCourseTitles.set(courseId, title);
          }
        }
        for (const course of activeCourses) {
          try {
            for (const unitId of course.unitIds) {
              const unit = readUnit(ctx.studiesRoot, study.id, course.id, unitId);
              if (unit.status !== "active") continue;
              for (const lessonId of unit.lessonIds) {
                const lesson = readLatestLesson(
                  ctx.studiesRoot,
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
                const readConfirmed =
                  store?.hasLessonCompletion(key, lesson.contentRevision) ?? false;
                const finished =
                  readConfirmed &&
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
                    progress: serializeProgress(progress, readConfirmed),
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
              const card = requireActiveCard(ctx.studiesRoot, {
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
                ctx.studiesRoot,
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
        requestToken: ctx.requestToken,
        studiesRoot: ctx.studiesRoot,
        studies,
        shelfIssues: shelf.issues,
        today: {
          dueCount: dueCards.length,
          card: dueCards[0] ?? null,
          nextLesson,
          focus: focus
            ? {
                ...focus,
                courses: focus.courseIds.map((id) => ({
                  id,
                  title: focusCourseTitles.get(id) ?? id,
                })),
              }
            : null,
          issues: learningIssues,
        },
      });
      return true;
    }
    if (url.pathname === "/api/bootstrap" && request.method !== "GET") {
      sendJson(response, 405, { error: "Method not allowed" });
      return true;
    }

    return false;
  };
}
