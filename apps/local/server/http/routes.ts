import { StableId } from "@pieai/university-core/domain/schemas.js";
import { HttpError } from "./errors.js";

export interface LearningRoute {
  readonly studyId: string;
  readonly courseId: string;
  readonly unitId: string;
  readonly lessonId: string;
  readonly contentId?: string;
}

interface EvidenceRoute {
  readonly lesson: LearningRoute;
  readonly index: number;
}

export interface LessonAssetRoute {
  readonly lesson: LearningRoute;
  readonly revision: number;
  readonly assetId: string;
}

export interface KnowledgeCardRoute {
  readonly studyId: string;
  readonly noteId: string;
  readonly cardId: string;
  readonly action: "reveal" | "review";
}

interface KnowledgeEvidenceRoute {
  readonly studyId: string;
  readonly noteId: string;
  readonly index: number;
}

function parseRoute(pathname: string, expression: RegExp): LearningRoute | null {
  const match = expression.exec(pathname);
  if (!match) return null;
  try {
    const values = match.slice(1).map((value) => StableId.parse(decodeURIComponent(value)));
    const [studyId, courseId, unitId, lessonId, contentId] = values;
    if (!studyId || !courseId || !unitId || !lessonId) return null;
    return { studyId, courseId, unitId, lessonId, ...(contentId ? { contentId } : {}) };
  } catch {
    throw new HttpError(400, "Route contains an invalid stable ID");
  }
}

function parseEvidenceRoute(pathname: string): EvidenceRoute | null {
  const match =
    /^\/api\/studies\/([^/]+)\/courses\/([^/]+)\/units\/([^/]+)\/lessons\/([^/]+)\/evidence\/(\d+)$/.exec(
      pathname,
    );
  if (!match) return null;
  try {
    const [studyId, courseId, unitId, lessonId] = match
      .slice(1, 5)
      .map((value) => StableId.parse(decodeURIComponent(value)));
    const index = Number(match[5]);
    if (
      !studyId ||
      !courseId ||
      !unitId ||
      !lessonId ||
      !Number.isSafeInteger(index) ||
      index < 0 ||
      index > 9_999
    ) {
      throw new Error("invalid evidence route");
    }
    return { lesson: { studyId, courseId, unitId, lessonId }, index };
  } catch {
    throw new HttpError(400, "Route contains an invalid evidence location");
  }
}

function parseLessonAssetRoute(pathname: string): LessonAssetRoute | null {
  const match =
    /^\/api\/studies\/([^/]+)\/courses\/([^/]+)\/units\/([^/]+)\/lessons\/([^/]+)\/revisions\/(\d+)\/assets\/([^/]+)$/.exec(
      pathname,
    );
  if (!match) return null;
  try {
    const [studyId, courseId, unitId, lessonId, assetId] = match
      .slice(1, 5)
      .concat(match[6] ?? "")
      .map((value) => StableId.parse(decodeURIComponent(value)));
    const revision = Number(match[5]);
    if (
      !studyId ||
      !courseId ||
      !unitId ||
      !lessonId ||
      !assetId ||
      !Number.isSafeInteger(revision) ||
      revision < 1 ||
      revision > 10_000
    ) {
      throw new Error("invalid lesson asset route");
    }
    return {
      lesson: { studyId, courseId, unitId, lessonId },
      revision,
      assetId,
    };
  } catch {
    throw new HttpError(400, "Route contains an invalid lesson asset location");
  }
}

function parseKnowledgeCardRoute(pathname: string): KnowledgeCardRoute | null {
  const match = /^\/api\/studies\/([^/]+)\/notes\/([^/]+)\/cards\/([^/]+)\/(reveal|review)$/.exec(
    pathname,
  );
  if (!match) return null;
  try {
    const [studyId, noteId, cardId] = match
      .slice(1, 4)
      .map((value) => StableId.parse(decodeURIComponent(value)));
    const action = match[4];
    if (!studyId || !noteId || !cardId || (action !== "reveal" && action !== "review")) {
      throw new Error("invalid knowledge card route");
    }
    return { studyId, noteId, cardId, action };
  } catch {
    throw new HttpError(400, "Route contains an invalid knowledge card location");
  }
}

function parseKnowledgeEvidenceRoute(pathname: string): KnowledgeEvidenceRoute | null {
  const match = /^\/api\/studies\/([^/]+)\/notes\/([^/]+)\/evidence\/(\d+)$/.exec(pathname);
  if (!match) return null;
  try {
    const studyId = StableId.parse(decodeURIComponent(match[1] ?? ""));
    const noteId = StableId.parse(decodeURIComponent(match[2] ?? ""));
    const index = Number(match[3]);
    if (!Number.isSafeInteger(index) || index < 0 || index > 9_999) {
      throw new Error("invalid knowledge evidence index");
    }
    return { studyId, noteId, index };
  } catch {
    throw new HttpError(400, "Route contains an invalid knowledge evidence location");
  }
}

export {
  parseRoute,
  parseEvidenceRoute,
  parseLessonAssetRoute,
  parseKnowledgeCardRoute,
  parseKnowledgeEvidenceRoute,
};
