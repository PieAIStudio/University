import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Grade } from "ts-fsrs";
import { z } from "zod";

import {
  IsoDateTime,
  SnapshotManifestSchema,
  StableId,
  UaAnalysisManifestSchema,
  type CardContent,
  type CourseManifest,
  type EvidenceReference,
  type Exercise,
  type KnowledgeCard,
  type KnowledgeNote,
  type LessonManifest,
  type StudyManifest,
  type UnitManifest,
} from "../src/domain/schemas.js";
import { loadUniversityLocalConfig } from "./config/load-config.js";
import { readEvidenceSnippet } from "./content/evidence.js";
import {
  listCourseIds,
  readCourse,
  readLatestCard,
  readLatestExercise,
  readLatestLesson,
  readUnit,
} from "./content/repository.js";
import {
  listKnowledgeNotes,
  readActiveKnowledgeCard,
  readLatestKnowledgeNote,
} from "./knowledge/repository.js";
import { SqliteLearningStore } from "./learning/sqlite-learning-store.js";
import {
  cardContentKey,
  exerciseContentKey,
  knowledgeCardContentKey,
  lessonContentKey,
  parseReviewContentKey,
  type ReviewContentKey,
  type StoredCardState,
  type StoredLessonProgress,
} from "./learning/types.js";
import { getCoursePaths, getStudyPaths } from "./studies/paths.js";
import { inspectStudyShelf, readStudy } from "./studies/repository.js";
import {
  buildExerciseCoachingPacket,
  disclosesReference,
  type CoachingPacketEvidence,
} from "./workflows/exercise-coaching-packet.js";
import { advanceLessonProgress, applyHostExerciseGrade } from "./workflows/host-exercise-grade.js";

const DEFAULT_PORT = 4317;
const MAX_JSON_BODY_BYTES = 64 * 1024;
const LOOPBACK_HOST = /^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/;
const CommandId = z.string().uuid();
const Answer = z.string().trim().min(1).max(20_000);
const ExerciseAttemptSchema = z
  .object({
    commandId: CommandId,
    contentRevision: z.number().int().positive(),
    answer: Answer,
    /**
     * Rubric points the learner claims their written answer covered. Present
     * only for `explain` exercises, which have no reference string to compare
     * against; the learner grades themselves against the rubric after writing.
     */
    met: z.array(z.number().int().nonnegative()).optional(),
  })
  .strict();
const CardRevealSchema = z
  .object({
    commandId: CommandId,
    contentRevision: z.number().int().positive(),
    answer: Answer,
    startedAt: IsoDateTime,
    usedHint: z.literal(false),
    confidence: z.number().min(0).max(1).optional(),
  })
  .strict();
const CardReviewSchema = z
  .object({
    commandId: CommandId,
    contentRevision: z.number().int().positive(),
    rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  })
  .strict();

interface OpenLearningStore {
  readonly store: SqliteLearningStore;
  /** `dev:ino` of the file this store opened, so a swapped file is detectable. */
  readonly fileId: string;
}

interface LearningRoute {
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

interface KnowledgeCardRoute {
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

interface ReviewableCard {
  readonly key: ReviewContentKey;
  readonly contentRevision: number;
  readonly front: string;
  readonly back: string;
}

interface DueCourseCard {
  readonly kind: "course-card";
  readonly studyId: string;
  readonly courseId: string;
  readonly unitId: string;
  readonly lessonId: string;
  readonly cardId: string;
  readonly front: string;
  readonly contentRevision: number;
  readonly dueAt: string;
}

interface DueKnowledgeCard {
  readonly kind: "knowledge-card";
  readonly studyId: string;
  readonly noteId: string;
  readonly cardId: string;
  readonly front: string;
  readonly contentRevision: number;
  readonly dueAt: string;
}

type DueCard = DueCourseCard | DueKnowledgeCard;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function countSnapshotManifests(directory: string): number {
  if (!existsSync(directory)) return 0;
  return readdirSync(directory, { withFileTypes: true }).filter((entry) => {
    if (!entry.isFile() || !entry.name.endsWith(".json")) return false;
    try {
      SnapshotManifestSchema.parse(readJson(`${directory}/${entry.name}`));
      return true;
    } catch {
      return false;
    }
  }).length;
}

function countUaAnalyses(directory: string): { readonly total: number; readonly ready: number } {
  if (!existsSync(directory)) return { total: 0, ready: 0 };
  let total = 0;
  let ready = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = `${directory}/${entry.name}/manifest.json`;
    if (!existsSync(path)) continue;
    try {
      const manifest = UaAnalysisManifestSchema.parse(readJson(path));
      total += 1;
      // Only a `ready` analysis can back evidence: `validateEvidence` rejects
      // everything else, and the CLI's `readyIds` agrees. Counting
      // `legacy-import` here made Studies promise analyses that would then be
      // refused at binding time with a 422 — the display was the thing that
      // was wrong, not the integrity rule.
      if (manifest.status === "ready") ready += 1;
    } catch {
      // Invalid analysis directories are isolated from the usable count.
    }
  }
  return { total, ready };
}

function countCourseManifests(directory: string): number {
  if (!existsSync(directory)) return 0;
  return readdirSync(directory, { withFileTypes: true }).filter(
    (entry) => entry.isDirectory() && existsSync(`${directory}/${entry.name}/course.json`),
  ).length;
}

function securityHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    ...securityHeaders(),
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(`${JSON.stringify(body)}\n`);
}

function rejectNonLoopbackHost(request: IncomingMessage, response: ServerResponse): boolean {
  const host = request.headers.host;
  if (!host || !LOOPBACK_HOST.test(host)) {
    sendJson(response, 403, { error: "UniversityLocal only accepts loopback Host headers" });
    return true;
  }
  return false;
}

