import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { basename, dirname, join, relative } from "node:path";

import { z } from "zod";

import {
  CardContentSchema,
  ContentStatus,
  CourseManifestSchema,
  ExerciseSchema,
  LessonManifestSchema,
  StableId,
  UnitManifestSchema,
  type CardContent,
  type CourseManifest,
  type Exercise,
  type LessonManifest,
  type UnitManifest,
} from "../../src/domain/schemas.js";
import { writeJsonAtomically, writeTextAtomically } from "../storage/atomic-json.js";
import { getCoursePaths, getLessonPaths, getUnitPaths } from "../studies/paths.js";
import { readStudy } from "../studies/repository.js";
import { validateEvidence } from "./evidence.js";

const EMPTY_SHA256 = `sha256:${"0".repeat(64)}`;

const LatestRevisionPointerSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: StableId,
    contentRevision: z.number().int().positive(),
  })
  .strict();

type LatestRevisionPointer = z.infer<typeof LatestRevisionPointerSchema>;

type ExerciseWithoutHash = Exercise extends infer Item
  ? Item extends { contentHash: string }
    ? Omit<Item, "contentHash">
    : never
  : never;

export interface WriteLessonRevisionInput {
  readonly manifest: Omit<LessonManifest, "contentHash">;
  readonly content: string;
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((child) => (child === undefined ? "null" : canonicalJson(child))).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function assertUniqueIds(ids: readonly string[], label: string): void {
  if (new Set(ids).size !== ids.length) throw new Error(`${label} must not contain duplicate IDs`);
}

function assertCourseStructure(course: CourseManifest): void {
  assertUniqueIds(course.unitIds, `Course ${course.id} unitIds`);
}

function assertUnitStructure(course: CourseManifest, unit: UnitManifest): void {
  if (!course.unitIds.includes(unit.id))
    throw new Error(`Course does not declare unit: ${unit.id}`);
  assertUniqueIds(unit.lessonIds, `Unit ${unit.id} lessonIds`);
  assertUniqueIds(unit.prerequisiteUnitIds, `Unit ${unit.id} prerequisiteUnitIds`);
  if (unit.prerequisiteUnitIds.includes(unit.id)) {
    throw new Error(`Unit must not list itself as a prerequisite: ${unit.id}`);
  }
  for (const prerequisiteId of unit.prerequisiteUnitIds) {
    if (!course.unitIds.includes(prerequisiteId)) {
      throw new Error(`Course does not declare prerequisite unit: ${prerequisiteId}`);
    }
  }
}

function assertLessonStructure(unit: UnitManifest, lesson: LessonManifest): void {
  if (!unit.lessonIds.includes(lesson.id))
    throw new Error(`Unit does not declare lesson: ${lesson.id}`);
  assertUniqueIds(lesson.exerciseIds, `Lesson ${lesson.id} exerciseIds`);
  assertUniqueIds(lesson.cardIds, `Lesson ${lesson.id} cardIds`);
}

function syncDirectory(directory: string): void {
  const descriptor = openSync(directory, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function createManifestRoot(
  root: string,
  childDirectory: string,
  manifestPath: string,
  manifest: unknown,
): void {
  const assertIdentity = (): void => {
    try {
      if (!statSync(childDirectory).isDirectory()) {
        throw new Error("required child path is not a directory");
      }
      if (canonicalJson(readJson(manifestPath)) !== canonicalJson(manifest)) {
        throw new Error("stored manifest does not match");
      }
    } catch (error) {
      const detail = error instanceof Error ? `: ${error.message}` : "";
      throw new Error(`Content already exists and conflicts with requested content${detail}`);
    }
  };

  const parent = dirname(root);
  mkdirSync(parent, { recursive: true, mode: 0o700 });
  if (existsSync(root)) {
    assertIdentity();
    return;
  }

  const staging = join(parent, `.creating-${basename(root)}-${randomUUID()}`);
  try {
    mkdirSync(staging, { mode: 0o700 });
    mkdirSync(join(staging, relative(root, childDirectory)), { recursive: true, mode: 0o700 });
    writeJsonAtomically(join(staging, relative(root, manifestPath)), manifest);
    try {
      renameSync(staging, root);
    } catch (error) {
      if (!existsSync(root)) throw error;
      assertIdentity();
      return;
    }
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
  syncDirectory(parent);
}

function readLatestPointer(path: string, expectedId: string): LatestRevisionPointer {
  const pointer = LatestRevisionPointerSchema.parse(readJson(path));
  if (pointer.id !== expectedId) {
    throw new Error(`Latest pointer ID mismatch: expected ${expectedId}, received ${pointer.id}`);
  }
  return pointer;
}

function assertPointerMatchesManifest(
  pointer: LatestRevisionPointer,
  manifest: { readonly id: string; readonly contentRevision: number },
  label: string,
): void {
  if (manifest.id !== pointer.id || manifest.contentRevision !== pointer.contentRevision) {
    throw new Error(`${label} latest pointer does not match its revision manifest`);
  }
}

function assertExistingRevisionMatches(
  revisionRoot: string,
  revision: number,
  label: string,
  assertIdentity: (revisionRoot: string) => void,
): void {
  try {
    assertIdentity(revisionRoot);
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    throw new Error(
      `${label} revision ${revision} already exists and conflicts with requested content${detail}`,
    );
  }
}

function writeRevisionDirectory(
  root: string,
  revision: number,
  label: string,
  writeStaging: (stagingRoot: string) => void,
  assertIdentity: (revisionRoot: string) => void,
): void {
  const revisionsRoot = join(root, "revisions");
  mkdirSync(revisionsRoot, { recursive: true, mode: 0o700 });
  const revisionRoot = join(revisionsRoot, String(revision));
  if (existsSync(revisionRoot)) {
    assertExistingRevisionMatches(revisionRoot, revision, label, assertIdentity);
    return;
  }

  const staging = join(revisionsRoot, `.creating-${revision}-${randomUUID()}`);
  try {
    mkdirSync(staging, { mode: 0o700 });
    writeStaging(staging);
    try {
      renameSync(staging, revisionRoot);
    } catch (error) {
      if (!existsSync(revisionRoot)) throw error;
      assertExistingRevisionMatches(revisionRoot, revision, label, assertIdentity);
      return;
    }
    syncDirectory(revisionsRoot);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

function assertRequestedRevision(actual: number, expected: number, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label} revision must be ${expected}, received ${actual}`);
  }
}

function finalizeLatestRevision(
  latestPath: string,
  id: string,
  revision: number,
  previousRevision: number,
  label: string,
): void {
  if (existsSync(latestPath)) {
    const current = readLatestPointer(latestPath, id);
    if (current.contentRevision === revision) return;
    if (current.contentRevision !== previousRevision) {
      throw new Error(`${label} latest revision changed while the revision was being written`);
    }
  } else if (previousRevision !== 0) {
    throw new Error(`${label} latest pointer disappeared while the revision was being written`);
  }

  writeJsonAtomically(latestPath, {
    schemaVersion: 1,
    id,
    contentRevision: revision,
  } satisfies LatestRevisionPointer);
}

function assertContentIdentity(
  content: { readonly courseId: string; readonly unitId: string; readonly lessonId?: string },
  courseId: string,
  unitId: string,
  lessonId?: string,
): void {
  if (content.courseId !== courseId || content.unitId !== unitId) {
    throw new Error("Content hierarchy IDs do not match its storage location");
  }
  if (lessonId !== undefined && content.lessonId !== lessonId) {
    throw new Error("Content lessonId does not match its storage location");
  }
}

export function writeCourse(
  studiesRoot: string,
  studyId: string,
  candidate: CourseManifest,
): CourseManifest {
  readStudy(studiesRoot, studyId);
  const course = CourseManifestSchema.parse(candidate);
  if (course.status !== "draft") {
    throw new Error("A course must be created as draft and activated only after validation");
  }
  assertCourseStructure(course);
  const paths = getCoursePaths(studiesRoot, studyId, course.id);
  createManifestRoot(paths.root, paths.units, paths.manifest, course);
  return course;
}

export function readCourse(studiesRoot: string, studyId: string, courseId: string): CourseManifest {
  const paths = getCoursePaths(studiesRoot, studyId, courseId);
  const course = CourseManifestSchema.parse(readJson(paths.manifest));
  if (course.id !== courseId) throw new Error("Course manifest ID does not match its directory");
  assertCourseStructure(course);
  return course;
}

export function writeUnit(
  studiesRoot: string,
  studyId: string,
  courseId: string,
  candidate: UnitManifest,
): UnitManifest {
  const course = readCourse(studiesRoot, studyId, courseId);
  const unit = UnitManifestSchema.parse(candidate);
  if (unit.status !== "draft") {
    throw new Error("A unit must be created as draft and activated only after validation");
  }
  assertUnitStructure(course, unit);
  const paths = getUnitPaths(studiesRoot, studyId, courseId, unit.id);
  createManifestRoot(paths.root, paths.lessons, paths.manifest, unit);
  return unit;
}

export function readUnit(
  studiesRoot: string,
  studyId: string,
  courseId: string,
  unitId: string,
): UnitManifest {
  const course = readCourse(studiesRoot, studyId, courseId);
  const paths = getUnitPaths(studiesRoot, studyId, courseId, unitId);
  const unit = UnitManifestSchema.parse(readJson(paths.manifest));
  if (unit.id !== unitId) throw new Error("Unit manifest ID does not match its directory");
  assertUnitStructure(course, unit);
  return unit;
}

function assertStatusTransition(
  current: CourseManifest["status"],
  candidate: CourseManifest["status"],
): void {
  const allowed: Readonly<Record<CourseManifest["status"], readonly CourseManifest["status"][]>> = {
    draft: ["active"],
    active: ["stale", "retired"],
    stale: ["active", "retired"],
    retired: [],
  };
  if (!allowed[current].includes(candidate)) {
    throw new Error(`Invalid content status transition: ${current} -> ${candidate}`);
  }
}

function assertEvidenceIsStillValid(
  studiesRoot: string,
  studyId: string,
  evidence: readonly LessonManifest["evidence"][number][],
): void {
  for (const reference of evidence) validateEvidence(studiesRoot, studyId, reference);
}

function assertUnitReadyForActivation(
  studiesRoot: string,
  studyId: string,
  courseId: string,
  unit: UnitManifest,
): void {
  if (unit.lessonIds.length === 0) {
    throw new Error(`Unit cannot be activated without lessons: ${unit.id}`);
  }

  for (const lessonId of unit.lessonIds) {
    const lesson = readLatestLesson(studiesRoot, studyId, courseId, unit.id, lessonId).manifest;
    if (lesson.status !== "active") {
      throw new Error(`Unit cannot be activated while lesson is ${lesson.status}: ${lesson.id}`);
    }
    assertEvidenceIsStillValid(studiesRoot, studyId, lesson.evidence);

    for (const cardId of lesson.cardIds) {
      const card = readLatestCard(studiesRoot, studyId, courseId, unit.id, lesson.id, cardId);
      if (card.status !== "active") {
        throw new Error(`Unit cannot be activated while card is ${card.status}: ${card.id}`);
      }
      assertEvidenceIsStillValid(studiesRoot, studyId, card.evidence);
    }

    for (const exerciseId of lesson.exerciseIds) {
      const exercise = readLatestExercise(
        studiesRoot,
        studyId,
        courseId,
        unit.id,
        lesson.id,
        exerciseId,
      );
      if (exercise.status !== "active") {
        throw new Error(
          `Unit cannot be activated while exercise is ${exercise.status}: ${exercise.id}`,
        );
      }
      assertEvidenceIsStillValid(studiesRoot, studyId, exercise.evidence);
    }
  }
}

function assertCourseReadyForActivation(
  studiesRoot: string,
  studyId: string,
  course: CourseManifest,
): void {
  if (course.unitIds.length === 0) {
    throw new Error(`Course cannot be activated without units: ${course.id}`);
  }
  for (const unitId of course.unitIds) {
    const unit = readUnit(studiesRoot, studyId, course.id, unitId);
    if (unit.status !== "active") {
      throw new Error(`Course cannot be activated while unit is ${unit.status}: ${unit.id}`);
    }
    assertUnitReadyForActivation(studiesRoot, studyId, course.id, unit);
  }
}

function assertContentContainerIsEditable(course: CourseManifest, unit: UnitManifest): void {
  if (course.status === "active" || course.status === "retired") {
    throw new Error(`Course must be draft or stale before content can change: ${course.id}`);
  }
  if (unit.status === "active" || unit.status === "retired") {
    throw new Error(`Unit must be draft or stale before content can change: ${unit.id}`);
  }
}

export function updateCourseStatus(
  studiesRoot: string,
  studyId: string,
  courseId: string,
  candidateStatus: CourseManifest["status"],
  now = new Date(),
): CourseManifest {
  const course = readCourse(studiesRoot, studyId, courseId);
  const status = ContentStatus.parse(candidateStatus);
  assertStatusTransition(course.status, status);
  if (status === "active") {
    assertCourseReadyForActivation(studiesRoot, studyId, course);
  }
  const updated = CourseManifestSchema.parse({
    ...course,
    status,
    updatedAt: now.toISOString(),
  });
  writeJsonAtomically(getCoursePaths(studiesRoot, studyId, courseId).manifest, updated);
  return updated;
}

export function updateUnitStatus(
  studiesRoot: string,
  studyId: string,
  courseId: string,
  unitId: string,
  candidateStatus: UnitManifest["status"],
): UnitManifest {
  const course = readCourse(studiesRoot, studyId, courseId);
  const unit = readUnit(studiesRoot, studyId, courseId, unitId);
  const status = ContentStatus.parse(candidateStatus);
  assertStatusTransition(unit.status, status);
  if (course.status === "active" && status !== "active") {
    throw new Error(`Course must be marked stale before changing an active unit: ${course.id}`);
  }
  if (status === "active") {
    assertUnitReadyForActivation(studiesRoot, studyId, courseId, unit);
  }
  const updated = UnitManifestSchema.parse({ ...unit, status });
  writeJsonAtomically(getUnitPaths(studiesRoot, studyId, courseId, unitId).manifest, updated);
  return updated;
}

export function writeLessonRevision(
  studiesRoot: string,
  studyId: string,
  input: WriteLessonRevisionInput,
): LessonManifest {
  if (input.content.trim() === "") throw new Error("Lesson content must not be empty");
  const lesson = LessonManifestSchema.parse({
    ...input.manifest,
    contentHash: sha256(input.content),
  });
  const course = readCourse(studiesRoot, studyId, lesson.courseId);
  const unit = readUnit(studiesRoot, studyId, lesson.courseId, lesson.unitId);
  assertContentContainerIsEditable(course, unit);
  assertLessonStructure(unit, lesson);
  for (const evidence of lesson.evidence) validateEvidence(studiesRoot, studyId, evidence);

  const paths = getLessonPaths(studiesRoot, studyId, lesson.courseId, lesson.unitId, lesson.id);
  let previousRevision = 0;
  if (existsSync(paths.latest)) {
    const current = readLatestLesson(
      studiesRoot,
      studyId,
      lesson.courseId,
      lesson.unitId,
      lesson.id,
    );
    previousRevision = current.manifest.contentRevision;
  }
  assertRequestedRevision(lesson.contentRevision, previousRevision + 1, "Lesson");

  writeRevisionDirectory(
    paths.root,
    lesson.contentRevision,
    "Lesson",
    (stagingRoot) => {
      writeTextAtomically(join(stagingRoot, "content.md"), input.content);
      writeJsonAtomically(join(stagingRoot, "manifest.json"), lesson);
    },
    (revisionRoot) => {
      const storedContent = readFileSync(join(revisionRoot, "content.md"), "utf8");
      const storedManifest = LessonManifestSchema.parse(
        readJson(join(revisionRoot, "manifest.json")),
      );
      if (
        storedContent !== input.content ||
        storedManifest.contentHash !== sha256(storedContent) ||
        canonicalJson(storedManifest) !== canonicalJson(lesson)
      ) {
        throw new Error("stored lesson identity does not match");
      }
    },
  );
  finalizeLatestRevision(
    paths.latest,
    lesson.id,
    lesson.contentRevision,
    previousRevision,
    "Lesson",
  );
  return lesson;
}

export function readLatestLesson(
  studiesRoot: string,
  studyId: string,
  courseId: string,
  unitId: string,
  lessonId: string,
): { readonly manifest: LessonManifest; readonly content: string } {
  const unit = readUnit(studiesRoot, studyId, courseId, unitId);
  const paths = getLessonPaths(studiesRoot, studyId, courseId, unitId, lessonId);
  const pointer = readLatestPointer(paths.latest, lessonId);
  const revisionRoot = join(paths.revisions, String(pointer.contentRevision));
  const manifest = LessonManifestSchema.parse(readJson(join(revisionRoot, "manifest.json")));
  assertPointerMatchesManifest(pointer, manifest, "Lesson");
  assertContentIdentity(manifest, courseId, unitId);
  assertLessonStructure(unit, manifest);
  const content = readFileSync(join(revisionRoot, "content.md"), "utf8");
  if (manifest.contentHash !== sha256(content)) throw new Error("Lesson content hash mismatch");
  return { manifest, content };
}

function normalizeCard(candidate: Omit<CardContent, "contentHash">): CardContent {
  const parsed = CardContentSchema.parse({ ...candidate, contentHash: EMPTY_SHA256 });
  const { contentHash: _ignored, ...content } = parsed;
  return CardContentSchema.parse({ ...content, contentHash: sha256(canonicalJson(content)) });
}

function normalizeExercise(candidate: ExerciseWithoutHash): Exercise {
  const parsed = ExerciseSchema.parse({ ...candidate, contentHash: EMPTY_SHA256 });
  const { contentHash: _ignored, ...content } = parsed;
  return ExerciseSchema.parse({ ...content, contentHash: sha256(canonicalJson(content)) });
}

function cardRoot(
  studiesRoot: string,
  studyId: string,
  courseId: string,
  unitId: string,
  lessonId: string,
  candidateId: string,
): string {
  const id = StableId.parse(candidateId);
  return join(getLessonPaths(studiesRoot, studyId, courseId, unitId, lessonId).cards, id);
}

function exerciseRoot(
  studiesRoot: string,
  studyId: string,
  courseId: string,
  unitId: string,
  lessonId: string,
  candidateId: string,
): string {
  const id = StableId.parse(candidateId);
  return join(getLessonPaths(studiesRoot, studyId, courseId, unitId, lessonId).exercises, id);
}

export function writeCardRevision(
  studiesRoot: string,
  studyId: string,
  candidate: Omit<CardContent, "contentHash">,
): CardContent {
  const card = normalizeCard(candidate);
  const course = readCourse(studiesRoot, studyId, card.courseId);
  const unit = readUnit(studiesRoot, studyId, card.courseId, card.unitId);
  assertContentContainerIsEditable(course, unit);
  const lesson = readLatestLesson(
    studiesRoot,
    studyId,
    card.courseId,
    card.unitId,
    card.lessonId,
  ).manifest;
  if (!lesson.cardIds.includes(card.id))
    throw new Error(`Lesson does not declare card: ${card.id}`);
  for (const evidence of card.evidence) validateEvidence(studiesRoot, studyId, evidence);

  const root = cardRoot(studiesRoot, studyId, card.courseId, card.unitId, card.lessonId, card.id);
  const latest = join(root, "latest.json");
  let previousRevision = 0;
  if (existsSync(latest)) {
    previousRevision = readLatestCard(
      studiesRoot,
      studyId,
      card.courseId,
      card.unitId,
      card.lessonId,
      card.id,
    ).contentRevision;
  }
  assertRequestedRevision(card.contentRevision, previousRevision + 1, "Card");

  writeRevisionDirectory(
    root,
    card.contentRevision,
    "Card",
    (stagingRoot) => writeJsonAtomically(join(stagingRoot, "card.json"), card),
    (revisionRoot) => {
      const stored = CardContentSchema.parse(readJson(join(revisionRoot, "card.json")));
      const { contentHash, ...content } = stored;
      if (
        contentHash !== sha256(canonicalJson(content)) ||
        canonicalJson(stored) !== canonicalJson(card)
      ) {
        throw new Error("stored card identity does not match");
      }
    },
  );
  finalizeLatestRevision(latest, card.id, card.contentRevision, previousRevision, "Card");
  return card;
}

export function readLatestCard(
  studiesRoot: string,
  studyId: string,
  courseId: string,
  unitId: string,
  lessonId: string,
  cardId: string,
): CardContent {
  const lesson = readLatestLesson(studiesRoot, studyId, courseId, unitId, lessonId).manifest;
  const root = cardRoot(studiesRoot, studyId, courseId, unitId, lessonId, cardId);
  const pointer = readLatestPointer(join(root, "latest.json"), cardId);
  const card = CardContentSchema.parse(
    readJson(join(root, "revisions", String(pointer.contentRevision), "card.json")),
  );
  assertPointerMatchesManifest(pointer, card, "Card");
  assertContentIdentity(card, courseId, unitId, lessonId);
  if (!lesson.cardIds.includes(card.id))
    throw new Error(`Lesson does not declare card: ${card.id}`);
  const { contentHash, ...content } = card;
  if (contentHash !== sha256(canonicalJson(content))) throw new Error("Card content hash mismatch");
  return card;
}

export function writeExerciseRevision(
  studiesRoot: string,
  studyId: string,
  candidate: ExerciseWithoutHash,
): Exercise {
  const exercise = normalizeExercise(candidate);
  const course = readCourse(studiesRoot, studyId, exercise.courseId);
  const unit = readUnit(studiesRoot, studyId, exercise.courseId, exercise.unitId);
  assertContentContainerIsEditable(course, unit);
  const lesson = readLatestLesson(
    studiesRoot,
    studyId,
    exercise.courseId,
    exercise.unitId,
    exercise.lessonId,
  ).manifest;
  if (!lesson.exerciseIds.includes(exercise.id)) {
    throw new Error(`Lesson does not declare exercise: ${exercise.id}`);
  }
  for (const evidence of exercise.evidence) validateEvidence(studiesRoot, studyId, evidence);

  const root = exerciseRoot(
    studiesRoot,
    studyId,
    exercise.courseId,
    exercise.unitId,
    exercise.lessonId,
    exercise.id,
  );
  const latest = join(root, "latest.json");
  let previousRevision = 0;
  if (existsSync(latest)) {
    previousRevision = readLatestExercise(
      studiesRoot,
      studyId,
      exercise.courseId,
      exercise.unitId,
      exercise.lessonId,
      exercise.id,
    ).contentRevision;
  }
  assertRequestedRevision(exercise.contentRevision, previousRevision + 1, "Exercise");

  writeRevisionDirectory(
    root,
    exercise.contentRevision,
    "Exercise",
    (stagingRoot) => writeJsonAtomically(join(stagingRoot, "exercise.json"), exercise),
    (revisionRoot) => {
      const stored = ExerciseSchema.parse(readJson(join(revisionRoot, "exercise.json")));
      const { contentHash, ...content } = stored;
      if (
        contentHash !== sha256(canonicalJson(content)) ||
        canonicalJson(stored) !== canonicalJson(exercise)
      ) {
        throw new Error("stored exercise identity does not match");
      }
    },
  );
  finalizeLatestRevision(
    latest,
    exercise.id,
    exercise.contentRevision,
    previousRevision,
    "Exercise",
  );
  return exercise;
}

export function readLatestExercise(
  studiesRoot: string,
  studyId: string,
  courseId: string,
  unitId: string,
  lessonId: string,
  exerciseId: string,
): Exercise {
  const lesson = readLatestLesson(studiesRoot, studyId, courseId, unitId, lessonId).manifest;
  const root = exerciseRoot(studiesRoot, studyId, courseId, unitId, lessonId, exerciseId);
  const pointer = readLatestPointer(join(root, "latest.json"), exerciseId);
  const exercise = ExerciseSchema.parse(
    readJson(join(root, "revisions", String(pointer.contentRevision), "exercise.json")),
  );
  assertPointerMatchesManifest(pointer, exercise, "Exercise");
  assertContentIdentity(exercise, courseId, unitId, lessonId);
  if (!lesson.exerciseIds.includes(exercise.id)) {
    throw new Error(`Lesson does not declare exercise: ${exercise.id}`);
  }
  const { contentHash, ...content } = exercise;
  if (contentHash !== sha256(canonicalJson(content))) {
    throw new Error("Exercise content hash mismatch");
  }
  return exercise;
}
