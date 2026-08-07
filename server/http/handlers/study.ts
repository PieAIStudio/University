import { StableId } from "../../../src/domain/schemas.js";
import { HttpError } from "../errors.js";
import { buildStudyView } from "../views.js";
import { sendJson } from "../wire.js";
import { readCourseClock } from "../../airlock/course-clock.js";
import { inspectAirlock } from "../../airlock/inspect.js";
import { readSourceRegistration, readStudy } from "../../studies/repository.js";
import type { Handler } from "./types.js";

/** GET `/api/studies/:id` — sits before lesson routes in the ordered list. */
export const handleStudy: Handler = (ctx, request, response, url) => {
  const studyMatch = /^\/api\/studies\/([^/]+)$/.exec(url.pathname);
  if (request.method === "GET" && studyMatch) {
    let studyId: string;
    try {
      studyId = StableId.parse(decodeURIComponent(studyMatch[1] ?? ""));
    } catch {
      throw new HttpError(400, "Route contains an invalid study ID");
    }
    const study = readStudy(ctx.studiesRoot, studyId);
    sendJson(response, 200, buildStudyView(ctx.studiesRoot, study, ctx.getStore(study.id)));
    return true;
  }
  return false;
};

/**
 * The three clocks, for a study whose source happens to be an airlock.
 *
 * No new configuration: a study already records where its source lives,
 * and an airlock is a source with a seal in it. A study pointed at an
 * ordinary checkout simply has no seal, which is reported as "not an
 * airlock" rather than as a fault — most studies are not.
 *
 * In the original flat chain this sat after expression-packet; the ordered
 * handler list keeps that position.
 */
export const handleAirlock: Handler = (ctx, request, response, url) => {
  const airlockRoute = /^\/api\/studies\/([^/]+)\/airlock$/.exec(url.pathname);
  if (request.method === "GET" && airlockRoute) {
    const studyId = StableId.parse(decodeURIComponent(airlockRoute[1]!));
    try {
      const registration = readSourceRegistration(ctx.studiesRoot, studyId);
      const inspection = inspectAirlock(registration.sourceRoot);
      sendJson(response, 200, {
        airlock: true,
        verdict: inspection.verdict,
        problems: inspection.problems,
        upstream: inspection.upstream,
        promotedCommit: inspection.seal.promotedCommit,
        promotedAt: inspection.seal.promotedAt,
        course: readCourseClock(ctx.studiesRoot, studyId, inspection.seal.promotedCommit),
      });
    } catch {
      sendJson(response, 200, { airlock: false });
    }
    return true;
  }
  return false;
};
