import { HttpError } from "../errors.js";
import { requireActiveLesson } from "../content-access.js";
import { parseEvidenceRoute, parseKnowledgeEvidenceRoute, parseRoute } from "../routes.js";
import { buildLessonView } from "../views.js";
import { sendJson } from "../wire.js";
import { readEvidenceSnippet } from "../../content/evidence.js";
import { readLatestKnowledgeNote } from "../../knowledge/repository.js";
import type { Handler } from "./types.js";

/** Lesson GET, lesson evidence, knowledge-note evidence. */
export const handleLesson: Handler = (ctx, request, response, url) => {
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
        readEvidenceSnippet(ctx.studiesRoot, evidenceRoute.lesson.studyId, evidence),
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
