import { HttpError } from "../errors.js";
import { requireActiveLesson } from "../content-access.js";
import { ReaderMarkSchema } from "../request-schemas.js";
import { parseRoute } from "../routes.js";
import { readJsonBody, requireMutationAccess, sendJson } from "../wire.js";
import { lessonContentKey } from "../../learning/types.js";
import type { Handler } from "./types.js";

const MARKS_ROUTE = /^\/api\/studies\/([^/]+)\/marks$/;
const MARK_ITEM_ROUTE = /^\/api\/studies\/([^/]+)\/marks\/([^/]+)$/;
const LESSON_MARKS_ROUTE =
  /^\/api\/studies\/([^/]+)\/courses\/([^/]+)\/units\/([^/]+)\/lessons\/([^/]+)\/marks$/;

/**
 * What the reader marked while reading, per study.
 *
 * Study-scoped rather than global, unlike vocabulary: a question is about a
 * passage in one project's lesson, and the batch a reader eventually hands to
 * an assistant is "what I did not follow while studying *this*". The rows live
 * in that study's learning database, beside the exercise attempts — which is
 * the point, because "said nothing but failed the exercise" is a question this
 * table can only answer while the two sit together.
 */
export const handleReaderMark: Handler = async (ctx, request, response, url) => {
  const listRoute = MARKS_ROUTE.exec(url.pathname);
  if (request.method === "GET" && listRoute) {
    const studyId = decodeURIComponent(listRoute[1]!);
    const store = ctx.getStore(studyId);
    // A study nobody has opened yet has no database, and that is not an error —
    // it is a reader who has not marked anything.
    sendJson(response, 200, { marks: store?.listReaderMarks({ limit: 500 }) ?? [] });
    return true;
  }

  const lessonRoute = parseRoute(url.pathname, LESSON_MARKS_ROUTE);
  if (request.method === "POST" && lessonRoute) {
    requireMutationAccess(request, ctx.requestToken);
    const body = ReaderMarkSchema.parse(await readJsonBody(request));
    const { lesson } = requireActiveLesson(ctx.studiesRoot, lessonRoute);
    if (lesson.contentRevision !== body.contentRevision) {
      // Anchoring a quote to a revision the reader is no longer looking at
      // would file the note against the wrong text.
      throw new HttpError(409, "Lesson content revision changed; reload before marking");
    }
    const store = ctx.getStore(lessonRoute.studyId, true)!;
    const mark = store.recordReaderMark({
      lessonKey: lessonContentKey({
        courseId: lessonRoute.courseId,
        unitId: lessonRoute.unitId,
        lessonId: lessonRoute.lessonId,
      }),
      contentRevision: body.contentRevision,
      kind: body.kind,
      quote: { exact: body.exact, prefix: body.prefix, suffix: body.suffix },
      ...(body.sectionTitle ? { sectionTitle: body.sectionTitle } : {}),
      ...(body.note ? { note: body.note } : {}),
    });
    sendJson(response, 201, { mark });
    return true;
  }

  const itemRoute = MARK_ITEM_ROUTE.exec(url.pathname);
  if (itemRoute) {
    const studyId = decodeURIComponent(itemRoute[1]!);
    const markId = decodeURIComponent(itemRoute[2]!);
    if (request.method === "DELETE") {
      requireMutationAccess(request, ctx.requestToken);
      const store = ctx.getStore(studyId);
      if (!store?.deleteReaderMark(markId)) throw new HttpError(404, "No such mark");
      sendJson(response, 200, { deleted: markId });
      return true;
    }
    if (request.method === "POST") {
      requireMutationAccess(request, ctx.requestToken);
      const store = ctx.getStore(studyId);
      if (!store?.resolveReaderMark(markId)) {
        throw new HttpError(404, "No such open mark");
      }
      sendJson(response, 200, { resolved: markId });
      return true;
    }
  }

  return false;
};
