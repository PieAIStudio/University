import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";

import { z } from "zod";

import {
  CourseCurrency,
  EvidenceReferenceSchema,
  LessonAssetSchema,
  LessonSectionSchema,
  LessonVariantSchema,
  SnapshotManifestSchema,
  StableId,
  type CourseManifest,
  type EvidenceReference,
  type LessonAsset,
} from "../../src/domain/schemas.js";
import { inspectImportPathRisk } from "../airlock/import-gate.js";
import { canonicalizePotentialPath, isPathInside } from "../config/load-config.js";
import {
  listCourseIds,
  orderCoursesByPrerequisite,
  readCourse,
  readLatestCard,
  readLatestExercise,
  readLatestLesson,
  readUnit,
  updateCourseStatus,
  updateUnitStatus,
  writeCardRevision,
  writeCourse,
  writeExerciseRevision,
  writeLessonRevision,
  writeUnit,
} from "../content/repository.js";
import { gitBuffer, gitText } from "../git/run.js";
import { writeJsonAtomically, writeTextAtomically } from "../storage/atomic-json.js";
import {
  getCoursePaths,
  getLessonPaths,
  getSnapshotPaths,
  getStudyPaths,
  getUnitPaths,
} from "../studies/paths.js";
import {
  createStudy,
  readSourceRegistration,
  readStudy,
  registerLocalGitSource,
  setDefaultCourse,
  setStudyStatus,
} from "../studies/repository.js";
import { createCleanSnapshot } from "../studies/snapshots.js";

const PACKAGE_KIND = "university-local-course-recovery";
const EVIDENCE_MODE = "source-only";
const INDEX_FILE = "index.json";
const RECONSTRUCTED_EPOCH_MS = Date.parse("2000-01-01T00:00:00.000Z");
const GIT_LFS_POINTER_HEADER = /^version https:\/\/git-lfs\.github\.com\/spec\/v1\r?\n/;
const FILE_MANAGER_ROUTE_PREFIX = "file-manager:";
const PORTABLE_SOURCE_ROOT_ROUTE = `${FILE_MANAGER_ROUTE_PREFIX}<source-root>`;

export const COURSE_RECOVERY_LIMITS = Object.freeze({
  maxIndexBytes: 1024 * 1024,
  maxCourseFileBytes: 128 * 1024 * 1024,
  maxPackageBytes: 512 * 1024 * 1024,
  maxCourses: 1_000,
});

const SourceOnlyEvidenceSchema = EvidenceReferenceSchema.refine(
  (evidence) =>
    evidence.analysisId === undefined &&
    evidence.graphHash === undefined &&
    evidence.nodeIds.length === 0,
  "Recovery evidence must be source-only",
);

const RecoveryAssetSchema = z
  .object({
    metadata: LessonAssetSchema,
    dataBase64: z.string().min(1),
  })
  .strict();

const RecoveryCardSchema = z
  .object({
    id: StableId,
    kind: z.enum(["basic", "cloze"]),
    front: z.string().min(1).max(20_000),
    back: z.string().min(1).max(20_000),
    tags: z.array(StableId).default([]),
    evidence: z.array(SourceOnlyEvidenceSchema).min(1),
  })
  .strict();

const RecoveryExerciseSchema = z.discriminatedUnion("kind", [
  z
    .object({
      id: StableId,
      kind: z.literal("short-answer"),
      title: z.string().min(1).max(200),
      prompt: z.string().min(1).max(20_000),
      expectedAnswer: z.string().min(1),
      evidence: z.array(SourceOnlyEvidenceSchema).min(1),
    })
    .strict(),
  z
    .object({
      id: StableId,
      kind: z.literal("explain"),
      title: z.string().min(1).max(200),
      prompt: z.string().min(1).max(20_000),
      rubric: z.array(z.string().min(1)).min(1),
      evidence: z.array(SourceOnlyEvidenceSchema).min(1),
    })
    .strict(),
]);

const RecoveryLessonSchema = z
  .object({
    id: StableId,
    title: z.string().min(1).max(200),
    content: z.string().min(1),
    sections: z.array(LessonSectionSchema).max(100).default([]),
    variant: LessonVariantSchema.optional(),
    evidence: z.array(SourceOnlyEvidenceSchema).min(1),
    assets: z.array(RecoveryAssetSchema).max(100).default([]),
    cards: z.array(RecoveryCardSchema),
    exercises: z.array(RecoveryExerciseSchema),
  })
  .strict();

const RecoveryUnitSchema = z
  .object({
    id: StableId,
    title: z.string().min(1).max(200),
    objective: z.string().min(1).max(1_000),
    prerequisiteUnitIds: z.array(StableId).default([]),
    lessons: z.array(RecoveryLessonSchema).min(1),
  })
  .strict();

export const CourseRecoveryPackageSchema = z
  .object({
    schemaVersion: z.literal(1),
    packageKind: z.literal(PACKAGE_KIND),
    evidenceMode: z.literal(EVIDENCE_MODE),
    droppedUaBindingCount: z.number().int().nonnegative(),
    course: z
      .object({
        id: StableId,
        title: z.string().min(1).max(200),
        description: z.string().max(2_000).default(""),
        audience: z.string().min(1).max(500),
        objectives: z.array(z.string().min(1).max(500)).min(1),
        currency: CourseCurrency,
        prerequisiteCourseIds: z.array(StableId).default([]),
        units: z.array(RecoveryUnitSchema).min(1),
      })
      .strict(),
  })
  .strict();

const RecoveryIndexEntrySchema = z
  .object({
    courseId: StableId,
    file: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-f0-9]{64}\.recovery\.json$/),
    sha256: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  })
  .strict();

export const CourseRecoveryIndexSchema = z
  .object({
    schemaVersion: z.literal(1),
    packageKind: z.literal(PACKAGE_KIND),
    evidenceMode: z.literal(EVIDENCE_MODE),
    droppedUaBindingCount: z.number().int().nonnegative(),
    study: z
      .object({
        id: StableId,
        title: z.string().min(1).max(160),
        description: z.string().max(2_000).default(""),
        goals: z.array(z.string().min(1).max(500)).default([]),
        defaultCourseId: StableId.nullable(),
        status: z.enum(["active", "archived"]),
      })
      .strict(),
    source: z
      .object({
        defaultRef: z.string().min(1).max(256),
      })
      .strict()
      .optional(),
    courses: z.array(RecoveryIndexEntrySchema).min(1).max(COURSE_RECOVERY_LIMITS.maxCourses),
  })
  .strict();

const RecoveryProvenanceSchema = z
  .object({
    schemaVersion: z.literal(1),
    evidenceMode: z.literal(EVIDENCE_MODE),
    droppedUaBindingCount: z.number().int().nonnegative(),
    semanticSha256: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  })
  .strict();

export type CourseRecoveryPackage = z.infer<typeof CourseRecoveryPackageSchema>;
export type CourseRecoveryIndex = z.infer<typeof CourseRecoveryIndexSchema>;
type RecoveryLesson = z.infer<typeof RecoveryLessonSchema>;
type RecoveryCard = RecoveryLesson["cards"][number];
type RecoveryExercise = RecoveryLesson["exercises"][number];
type LoadedRecovery = {
  readonly index: CourseRecoveryIndex;
  readonly packages: readonly CourseRecoveryPackage[];
};

interface ExportCourseRecoveryInput {
  readonly studiesRoot: string;
  readonly studyId: string;
  readonly outDirectory: string;
  /** Test-only fault seam: course objects are durable, but index.json is not committed yet. */
  readonly beforeIndexCommit?: () => void;
}

