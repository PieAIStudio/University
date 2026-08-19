import { existsSync } from "node:fs";

import type { LearningFocus } from "@pieai/university-core/domain/schemas.js";
import {
  countCourseManifests,
  countSnapshotManifests,
  countUaAnalyses,
  listActiveCourses,
} from "../content-access.js";
import { sendJson } from "../wire.js";
import { readCourse } from "../../content/repository.js";
import { getStudyPaths } from "../../studies/paths.js";
import { inspectStudyShelf } from "../../studies/repository.js";
import { buildLearningOverview } from "../../workflows/learning-overview.js";
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

      const overview = buildLearningOverview({
        studiesRoot: ctx.studiesRoot,
        ...(focus ? { focus } : {}),
        getStore: (studyId) => ctx.getStore(studyId),
      });
      // AI hosts benefit from exact evidence and artifact paths. The browser
      // only needs the locator and progress, so keep its payload as small as it
      // was before this shared read model existed.
      const browserNextLesson = overview.nextLesson
        ? (({ evidence: _evidence, artifact: _artifact, ...lesson }) => lesson)(overview.nextLesson)
        : null;
      sendJson(response, 200, {
        product: "UniversityLocal",
        requestToken: ctx.requestToken,
        studiesRoot: ctx.studiesRoot,
        studies,
        shelfIssues: shelf.issues,
        today: {
          dueCount: overview.dueCount,
          card: overview.card,
          nextLesson: browserNextLesson,
          focus: overview.focus,
          issues: overview.issues,
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
