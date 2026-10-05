import { StableId } from "@pieai/university-core/domain/schemas.js";
import { HttpError } from "./errors.js";
function parseRoute(pathname, expression) {
    const match = expression.exec(pathname);
    if (!match)
        return null;
    try {
        const values = match.slice(1).map((value) => StableId.parse(decodeURIComponent(value)));
        const [studyId, courseId, unitId, lessonId, contentId] = values;
        if (!studyId || !courseId || !unitId || !lessonId)
            return null;
        return { studyId, courseId, unitId, lessonId, ...(contentId ? { contentId } : {}) };
    }
    catch {
        throw new HttpError(400, "Route contains an invalid stable ID");
    }
}
function parseEvidenceRoute(pathname) {
    const match = /^\/api\/studies\/([^/]+)\/courses\/([^/]+)\/units\/([^/]+)\/lessons\/([^/]+)\/evidence\/(\d+)$/.exec(pathname);
    if (!match)
        return null;
    try {
        const [studyId, courseId, unitId, lessonId] = match
            .slice(1, 5)
            .map((value) => StableId.parse(decodeURIComponent(value)));
        const index = Number(match[5]);
        if (!studyId ||
            !courseId ||
            !unitId ||
            !lessonId ||
            !Number.isSafeInteger(index) ||
            index < 0 ||
            index > 9_999) {
            throw new Error("invalid evidence route");
        }
        return { lesson: { studyId, courseId, unitId, lessonId }, index };
    }
    catch {
        throw new HttpError(400, "Route contains an invalid evidence location");
    }
}
function parseLessonAssetRoute(pathname) {
    const match = /^\/api\/studies\/([^/]+)\/courses\/([^/]+)\/units\/([^/]+)\/lessons\/([^/]+)\/revisions\/(\d+)\/assets\/([^/]+)$/.exec(pathname);
    if (!match)
        return null;
    try {
        const [studyId, courseId, unitId, lessonId, assetId] = match
            .slice(1, 5)
            .concat(match[6] ?? "")
            .map((value) => StableId.parse(decodeURIComponent(value)));
        const revision = Number(match[5]);
        if (!studyId ||
            !courseId ||
            !unitId ||
            !lessonId ||
            !assetId ||
            !Number.isSafeInteger(revision) ||
            revision < 1 ||
            revision > 10_000) {
            throw new Error("invalid lesson asset route");
        }
        return {
            lesson: { studyId, courseId, unitId, lessonId },
            revision,
            assetId,
        };
    }
    catch {
        throw new HttpError(400, "Route contains an invalid lesson asset location");
    }
}
function parseKnowledgeCardRoute(pathname) {
    const match = /^\/api\/studies\/([^/]+)\/notes\/([^/]+)\/cards\/([^/]+)\/(reveal|review)$/.exec(pathname);
    if (!match)
        return null;
    try {
        const [studyId, noteId, cardId] = match
            .slice(1, 4)
            .map((value) => StableId.parse(decodeURIComponent(value)));
        const action = match[4];
        if (!studyId || !noteId || !cardId || (action !== "reveal" && action !== "review")) {
            throw new Error("invalid knowledge card route");
        }
        return { studyId, noteId, cardId, action };
    }
    catch {
        throw new HttpError(400, "Route contains an invalid knowledge card location");
    }
}
function parseKnowledgeEvidenceRoute(pathname) {
    const match = /^\/api\/studies\/([^/]+)\/notes\/([^/]+)\/evidence\/(\d+)$/.exec(pathname);
    if (!match)
        return null;
    try {
        const studyId = StableId.parse(decodeURIComponent(match[1] ?? ""));
        const noteId = StableId.parse(decodeURIComponent(match[2] ?? ""));
        const index = Number(match[3]);
        if (!Number.isSafeInteger(index) || index < 0 || index > 9_999) {
            throw new Error("invalid knowledge evidence index");
        }
        return { studyId, noteId, index };
    }
    catch {
        throw new HttpError(400, "Route contains an invalid knowledge evidence location");
    }
}
export { parseRoute, parseEvidenceRoute, parseLessonAssetRoute, parseKnowledgeCardRoute, parseKnowledgeEvidenceRoute, };
//# sourceMappingURL=routes.js.map