function isLoopbackOrigin(candidate: string): boolean {
  try {
    const origin = new URL(candidate);
    return (
      origin.protocol === "http:" &&
      (origin.hostname === "127.0.0.1" ||
        origin.hostname === "localhost" ||
        origin.hostname === "[::1]" ||
        origin.hostname === "::1")
    );
  } catch {
    return false;
  }
}

function tokensMatch(actual: string | undefined, expected: string): boolean {
  if (!actual) return false;
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function requireMutationAccess(request: IncomingMessage, requestToken: string): void {
  const origin = request.headers.origin;
  if (origin && !isLoopbackOrigin(origin)) {
    throw new HttpError(403, "State-changing requests require a loopback Origin");
  }
  const tokenHeader = request.headers["x-university-local-token"];
  const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
  if (!tokensMatch(token, requestToken)) {
    throw new HttpError(403, "Missing or invalid UniversityLocal request token");
  }
  if (request.headers["content-type"]?.split(";", 1)[0]?.trim() !== "application/json") {
    throw new HttpError(415, "State-changing requests require application/json");
  }
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const declaredLength = Number(request.headers["content-length"] ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
    throw new HttpError(413, "Request body is too large");
  }
  const chunks: Buffer[] = [];
  let total = 0;
  let tooLarge = false;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    total += bytes.length;
    if (total > MAX_JSON_BODY_BYTES) {
      tooLarge = true;
    } else {
      chunks.push(bytes);
    }
  }
  if (tooLarge) throw new HttpError(413, "Request body is too large");
  if (total === 0) throw new HttpError(400, "Request body must be valid JSON");
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
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

function serializeProgress(progress: StoredLessonProgress | null): unknown {
  if (!progress) return null;
  return {
    contentRevision: progress.contentRevision,
    status: progress.status,
    progress: progress.progress,
    updatedAt: progress.updatedAt.toISOString(),
  };
}

function serializeCardState(state: StoredCardState): unknown {
  return {
    contentRevision: state.contentRevision,
    dueAt: state.due.toISOString(),
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
    lastReviewAt: state.last_review?.toISOString() ?? null,
  };
}

function publicEvidence(evidence: readonly EvidenceReference[]): unknown {
  return evidence.map((reference) => ({
    kind: reference.kind,
    sourcePath: reference.sourcePath,
    lineStart: reference.lineStart ?? null,
    lineEnd: reference.lineEnd ?? null,
    sourceCommit: reference.sourceCommit,
    nodeIds: reference.nodeIds,
    // Every reference is written with a sentence saying what this code proves.
    // It was stored and never served, so the rail could only ever show a file
    // path — the learner had to open the snippet and work out the relevance
    // themselves, for a question the author had already answered.
    note: reference.note ?? null,
  }));
}

function publicKnowledgeNote(note: KnowledgeNote, content: string): unknown {
  return {
    id: note.id,
    title: note.title,
    question: note.question,
    summary: note.summary,
    claimType: note.claimType,
    status: note.status,
    contentRevision: note.contentRevision,
    cardCount: note.cards.length,
    evidence: publicEvidence(note.evidence),
    content,
  };
}

/**
 * `defaultCourseId` decides which course a study opens on, not which course a
 * study is allowed to teach. Gating every route on it turned a study into a
 * single-course container: a second course was written, validated and stored,
 * and then answered 404 on every read. Membership is already established by the
 * path — `StableId` rejects traversal in both `parseRoute` and `getCoursePaths`
 * — so the only questions left are whether the course exists and is active.
 */
function requireActiveCourse(
  studiesRoot: string,
  studyId: string,
  courseId: string,
): CourseManifest {
  readStudy(studiesRoot, studyId);
  if (!existsSync(getCoursePaths(studiesRoot, studyId, courseId).manifest)) {
    throw new HttpError(404, "Course does not exist in this study");
  }
  const course = readCourse(studiesRoot, studyId, courseId);
  if (course.status !== "active") throw new HttpError(409, "Course is not active");
  return course;
}

/**
 * The study's active courses, default first. Ordering is what makes "next
 * lesson" meaningful across a shelf: without it the learner's next step would
 * hop between courses by whatever order the filesystem happened to return.
 */
function listActiveCourses(studiesRoot: string, study: StudyManifest): readonly CourseManifest[] {
  const courses: CourseManifest[] = [];
  for (const courseId of listCourseIds(studiesRoot, study.id)) {
    try {
      const course = readCourse(studiesRoot, study.id, courseId);
      if (course.status === "active") courses.push(course);
    } catch {
      // A course that cannot be parsed is reported by the route that reads it,
      // not by every shelf listing that walks past it.
    }
  }
  return courses.sort((left, right) => {
    if (left.id === study.defaultCourseId) return -1;
    if (right.id === study.defaultCourseId) return 1;
    return left.id.localeCompare(right.id);
  });
}

function requireActiveUnit(
  studiesRoot: string,
  route: LearningRoute,
  course: CourseManifest,
): UnitManifest {
  if (!course.unitIds.includes(route.unitId)) throw new HttpError(404, "Unit is not in the course");
  const unit = readUnit(studiesRoot, route.studyId, route.courseId, route.unitId);
  if (unit.status !== "active") throw new HttpError(409, "Unit is not active");
  return unit;
}

function requireActiveLesson(
  studiesRoot: string,
  route: LearningRoute,
): { readonly lesson: LessonManifest; readonly content: string } {
  const course = requireActiveCourse(studiesRoot, route.studyId, route.courseId);
  const unit = requireActiveUnit(studiesRoot, route, course);
  if (!unit.lessonIds.includes(route.lessonId)) {
    throw new HttpError(404, "Lesson is not in the unit");
  }
  const result = readLatestLesson(
    studiesRoot,
    route.studyId,
    route.courseId,
    route.unitId,
    route.lessonId,
  );
  if (result.manifest.status !== "active") throw new HttpError(409, "Lesson is not active");
  return { lesson: result.manifest, content: result.content };
}

function requireActiveCard(studiesRoot: string, route: LearningRoute): CardContent {
  if (!route.contentId) throw new HttpError(404, "Card ID is missing");
  const lesson = requireActiveLesson(studiesRoot, route).lesson;
  if (!lesson.cardIds.includes(route.contentId)) throw new HttpError(404, "Card is not in lesson");
  const card = readLatestCard(
    studiesRoot,
    route.studyId,
    route.courseId,
    route.unitId,
    route.lessonId,
    route.contentId,
  );
  if (card.status !== "active") throw new HttpError(409, "Card is not active");
  return card;
}

function requireActiveExercise(studiesRoot: string, route: LearningRoute): Exercise {
  if (!route.contentId) throw new HttpError(404, "Exercise ID is missing");
  const lesson = requireActiveLesson(studiesRoot, route).lesson;
  if (!lesson.exerciseIds.includes(route.contentId)) {
    throw new HttpError(404, "Exercise is not in lesson");
  }
  const exercise = readLatestExercise(
    studiesRoot,
    route.studyId,
    route.courseId,
    route.unitId,
    route.lessonId,
    route.contentId,
  );
  if (exercise.status !== "active") throw new HttpError(409, "Exercise is not active");
  return exercise;
}

function courseReviewableCard(studiesRoot: string, route: LearningRoute): ReviewableCard {
  const card = requireActiveCard(studiesRoot, route);
  return {
    key: cardContentKey({
      courseId: route.courseId,
      unitId: route.unitId,
      lessonId: route.lessonId,
      cardId: card.id,
    }),
    contentRevision: card.contentRevision,
    front: card.front,
    back: card.back,
  };
}

function knowledgeReviewableCard(
  studiesRoot: string,
  route: Pick<KnowledgeCardRoute, "studyId" | "noteId" | "cardId">,
): ReviewableCard {
  let result: { readonly note: KnowledgeNote; readonly card: KnowledgeCard };
  try {
    result = readActiveKnowledgeCard(studiesRoot, route.studyId, route.noteId, route.cardId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Knowledge card is unavailable";
    if (message.startsWith("Knowledge note is not active:")) throw new HttpError(409, message);
    if (message.startsWith("Knowledge note does not declare card:")) {
      throw new HttpError(404, message);
    }
    throw error;
  }
  return {
    key: knowledgeCardContentKey({ noteId: result.note.id, cardId: result.card.id }),
    contentRevision: result.note.contentRevision,
    front: result.card.front,
    back: result.card.back,
  };
}

function revealReviewableCard(
  response: ServerResponse,
  body: z.infer<typeof CardRevealSchema>,
  card: ReviewableCard,
  store: SqliteLearningStore,
): void {
  if (card.contentRevision !== body.contentRevision) {
    throw new HttpError(409, "Card content revision changed; reload before revealing");
  }
  if (!store.getCard(card.key)) {
    throw new HttpError(409, "Card is not enrolled in the learning schedule");
  }

  const startedAt = new Date(body.startedAt);
  const duplicate = store.getRetrievalAttemptByCommandId(body.commandId);
  if (duplicate) {
    if (
      duplicate.cardKey !== card.key ||
      duplicate.contentRevision !== body.contentRevision ||
      duplicate.answer !== body.answer ||
      duplicate.startedAt.getTime() !== startedAt.getTime() ||
      duplicate.usedHint !== body.usedHint ||
      duplicate.confidence !== body.confidence
    ) {
      throw new HttpError(409, "Command ID was already used for another card reveal");
    }
    sendJson(response, 200, {
      attemptId: duplicate.attemptId,
      submittedAnswer: duplicate.answer,
      back: card.back,
      durationMs: duplicate.durationMs,
    });
    return;
  }

  const revealedAt = new Date();
  if (startedAt.getTime() > revealedAt.getTime()) {
    throw new HttpError(400, "Card retrieval start time cannot be in the future");
  }
  let attempt;
  try {
    attempt = store.recordRetrievalAttempt({
      commandId: body.commandId,
      cardKey: card.key,
      contentRevision: body.contentRevision,
      answer: body.answer,
      startedAt,
      revealedAt,
      usedHint: body.usedHint,
      ...(body.confidence === undefined ? {} : { confidence: body.confidence }),
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Command ID conflict:")) {
      throw new HttpError(409, "Command ID was already used for another card reveal");
    }
    throw error;
  }
  sendJson(response, 200, {
    attemptId: attempt.attemptId,
    submittedAnswer: body.answer,
    back: card.back,
    durationMs: attempt.durationMs,
  });
}

function reviewReviewableCard(
  response: ServerResponse,
  body: z.infer<typeof CardReviewSchema>,
  card: ReviewableCard,
  store: SqliteLearningStore,
): void {
  if (card.contentRevision !== body.contentRevision) {
    throw new HttpError(409, "Card content revision changed; reload before reviewing");
  }
  if (!store.getCard(card.key)) {
    throw new HttpError(409, "Card is not enrolled in the learning schedule");
  }
  try {
    const receipt = store.reviewCard({
      commandId: body.commandId,
      cardKey: card.key,
      contentRevision: body.contentRevision,
      rating: body.rating as Grade,
    });
    sendJson(response, 200, {
      eventId: receipt.eventId,
      state: serializeCardState(receipt.state),
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Command ID conflict:")) {
      throw new HttpError(409, "Command ID was already used for another card review");
    }
    throw error;
  }
}

/**
 * Short answers are compared exactly after normalising the noise a learner
 * cannot be expected to guess: unicode form, case, run-together whitespace,
 * wrapping quotes or backticks, and sentence-final punctuation. Marking
 * `ink.` or `"ink"` wrong teaches typing, not the material. Anything past
 * that — synonyms, alternative spellings — belongs in the content as
 * accepted answers, not in a grader heuristic that could start accepting
 * genuinely wrong responses.
 */
/**
 * Reusing a command ID with a different body is a client conflict, not a
 * server fault. The card paths already mapped it to 409; the exercise path
 * let it escape as a generic 500, which tells a retrying client nothing.
 */
function runWithCommandConflictMapped<T>(message: string, operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Command ID conflict:")) {
      throw new HttpError(409, message);
    }
    throw error;
  }
}

export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^[`'"“”‘’「『【（([]+|[`'"“”‘’」』】）)\]]+$/g, "")
    .replace(/[.。!！?？;；,，、]+$/u, "")
    .trim()
    .toLocaleLowerCase("en-US");
}

function buildStudyView(
  studiesRoot: string,
  study: StudyManifest,
  store: SqliteLearningStore | null,
): unknown {
  const courseViews = listActiveCourses(studiesRoot, study).map((course) => {
    const units = course.unitIds.map((unitId) => {
      const unit = readUnit(studiesRoot, study.id, course.id, unitId);
      return {
        ...unit,
        lessons: unit.lessonIds.map((lessonId) => {
          const lesson = readLatestLesson(
            studiesRoot,
            study.id,
            course.id,
            unit.id,
            lessonId,
          ).manifest;
          const key = lessonContentKey({ courseId: course.id, unitId: unit.id, lessonId });
          return {
            id: lesson.id,
            title: lesson.title,
            status: lesson.status,
            contentRevision: lesson.contentRevision,
            cardCount: lesson.cardIds.length,
            exerciseCount: lesson.exerciseIds.length,
            progress: serializeProgress(store?.getLessonProgress(key) ?? null),
          };
        }),
      };
    });
    return { ...course, units, isDefault: course.id === study.defaultCourseId };
  });
  const notes = listKnowledgeNotes(studiesRoot, study.id).map((note) => {
    const stored = readLatestKnowledgeNote(studiesRoot, study.id, note.id);
    return publicKnowledgeNote(stored.note, stored.content);
  });
  return { study, courses: courseViews, notes };
}

function buildLessonView(
  studiesRoot: string,
  route: LearningRoute,
  store: SqliteLearningStore | null,
): unknown {
  const { lesson, content } = requireActiveLesson(studiesRoot, route);
  const lessonKey = lessonContentKey({
    courseId: route.courseId,
    unitId: route.unitId,
    lessonId: route.lessonId,
  });
  return {
    lesson: {
      id: lesson.id,
      title: lesson.title,
      contentRevision: lesson.contentRevision,
      content,
      evidence: publicEvidence(lesson.evidence),
      progress: serializeProgress(store?.getLessonProgress(lessonKey) ?? null),
      exercises: lesson.exerciseIds.map((exerciseId) => {
        const exercise = requireActiveExercise(studiesRoot, { ...route, contentId: exerciseId });
        const exerciseKey = exerciseContentKey({
          courseId: route.courseId,
          unitId: route.unitId,
          lessonId: route.lessonId,
          exerciseId: exercise.id,
        });
        const hostGrade = store?.getLatestHostExerciseGrade(exerciseKey, exercise.contentRevision);
        const hostPassed = store?.hasCorrectExerciseAttempt(exerciseKey, exercise.contentRevision);
        return {
          id: exercise.id,
          kind: exercise.kind,
          title: exercise.title,
          prompt: exercise.prompt,
          contentRevision: exercise.contentRevision,
          awaitingHostGrade: !hostPassed,
          hostGrade: hostGrade
            ? {
                passed: hostGrade.passed,
                evaluation: hostGrade.evaluation,
                extensions: hostGrade.extensions,
                host: hostGrade.host,
                learnerAnswer: hostGrade.learnerAnswer,
                occurredAt: hostGrade.occurredAt.toISOString(),
              }
            : null,
        };
      }),
      cards: lesson.cardIds.map((cardId) => {
        const card = requireActiveCard(studiesRoot, { ...route, contentId: cardId });
        return {
          id: card.id,
          kind: card.kind,
          front: card.front,
          contentRevision: card.contentRevision,
        };
      }),
    },
  };
}

/**
 * Evidence carried by the packet. The exercise's own references come first
 * because they are what the question is about; the lesson's references follow
 * as context. Five is a clipboard budget, not a correctness limit — a packet
 * nobody can paste teaches nothing.
 */
const PACKET_EVIDENCE_LIMIT = 5;
const PACKET_EVIDENCE_CONTEXT_LINES = 2;

function evidenceIdentity(reference: EvidenceReference): string {
  return `${reference.sourcePath}:${reference.lineStart ?? ""}-${reference.lineEnd ?? ""}`;
}

function collectPacketEvidence(
  studiesRoot: string,
  studyId: string,
  references: readonly EvidenceReference[],
): { readonly evidence: readonly CoachingPacketEvidence[]; readonly omitted: number } {
  const evidence: CoachingPacketEvidence[] = [];
  const seen = new Set<string>();
  let omitted = 0;
  for (const reference of references) {
    const identity = evidenceIdentity(reference);
    if (seen.has(identity)) continue;
    seen.add(identity);
    if (evidence.length >= PACKET_EVIDENCE_LIMIT) {
      omitted += 1;
      continue;
    }
    try {
      evidence.push({
        note: reference.note ?? null,
        snippet: readEvidenceSnippet(
          studiesRoot,
          studyId,
          reference,
          PACKET_EVIDENCE_CONTEXT_LINES,
        ),
      });
    } catch {
      // A reference can point at a file too large to display, or at build
      // configuration outside the UA graph. One unreadable snippet must not
      // cost the learner the whole packet.
      omitted += 1;
    }
  }
  return { evidence, omitted };
}

function buildCoachingPacketResponse(
  studiesRoot: string,
  route: LearningRoute,
  getStore: (studyId: string, create?: boolean) => SqliteLearningStore | null,
): unknown {
  const exercise = requireActiveExercise(studiesRoot, route);
  const lesson = requireActiveLesson(studiesRoot, route).lesson;
  const store = getStore(route.studyId);
  const exerciseKey = exerciseContentKey({
    courseId: route.courseId,
    unitId: route.unitId,
    lessonId: route.lessonId,
    exerciseId: exercise.id,
  });
  const submission = store?.getLatestLearnerSubmission(exerciseKey, exercise.contentRevision);
  if (!submission) {
    throw new HttpError(409, "Submit an answer before copying the coaching packet");
  }
  const submissionCount = store!.countLearnerSubmissions(exerciseKey, exercise.contentRevision);
  const passed = store!.hasCorrectExerciseAttempt(exerciseKey, exercise.contentRevision);
  const disclose = disclosesReference({ passed, submissionCount });

  const { evidence, omitted } = collectPacketEvidence(studiesRoot, route.studyId, [
    ...exercise.evidence,
    ...lesson.evidence,
  ]);

  const packet = buildExerciseCoachingPacket({
    locator: {
      studyId: route.studyId,
      courseId: route.courseId,
      unitId: route.unitId,
      lessonId: route.lessonId,
    },
    lessonTitle: lesson.title,
    exercise: {
      id: exercise.id,
      kind: exercise.kind,
      title: exercise.title,
      prompt: exercise.prompt,
      contentRevision: exercise.contentRevision,
    },
    learnerAnswer: submission.answer,
    submissionCount,
    commandId: randomUUID(),
    evidence,
    evidenceOmitted: omitted,
    reference: !disclose
      ? null
      : exercise.kind === "short-answer"
        ? { kind: "short-answer", expectedAnswer: exercise.expectedAnswer }
        : { kind: "explain", rubric: exercise.rubric },
  });

  return {
    packet,
    referenceDisclosed: disclose,
    evidenceCount: evidence.length,
    evidenceOmitted: omitted,
    submissionCount,
  };
}

function defaultProjectRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../..");
}

export function createUniversityLocalHttpServer(projectRoot: string): Server {
  const config = loadUniversityLocalConfig({ projectRoot });
  const requestToken = randomBytes(32).toString("base64url");
  const stores = new Map<string, OpenLearningStore>();

  /**
   * Identity of the file behind a path, not the path itself. `learner restore`
   * and `learner reset` install a database by renaming a new file over the old
   * one; on POSIX the old inode stays alive for anyone still holding it open.
   * Without this check the server kept serving — and writing to — a database
   * that had already been replaced, so everything the learner did after a
   * restore landed in an unlinked file nobody would ever read again.
   * `assertQuiescent` in the restore workflow cannot catch this: it looks for
   * active transactions, and an idle open connection has none.
   */
  const databaseIdentity = (path: string): string | null => {
    try {
      const stats = statSync(path);
      return `${stats.dev}:${stats.ino}`;
    } catch {
      return null;
    }
  };

  const getStore = (studyId: string, create = false): SqliteLearningStore | null => {
    const path = getStudyPaths(config.studiesRoot, studyId).learner.database;
    const identity = databaseIdentity(path);
    const open = stores.get(studyId);
    if (open) {
      if (identity !== null && identity === open.fileId) return open.store;
      try {
        open.store.close();
      } catch {
        // Already closed, or closed under us. Dropping the handle is the point.
      }
      stores.delete(studyId);
    }
    if (!create && identity === null) return null;
    const store = new SqliteLearningStore(path);
    const openedId = databaseIdentity(path);
    if (openedId !== null) stores.set(studyId, { store, fileId: openedId });
    return store;
  };

  for (const study of inspectStudyShelf(config.studiesRoot).studies) {
    if (existsSync(getStudyPaths(config.studiesRoot, study.id).learner.database)) {
      getStore(study.id);
    }
  }

  const server = createServer((request, response) => {
    void (async () => {
      if (rejectNonLoopbackHost(request, response)) return;
      const url = new URL(request.url ?? "/", "http://127.0.0.1");

      if (request.method === "GET" && url.pathname === "/api/health") {
        sendJson(response, 200, { status: "ok", service: "university-local" });
        return;
      }
      if (url.pathname === "/api/health" && request.method !== "GET") {
        sendJson(response, 405, { error: "Method not allowed" });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/bootstrap") {
        const shelf = inspectStudyShelf(config.studiesRoot);
        const studies = shelf.studies.map((study) => {
          const paths = getStudyPaths(config.studiesRoot, study.id);
          const ua = countUaAnalyses(paths.ua);
          let defaultCourse: { id: string; title: string; status: string } | null = null;
          if (study.defaultCourseId) {
            try {
              const course = readCourse(config.studiesRoot, study.id, study.defaultCourseId);
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
            activeCourseCount: listActiveCourses(config.studiesRoot, study).length,
            defaultCourse,
            hasLearningDatabase: existsSync(paths.learner.database),
          };
        });

        const dueCards: DueCard[] = [];
        let nextLesson: Record<string, unknown> | null = null;
        const learningIssues: string[] = [];
        // `nextLesson` is whatever incomplete lesson the walk meets first, so the
        // walk order is the curriculum order. Focus moves the chosen study and
        // course to the front rather than filtering the rest out: finishing the
        // focused study should roll on to the next one, not report nothing left.
        // Due cards are unaffected — they are sorted by due date afterwards.
        const focusedStudies = [...shelf.studies].sort((left, right) => {
          const rank = (id: string): number => (id === config.focus?.studyId ? 0 : 1);
          return rank(left.id) - rank(right.id);
        });
        for (const study of focusedStudies) {
          const store = getStore(study.id);
          // A focused run is walked in the order it was written, and everything
          // it does not name keeps its own order behind it.
          const focusedCourseIds = study.id === config.focus?.studyId ? config.focus.courseIds : [];
          const activeCourses = [...listActiveCourses(config.studiesRoot, study)].sort(
            (left, right) => {
              const rank = (id: string): number => {
                const position = focusedCourseIds.indexOf(id);
                return position === -1 ? focusedCourseIds.length : position;
              };
              return rank(left.id) - rank(right.id);
            },
          );
          const coursesById = new Map(activeCourses.map((course) => [course.id, course]));
          for (const course of activeCourses) {
            try {
              for (const unitId of course.unitIds) {
                const unit = readUnit(config.studiesRoot, study.id, course.id, unitId);
                if (unit.status !== "active") continue;
                for (const lessonId of unit.lessonIds) {
                  const lesson = readLatestLesson(
                    config.studiesRoot,
                    study.id,
                    course.id,
                    unit.id,
                    lessonId,
                  ).manifest;
                  if (lesson.status !== "active") continue;
                  const key = lessonContentKey({ courseId: course.id, unitId: unit.id, lessonId });
                  const progress = store?.getLessonProgress(key) ?? null;
                  // Completion belongs to the revision it was earned on. A
                  // revised lesson re-enrolls its cards only when it is
                  // completed again, so treating an old completion as current
                  // left the learner with a course that looked finished and a
                  // review queue that had quietly gone empty.
                  const finished =
                    progress?.status === "completed" &&
                    progress.contentRevision === lesson.contentRevision;
                  if (!nextLesson && !finished) {
                    nextLesson = {
                      studyId: study.id,
                      studyTitle: study.title,
                      courseId: course.id,
                      courseTitle: course.title,
                      unitId: unit.id,
                      lessonId,
                      lessonTitle: lesson.title,
                      contentRevision: lesson.contentRevision,
                      progress: serializeProgress(progress),
                    };
                  }
                }
              }
            } catch (error) {
              learningIssues.push(
                `${study.id}/${course.id}: course: ${error instanceof Error ? error.message : "invalid course learning data"}`,
              );
            }
          }

          let states: readonly StoredCardState[] = [];
          try {
            states = store?.listDueCards(new Date(), 1_000) ?? [];
          } catch (error) {
            learningIssues.push(
              `${study.id}: due queue: ${error instanceof Error ? error.message : "invalid learner data"}`,
            );
          }
          for (const state of states) {
            try {
              const identity = parseReviewContentKey(state.cardKey);
              if (identity.kind === "course-card") {
                if (!coursesById.has(identity.courseId)) continue;
                const card = requireActiveCard(config.studiesRoot, {
                  studyId: study.id,
                  ...identity,
                  contentId: identity.cardId,
                });
                if (card.contentRevision !== state.contentRevision) continue;
                dueCards.push({
                  kind: "course-card",
                  studyId: study.id,
                  courseId: identity.courseId,
                  unitId: identity.unitId,
                  lessonId: identity.lessonId,
                  cardId: identity.cardId,
                  front: card.front,
                  contentRevision: card.contentRevision,
                  dueAt: state.due.toISOString(),
                });
                continue;
              }

              let active;
              try {
                active = readActiveKnowledgeCard(
                  config.studiesRoot,
                  study.id,
                  identity.noteId,
                  identity.cardId,
                );
              } catch (error) {
                if (
                  error instanceof Error &&
                  error.message.startsWith("Knowledge note is not active:")
                ) {
                  continue;
                }
                throw error;
              }
              if (active.note.contentRevision !== state.contentRevision) continue;
              dueCards.push({
                kind: "knowledge-card",
                studyId: study.id,
                noteId: active.note.id,
                cardId: active.card.id,
                front: active.card.front,
                contentRevision: active.note.contentRevision,
                dueAt: state.due.toISOString(),
              });
            } catch (error) {
              learningIssues.push(
                `${study.id}: due ${state.cardKey}: ${error instanceof Error ? error.message : "invalid review item"}`,
              );
            }
          }
        }
        dueCards.sort((left, right) => left.dueAt.localeCompare(right.dueAt));
        sendJson(response, 200, {
          product: "UniversityLocal",
          requestToken,
          studiesRoot: config.studiesRoot,
          studies,
          shelfIssues: shelf.issues,
          today: {
            dueCount: dueCards.length,
            card: dueCards[0] ?? null,
            nextLesson,
            focus: config.focus ?? null,
            issues: learningIssues,
          },
        });
        return;
      }
      if (url.pathname === "/api/bootstrap" && request.method !== "GET") {
        sendJson(response, 405, { error: "Method not allowed" });
        return;
      }

      const studyMatch = /^\/api\/studies\/([^/]+)$/.exec(url.pathname);
      if (request.method === "GET" && studyMatch) {
        let studyId: string;
        try {
          studyId = StableId.parse(decodeURIComponent(studyMatch[1] ?? ""));
        } catch {
          throw new HttpError(400, "Route contains an invalid study ID");
        }
        const study = readStudy(config.studiesRoot, studyId);
        sendJson(response, 200, buildStudyView(config.studiesRoot, study, getStore(study.id)));
        return;
      }

      const lessonRoute = parseRoute(
        url.pathname,
        /^\/api\/studies\/([^/]+)\/courses\/([^/]+)\/units\/([^/]+)\/lessons\/([^/]+)$/,
      );
      if (request.method === "GET" && lessonRoute) {
        sendJson(
          response,
          200,
          buildLessonView(config.studiesRoot, lessonRoute, getStore(lessonRoute.studyId)),
        );
        return;
      }

      const evidenceRoute = parseEvidenceRoute(url.pathname);
      if (request.method === "GET" && evidenceRoute) {
        const { lesson } = requireActiveLesson(config.studiesRoot, evidenceRoute.lesson);
        const evidence = lesson.evidence[evidenceRoute.index];
        if (!evidence) throw new HttpError(404, "Lesson evidence index does not exist");
        try {
          sendJson(
            response,
            200,
            readEvidenceSnippet(config.studiesRoot, evidenceRoute.lesson.studyId, evidence),
          );
        } catch (error) {
          throw new HttpError(
            422,
            `Lesson evidence cannot be displayed: ${error instanceof Error ? error.message : "invalid immutable evidence"}`,
          );
        }
        return;
      }

      const knowledgeEvidenceRoute = parseKnowledgeEvidenceRoute(url.pathname);
      if (request.method === "GET" && knowledgeEvidenceRoute) {
        const stored = readLatestKnowledgeNote(
          config.studiesRoot,
          knowledgeEvidenceRoute.studyId,
          knowledgeEvidenceRoute.noteId,
        );
        const evidence = stored.note.evidence[knowledgeEvidenceRoute.index];
        if (!evidence) throw new HttpError(404, "Knowledge note evidence index does not exist");
        try {
          sendJson(
            response,
            200,
            readEvidenceSnippet(config.studiesRoot, knowledgeEvidenceRoute.studyId, evidence),
          );
        } catch (error) {
          throw new HttpError(
            422,
            `Knowledge note evidence cannot be displayed: ${error instanceof Error ? error.message : "invalid immutable evidence"}`,
          );
        }
        return;
      }

      const exerciseRoute = parseRoute(
        url.pathname,
        /^\/api\/studies\/([^/]+)\/courses\/([^/]+)\/units\/([^/]+)\/lessons\/([^/]+)\/exercises\/([^/]+)\/attempt$/,
      );
      if (request.method === "POST" && exerciseRoute) {
        requireMutationAccess(request, requestToken);
        const body = ExerciseAttemptSchema.parse(await readJsonBody(request));
        const exercise = requireActiveExercise(config.studiesRoot, exerciseRoute);
        if (exercise.contentRevision !== body.contentRevision) {
          throw new HttpError(409, "Exercise content revision changed; reload before submitting");
        }
        // All exercise kinds: record learner answer only (score 0). Semantic
        // pass/fail comes from AI host write-back (host-grade). Self-rubric is
        // no longer used for completion.
        if (body.met !== undefined) {
          throw new HttpError(
            400,
            "Self-assessment is disabled; submit the answer and use host-grade write-back",
          );
        }
        const maxScore = 1;
        const score = 0;
        const awaitingHostGrade = true;
        const correct = false;
        const store = getStore(exerciseRoute.studyId, true)!;
        const exerciseKey = exerciseContentKey({
          courseId: exerciseRoute.courseId,
          unitId: exerciseRoute.unitId,
          lessonId: exerciseRoute.lessonId,
          exerciseId: exercise.id,
        });
        const lesson = requireActiveLesson(config.studiesRoot, exerciseRoute).lesson;
        const lessonKey = lessonContentKey({
          courseId: exerciseRoute.courseId,
          unitId: exerciseRoute.unitId,
          lessonId: exerciseRoute.lessonId,
        });
        const attemptId = runWithCommandConflictMapped(
          "Command ID was already used for another exercise attempt",
          () =>
            store.transaction(() => {
              const recordedAttemptId = store.recordExerciseAttempt({
                commandId: body.commandId,
                exerciseKey,
                contentRevision: exercise.contentRevision,
                score,
                maxScore,
                response: { phase: "learner-submit", answer: body.answer },
              });
              // Same advancement the host-grade write-back runs. Two copies of
              // this drifted once already, and the drift made every failing
              // grade unrecordable.
              advanceLessonProgress(
                store,
                config.studiesRoot,
                { ...exerciseRoute, exerciseId: exercise.id },
                lesson,
                lessonKey,
              );
              return recordedAttemptId;
            }),
        );
        const attemptCount = store.countExerciseAttempts(exerciseKey, exercise.contentRevision);
        const hostGrade = store.getLatestHostExerciseGrade(exerciseKey, exercise.contentRevision);
        sendJson(response, 200, {
          attemptId,
          correct,
          score,
          maxScore,
          attemptCount,
          awaitingHostGrade,
          hostGrade: hostGrade
            ? {
                passed: hostGrade.passed,
                evaluation: hostGrade.evaluation,
                extensions: hostGrade.extensions,
                host: hostGrade.host,
                learnerAnswer: hostGrade.learnerAnswer,
                occurredAt: hostGrade.occurredAt.toISOString(),
              }
            : null,
        });
        return;
      }

      const hostGradeRoute = parseRoute(
        url.pathname,
        /^\/api\/studies\/([^/]+)\/courses\/([^/]+)\/units\/([^/]+)\/lessons\/([^/]+)\/exercises\/([^/]+)\/host-grade$/,
      );
      if (request.method === "POST" && hostGradeRoute) {
        requireMutationAccess(request, requestToken);
        if (!hostGradeRoute.contentId) throw new HttpError(404, "Exercise ID is missing");
        const body = await readJsonBody(request);
        const store = getStore(hostGradeRoute.studyId, true)!;
        try {
          const result = runWithCommandConflictMapped(
            "Command ID was already used for another exercise attempt",
            () =>
              applyHostExerciseGrade({
                studiesRoot: config.studiesRoot,
                store,
                route: {
                  studyId: hostGradeRoute.studyId,
                  courseId: hostGradeRoute.courseId,
                  unitId: hostGradeRoute.unitId,
                  lessonId: hostGradeRoute.lessonId,
                  exerciseId: hostGradeRoute.contentId!,
                },
                proposal: body,
              }),
          );
          sendJson(response, 200, {
            attemptId: result.attemptId,
            correct: result.passed,
            passed: result.passed,
            lessonComplete: result.lessonComplete,
            hostGrade: result.hostGrade,
          });
        } catch (error) {
          if (error instanceof z.ZodError) {
            throw new HttpError(400, error.issues.map((issue) => issue.message).join("; "));
          }
          throw new HttpError(409, error instanceof Error ? error.message : "Host grade failed");
        }
        return;
      }

      // Rubric self-assessment retired: explain exercises use host-grade like
      // short-answer. Keep the route as a clear 410 so old clients do not hang.
      const exerciseRubricRoute = parseRoute(
        url.pathname,
        /^\/api\/studies\/([^/]+)\/courses\/([^/]+)\/units\/([^/]+)\/lessons\/([^/]+)\/exercises\/([^/]+)\/rubric$/,
      );
      if (request.method === "POST" && exerciseRubricRoute) {
        throw new HttpError(
          410,
          "Self-assessment rubric is retired; submit the answer and use host-grade write-back",
        );
      }

      const coachingPacketRoute = parseRoute(
        url.pathname,
        /^\/api\/studies\/([^/]+)\/courses\/([^/]+)\/units\/([^/]+)\/lessons\/([^/]+)\/exercises\/([^/]+)\/coaching-packet$/,
      );
      if (request.method === "GET" && coachingPacketRoute) {
        sendJson(
          response,
          200,
          buildCoachingPacketResponse(config.studiesRoot, coachingPacketRoute, getStore),
        );
        return;
      }

      const cardRevealRoute = parseRoute(
        url.pathname,
        /^\/api\/studies\/([^/]+)\/courses\/([^/]+)\/units\/([^/]+)\/lessons\/([^/]+)\/cards\/([^/]+)\/reveal$/,
      );
      if (request.method === "POST" && cardRevealRoute) {
        requireMutationAccess(request, requestToken);
        const body = CardRevealSchema.parse(await readJsonBody(request));
        const store = getStore(cardRevealRoute.studyId, true)!;
        revealReviewableCard(
          response,
          body,
          courseReviewableCard(config.studiesRoot, cardRevealRoute),
          store,
        );
        return;
      }

      const cardReviewRoute = parseRoute(
        url.pathname,
        /^\/api\/studies\/([^/]+)\/courses\/([^/]+)\/units\/([^/]+)\/lessons\/([^/]+)\/cards\/([^/]+)\/review$/,
      );
      if (request.method === "POST" && cardReviewRoute) {
        requireMutationAccess(request, requestToken);
        const body = CardReviewSchema.parse(await readJsonBody(request));
        const store = getStore(cardReviewRoute.studyId, true)!;
        reviewReviewableCard(
          response,
          body,
          courseReviewableCard(config.studiesRoot, cardReviewRoute),
          store,
        );
        return;
      }

      const knowledgeCardRoute = parseKnowledgeCardRoute(url.pathname);
      if (request.method === "POST" && knowledgeCardRoute?.action === "reveal") {
        requireMutationAccess(request, requestToken);
        const body = CardRevealSchema.parse(await readJsonBody(request));
        const store = getStore(knowledgeCardRoute.studyId, true)!;
        revealReviewableCard(
          response,
          body,
          knowledgeReviewableCard(config.studiesRoot, knowledgeCardRoute),
          store,
        );
        return;
      }
      if (request.method === "POST" && knowledgeCardRoute?.action === "review") {
        requireMutationAccess(request, requestToken);
        const body = CardReviewSchema.parse(await readJsonBody(request));
        const store = getStore(knowledgeCardRoute.studyId, true)!;
        reviewReviewableCard(
          response,
          body,
          knowledgeReviewableCard(config.studiesRoot, knowledgeCardRoute),
          store,
        );
        return;
      }

      if (request.method !== "GET" && request.method !== "POST") {
        sendJson(response, 405, { error: "Method not allowed" });
        return;
      }
      sendJson(response, 404, { error: "Not found" });
    })().catch((error: unknown) => {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      if (error instanceof HttpError) {
        sendJson(response, error.status, { error: error.message });
        return;
      }
      if (error instanceof z.ZodError) {
        sendJson(response, 400, { error: "Request validation failed", issues: error.issues });
        return;
      }
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? (error as { code?: unknown }).code
          : undefined;
      if (code === "ENOENT") {
        sendJson(response, 404, { error: "Requested learning content was not found" });
        return;
      }
      console.error("UniversityLocal API error", error);
      sendJson(response, 500, { error: "UniversityLocal could not complete the request" });
    });
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 5_000;
  server.on("close", () => {
    for (const open of stores.values()) open.store.close();
    stores.clear();
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const projectRoot = process.env["UNIVERSITY_LOCAL_PROJECT_ROOT"] ?? defaultProjectRoot();
  const port = Number(process.env["UNIVERSITY_LOCAL_PORT"] ?? DEFAULT_PORT);
  const server = createUniversityLocalHttpServer(projectRoot);
  server.listen(port, "127.0.0.1", () => {
    console.log(`UniversityLocal API listening on http://127.0.0.1:${port}`);
  });
}