interface ImportCourseRecoveryInput {
  readonly studiesRoot: string;
  readonly studyId: string;
  readonly inputDirectory: string;
  readonly sourceRoot: string;
  readonly dryRun?: boolean;
}

function jsonBytes(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value: string | Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} must not contain duplicate IDs`);
  }
}

function sourceOnlyEvidence(evidence: EvidenceReference): EvidenceReference {
  return EvidenceReferenceSchema.parse({
    kind: evidence.kind,
    snapshotId: evidence.snapshotId,
    sourceCommit: evidence.sourceCommit,
    sourcePath: evidence.sourcePath,
    ...(evidence.lineStart === undefined ? {} : { lineStart: evidence.lineStart }),
    ...(evidence.lineEnd === undefined ? {} : { lineEnd: evidence.lineEnd }),
    nodeIds: [],
    ...(evidence.note === undefined ? {} : { note: evidence.note }),
  });
}

function uaBindingCount(evidence: readonly EvidenceReference[]): number {
  return evidence.filter(
    (reference) =>
      reference.analysisId !== undefined ||
      reference.graphHash !== undefined ||
      reference.nodeIds.length > 0,
  ).length;
}

function provenancePath(studiesRoot: string, studyId: string, courseId: string): string {
  return join(getCoursePaths(studiesRoot, studyId, courseId).root, "recovery-provenance.json");
}

function packageSemanticSha256(coursePackage: CourseRecoveryPackage): string {
  return sha256(canonicalJson({ ...coursePackage, droppedUaBindingCount: 0 }));
}

function readPreservedDroppedCount(
  studiesRoot: string,
  studyId: string,
  coursePackage: CourseRecoveryPackage,
): number | null {
  const path = provenancePath(studiesRoot, studyId, coursePackage.course.id);
  if (!existsSync(path)) return null;
  const provenance = RecoveryProvenanceSchema.parse(
    JSON.parse(readFileSync(path, "utf8")) as unknown,
  );
  return provenance.semanticSha256 === packageSemanticSha256(coursePackage)
    ? provenance.droppedUaBindingCount
    : null;
}

function readAssetBytes(
  studiesRoot: string,
  studyId: string,
  courseId: string,
  unitId: string,
  lessonId: string,
  revision: number,
  asset: LessonAsset,
): Buffer {
  const revisionRoot = join(
    getLessonPaths(studiesRoot, studyId, courseId, unitId, lessonId).revisions,
    String(revision),
  );
  const candidate = resolve(revisionRoot, asset.path);
  const relativePath = relative(revisionRoot, candidate);
  if (relativePath.startsWith("..") || relativePath === "" || resolve(candidate) === revisionRoot) {
    throw new Error(`Lesson asset path escapes its revision: ${asset.path}`);
  }
  const bytes = readFileSync(candidate);
  if (bytes.byteLength !== asset.bytes || sha256(bytes) !== asset.sha256) {
    throw new Error(`Lesson asset hash/size mismatch: ${asset.id}`);
  }
  return bytes;
}

function normalizedRecoveryRelativePath(value: string): string {
  if (
    value === "" ||
    value.startsWith("/") ||
    value.includes("\\") ||
    value.includes("//") ||
    value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`Recovery capture route has an unsafe source-relative path: ${value}`);
  }
  return value;
}

function validatePortableCaptureRoute(route: string): void {
  if (!route.startsWith(FILE_MANAGER_ROUTE_PREFIX)) return;
  if (route === PORTABLE_SOURCE_ROOT_ROUTE) return;
  const portablePrefix = `${PORTABLE_SOURCE_ROOT_ROUTE}/`;
  if (!route.startsWith(portablePrefix)) {
    throw new Error("Recovery file-manager capture routes must use <source-root>");
  }
  normalizedRecoveryRelativePath(route.slice(portablePrefix.length));
}

function portableCaptureRoute(route: string, registeredSourceRoot: string): string {
  if (!route.startsWith(FILE_MANAGER_ROUTE_PREFIX)) return route;
  if (route.startsWith(PORTABLE_SOURCE_ROOT_ROUTE)) {
    validatePortableCaptureRoute(route);
    return route;
  }

  const routePath = route.slice(FILE_MANAGER_ROUTE_PREFIX.length);
  if (!routePath.startsWith("/")) {
    throw new Error("Lesson asset file-manager capture route must be an absolute source path");
  }
  const sourceRoot = canonicalizePotentialPath(registeredSourceRoot);
  const capturePath = canonicalizePotentialPath(routePath);
  if (!isPathInside(sourceRoot, capturePath)) {
    throw new Error("Lesson asset capture route points outside the registered source root");
  }
  const sourceRelativePath = relative(sourceRoot, capturePath).split(sep).join("/");
  return sourceRelativePath === ""
    ? PORTABLE_SOURCE_ROOT_ROUTE
    : `${PORTABLE_SOURCE_ROOT_ROUTE}/${normalizedRecoveryRelativePath(sourceRelativePath)}`;
}

function portableAssetMetadata(asset: LessonAsset, registeredSourceRoot: string): LessonAsset {
  if (asset.capture === undefined) return asset;
  const route = portableCaptureRoute(asset.capture.route, registeredSourceRoot);
  if (route === asset.capture.route) return asset;
  return LessonAssetSchema.parse({
    ...asset,
    capture: { ...asset.capture, route },
  });
}

function runtimeAssetMetadata(asset: LessonAsset, sourceRoot: string): LessonAsset {
  if (asset.capture === undefined) return asset;
  const route = asset.capture.route;
  validatePortableCaptureRoute(route);
  if (!route.startsWith(FILE_MANAGER_ROUTE_PREFIX)) return asset;
  const portablePrefix = `${PORTABLE_SOURCE_ROOT_ROUTE}/`;
  const restoredRoute =
    route === PORTABLE_SOURCE_ROOT_ROUTE
      ? `${FILE_MANAGER_ROUTE_PREFIX}${sourceRoot}`
      : `${FILE_MANAGER_ROUTE_PREFIX}${resolve(
          sourceRoot,
          normalizedRecoveryRelativePath(route.slice(portablePrefix.length)),
        )}`;
  return LessonAssetSchema.parse({
    ...asset,
    capture: { ...asset.capture, route: restoredRoute },
  });
}

function serializeCourse(
  studiesRoot: string,
  studyId: string,
  course: CourseManifest,
): CourseRecoveryPackage {
  if (course.status !== "active") throw new Error(`Course is not active: ${course.id}`);
  const registeredSourceRoot = readSourceRegistration(studiesRoot, studyId).sourceRoot;
  let droppedUaBindingCount = 0;
  const units = course.unitIds.map((unitId) => {
    const unit = readUnit(studiesRoot, studyId, course.id, unitId);
    if (unit.status !== "active") throw new Error(`Unit is not active: ${unit.id}`);
    return {
      id: unit.id,
      title: unit.title,
      objective: unit.objective,
      prerequisiteUnitIds: unit.prerequisiteUnitIds,
      lessons: unit.lessonIds.map((lessonId) => {
        const lesson = readLatestLesson(studiesRoot, studyId, course.id, unit.id, lessonId);
        if (lesson.manifest.status !== "active") {
          throw new Error(`Lesson is not active: ${lesson.manifest.id}`);
        }
        droppedUaBindingCount += uaBindingCount(lesson.manifest.evidence);
        const cards = lesson.manifest.cardIds.map((cardId) => {
          const card = readLatestCard(
            studiesRoot,
            studyId,
            course.id,
            unit.id,
            lesson.manifest.id,
            cardId,
          );
          if (card.status !== "active") throw new Error(`Card is not active: ${card.id}`);
          droppedUaBindingCount += uaBindingCount(card.evidence);
          return {
            id: card.id,
            kind: card.kind,
            front: card.front,
            back: card.back,
            tags: card.tags,
            evidence: card.evidence.map(sourceOnlyEvidence),
          };
        });
        const exercises = lesson.manifest.exerciseIds.map((exerciseId) => {
          const exercise = readLatestExercise(
            studiesRoot,
            studyId,
            course.id,
            unit.id,
            lesson.manifest.id,
            exerciseId,
          );
          if (exercise.status !== "active") {
            throw new Error(`Exercise is not active: ${exercise.id}`);
          }
          droppedUaBindingCount += uaBindingCount(exercise.evidence);
          return exercise.kind === "short-answer"
            ? {
                id: exercise.id,
                kind: exercise.kind,
                title: exercise.title,
                prompt: exercise.prompt,
                expectedAnswer: exercise.expectedAnswer,
                evidence: exercise.evidence.map(sourceOnlyEvidence),
              }
            : {
                id: exercise.id,
                kind: exercise.kind,
                title: exercise.title,
                prompt: exercise.prompt,
                rubric: exercise.rubric,
                evidence: exercise.evidence.map(sourceOnlyEvidence),
              };
        });
        return {
          id: lesson.manifest.id,
          title: lesson.manifest.title,
          content: lesson.content,
          sections: lesson.manifest.sections,
          ...(lesson.manifest.variant === undefined ? {} : { variant: lesson.manifest.variant }),
          evidence: lesson.manifest.evidence.map(sourceOnlyEvidence),
          assets: lesson.manifest.assets.map((asset) => ({
            metadata: portableAssetMetadata(asset, registeredSourceRoot),
            dataBase64: readAssetBytes(
              studiesRoot,
              studyId,
              course.id,
              unit.id,
              lesson.manifest.id,
              lesson.manifest.contentRevision,
              asset,
            ).toString("base64"),
          })),
          cards,
          exercises,
        };
      }),
    };
  });

  let result = CourseRecoveryPackageSchema.parse({
    schemaVersion: 1,
    packageKind: PACKAGE_KIND,
    evidenceMode: EVIDENCE_MODE,
    droppedUaBindingCount,
    course: {
      id: course.id,
      title: course.title,
      description: course.description,
      audience: course.audience,
      objectives: course.objectives,
      currency: course.currency,
      prerequisiteCourseIds: course.prerequisiteCourseIds,
      units,
    },
  });
  if (droppedUaBindingCount === 0) {
    const preserved = readPreservedDroppedCount(studiesRoot, studyId, result);
    if (preserved !== null) result = { ...result, droppedUaBindingCount: preserved };
  }
  return result;
}

function validatePackageStructure(coursePackage: CourseRecoveryPackage): void {
  const course = coursePackage.course;
  assertUnique(course.prerequisiteCourseIds, `Course ${course.id} prerequisites`);
  if (course.prerequisiteCourseIds.includes(course.id)) {
    throw new Error(`Course ${course.id} cannot depend on itself`);
  }
  assertUnique(
    course.units.map((unit) => unit.id),
    `Course ${course.id} units`,
  );
  const lessonIds: string[] = [];
  for (const unit of course.units) {
    assertUnique(unit.prerequisiteUnitIds, `Unit ${unit.id} prerequisites`);
    if (unit.prerequisiteUnitIds.includes(unit.id)) {
      throw new Error(`Unit ${unit.id} cannot depend on itself`);
    }
    for (const prerequisite of unit.prerequisiteUnitIds) {
      if (!course.units.some((candidate) => candidate.id === prerequisite)) {
        throw new Error(`Unit ${unit.id} requires missing unit ${prerequisite}`);
      }
    }
    for (const lesson of unit.lessons) {
      lessonIds.push(lesson.id);
      assertUnique(
        lesson.sections.map((section) => section.id),
        `Lesson ${lesson.id} sections`,
      );
      assertUnique(
        lesson.assets.map((asset) => asset.metadata.id),
        `Lesson ${lesson.id} assets`,
      );
      assertUnique(
        lesson.assets.map((asset) => asset.metadata.path),
        `Lesson ${lesson.id} asset paths`,
      );
      for (const asset of lesson.assets) {
        if (asset.metadata.capture !== undefined) {
          validatePortableCaptureRoute(asset.metadata.capture.route);
        }
      }
      assertUnique(
        lesson.cards.map((card) => card.id),
        `Lesson ${lesson.id} cards`,
      );
      assertUnique(
        lesson.exercises.map((exercise) => exercise.id),
        `Lesson ${lesson.id} exercises`,
      );
    }
  }
  assertUnique(lessonIds, `Course ${course.id} lessons`);
}

function validateBase64Assets(coursePackage: CourseRecoveryPackage): void {
  for (const unit of coursePackage.course.units) {
    for (const lesson of unit.lessons) {
      for (const asset of lesson.assets) {
        const encoded = asset.dataBase64;
        if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
          throw new Error(`Lesson asset is not canonical base64: ${asset.metadata.id}`);
        }
        const bytes = Buffer.from(encoded, "base64");
        if (bytes.toString("base64") !== encoded) {
          throw new Error(`Lesson asset is not canonical base64: ${asset.metadata.id}`);
        }
        if (bytes.byteLength !== asset.metadata.bytes || sha256(bytes) !== asset.metadata.sha256) {
          throw new Error(`Lesson asset hash/size mismatch: ${asset.metadata.id}`);
        }
      }
    }
  }
}

function readBoundedRegularFile(path: string, maximumBytes: number, label: string): Buffer {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} must be a regular file`);
  if (stat.size > maximumBytes) throw new Error(`${label} exceeds ${maximumBytes} bytes`);
  return readFileSync(path);
}

