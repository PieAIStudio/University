import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";

import type { LanguageRange } from "@pieai/university-core/domain/lesson-marks.js";
import {
  LanguageOverlaySchema,
  StableId,
  type LanguageAnchor,
  type LanguageOverlay,
} from "@pieai/university-core/domain/schemas.js";
import { readLatestLesson } from "../content/repository.js";
import { getStudyPaths } from "../studies/paths.js";
import { writeJsonAtomically } from "../storage/atomic-json.js";
import { resolveAnchors } from "./resolve-anchors.js";

export type { LanguageRange } from "@pieai/university-core/domain/lesson-marks.js";

export type LanguageCode = "en";

function getOverlayPath(
  studiesRoot: string,
  studyId: string,
  language: LanguageCode,
  route: { readonly courseId: string; readonly unitId: string; readonly lessonId: string },
  contentRevision: number,
): string {
  return join(
    getStudyPaths(studiesRoot, studyId).language,
    language,
    StableId.parse(route.courseId),
    StableId.parse(route.unitId),
    StableId.parse(route.lessonId),
    `${contentRevision}.json`,
  );
}

interface WriteOverlayInput {
  readonly studiesRoot: string;
  readonly studyId: string;
  readonly language: LanguageCode;
  readonly courseId: string;
  readonly unitId: string;
  readonly lessonId: string;
  readonly anchors: readonly LanguageAnchor[];
  readonly now?: Date;
}

interface WriteOverlayReceipt {
  readonly overlay: LanguageOverlay;
  readonly placed: number;
  readonly rejected: readonly { readonly senseId: string; readonly reason: string }[];
}

/**
 * Writes the English layer for whatever revision of the lesson is current.
 *
 * Anchors that do not resolve are rejected at write time, not at read time. An
 * overlay is authored content, and content that silently does nothing is worse
 * than content that fails: the author would keep believing the word is on the
 * page.
 */
export function writeLanguageOverlay(input: WriteOverlayInput): WriteOverlayReceipt {
  const { manifest, content } = readLatestLesson(
    input.studiesRoot,
    input.studyId,
    input.courseId,
    input.unitId,
    input.lessonId,
  );
  const { resolved, unresolved } = resolveAnchors(content, input.anchors);
  const overlay = LanguageOverlaySchema.parse({
    schemaVersion: 1,
    language: input.language,
    courseId: input.courseId,
    unitId: input.unitId,
    lessonId: input.lessonId,
    contentRevision: manifest.contentRevision,
    contentHash: manifest.contentHash,
    anchors: resolved.map((item) => item.anchor),
    updatedAt: (input.now ?? new Date()).toISOString(),
  });
  const path = getOverlayPath(
    input.studiesRoot,
    input.studyId,
    input.language,
    input,
    manifest.contentRevision,
  );
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeJsonAtomically(path, overlay);
  return {
    overlay,
    placed: resolved.length,
    rejected: unresolved.map((item) => ({
      senseId: item.anchor.senseId,
      reason: item.reason,
    })),
  };
}

export type OverlayStatus = "annotated" | "not-annotated" | "stale";

interface LessonLanguageLayer {
  readonly status: OverlayStatus;
  /**
   * Character ranges, not rewritten Markdown. The browser already has the
   * lesson; sending a second copy cut into pieces would double the payload and,
   * worse, make it possible for what is displayed to differ from what is
   * stored.
   */
  readonly ranges: readonly LanguageRange[];
  readonly senseIds: readonly string[];
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

/**
 * Reads the layer for a lesson, refusing to render one that was written against
 * different text.
 *
 * The hash comparison is the whole safety argument. Lesson revisions are
 * immutable, so a matching hash proves the bytes are identical and every anchor
 * position still means what the author meant. A mismatch can only happen when
 * the lesson was revised, and then the honest answer is that this revision has
 * no English layer yet — not a best guess at where the words used to be.
 */
export function readLessonLanguageLayer(input: {
  readonly studiesRoot: string;
  readonly studyId: string;
  readonly language: LanguageCode;
  readonly courseId: string;
  readonly unitId: string;
  readonly lessonId: string;
  readonly contentRevision: number;
  readonly content: string;
}): LessonLanguageLayer {
  const path = getOverlayPath(
    input.studiesRoot,
    input.studyId,
    input.language,
    input,
    input.contentRevision,
  );
  if (!existsSync(path)) {
    return { status: "not-annotated", ranges: [], senseIds: [] };
  }
  const overlay = LanguageOverlaySchema.parse(JSON.parse(readFileSync(path, "utf8")) as unknown);
  if (overlay.contentHash !== sha256(input.content)) {
    return { status: "stale", ranges: [], senseIds: [] };
  }
  const { resolved } = resolveAnchors(input.content, overlay.anchors);
  return {
    status: "annotated",
    ranges: resolved.map((item) => ({
      start: item.start,
      end: item.end,
      senseId: item.anchor.senseId,
    })),
    senseIds: [...new Set(resolved.map((item) => item.anchor.senseId))].sort(),
  };
}
