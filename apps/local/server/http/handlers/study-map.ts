import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { getStudyPaths } from "../../studies/paths.js";
import { buildStudyMap, lookupStudyMapFiles } from "../../ua/study-map.js";
import { sendJson } from "../wire.js";
import type { Handler } from "./types.js";

const MAP_ROUTE = /^\/api\/studies\/([^/]+)\/map$/;
const FILES_ROUTE = /^\/api\/studies\/([^/]+)\/map\/files$/;

/**
 * Every source path any lesson in this study cites, from the landed manifests.
 *
 * Read from disk rather than from a stored index, because an index is a second
 * copy of a fact the manifests already hold — and the failure mode of a stale
 * coverage number is a curriculum that looks broader than it is, which is the
 * exact thing this endpoint exists to expose.
 */
function citedSourcePaths(studiesRoot: string, studyId: string): Set<string> {
  const cited = new Set<string>();
  const coursesRoot = getStudyPaths(studiesRoot, studyId).courses;
  if (!existsSync(coursesRoot)) return cited;
  for (const courseId of readdirSync(coursesRoot)) {
    const unitsRoot = join(coursesRoot, courseId, "units");
    if (!existsSync(unitsRoot)) continue;
    for (const unitId of readdirSync(unitsRoot)) {
      const lessonsRoot = join(unitsRoot, unitId, "lessons");
      if (!existsSync(lessonsRoot)) continue;
      for (const lessonId of readdirSync(lessonsRoot)) {
        const latest = join(lessonsRoot, lessonId, "latest.json");
        if (!existsSync(latest)) continue;
        try {
          const revision = JSON.parse(readFileSync(latest, "utf8")).contentRevision;
          const manifest = JSON.parse(
            readFileSync(
              join(lessonsRoot, lessonId, "revisions", String(revision), "manifest.json"),
              "utf8",
            ),
          );
          for (const entry of manifest.evidence ?? []) {
            if (typeof entry?.sourcePath === "string") cited.add(entry.sourcePath);
          }
        } catch {
          // A lesson whose manifest will not parse contributes no coverage.
          // It is still a lesson; it is just not evidence of reach.
        }
      }
    }
  }
  return cited;
}

/**
 * The studied project's own layers, and how far the courses reach into them.
 *
 * `GET /api/studies/:id/map` — the layer view.
 * `GET /api/studies/:id/map/files?paths=a,b` — what UA knows about named files,
 * for the panel beside a piece of evidence.
 *
 * A study with no ready analysis returns `map: null` rather than a 404: having
 * no map is an ordinary state for a project nobody has analysed yet, and the
 * page should say so instead of showing an error.
 */
export const handleStudyMap: Handler = (ctx, request, response, url) => {
  const mapRoute = MAP_ROUTE.exec(url.pathname);
  if (request.method === "GET" && mapRoute) {
    const studyId = decodeURIComponent(mapRoute[1]!);
    const cited = citedSourcePaths(ctx.studiesRoot, studyId);
    const map = buildStudyMap(ctx.studiesRoot, studyId, cited);
    sendJson(response, 200, { map, citedFileCount: cited.size });
    return true;
  }

  const filesRoute = FILES_ROUTE.exec(url.pathname);
  if (request.method === "GET" && filesRoute) {
    const studyId = decodeURIComponent(filesRoute[1]!);
    // Capped: this answers "what are the few files on screen", not "hand me
    // the graph". A caller wanting the whole thing should read the map.
    const paths = (url.searchParams.get("paths") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 50);
    sendJson(response, 200, { files: lookupStudyMapFiles(ctx.studiesRoot, studyId, paths) });
    return true;
  }

  return false;
};