function safePackageFile(inputRoot: string, file: string): string {
  if (basename(file) !== file) throw new Error(`Unsafe recovery package filename: ${file}`);
  const candidate = resolve(inputRoot, file);
  const pathFromRoot = relative(inputRoot, candidate);
  if (pathFromRoot.startsWith("..") || pathFromRoot === "") {
    throw new Error(`Unsafe recovery package filename: ${file}`);
  }
  return candidate;
}

export function loadCourseRecovery(inputDirectory: string): LoadedRecovery {
  const inputRoot = realpathSync.native(inputDirectory);
  if (!statSync(inputRoot).isDirectory()) throw new Error("Recovery input must be a directory");
  const indexBytes = readBoundedRegularFile(
    join(inputRoot, INDEX_FILE),
    COURSE_RECOVERY_LIMITS.maxIndexBytes,
    "Recovery index",
  );
  let indexValue: unknown;
  try {
    indexValue = JSON.parse(indexBytes.toString("utf8")) as unknown;
  } catch {
    throw new Error("Recovery index must contain valid JSON");
  }
  const index = CourseRecoveryIndexSchema.parse(indexValue);
  if (!indexBytes.equals(Buffer.from(jsonBytes(index)))) {
    throw new Error("Recovery index is not in canonical JSON form");
  }
  assertUnique(
    index.courses.map((entry) => entry.courseId),
    "Recovery index courses",
  );
  assertUnique(
    index.courses.map((entry) => entry.file),
    "Recovery index files",
  );

  let totalBytes = indexBytes.byteLength;
  const packages = index.courses.map((entry) => {
    const expectedFile = `${entry.courseId}.${entry.sha256.slice("sha256:".length)}.recovery.json`;
    if (entry.file !== expectedFile) {
      throw new Error(`Recovery file must be named ${expectedFile}`);
    }
    const fileBytes = readBoundedRegularFile(
      safePackageFile(inputRoot, entry.file),
      COURSE_RECOVERY_LIMITS.maxCourseFileBytes,
      `Recovery course ${entry.courseId}`,
    );
    totalBytes += fileBytes.byteLength;
    if (totalBytes > COURSE_RECOVERY_LIMITS.maxPackageBytes) {
      throw new Error(`Recovery package exceeds ${COURSE_RECOVERY_LIMITS.maxPackageBytes} bytes`);
    }
    if (sha256(fileBytes) !== entry.sha256) {
      throw new Error(`Recovery course hash mismatch: ${entry.courseId}`);
    }
    let value: unknown;
    try {
      value = JSON.parse(fileBytes.toString("utf8")) as unknown;
    } catch {
      throw new Error(`Recovery course must contain valid JSON: ${entry.courseId}`);
    }
    const coursePackage = CourseRecoveryPackageSchema.parse(value);
    if (!fileBytes.equals(Buffer.from(jsonBytes(coursePackage)))) {
      throw new Error(`Recovery course is not in canonical JSON form: ${entry.courseId}`);
    }
    if (coursePackage.course.id !== entry.courseId) {
      throw new Error(`Recovery course ID does not match its index: ${entry.courseId}`);
    }
    validatePackageStructure(coursePackage);
    validateBase64Assets(coursePackage);
    return coursePackage;
  });
  const dropped = packages.reduce((sum, course) => sum + course.droppedUaBindingCount, 0);
  if (dropped !== index.droppedUaBindingCount) {
    throw new Error("Recovery index droppedUaBindingCount does not match its course packages");
  }
  if (
    index.study.defaultCourseId !== null &&
    !packages.some((course) => course.course.id === index.study.defaultCourseId)
  ) {
    throw new Error("Recovery study default course is not included in the package");
  }
  assertCoursePrerequisites(packages);
  return { index, packages };
}

