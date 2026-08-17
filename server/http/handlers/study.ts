import { StableId } from "../../../src/domain/schemas.js";
import { HttpError } from "../errors.js";
import { buildStudyView } from "../views.js";
import { sendJson } from "../wire.js";
import { readCourseClock } from "../../airlock/course-clock.js";
import { inspectAirlock } from "../../airlock/inspect.js";
import { readSourceRegistration, readStudy } from "../../studies/repository.js";
import {
  closeSnapshotCheckout,
  openSnapshotCheckout,
  snapshotIdForCommit,
} from "../../workflows/snapshot-checkout.js";
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
 * `/api/studies/:id/checkout` — the version a lesson teaches, made runnable.
 *
 * Reading the cited source has always worked, because the mirror holds the
 * commit. Using the product at that commit did not, and once the studied
 * project moves on, "the screen in this lesson" stops existing anywhere the
 * learner can reach. This materialises it.
 *
 * POST creates or reports, DELETE removes. The commit comes from the lesson
 * that asked, so the reader gets the version they are reading about rather than
 * whichever snapshot happens to be newest; an unrecognised commit is a 404,
 * because a lesson can outlive its snapshot.
 *
 * Deliberately does not start anything. UniversityLocal studies whatever it is
 * pointed at, and running someone else's project is their call and their
 * command — this hands over the path and the commands it can read off the
 * project, and stops.
 */
export const handleSnapshotCheckout: Handler = (ctx, request, response, url) => {
  const route = /^\/api\/studies\/([^/]+)\/checkout$/.exec(url.pathname);
  if (!route) return false;
  if (request.method !== "POST" && request.method !== "DELETE") {
    sendJson(response, 405, { error: "Method not allowed" });
    return true;
  }
  const studyId = StableId.parse(decodeURIComponent(route[1]!));
  const requested = url.searchParams.get("sourceCommit");
  let snapshotId: string | undefined;
  if (requested) {
    snapshotId = snapshotIdForCommit(ctx.studiesRoot, studyId, requested);
    if (!snapshotId) {
      throw new HttpError(404, "No ready snapshot holds that commit");
    }
  }
  sendJson(
    response,
    200,
    request.method === "POST"
      ? openSnapshotCheckout(ctx.studiesRoot, studyId, snapshotId)
      : closeSnapshotCheckout(ctx.studiesRoot, studyId, snapshotId),
  );
  return true;
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
