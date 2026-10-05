import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { HttpError } from "../errors.js";
import { requireActiveLesson, runWithCommandConflictMapped } from "../content-access.js";
import { LessonCompletionSchema } from "../request-schemas.js";
import {
  parseEvidenceRoute,
  parseKnowledgeEvidenceRoute,
  parseLessonAssetRoute,
  parseRoute,
} from "../routes.js";
import { serializeProgress } from "../serialize.js";
import { buildLessonView } from "../views.js";
import { readJsonBody, requireMutationAccess, sendJson } from "../wire.js";
import { matchesAssetMime } from "../../content/asset-bytes.js";
import { readEvidenceSnippet } from "../../content/evidence.js";
import { readLatestKnowledgeNote } from "../../knowledge/repository.js";
import { lessonContentKey } from "../../learning/types.js";
import { getLessonPaths } from "../../studies/paths.js";
import { advanceLessonProgress, isLessonComplete } from "../../workflows/host-exercise-grade.js";
import type { Handler } from "./types.js";

/** Lesson GET, lesson evidence, knowledge-note evidence. */
export const handleLesson: Handler = async (ctx, request, response, url) => {
  const assetRoute = parseLessonAssetRoute(url.pathname);
  if (assetRoute) {
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Method not allowed" });
      return true;
    }
    const { lesson } = requireActiveLesson(ctx.studiesRoot, assetRoute.lesson);
    if (lesson.contentRevision !== assetRoute.revision) {
      throw new HttpError(409, "Lesson asset revision is no longer active");
    }
    const asset = lesson.assets.find((candidate) => candidate.id === assetRoute.assetId);
    if (!asset) throw new HttpError(404, "Lesson asset is not approved by this revision");
    const revisionRoot = join(
      getLessonPaths(
        ctx.studiesRoot,
        assetRoute.lesson.studyId,
        assetRoute.lesson.courseId,
        assetRoute.lesson.unitId,
        assetRoute.lesson.lessonId,
      ).revisions,
      String(assetRoute.revision),
    );
    const filePath = resolve(revisionRoot, asset.path);
    const normalizedRoot = resolve(revisionRoot);
    if (filePath !== normalizedRoot && !filePath.startsWith(`${normalizedRoot}/`)) {
      throw new HttpError(422, "Lesson asset path is outside its revision");
    }
    let bytes: Buffer;
    try {
      if (!statSync(filePath).isFile()) throw new Error("not a regular file");
      bytes = readFileSync(filePath);
    } catch {
      throw new HttpError(404, "Lesson asset file is missing");
    }
    if (bytes.byteLength !== asset.bytes || bytes.byteLength > 25 * 1024 * 1024) {
      throw new HttpError(422, "Lesson asset size does not match its manifest");
    }
    const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    if (digest !== asset.sha256)
      throw new HttpError(422, "Lesson asset hash does not match its manifest");
    if (!matchesAssetMime(bytes, asset.mime)) {
      throw new HttpError(422, "Lesson asset MIME does not match its bytes");
    }
    response.writeHead(200, {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": asset.mime,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": "inline",
      ETag: `"${asset.sha256}"`,
      "X-Content-Type-Options": "nosniff",
    });
    response.end(bytes);
    return true;
  }

  const completionRoute = parseRoute(
    url.pathname,
    /^\/api\/studies\/([^/]+)\/courses\/([^/]+)\/units\/([^/]+)\/lessons\/([^/]+)\/complete$/,
  );
  if (request.method === "POST" && completionRoute) {
    requireMutationAccess(request, ctx.requestToken);
    const body = LessonCompletionSchema.parse(await readJsonBody(request));
    const { lesson } = requireActiveLesson(ctx.studiesRoot, completionRoute);
    if (lesson.contentRevision !== body.contentRevision) {
      throw new HttpError(409, "Lesson content revision changed; reload before confirming");
    }
    const store = ctx.getStore(completionRoute.studyId, true)!;
    const lessonKey = lessonContentKey({
      courseId: completionRoute.courseId,
      unitId: completionRoute.unitId,
      lessonId: completionRoute.lessonId,
    });
    const receipt = runWithCommandConflictMapped(
      "Command ID was already used for another lesson completion",
      () =>
        store.transaction(() => {
          const completion = store.recordLessonCompletion({
            commandId: body.commandId,
            lessonKey,
            contentRevision: lesson.contentRevision,
          });
          advanceLessonProgress(store, ctx.studiesRoot, completionRoute, lesson, lessonKey);
          return completion;
        }),
    );
    sendJson(response, 200, {
      ...receipt,
      lessonComplete: isLessonComplete(store, ctx.studiesRoot, completionRoute, lesson),
      progress: serializeProgress(
        store.getLessonProgress(lessonKey),
        store.hasLessonCompletion(lessonKey, lesson.contentRevision),
      ),
    });
    return true;
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
        ctx.studiesRoot,
        lessonRoute,
        ctx.getStore(lessonRoute.studyId),
        ctx.peekVocabularyStates(),
      ),
    );
    return true;
  }

  const evidenceRoute = parseEvidenceRoute(url.pathname);
  if (request.method === "GET" && evidenceRoute) {
    const { lesson } = requireActiveLesson(ctx.studiesRoot, evidenceRoute.lesson);
    const evidence = lesson.evidence[evidenceRoute.index];
    if (!evidence) throw new HttpError(404, "Lesson evidence index does not exist");
    try {
      sendJson(
        response,
        200,
        readEvidenceSnippet(
          ctx.studiesRoot,
          evidenceRoute.lesson.studyId,
          evidence,
          url.searchParams.get("view") === "full" ? "full" : undefined,
        ),
      );
    } catch (error) {
      throw new HttpError(
        422,
        `Lesson evidence cannot be displayed: ${error instanceof Error ? error.message : "invalid immutable evidence"}`,
      );
    }
    return true;
  }

  const knowledgeEvidenceRoute = parseKnowledgeEvidenceRoute(url.pathname);
  if (request.method === "GET" && knowledgeEvidenceRoute) {
    const stored = readLatestKnowledgeNote(
      ctx.studiesRoot,
      knowledgeEvidenceRoute.studyId,
      knowledgeEvidenceRoute.noteId,
    );
    const evidence = stored.note.evidence[knowledgeEvidenceRoute.index];
    if (!evidence) throw new HttpError(404, "Knowledge note evidence index does not exist");
    try {
      sendJson(
        response,
        200,
        readEvidenceSnippet(ctx.studiesRoot, knowledgeEvidenceRoute.studyId, evidence),
      );
    } catch (error) {
      throw new HttpError(
        422,
        `Knowledge note evidence cannot be displayed: ${error instanceof Error ? error.message : "invalid immutable evidence"}`,
      );
    }
    return true;
  }

  return false;
};

// Moved to server/content/asset-bytes.ts so ingest enforces the same rule this
// handler enforces. Keeping a private copy here is what let the two drift.