function assertCoursePrerequisites(packages: readonly CourseRecoveryPackage[]): void {
  const included = new Set(packages.map((course) => course.course.id));
  const position = new Map(packages.map((course, index) => [course.course.id, index]));
  for (const course of packages) {
    for (const prerequisite of course.course.prerequisiteCourseIds) {
      if (
        included.has(prerequisite) &&
        position.get(prerequisite)! >= position.get(course.course.id)!
      ) {
        throw new Error(
          `Recovery course order must place prerequisite ${prerequisite} before ${course.course.id}`,
        );
      }
    }
  }
}

function allEvidence(coursePackage: CourseRecoveryPackage): readonly EvidenceReference[] {
  const evidence: EvidenceReference[] = [];
  for (const unit of coursePackage.course.units) {
    for (const lesson of unit.lessons) {
      evidence.push(...lesson.evidence);
      for (const card of lesson.cards) evidence.push(...card.evidence);
      for (const exercise of lesson.exercises) evidence.push(...exercise.evidence);
    }
  }
  return evidence;
}

interface GitTreeEntry {
  readonly mode: string;
  readonly type: string;
  readonly objectId: string;
  readonly size: number | null;
  readonly path: string;
}

function parseTreeEntries(output: Buffer): readonly GitTreeEntry[] {
  return output
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((record) => {
      const tab = record.indexOf("\t");
      const header =
        tab < 0
          ? null
          : record.slice(0, tab).match(/^(\d+) (blob|tree|commit) ([a-f0-9]+)\s+(-|\d+)$/);
      if (!header || tab < 0) throw new Error("Git returned an invalid recovery tree entry");
      return {
        mode: header[1]!,
        type: header[2]!,
        objectId: header[3]!,
        size: header[4] === "-" ? null : Number(header[4]),
        path: record.slice(tab + 1),
      };
    });
}

function requireSourceRoot(sourceCandidate: string): string {
  const candidate = realpathSync.native(sourceCandidate);
  const sourceRoot = realpathSync.native(gitText(["rev-parse", "--show-toplevel"], candidate));
  return sourceRoot;
}

function sourceLines(bytes: Buffer, sourcePath: string): readonly string[] {
  if (bytes.includes(0)) throw new Error(`Evidence source is binary: ${sourcePath}`);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`Evidence source must be UTF-8: ${sourcePath}`);
  }
  if (text.length === 0) return [];
  const lines = text.split(/\r\n|\n|\r/);
  if (/(?:\r\n|\n|\r)$/.test(text)) lines.pop();
  return lines;
}

function safePathForError(path: string): string {
  return [...path]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 0x20 || code === 0x7f ? `\\u${code.toString(16).padStart(4, "0")}` : character;
    })
    .join("");
}

function validateSnapshotCompatibility(
  sourceRoot: string,
  commit: string,
  tree: readonly GitTreeEntry[],
): void {
  const submodules = tree.filter((entry) => entry.mode === "160000" || entry.type === "commit");
  if (submodules.length > 0) {
    throw new Error(
      `Recovery source contains unsupported Git submodules: ${submodules
        .slice(0, 10)
        .map((entry) => safePathForError(entry.path))
        .join(", ")}`,
    );
  }
  const lfsPaths = tree.flatMap((entry) => {
    if (
      entry.type !== "blob" ||
      (entry.mode !== "100644" && entry.mode !== "100755") ||
      entry.size === null ||
      entry.size > 1024
    ) {
      return [];
    }
    const content = gitBuffer(["cat-file", "blob", entry.objectId], sourceRoot).toString("utf8");
    return GIT_LFS_POINTER_HEADER.test(content) ? [entry.path] : [];
  });
  if (lfsPaths.length > 0) {
    throw new Error(
      `Recovery source contains unsupported Git LFS pointers at ${commit}: ${lfsPaths
        .slice(0, 10)
        .map(safePathForError)
        .join(", ")}`,
    );
  }
}

function validateSourceEvidence(
  sourceRoot: string,
  packages: readonly CourseRecoveryPackage[],
): readonly string[] {
  const references = packages.flatMap(allEvidence);
  const commits = [...new Set(references.map((reference) => reference.sourceCommit))].sort();
  const snapshotOwners = new Map<string, string>();
  const treeByCommit = new Map<string, ReadonlyMap<string, GitTreeEntry>>();
  for (const commit of commits) {
    const resolved = gitText(["rev-parse", "--verify", `${commit}^{commit}`], sourceRoot);
    if (resolved !== commit) throw new Error(`Recovery source commit is unavailable: ${commit}`);
    const snapshotId = `git-${commit.slice(0, 12)}`;
    const prior = snapshotOwners.get(snapshotId);
    if (prior && prior !== commit) throw new Error(`Recovery snapshot ID collision: ${snapshotId}`);
    snapshotOwners.set(snapshotId, commit);

    const tree = parseTreeEntries(gitBuffer(["ls-tree", "-r", "-l", "-z", commit], sourceRoot));
    treeByCommit.set(commit, new Map(tree.map((entry) => [entry.path, entry])));
    validateSnapshotCompatibility(sourceRoot, commit, tree);
    const pathRisk = inspectImportPathRisk(tree);
    if (pathRisk.length > 0) {
      throw new Error(
        `Recovery source commit contains blocked tracked paths: ${pathRisk
          .slice(0, 10)
          .map((finding) => safePathForError(finding.path))
          .join(", ")}`,
      );
    }
  }

  const linesBySource = new Map<string, readonly string[]>();
  for (const reference of references) {
    const expectedSnapshotId = `git-${reference.sourceCommit.slice(0, 12)}`;
    if (reference.snapshotId !== expectedSnapshotId) {
      throw new Error(
        `Evidence snapshot ${reference.snapshotId} is not deterministic for ${reference.sourceCommit}`,
      );
    }
    const entry = treeByCommit.get(reference.sourceCommit)?.get(reference.sourcePath);
    if (!entry) {
      throw new Error(`Evidence source file does not exist: ${reference.sourcePath}`);
    }
    if (entry.type !== "blob" || (entry.mode !== "100644" && entry.mode !== "100755")) {
      throw new Error(`Evidence source must be a regular Git blob: ${reference.sourcePath}`);
    }
    if (reference.lineStart !== undefined || reference.lineEnd !== undefined) {
      const sourceKey = `${reference.sourceCommit}\0${reference.sourcePath}`;
      let lines = linesBySource.get(sourceKey);
      if (!lines) {
        lines = sourceLines(
          gitBuffer(["cat-file", "blob", entry.objectId], sourceRoot),
          reference.sourcePath,
        );
        linesBySource.set(sourceKey, lines);
      }
      if (
        (reference.lineStart ?? 1) > lines.length ||
        (reference.lineEnd ?? reference.lineStart ?? 1) > lines.length
      ) {
        throw new Error(`Evidence line range exceeds ${reference.sourcePath}`);
      }
    }
  }
  return commits;
}

interface CourseRecoveryArtifact {
  readonly courseId: string;
  readonly file: string;
  readonly sha256: string;
  readonly bytes: string;
}

function assertStoredArtifactMatches(path: string, artifact: CourseRecoveryArtifact): void {
  const stored = readBoundedRegularFile(
    path,
    COURSE_RECOVERY_LIMITS.maxCourseFileBytes,
    `Recovery course ${artifact.courseId}`,
  );
  if (sha256(stored) !== artifact.sha256 || !stored.equals(Buffer.from(artifact.bytes))) {
    throw new Error(
      `Content-addressed recovery file conflicts with its filename: ${artifact.file}`,
    );
  }
}

/**
 * Publishes one immutable course object without ever replacing an existing path.
 *
 * The staging file is complete and fsynced before `linkSync` gives it its
 * content-addressed name. A crash can therefore leave an unreferenced complete
 * object, never a partial object that an older index already trusts.
 */
function publishCourseArtifact(outDirectory: string, artifact: CourseRecoveryArtifact): void {
  const target = join(outDirectory, artifact.file);
  if (existsSync(target)) {
    assertStoredArtifactMatches(target, artifact);
    return;
  }

  const staging = join(outDirectory, `.${artifact.courseId}.${randomUUID()}.staged`);
  try {
    writeTextAtomically(staging, artifact.bytes);
    try {
      linkSync(staging, target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      assertStoredArtifactMatches(target, artifact);
    }
  } finally {
    try {
      unlinkSync(staging);
    } catch {
      // A failed staging write or successful cleanup can both leave no path.
    }
  }
  assertStoredArtifactMatches(target, artifact);
}

export function exportCourseRecovery(input: ExportCourseRecoveryInput) {
  const study = readStudy(input.studiesRoot, input.studyId);
  if (study.status !== "active") {
    throw new Error(
      `Only an active study can be exported for recovery: ${study.id} is ${study.status}`,
    );
  }
  const activeCourses = orderCoursesByPrerequisite(
    listCourseIds(input.studiesRoot, input.studyId)
      .map((courseId) => readCourse(input.studiesRoot, input.studyId, courseId))
      .filter((course) => course.status === "active"),
  );
  if (activeCourses.length === 0) throw new Error(`Study has no active courses: ${study.id}`);
  if (activeCourses.length > COURSE_RECOVERY_LIMITS.maxCourses) {
    throw new Error(`Study has more than ${COURSE_RECOVERY_LIMITS.maxCourses} active courses`);
  }
  if (
    study.defaultCourseId !== null &&
    !activeCourses.some((course) => course.id === study.defaultCourseId)
  ) {
    throw new Error(`Study default course is not active: ${study.defaultCourseId}`);
  }
  const sourceRegistration = readSourceRegistration(input.studiesRoot, study.id);

  const entries: Array<z.infer<typeof RecoveryIndexEntrySchema>> = [];
  const artifacts: CourseRecoveryArtifact[] = [];
  const serializedPackages: CourseRecoveryPackage[] = [];
  let droppedUaBindingCount = 0;
  let totalBytes = 0;
  for (const course of activeCourses) {
    const coursePackage = serializeCourse(input.studiesRoot, study.id, course);
    validatePackageStructure(coursePackage);
    validateBase64Assets(coursePackage);
    serializedPackages.push(coursePackage);
    const bytes = jsonBytes(coursePackage);
    const contentHash = sha256(bytes);
    const file = `${course.id}.${contentHash.slice("sha256:".length)}.recovery.json`;
    const byteLength = Buffer.byteLength(bytes);
    if (byteLength > COURSE_RECOVERY_LIMITS.maxCourseFileBytes) {
      throw new Error(`Recovery course exceeds size limit: ${course.id}`);
    }
    totalBytes += byteLength;
    if (totalBytes > COURSE_RECOVERY_LIMITS.maxPackageBytes) {
      throw new Error(`Recovery package exceeds ${COURSE_RECOVERY_LIMITS.maxPackageBytes} bytes`);
    }
    const artifact = { courseId: course.id, file, sha256: contentHash, bytes };
    artifacts.push(artifact);
    entries.push({ courseId: course.id, file, sha256: contentHash });
    droppedUaBindingCount += coursePackage.droppedUaBindingCount;
  }
  assertCoursePrerequisites(serializedPackages);
  const index = CourseRecoveryIndexSchema.parse({
    schemaVersion: 1,
    packageKind: PACKAGE_KIND,
    evidenceMode: EVIDENCE_MODE,
    droppedUaBindingCount,
    study: {
      id: study.id,
      title: study.title,
      description: study.description,
      goals: study.goals,
      defaultCourseId: study.defaultCourseId,
      status: study.status,
    },
    source: { defaultRef: sourceRegistration.defaultRef },
    courses: entries,
  });
  const indexBytes = jsonBytes(index);
  if (Buffer.byteLength(indexBytes) > COURSE_RECOVERY_LIMITS.maxIndexBytes) {
    throw new Error(`Recovery index exceeds ${COURSE_RECOVERY_LIMITS.maxIndexBytes} bytes`);
  }
  if (totalBytes + Buffer.byteLength(indexBytes) > COURSE_RECOVERY_LIMITS.maxPackageBytes) {
    throw new Error(`Recovery package exceeds ${COURSE_RECOVERY_LIMITS.maxPackageBytes} bytes`);
  }

  mkdirSync(input.outDirectory, { recursive: true, mode: 0o700 });
  if (!statSync(input.outDirectory).isDirectory()) {
    throw new Error("Recovery output must be a directory");
  }
  for (const artifact of artifacts) publishCourseArtifact(input.outDirectory, artifact);
  input.beforeIndexCommit?.();
  // `index.json` is the commit point. Course filenames are content-addressed,
  // so failures above can only leave new unreferenced objects; an older index
  // and every immutable object it references remain valid. Import deliberately
  // ignores those old unreferenced objects instead of deleting them here.
  writeTextAtomically(join(input.outDirectory, INDEX_FILE), indexBytes);
  return {
    schemaVersion: 1 as const,
    operation: "course-recovery-export" as const,
    studyId: study.id,
    outDirectory: input.outDirectory,
    evidenceMode: EVIDENCE_MODE,
    droppedUaBindingCount,
    courses: entries,
  };
}

function assertExistingStudy(
  studiesRoot: string,
  index: CourseRecoveryIndex,
  sourceRoot: string,
): void {
  const existing = readStudy(studiesRoot, index.study.id);
  if (
    existing.title !== index.study.title ||
    existing.description !== index.study.description ||
    canonicalJson(existing.goals) !== canonicalJson(index.study.goals)
  ) {
    throw new Error(`Existing study metadata conflicts with recovery package: ${existing.id}`);
  }
  if (existing.status !== index.study.status && index.study.status !== "archived") {
    throw new Error(`Existing study status conflicts with recovery package: ${existing.id}`);
  }
  if (
    existing.defaultCourseId !== null &&
    existing.defaultCourseId !== index.study.defaultCourseId
  ) {
    throw new Error(
      `Existing study default course conflicts with recovery package: ${existing.id}`,
    );
  }
  const registrationPath = getStudyPaths(studiesRoot, existing.id).source.registration;
  if (existsSync(registrationPath)) {
    const registration = readSourceRegistration(studiesRoot, existing.id);
    if (realpathSync.native(registration.sourceRoot) !== sourceRoot) {
      throw new Error(`Existing study source conflicts with recovery package: ${existing.id}`);
    }
    const expectedDefaultRef = index.source?.defaultRef ?? "HEAD";
    if (registration.defaultRef !== expectedDefaultRef) {
      throw new Error(
        `Existing study source default ref conflicts with recovery package: ${existing.id}`,
      );
    }
  }
}

function writeRecoveryProvenance(
  studiesRoot: string,
  studyId: string,
  coursePackage: CourseRecoveryPackage,
): void {
  const path = provenancePath(studiesRoot, studyId, coursePackage.course.id);
  const value = RecoveryProvenanceSchema.parse({
    schemaVersion: 1,
    evidenceMode: EVIDENCE_MODE,
    droppedUaBindingCount: coursePackage.droppedUaBindingCount,
    semanticSha256: packageSemanticSha256(coursePackage),
  });
  if (existsSync(path)) {
    const existing = RecoveryProvenanceSchema.parse(
      JSON.parse(readFileSync(path, "utf8")) as unknown,
    );
    if (canonicalJson(existing) !== canonicalJson(value)) {
      throw new Error(
        `Existing recovery provenance conflicts for course ${coursePackage.course.id}`,
      );
    }
    return;
  }
  writeJsonAtomically(path, value);
}

function courseTimestamp(courseIndex: number): string {
  return new Date(RECONSTRUCTED_EPOCH_MS + courseIndex * 1_000).toISOString();
}

function equivalentPackage(
  studiesRoot: string,
  studyId: string,
  coursePackage: CourseRecoveryPackage,
): boolean {
  const actual = serializeCourse(
    studiesRoot,
    studyId,
    readCourse(studiesRoot, studyId, coursePackage.course.id),
  );
  return canonicalJson(actual) === canonicalJson(coursePackage);
}

function assertCourseMatchesRecovery(
  existing: CourseManifest,
  coursePackage: CourseRecoveryPackage,
): void {
  const wanted = coursePackage.course;
  const actual = {
    id: existing.id,
    title: existing.title,
    description: existing.description,
    audience: existing.audience,
    objectives: existing.objectives,
    unitIds: existing.unitIds,
    currency: existing.currency,
    prerequisiteCourseIds: existing.prerequisiteCourseIds,
  };
  const expected = {
    id: wanted.id,
    title: wanted.title,
    description: wanted.description,
    audience: wanted.audience,
    objectives: wanted.objectives,
    unitIds: wanted.units.map((unit) => unit.id),
    currency: wanted.currency,
    prerequisiteCourseIds: wanted.prerequisiteCourseIds,
  };
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error(`Existing draft course conflicts with recovery package: ${wanted.id}`);
  }
}

function assertUnitMatchesRecovery(
  studiesRoot: string,
  studyId: string,
  courseId: string,
  unit: CourseRecoveryPackage["course"]["units"][number],
): void {
  const existing = readUnit(studiesRoot, studyId, courseId, unit.id);
  if (existing.status === "retired") {
    throw new Error(`Retired unit cannot be recovered in place: ${unit.id}`);
  }
  const actual = {
    id: existing.id,
    title: existing.title,
    objective: existing.objective,
    prerequisiteUnitIds: existing.prerequisiteUnitIds,
    lessonIds: existing.lessonIds,
  };
  const expected = {
    id: unit.id,
    title: unit.title,
    objective: unit.objective,
    prerequisiteUnitIds: unit.prerequisiteUnitIds,
    lessonIds: unit.lessons.map((lesson) => lesson.id),
  };
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error(`Existing unit conflicts with recovery package: ${unit.id}`);
  }
}

function assertLessonMatchesRecovery(
  studiesRoot: string,
  studyId: string,
  courseId: string,
  unitId: string,
  lesson: RecoveryLesson,
  sourceRoot: string,
): void {
  const existing = readLatestLesson(studiesRoot, studyId, courseId, unitId, lesson.id);
  const actual = {
    id: existing.manifest.id,
    title: existing.manifest.title,
    content: existing.content,
    sections: existing.manifest.sections,
    ...(existing.manifest.variant === undefined ? {} : { variant: existing.manifest.variant }),
    evidence: existing.manifest.evidence,
    assets: existing.manifest.assets.map((asset) => ({
      metadata: asset,
      dataBase64: readAssetBytes(
        studiesRoot,
        studyId,
        courseId,
        unitId,
        lesson.id,
        existing.manifest.contentRevision,
        asset,
      ).toString("base64"),
    })),
    cardIds: existing.manifest.cardIds,
    exerciseIds: existing.manifest.exerciseIds,
    contentRevision: existing.manifest.contentRevision,
    status: existing.manifest.status,
  };
  const expected = {
    id: lesson.id,
    title: lesson.title,
    content: lesson.content,
    sections: lesson.sections,
    ...(lesson.variant === undefined ? {} : { variant: lesson.variant }),
    evidence: lesson.evidence,
    assets: lesson.assets.map((asset) => ({
      ...asset,
      metadata: runtimeAssetMetadata(asset.metadata, sourceRoot),
    })),
    cardIds: lesson.cards.map((card) => card.id),
    exerciseIds: lesson.exercises.map((exercise) => exercise.id),
    contentRevision: 1,
    status: "active",
  };
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error(`Existing lesson conflicts with recovery package: ${lesson.id}`);
  }
}

function assertCardMatchesRecovery(
  existing: ReturnType<typeof readLatestCard>,
  card: RecoveryCard,
): void {
  const actual = {
    id: existing.id,
    kind: existing.kind,
    front: existing.front,
    back: existing.back,
    tags: existing.tags,
    evidence: existing.evidence,
    contentRevision: existing.contentRevision,
    status: existing.status,
  };
  if (canonicalJson(actual) !== canonicalJson({ ...card, contentRevision: 1, status: "active" })) {
    throw new Error(`Existing card conflicts with recovery package: ${card.id}`);
  }
}

function assertExerciseMatchesRecovery(
  existing: ReturnType<typeof readLatestExercise>,
  exercise: RecoveryExercise,
): void {
  const actual =
    existing.kind === "short-answer"
      ? {
          id: existing.id,
          kind: existing.kind,
          title: existing.title,
          prompt: existing.prompt,
          expectedAnswer: existing.expectedAnswer,
          evidence: existing.evidence,
          contentRevision: existing.contentRevision,
          status: existing.status,
        }
      : {
          id: existing.id,
          kind: existing.kind,
          title: existing.title,
          prompt: existing.prompt,
          rubric: existing.rubric,
          evidence: existing.evidence,
          contentRevision: existing.contentRevision,
          status: existing.status,
        };
  if (
    canonicalJson(actual) !== canonicalJson({ ...exercise, contentRevision: 1, status: "active" })
  ) {
    throw new Error(`Existing exercise conflicts with recovery package: ${exercise.id}`);
  }
}

function preflightPractices(
  studiesRoot: string,
  studyId: string,
  courseId: string,
  unitId: string,
  lesson: RecoveryLesson,
): void {
  const lessonPaths = getLessonPaths(studiesRoot, studyId, courseId, unitId, lesson.id);
  for (const card of lesson.cards) {
    const cardRoot = join(lessonPaths.cards, card.id);
    const cardLatest = join(cardRoot, "latest.json");
    if (!existsSync(cardLatest)) {
      if (existsSync(cardRoot)) {
        throw new Error(`Existing card path has no canonical latest revision: ${card.id}`);
      }
      continue;
    }
    const existing = readLatestCard(studiesRoot, studyId, courseId, unitId, lesson.id, card.id);
    assertCardMatchesRecovery(existing, card);
  }
  for (const exercise of lesson.exercises) {
    const exerciseRoot = join(lessonPaths.exercises, exercise.id);
    const exerciseLatest = join(exerciseRoot, "latest.json");
    if (!existsSync(exerciseLatest)) {
      if (existsSync(exerciseRoot)) {
        throw new Error(`Existing exercise path has no canonical latest revision: ${exercise.id}`);
      }
      continue;
    }
    const existing = readLatestExercise(
      studiesRoot,
      studyId,
      courseId,
      unitId,
      lesson.id,
      exercise.id,
    );
    assertExerciseMatchesRecovery(existing, exercise);
  }
}

function writePractices(
  studiesRoot: string,
  studyId: string,
  courseId: string,
  unitId: string,
  lesson: RecoveryLesson,
): void {
  const lessonPaths = getLessonPaths(studiesRoot, studyId, courseId, unitId, lesson.id);
  preflightPractices(studiesRoot, studyId, courseId, unitId, lesson);
  for (const card of lesson.cards) {
    if (existsSync(join(lessonPaths.cards, card.id, "latest.json"))) continue;
    writeCardRevision(studiesRoot, studyId, {
      schemaVersion: 1,
      id: card.id,
      kind: card.kind,
      courseId,
      unitId,
      lessonId: lesson.id,
      front: card.front,
      back: card.back,
      contentRevision: 1,
      status: "active",
      tags: card.tags,
      evidence: card.evidence,
    });
  }
  for (const exercise of lesson.exercises) {
    if (existsSync(join(lessonPaths.exercises, exercise.id, "latest.json"))) continue;
    writeExerciseRevision(
      studiesRoot,
      studyId,
      exercise.kind === "short-answer"
        ? {
            schemaVersion: 1,
            id: exercise.id,
            kind: exercise.kind,
            title: exercise.title,
            courseId,
            unitId,
            lessonId: lesson.id,
            prompt: exercise.prompt,
            expectedAnswer: exercise.expectedAnswer,
            contentRevision: 1,
            status: "active",
            evidence: exercise.evidence,
          }
        : {
            schemaVersion: 1,
            id: exercise.id,
            kind: exercise.kind,
            title: exercise.title,
            courseId,
            unitId,
            lessonId: lesson.id,
            prompt: exercise.prompt,
            rubric: exercise.rubric,
            contentRevision: 1,
            status: "active",
            evidence: exercise.evidence,
          },
    );
  }
}

function writeLesson(
  studiesRoot: string,
  studyId: string,
  courseId: string,
  unitId: string,
  lesson: RecoveryLesson,
  timestamp: string,
  sourceRoot: string,
): void {
  const tempRoot = mkdtempSync(join(tmpdir(), "university-local-recovery-assets-"));
  try {
    const assetFiles = lesson.assets.map((asset, index) => {
      const sourcePath = join(tempRoot, `${String(index).padStart(4, "0")}-${asset.metadata.id}`);
      writeFileSync(sourcePath, Buffer.from(asset.dataBase64, "base64"), { mode: 0o600 });
      return { path: asset.metadata.path, sourcePath };
    });
    writeLessonRevision(studiesRoot, studyId, {
      manifest: {
        schemaVersion: 1,
        id: lesson.id,
        title: lesson.title,
        courseId,
        unitId,
        exerciseIds: lesson.exercises.map((exercise) => exercise.id),
        cardIds: lesson.cards.map((card) => card.id),
        contentRevision: 1,
        status: "active",
        evidence: lesson.evidence,
        sections: lesson.sections,
        assets: lesson.assets.map((asset) => runtimeAssetMetadata(asset.metadata, sourceRoot)),
        ...(lesson.variant === undefined ? {} : { variant: lesson.variant }),
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      content: lesson.content,
      assetFiles,
    });
    writePractices(studiesRoot, studyId, courseId, unitId, lesson);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function preflightCourseRecovery(
  studiesRoot: string,
  studyId: string,
  coursePackage: CourseRecoveryPackage,
  sourceRoot: string,
): void {
  const course = coursePackage.course;
  const paths = getCoursePaths(studiesRoot, studyId, course.id);
  if (!existsSync(paths.manifest)) {
    if (existsSync(paths.root)) {
      throw new Error(`Existing course path has no canonical manifest: ${course.id}`);
    }
    return;
  }

  const existing = readCourse(studiesRoot, studyId, course.id);
  if (existing.status === "active") {
    if (!equivalentPackage(studiesRoot, studyId, coursePackage)) {
      throw new Error(`Active course conflicts with recovery package: ${course.id}`);
    }
    return;
  }
  if (existing.status !== "draft" && existing.status !== "stale") {
    throw new Error(`Course cannot be resumed from status ${existing.status}: ${course.id}`);
  }
  assertCourseMatchesRecovery(existing, coursePackage);

  for (const unit of course.units) {
    const unitPaths = getUnitPaths(studiesRoot, studyId, course.id, unit.id);
    if (!existsSync(unitPaths.manifest)) {
      if (existsSync(unitPaths.root)) {
        throw new Error(`Existing unit path has no canonical manifest: ${unit.id}`);
      }
    } else {
      assertUnitMatchesRecovery(studiesRoot, studyId, course.id, unit);
    }
    for (const lesson of unit.lessons) {
      const lessonPaths = getLessonPaths(studiesRoot, studyId, course.id, unit.id, lesson.id);
      if (!existsSync(lessonPaths.latest)) {
        if (existsSync(lessonPaths.root)) {
          throw new Error(`Existing lesson path has no canonical latest revision: ${lesson.id}`);
        }
      } else {
        assertLessonMatchesRecovery(studiesRoot, studyId, course.id, unit.id, lesson, sourceRoot);
      }
      preflightPractices(studiesRoot, studyId, course.id, unit.id, lesson);
    }
  }
}

function preflightSnapshotConflict(
  studiesRoot: string,
  studyId: string,
  sourceRoot: string,
  sourceCommit: string,
): void {
  const snapshotId = `git-${sourceCommit.slice(0, 12)}`;
  const manifestPath = getSnapshotPaths(studiesRoot, studyId, snapshotId).manifest;
  if (!existsSync(manifestPath)) return;
  const existing = SnapshotManifestSchema.parse(
    JSON.parse(readFileSync(manifestPath, "utf8")) as unknown,
  );
  const sourceTree = gitText(["rev-parse", "--verify", `${sourceCommit}^{tree}`], sourceRoot);
  if (
    existing.id !== snapshotId ||
    existing.sourceCommit !== sourceCommit ||
    existing.sourceTree !== sourceTree
  ) {
    throw new Error(`Recovery snapshot conflicts with existing snapshot: ${snapshotId}`);
  }
}

function preflightRecoveryImport(
  studiesRoot: string,
  studyId: string,
  loaded: LoadedRecovery,
  sourceRoot: string,
  sourceCommits: readonly string[],
): void {
  const studyPaths = getStudyPaths(studiesRoot, studyId);
  const studyExists = existsSync(studyPaths.manifest);
  if (studyExists) {
    assertExistingStudy(studiesRoot, loaded.index, sourceRoot);
  } else if (existsSync(studyPaths.root)) {
    throw new Error(`Recovery target study path exists without a study manifest: ${studyId}`);
  }
  if (!studyExists && existsSync(studyPaths.source.root)) {
    throw new Error(`Recovery target source path exists without a registration: ${studyId}`);
  }

  for (const commit of sourceCommits) {
    preflightSnapshotConflict(studiesRoot, studyId, sourceRoot, commit);
  }
  if (!studyExists) return;
  for (const coursePackage of loaded.packages) {
    preflightCourseRecovery(studiesRoot, studyId, coursePackage, sourceRoot);
  }
}

function restoreCourse(
  studiesRoot: string,
  studyId: string,
  coursePackage: CourseRecoveryPackage,
  courseIndex: number,
  sourceRoot: string,
): "created" | "resumed" | "reused" {
  const course = coursePackage.course;
  const paths = getCoursePaths(studiesRoot, studyId, course.id);
  const courseExisted = existsSync(paths.manifest);
  if (courseExisted) {
    const existing = readCourse(studiesRoot, studyId, course.id);
    if (existing.status === "active") {
      if (!equivalentPackage(studiesRoot, studyId, coursePackage)) {
        throw new Error(`Active course conflicts with recovery package: ${course.id}`);
      }
      return "reused";
    }
    if (existing.status !== "draft" && existing.status !== "stale") {
      throw new Error(`Course cannot be resumed from status ${existing.status}: ${course.id}`);
    }
    assertCourseMatchesRecovery(existing, coursePackage);
  }

  const timestamp = courseTimestamp(courseIndex);
  if (!courseExisted) {
    writeCourse(studiesRoot, studyId, {
      schemaVersion: 1,
      id: course.id,
      title: course.title,
      description: course.description,
      audience: course.audience,
      objectives: course.objectives,
      unitIds: course.units.map((unit) => unit.id),
      status: "draft",
      currency: course.currency,
      prerequisiteCourseIds: course.prerequisiteCourseIds,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  for (const unit of course.units) {
    const unitRoot = join(paths.units, unit.id);
    if (!existsSync(join(unitRoot, "unit.json"))) {
      writeUnit(studiesRoot, studyId, course.id, {
        schemaVersion: 1,
        id: unit.id,
        title: unit.title,
        objective: unit.objective,
        prerequisiteUnitIds: unit.prerequisiteUnitIds,
        lessonIds: unit.lessons.map((lesson) => lesson.id),
        status: "draft",
      });
    } else {
      assertUnitMatchesRecovery(studiesRoot, studyId, course.id, unit);
    }
    for (const lesson of unit.lessons) {
      const lessonPaths = getLessonPaths(studiesRoot, studyId, course.id, unit.id, lesson.id);
      if (!existsSync(lessonPaths.latest)) {
        writeLesson(studiesRoot, studyId, course.id, unit.id, lesson, timestamp, sourceRoot);
      } else {
        assertLessonMatchesRecovery(studiesRoot, studyId, course.id, unit.id, lesson, sourceRoot);
        writePractices(studiesRoot, studyId, course.id, unit.id, lesson);
      }
    }
  }

  writeRecoveryProvenance(studiesRoot, studyId, coursePackage);
  for (const unit of course.units) {
    updateUnitStatus(studiesRoot, studyId, course.id, unit.id, "active");
  }
  updateCourseStatus(studiesRoot, studyId, course.id, "active", new Date(timestamp));
  if (!equivalentPackage(studiesRoot, studyId, coursePackage)) {
    throw new Error(`Recovered course failed canonical verification: ${course.id}`);
  }
  return courseExisted ? "resumed" : "created";
}

export function importCourseRecovery(input: ImportCourseRecoveryInput) {
  const loaded = loadCourseRecovery(input.inputDirectory);
  if (loaded.index.study.id !== StableId.parse(input.studyId)) {
    throw new Error(
      `Recovery study ID ${loaded.index.study.id} does not match requested ${input.studyId}`,
    );
  }
  const sourceRoot = requireSourceRoot(input.sourceRoot);
  const sourceDefaultRef = loaded.index.source?.defaultRef ?? "HEAD";
  const potentialStudiesRoot = canonicalizePotentialPath(input.studiesRoot);
  if (
    isPathInside(potentialStudiesRoot, sourceRoot) ||
    isPathInside(sourceRoot, potentialStudiesRoot)
  ) {
    throw new Error("Recovery studiesRoot and sourceRoot must be separate");
  }
  const commits = validateSourceEvidence(sourceRoot, loaded.packages);
  preflightRecoveryImport(input.studiesRoot, loaded.index.study.id, loaded, sourceRoot, commits);
  if (input.dryRun) {
    return {
      schemaVersion: 1 as const,
      operation: "course-recovery-import" as const,
      mode: "dry-run" as const,
      outcome: "validated" as const,
      studyId: loaded.index.study.id,
      sourceRoot,
      evidenceMode: EVIDENCE_MODE,
      droppedUaBindingCount: loaded.index.droppedUaBindingCount,
      sourceCommits: commits,
      courseIds: loaded.packages.map((course) => course.course.id),
    };
  }

  const studyPaths = getStudyPaths(input.studiesRoot, loaded.index.study.id);
  const existed = existsSync(studyPaths.manifest);
  if (!existed) {
    createStudy(input.studiesRoot, {
      id: loaded.index.study.id,
      title: loaded.index.study.title,
      description: loaded.index.study.description,
      goals: loaded.index.study.goals,
      now: new Date(RECONSTRUCTED_EPOCH_MS),
    });
  }
  if (!existsSync(studyPaths.source.registration)) {
    registerLocalGitSource(input.studiesRoot, loaded.index.study.id, sourceRoot, sourceDefaultRef);
  }
  for (const commit of commits) {
    const snapshot = createCleanSnapshot(
      input.studiesRoot,
      loaded.index.study.id,
      commit,
      new Date(RECONSTRUCTED_EPOCH_MS),
    );
    const expected = `git-${commit.slice(0, 12)}`;
    if (snapshot.id !== expected || snapshot.sourceCommit !== commit) {
      throw new Error(`Recovery snapshot is not deterministic for commit ${commit}`);
    }
  }

  const courses = loaded.packages.map((coursePackage, index) => ({
    courseId: coursePackage.course.id,
    outcome: restoreCourse(
      input.studiesRoot,
      loaded.index.study.id,
      coursePackage,
      index,
      sourceRoot,
    ),
  }));
  if (loaded.index.study.defaultCourseId !== null) {
    const current = readStudy(input.studiesRoot, loaded.index.study.id);
    if (current.defaultCourseId === null) {
      setDefaultCourse(
        input.studiesRoot,
        loaded.index.study.id,
        loaded.index.study.defaultCourseId,
        new Date(RECONSTRUCTED_EPOCH_MS),
      );
    }
  }
  if (loaded.index.study.status === "archived") {
    setStudyStatus(
      input.studiesRoot,
      loaded.index.study.id,
      "archived",
      new Date(RECONSTRUCTED_EPOCH_MS),
    );
  }
  return {
    schemaVersion: 1 as const,
    operation: "course-recovery-import" as const,
    mode: "apply" as const,
    outcome: existed ? "resumed" : "created",
    studyId: loaded.index.study.id,
    sourceRoot,
    evidenceMode: EVIDENCE_MODE,
    droppedUaBindingCount: loaded.index.droppedUaBindingCount,
    sourceCommits: commits,
    courses,
  };
}
