import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import {
  CardContentSchema,
  EvidenceReferenceSchema,
  ExerciseSchema,
  IsoDateTime,
  LessonManifestSchema,
  LessonAssetSchema,
  LessonVariantSchema,
  Sha256,
  SnapshotManifestSchema,
  StableId,
  UaAnalysisManifestSchema,
  type CardContent,
  type EvidenceReference,
  type Exercise,
  type LessonManifest,
} from "../../src/domain/schemas.js";
import {
  readCourse,
  readLatestCard,
  readLatestExercise,
  readLatestLesson,
  readUnit,
  updateCourseStatus,
  updateUnitStatus,
  writeCardRevision,
  writeExerciseRevision,
  writeLessonRevision,
} from "../content/repository.js";
import { matchesAssetMime, sniffAssetMime } from "../content/asset-bytes.js";
import { validateEvidence } from "../content/evidence.js";
import { writeJsonAtomically } from "../storage/atomic-json.js";
import {
  getCoursePaths,
  getLessonPaths,
  getSnapshotPaths,
  getUaAnalysisPaths,
} from "../studies/paths.js";
import { auditStudyFreshness, inspectSourceStatus } from "./refresh-study.js";

const EMPTY_SHA256 = `sha256:${"0".repeat(64)}`;
const MAX_LESSON_CONTENT_BYTES = 512 * 1024;

/**
 * `expectedRevision` is the optimistic-concurrency check against the stored
 * item. Omitting it declares the item as new: a course that could only revise
 * what it already had could never grow, so adding a card or an exercise meant
 * rebuilding the whole course.
 */
const CardRevisionProposalSchema = z
  .object({
    id: StableId,
    expectedRevision: z.number().int().positive().optional(),
    kind: z.enum(["basic", "cloze"]).optional(),
    front: z.string().min(1).max(20_000),
    back: z.string().min(1).max(20_000),
    tags: z.array(StableId).optional(),
    evidence: z.array(EvidenceReferenceSchema).min(1),
  })
  .strict();

const ExerciseRevisionBaseSchema = z.object({
  id: StableId,
  expectedRevision: z.number().int().positive().optional(),
  title: z.string().min(1).max(200).optional(),
  prompt: z.string().min(1).max(20_000),
  evidence: z.array(EvidenceReferenceSchema).min(1),
});

const ExerciseRevisionProposalSchema = z.union([
  ExerciseRevisionBaseSchema.extend({
    kind: z.literal("short-answer").optional(),
    expectedAnswer: z.string().min(1),
  }).strict(),
  ExerciseRevisionBaseSchema.extend({
    kind: z.literal("explain").optional(),
    rubric: z.array(z.string().min(1)).min(1),
  }).strict(),
]);

const LessonAssetFileProposalSchema = z
  .object({
    path: z.string().min(1),
    sourcePath: z.string().min(1),
  })
  .strict();

export const CourseRevisionProposalSchema = z
  .object({
    schemaVersion: z.literal(1),
    proposalId: StableId,
    targetSnapshotId: StableId,
    targetAnalysisId: StableId.optional(),
    lesson: z
      .object({
        courseId: StableId,
        unitId: StableId,
        id: StableId,
        expectedRevision: z.number().int().positive(),
        title: z.string().min(1).max(200).optional(),
        variant: LessonVariantSchema.optional(),
        content: z.string().min(1),
        evidence: z.array(EvidenceReferenceSchema).min(1),
        assets: z.array(LessonAssetSchema).max(100).optional(),
        assetFiles: z.array(LessonAssetFileProposalSchema).optional(),
        cards: z.array(CardRevisionProposalSchema),
        exercises: z.array(ExerciseRevisionProposalSchema),
      })
      .strict(),
  })
  .strict();

const OperationReceiptSchema = z
  .object({
    schemaVersion: z.literal(1),
    operation: z.literal("course-revise"),
    proposalId: StableId,
    proposalHash: Sha256,
    studyId: StableId,
    courseId: StableId,
    unitId: StableId,
    lessonId: StableId,
    targetSnapshotId: StableId,
    targetAnalysisId: StableId.nullable(),
    status: z.enum(["pending", "complete"]),
    completedComponents: z.array(z.string().min(1)),
    createdAt: IsoDateTime,
    updatedAt: IsoDateTime,
  })
  .strict();

type CourseRevisionProposal = z.infer<typeof CourseRevisionProposalSchema>;
type CardRevisionProposal = z.infer<typeof CardRevisionProposalSchema>;
type ExerciseRevisionProposal = z.infer<typeof ExerciseRevisionProposalSchema>;
type LessonAsset = z.infer<typeof LessonAssetSchema>;
type LessonAssetFileProposal = z.infer<typeof LessonAssetFileProposalSchema>;
type OperationReceipt = z.infer<typeof OperationReceiptSchema>;
type ExerciseWithoutHash = Exercise extends infer Item
  ? Item extends { contentHash: string }
    ? Omit<Item, "contentHash">
    : never
  : never;

export interface TargetIdentity {
  readonly snapshotId: string;
  readonly sourceCommit: string;
  readonly analysisId: string | null;
  readonly graphHash: string | null;
}

interface RevisionBundle {
  readonly lesson: LessonManifest;
  readonly lessonContent: string;
  readonly assetFiles: readonly { readonly path: string; readonly sourcePath: string }[];
  readonly cards: readonly CardContent[];
  readonly exercises: readonly Exercise[];
}

interface ReviseCourseInput {
  readonly studiesRoot: string;
  readonly studyId: string;
  readonly proposal: unknown;
  readonly dryRun?: boolean;
  readonly now?: Date;
  /** Optional progress observer. Throwing simulates an interrupted caller; exact retries recover. */
  readonly onComponentWritten?: (component: string) => void;
}

interface CourseRevisionResult {
  readonly schemaVersion: 1;
  readonly operation: "course-revise";
  readonly mode: "dry-run" | "apply";
  readonly disposition: "validated" | "created" | "recovered" | "reused";
  readonly studyId: string;
  readonly proposalId: string;
  readonly proposalHash: string;
  readonly courseId: string;
  readonly unitId: string;
  readonly lessonId: string;
  readonly targetSnapshotId: string;
  readonly targetAnalysisId: string | null;
  readonly revisions: {
    readonly lesson: number;
    readonly cards: Readonly<Record<string, number>>;
    readonly exercises: Readonly<Record<string, number>>;
  };
  readonly completedComponents: readonly string[];
  readonly retrySafe: true;
}

interface ReactivateCourseInput {
  readonly studiesRoot: string;
  readonly studyId: string;
  readonly courseId: string;
  readonly targetSnapshotId: string;
  readonly targetAnalysisId?: string;
}

interface ReactivateCourseResult {
  readonly schemaVersion: 1;
  readonly operation: "course-reactivate";
  readonly disposition: "activated" | "reused";
  readonly studyId: string;
  readonly courseId: string;
  readonly targetSnapshotId: string;
  readonly targetAnalysisId: string | null;
  readonly reportHash: string;
  readonly activatedUnitIds: readonly string[];
  readonly courseStatus: "active";
}

interface OpenCourseForEditInput {
  readonly studiesRoot: string;
  readonly studyId: string;
  readonly courseId: string;
  readonly now?: Date;
}

interface OpenCourseForEditResult {
  readonly schemaVersion: 1;
  readonly operation: "course-open-for-edit";
  readonly disposition: "opened" | "reused";
  readonly studyId: string;
  readonly courseId: string;
  readonly staleUnitIds: readonly string[];
  readonly courseStatus: "stale";
}

/**
 * Moves an active course and its units to `stale` so their content can be
 * edited. `course revise` refuses to touch active containers, and until now the
 * only thing that produced `stale` was a freshness audit finding the source had
 * moved — so a course whose evidence was still perfectly current could not be
 * improved at all. This is the deliberate half of the same transition, and
 * `course reactivate` remains the only way back, with its full audit intact.
 */
export function openCourseForEdit(input: OpenCourseForEditInput): OpenCourseForEditResult {
  const course = readCourse(input.studiesRoot, input.studyId, input.courseId);
  if (course.status !== "active" && course.status !== "stale") {
    throw new Error(
      `Only an active course can be opened for editing: ${course.id} is ${course.status}`,
    );
  }
  const alreadyOpen =
    course.status === "stale" &&
    course.unitIds.every(
      (unitId) => readUnit(input.studiesRoot, input.studyId, course.id, unitId).status === "stale",
    );
  const now = input.now ?? new Date();
  // The course goes first: `updateUnitStatus` refuses to move a unit out of
  // `active` while its course is still active. Reactivation runs the mirror
  // image, units first and the course last.
  const updated = updateCourseStatus(input.studiesRoot, input.studyId, course.id, "stale", now);
  for (const unitId of course.unitIds) {
    updateUnitStatus(input.studiesRoot, input.studyId, course.id, unitId, "stale");
  }
  return {
    schemaVersion: 1,
    operation: "course-open-for-edit",
    disposition: alreadyOpen ? "reused" : "opened",
    studyId: input.studyId,
    courseId: course.id,
    staleUnitIds: course.unitIds,
    courseStatus: updated.status as "stale",
  };
}

export class CourseRevisionPartialError extends Error {
  readonly receipt: OperationReceipt;

  constructor(receipt: OperationReceipt, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(
      `Course revision stopped after a partial write (${receipt.completedComponents.join(", ") || "none"}). ` +
        `A pending receipt was preserved; retry the exact proposal ${receipt.proposalId}. Cause: ${detail}`,
    );
    this.name = "CourseRevisionPartialError";
    this.receipt = receipt;
  }
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
  return JSON.stringify(value) ?? "undefined";
}

function sha256(value: string | Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function assertUniqueIds(items: readonly { readonly id: string }[], label: string): void {
  const ids = items.map((item) => item.id);
  if (new Set(ids).size !== ids.length) throw new Error(`${label} must not contain duplicate IDs`);
}

/**
 * A revision may add items but never lose them. Dropping a card would leave its
 * scheduled review state pointing at content the lesson no longer declares, so
 * removal has to go through retirement rather than through an omission in a
 * proposal. Duplicates are rejected for the same reason `create-course` rejects
 * them: two entries would write into one directory.
 */
function assertCoversExisting(
  proposed: readonly string[],
  existing: readonly string[],
  label: string,
): void {
  const seen = new Set<string>();
  for (const id of proposed) {
    if (seen.has(id)) throw new Error(`${label} must not contain duplicate IDs: ${id}`);
    seen.add(id);
  }
  const missing = existing.filter((id) => !seen.has(id));
  if (missing.length > 0) {
    throw new Error(
      `${label} must still contain every existing ID; missing: ${missing.join(", ")}. ` +
        `Retire an item instead of dropping it from a revision.`,
    );
  }
}

function resolveLessonAssets(
  currentLesson: LessonManifest,
  proposedAssets: readonly LessonAsset[] | undefined,
): readonly LessonAsset[] {
  const assets = proposedAssets ?? currentLesson.assets;
  assertUniqueIds(assets, "Proposed lesson assets");
  assertUniqueIds(
    assets.map((asset) => ({ id: asset.path })),
    "Proposed lesson asset paths",
  );
  assertCoversExisting(
    assets.map((asset) => asset.id),
    currentLesson.assets.map((asset) => asset.id),
    `Lesson ${currentLesson.id} assets`,
  );

  const proposedById = new Map(assets.map((asset) => [asset.id, asset]));
  for (const current of currentLesson.assets) {
    const replacement = proposedById.get(current.id);
    if (replacement?.path !== current.path) {
      throw new Error(`Existing lesson asset paths cannot change in a revision: ${current.id}`);
    }
  }
  return assets;
}

function resolveLessonAssetFiles(
  studiesRoot: string,
  studyId: string,
  currentLesson: LessonManifest,
  assets: readonly LessonAsset[],
  proposedFiles: readonly LessonAssetFileProposal[] | undefined,
): readonly { readonly path: string; readonly sourcePath: string }[] {
  const files = proposedFiles ?? [];
  assertUniqueIds(
    files.map((file) => ({ id: file.path })),
    "Proposed lesson asset files",
  );
  const declaredPaths = new Set(assets.map((asset) => asset.path));
  for (const file of files) {
    if (!declaredPaths.has(file.path)) {
      throw new Error(`Asset file is not declared by the lesson: ${file.path}`);
    }
  }

  const explicitByPath = new Map(files.map((file) => [file.path, file.sourcePath]));
  const currentById = new Map(currentLesson.assets.map((asset) => [asset.id, asset]));
  const currentRevisionRoot = join(
    getLessonPaths(
      studiesRoot,
      studyId,
      currentLesson.courseId,
      currentLesson.unitId,
      currentLesson.id,
    ).revisions,
    String(currentLesson.contentRevision),
  );

  return assets.map((asset) => {
    const sourcePath =
      explicitByPath.get(asset.path) ??
      (currentById.has(asset.id) ? join(currentRevisionRoot, asset.path) : undefined);
    if (!sourcePath) {
      throw new Error(`New lesson asset needs an assetFiles sourcePath: ${asset.id}`);
    }
    const bytes = readFileSync(sourcePath);
    if (bytes.byteLength !== asset.bytes || sha256(bytes) !== asset.sha256) {
      throw new Error(`Lesson asset hash/size mismatch: ${asset.id}`);
    }
    // Size and hash are both computed from this very file, so they agree with
    // any declared MIME. The bytes are the only thing that can contradict it,
    // and the serving path refuses a file that does — after it is already
    // stored, where the failure is a broken image and nobody's build error.
    if (!matchesAssetMime(bytes, asset.mime)) {
      throw new Error(
        `Lesson asset ${asset.id} declares ${asset.mime} but its bytes are ${sniffAssetMime(bytes)}: ${asset.path}`,
      );
    }
    return { path: asset.path, sourcePath };
  });
}

export function readTargetIdentity(
  studiesRoot: string,
  studyId: string,
  proposal: {
    readonly targetSnapshotId: string;
    readonly targetAnalysisId?: string | undefined;
  },
): TargetIdentity {
  const snapshot = SnapshotManifestSchema.parse(
    readJson(getSnapshotPaths(studiesRoot, studyId, proposal.targetSnapshotId).manifest),
  );
  if (!proposal.targetAnalysisId) {
    return {
      snapshotId: snapshot.id,
      sourceCommit: snapshot.sourceCommit,
      analysisId: null,
      graphHash: null,
    };
  }
  const analysis = UaAnalysisManifestSchema.parse(
    readJson(getUaAnalysisPaths(studiesRoot, studyId, proposal.targetAnalysisId).manifest),
  );
  if (
    analysis.status !== "ready" ||
    analysis.snapshotId !== snapshot.id ||
    analysis.sourceCommit !== snapshot.sourceCommit
  ) {
    throw new Error("Target UA analysis is not ready or does not match the target snapshot");
  }
  return {
    snapshotId: snapshot.id,
    sourceCommit: snapshot.sourceCommit,
    analysisId: analysis.id,
    graphHash: analysis.graphHash,
  };
}

export function validateTargetEvidence(
  studiesRoot: string,
  studyId: string,
  evidence: readonly EvidenceReference[],
  target: TargetIdentity,
  label: string,
): void {
  for (const reference of evidence) {
    validateEvidence(studiesRoot, studyId, reference);
    if (
      reference.snapshotId !== target.snapshotId ||
      reference.sourceCommit !== target.sourceCommit
    ) {
      throw new Error(`${label} evidence must point to the target snapshot and source commit`);
    }
    if (reference.analysisId) {
      if (reference.analysisId !== target.analysisId || reference.graphHash !== target.graphHash) {
        throw new Error(`${label} UA evidence must point to the target analysis identity`);
      }
    }
  }
}

function normalizeCard(candidate: Omit<CardContent, "contentHash">): CardContent {
  const parsed = CardContentSchema.parse({ ...candidate, contentHash: EMPTY_SHA256 });
  const { contentHash: _contentHash, ...content } = parsed;
  return CardContentSchema.parse({ ...content, contentHash: sha256(canonicalJson(content)) });
}

function normalizeExercise(candidate: ExerciseWithoutHash): Exercise {
  const parsed = ExerciseSchema.parse({ ...candidate, contentHash: EMPTY_SHA256 });
  const { contentHash: _contentHash, ...content } = parsed;
  return ExerciseSchema.parse({ ...content, contentHash: sha256(canonicalJson(content)) });
}

/** Where an item lives, for the case where there is no stored item to copy it from. */
interface ContentLocation {
  readonly courseId: string;
  readonly unitId: string;
  readonly lessonId: string;
}

function createCardRevision(
  current: CardContent | null,
  proposal: CardRevisionProposal,
  location: ContentLocation,
): CardContent {
  return normalizeCard({
    schemaVersion: 1,
    id: proposal.id,
    kind: proposal.kind ?? current?.kind ?? "basic",
    courseId: location.courseId,
    unitId: location.unitId,
    lessonId: location.lessonId,
    front: proposal.front,
    back: proposal.back,
    contentRevision: current === null ? 1 : (proposal.expectedRevision ?? 0) + 1,
    status: "active",
    tags: proposal.tags ?? current?.tags ?? [],
    evidence: proposal.evidence,
  });
}

function createExerciseRevision(
  current: Exercise | null,
  proposal: ExerciseRevisionProposal,
  location: ContentLocation,
): Exercise {
  const title = proposal.title ?? current?.title;
  if (title === undefined) {
    throw new Error(`Exercise ${proposal.id} is new and must declare a title`);
  }
  const common = {
    schemaVersion: 1 as const,
    id: proposal.id,
    title,
    courseId: location.courseId,
    unitId: location.unitId,
    lessonId: location.lessonId,
    prompt: proposal.prompt,
    contentRevision: current === null ? 1 : (proposal.expectedRevision ?? 0) + 1,
    status: "active" as const,
    evidence: proposal.evidence,
  };
  if ("expectedAnswer" in proposal) {
    if (proposal.kind && proposal.kind !== "short-answer") {
      throw new Error(`Exercise ${proposal.id} kind does not match expectedAnswer content`);
    }
    return normalizeExercise({
      ...common,
      kind: "short-answer",
      expectedAnswer: proposal.expectedAnswer,
    });
  }
  if (proposal.kind && proposal.kind !== "explain") {
    throw new Error(`Exercise ${proposal.id} kind does not match rubric content`);
  }
  return normalizeExercise({ ...common, kind: "explain", rubric: proposal.rubric });
}

function buildBundle(
  studiesRoot: string,
  studyId: string,
  proposal: CourseRevisionProposal,
  target: TargetIdentity,
  timestamp: string,
  allowInstalledTargetRevision: boolean,
  requireStaleContainers: boolean,
): RevisionBundle {
  const course = readCourse(studiesRoot, studyId, proposal.lesson.courseId);
  const unit = readUnit(studiesRoot, studyId, course.id, proposal.lesson.unitId);
  if (requireStaleContainers && (course.status !== "stale" || unit.status !== "stale")) {
    throw new Error("Course and target unit must both be stale before revising lesson content");
  }
  const currentLesson = readLatestLesson(
    studiesRoot,
    studyId,
    course.id,
    unit.id,
    proposal.lesson.id,
  ).manifest;
  const assets = resolveLessonAssets(currentLesson, proposal.lesson.assets);
  const assetFiles = resolveLessonAssetFiles(
    studiesRoot,
    studyId,
    currentLesson,
    assets,
    proposal.lesson.assetFiles,
  );
  assertUniqueIds(proposal.lesson.cards, "Proposed cards");
  assertUniqueIds(proposal.lesson.exercises, "Proposed exercises");
  const existingCardIds = new Set(currentLesson.cardIds);
  const existingExerciseIds = new Set(currentLesson.exerciseIds);
  assertCoversExisting(
    proposal.lesson.cards.map((card) => card.id),
    currentLesson.cardIds,
    `Lesson ${currentLesson.id} cards`,
  );
  assertCoversExisting(
    proposal.lesson.exercises.map((exercise) => exercise.id),
    currentLesson.exerciseIds,
    `Lesson ${currentLesson.id} exercises`,
  );
  if (Buffer.byteLength(proposal.lesson.content, "utf8") > MAX_LESSON_CONTENT_BYTES) {
    throw new Error(`Lesson content must not exceed ${MAX_LESSON_CONTENT_BYTES} bytes`);
  }
  if (proposal.lesson.content.trim() === "") throw new Error("Lesson content must not be empty");

  const assertExpected = (label: string, current: number, expected: number): void => {
    const installedTarget = expected + 1;
    if (current !== expected && !(allowInstalledTargetRevision && current === installedTarget)) {
      throw new Error(`${label} expected current revision ${expected}, received ${current}`);
    }
  };
  assertExpected(
    `Lesson ${currentLesson.id}`,
    currentLesson.contentRevision,
    proposal.lesson.expectedRevision,
  );
  validateTargetEvidence(
    studiesRoot,
    studyId,
    proposal.lesson.evidence,
    target,
    `Lesson ${currentLesson.id}`,
  );

  const location: ContentLocation = {
    courseId: course.id,
    unitId: unit.id,
    lessonId: currentLesson.id,
  };
  /**
   * An omitted `expectedRevision` claims the item is new, so the claim is
   * checked against the lesson rather than trusted: an ID the lesson already
   * declares must come with the revision it is at, and an ID it does not
   * declare must not pretend to have one.
   */
  const assertNewness = (label: string, id: string, expected: number | undefined): boolean => {
    const known = existingCardIds.has(id) || existingExerciseIds.has(id);
    if (known && expected === undefined) {
      throw new Error(`${label} already exists; declare its expectedRevision to revise it`);
    }
    if (!known && expected !== undefined) {
      throw new Error(`${label} does not exist yet; omit expectedRevision to add it`);
    }
    return !known;
  };

  const cards = proposal.lesson.cards.map((item) => {
    const isNew = assertNewness(`Card ${item.id}`, item.id, item.expectedRevision);
    const current = isNew
      ? null
      : readLatestCard(studiesRoot, studyId, course.id, unit.id, currentLesson.id, item.id);
    if (current !== null) {
      assertExpected(`Card ${item.id}`, current.contentRevision, item.expectedRevision!);
    }
    validateTargetEvidence(studiesRoot, studyId, item.evidence, target, `Card ${item.id}`);
    return createCardRevision(current, item, location);
  });
  const exercises = proposal.lesson.exercises.map((item) => {
    const isNew = assertNewness(`Exercise ${item.id}`, item.id, item.expectedRevision);
    const current = isNew
      ? null
      : readLatestExercise(studiesRoot, studyId, course.id, unit.id, currentLesson.id, item.id);
    if (current !== null) {
      assertExpected(`Exercise ${item.id}`, current.contentRevision, item.expectedRevision!);
    }
    validateTargetEvidence(studiesRoot, studyId, item.evidence, target, `Exercise ${item.id}`);
    return createExerciseRevision(current, item, location);
  });
  const lesson = LessonManifestSchema.parse({
    ...currentLesson,
    title: proposal.lesson.title ?? currentLesson.title,
    variant: proposal.lesson.variant ?? currentLesson.variant,
    // The proposal's order is the lesson's order, and it is where a newly added
    // card or exercise becomes part of the lesson rather than an orphan file.
    cardIds: cards.map((card) => card.id),
    exerciseIds: exercises.map((exercise) => exercise.id),
    contentRevision: proposal.lesson.expectedRevision + 1,
    contentHash: sha256(proposal.lesson.content),
    status: "active",
    evidence: proposal.lesson.evidence,
    assets,
    updatedAt: timestamp,
  });
  return { lesson, lessonContent: proposal.lesson.content, assetFiles, cards, exercises };
}

function operationPath(
  studiesRoot: string,
  studyId: string,
  courseId: string,
  proposalId: string,
): string {
  return join(
    getCoursePaths(studiesRoot, studyId, courseId).root,
    "operations",
    `revise-${StableId.parse(proposalId)}.json`,
  );
}

function writeReceipt(path: string, receipt: OperationReceipt): void {
  mkdirSync(join(path, ".."), { recursive: true, mode: 0o700 });
  writeJsonAtomically(path, OperationReceiptSchema.parse(receipt));
}

function readExistingReceipt(path: string): OperationReceipt | null {
  return existsSync(path) ? OperationReceiptSchema.parse(readJson(path)) : null;
}

function assertStoredBundle(studiesRoot: string, studyId: string, bundle: RevisionBundle): void {
  const paths = getLessonPaths(
    studiesRoot,
    studyId,
    bundle.lesson.courseId,
    bundle.lesson.unitId,
    bundle.lesson.id,
  );
  const lessonRoot = join(paths.revisions, String(bundle.lesson.contentRevision));
  const storedLesson = LessonManifestSchema.parse(readJson(join(lessonRoot, "manifest.json")));
  const storedContent = readFileSync(join(lessonRoot, "content.md"), "utf8");
  if (
    canonicalJson(storedLesson) !== canonicalJson(bundle.lesson) ||
    storedContent !== bundle.lessonContent ||
    storedLesson.contentHash !== sha256(storedContent)
  ) {
    throw new Error("Stored lesson target revision conflicts with the proposal");
  }
  for (const asset of bundle.lesson.assets) {
    const storedAssetPath = join(lessonRoot, asset.path);
    if (!existsSync(storedAssetPath)) {
      throw new Error(`Stored lesson asset is missing: ${asset.id}`);
    }
    const bytes = readFileSync(storedAssetPath);
    if (bytes.byteLength !== asset.bytes || sha256(bytes) !== asset.sha256) {
      throw new Error(`Stored lesson asset conflicts with the proposal: ${asset.id}`);
    }
    if (!matchesAssetMime(bytes, asset.mime)) {
      throw new Error(
        `Stored lesson asset ${asset.id} declares ${asset.mime} but its bytes are ${sniffAssetMime(bytes)}`,
      );
    }
  }
  for (const card of bundle.cards) {
    const stored = CardContentSchema.parse(
      readJson(join(paths.cards, card.id, "revisions", String(card.contentRevision), "card.json")),
    );
    if (canonicalJson(stored) !== canonicalJson(card)) {
      throw new Error(`Stored card target revision conflicts with the proposal: ${card.id}`);
    }
  }
  for (const exercise of bundle.exercises) {
    const stored = ExerciseSchema.parse(
      readJson(
        join(
          paths.exercises,
          exercise.id,
          "revisions",
          String(exercise.contentRevision),
          "exercise.json",
        ),
      ),
    );
    if (canonicalJson(stored) !== canonicalJson(exercise)) {
      throw new Error(
        `Stored exercise target revision conflicts with the proposal: ${exercise.id}`,
      );
    }
  }
}

function readLatestCardIfPresent(
  studiesRoot: string,
  studyId: string,
  courseId: string,
  unitId: string,
  lessonId: string,
  cardId: string,
): CardContent | null {
  try {
    return readLatestCard(studiesRoot, studyId, courseId, unitId, lessonId, cardId);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

function readLatestExerciseIfPresent(
  studiesRoot: string,
  studyId: string,
  courseId: string,
  unitId: string,
  lessonId: string,
  exerciseId: string,
): Exercise | null {
  try {
    return readLatestExercise(studiesRoot, studyId, courseId, unitId, lessonId, exerciseId);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

function assertInstalledTargetComponentsMatch(
  studiesRoot: string,
  studyId: string,
  bundle: RevisionBundle,
): void {
  const latestLesson = readLatestLesson(
    studiesRoot,
    studyId,
    bundle.lesson.courseId,
    bundle.lesson.unitId,
    bundle.lesson.id,
  );
  if (
    latestLesson.manifest.contentRevision === bundle.lesson.contentRevision &&
    (canonicalJson(latestLesson.manifest) !== canonicalJson(bundle.lesson) ||
      latestLesson.content !== bundle.lessonContent)
  ) {
    throw new Error("Installed lesson target revision conflicts with the pending proposal");
  }
  // A proposal may introduce items the lesson does not have yet, so "not on
  // disk" is the expected state for them rather than a fault. Nothing that is
  // absent can conflict with what is about to be written.
  for (const card of bundle.cards) {
    const latest = readLatestCardIfPresent(
      studiesRoot,
      studyId,
      card.courseId,
      card.unitId,
      card.lessonId,
      card.id,
    );
    if (
      latest !== null &&
      latest.contentRevision === card.contentRevision &&
      canonicalJson(latest) !== canonicalJson(card)
    ) {
      throw new Error(
        `Installed card target revision conflicts with the pending proposal: ${card.id}`,
      );
    }
  }
  for (const exercise of bundle.exercises) {
    const latest = readLatestExerciseIfPresent(
      studiesRoot,
      studyId,
      exercise.courseId,
      exercise.unitId,
      exercise.lessonId,
      exercise.id,
    );
    if (
      latest !== null &&
      latest.contentRevision === exercise.contentRevision &&
      canonicalJson(latest) !== canonicalJson(exercise)
    ) {
      throw new Error(
        `Installed exercise target revision conflicts with the pending proposal: ${exercise.id}`,
      );
    }
  }
}

function result(
  mode: CourseRevisionResult["mode"],
  disposition: CourseRevisionResult["disposition"],
  studyId: string,
  proposal: CourseRevisionProposal,
  proposalHash: string,
  bundle: RevisionBundle,
  completedComponents: readonly string[],
): CourseRevisionResult {
  return {
    schemaVersion: 1,
    operation: "course-revise",
    mode,
    disposition,
    studyId,
    proposalId: proposal.proposalId,
    proposalHash,
    courseId: proposal.lesson.courseId,
    unitId: proposal.lesson.unitId,
    lessonId: proposal.lesson.id,
    targetSnapshotId: proposal.targetSnapshotId,
    targetAnalysisId: proposal.targetAnalysisId ?? null,
    revisions: {
      lesson: bundle.lesson.contentRevision,
      cards: Object.fromEntries(bundle.cards.map((card) => [card.id, card.contentRevision])),
      exercises: Object.fromEntries(
        bundle.exercises.map((exercise) => [exercise.id, exercise.contentRevision]),
      ),
    },
    completedComponents,
    retrySafe: true,
  };
}

function sameSourceStatus(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function withSourceStatusGuard<T>(
  studiesRoot: string,
  studyId: string,
  changedMessage: string,
  operation: () => T,
): T {
  const before = inspectSourceStatus(studiesRoot, studyId);
  let outcome: T;
  try {
    outcome = operation();
  } catch (error) {
    const afterFailure = inspectSourceStatus(studiesRoot, studyId);
    if (!sameSourceStatus(before, afterFailure)) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`${changedMessage}. The local operation also failed: ${detail}`);
    }
    throw error;
  }
  const after = inspectSourceStatus(studiesRoot, studyId);
  if (!sameSourceStatus(before, after)) throw new Error(changedMessage);
  return outcome;
}

function reviseCourseLessonUnchecked(input: ReviseCourseInput): CourseRevisionResult {
  const proposal = CourseRevisionProposalSchema.parse(input.proposal);
  const proposalHash = sha256(canonicalJson(proposal));
  const target = readTargetIdentity(input.studiesRoot, input.studyId, proposal);
  const path = operationPath(
    input.studiesRoot,
    input.studyId,
    proposal.lesson.courseId,
    proposal.proposalId,
  );
  const existing = readExistingReceipt(path);
  if (existing && existing.proposalHash !== proposalHash) {
    throw new Error(`Proposal ID ${proposal.proposalId} was already used for different content`);
  }
  const timestamp = existing?.createdAt ?? (input.now ?? new Date()).toISOString();
  const bundle = buildBundle(
    input.studiesRoot,
    input.studyId,
    proposal,
    target,
    timestamp,
    existing !== null,
    existing?.status !== "complete",
  );
  assertInstalledTargetComponentsMatch(input.studiesRoot, input.studyId, bundle);
  if (existing?.status === "complete") {
    assertStoredBundle(input.studiesRoot, input.studyId, bundle);
    return result(
      "apply",
      "reused",
      input.studyId,
      proposal,
      proposalHash,
      bundle,
      existing.completedComponents,
    );
  }
  if (input.dryRun) {
    return result("dry-run", "validated", input.studyId, proposal, proposalHash, bundle, []);
  }

  let receipt: OperationReceipt =
    existing ??
    OperationReceiptSchema.parse({
      schemaVersion: 1,
      operation: "course-revise",
      proposalId: proposal.proposalId,
      proposalHash,
      studyId: input.studyId,
      courseId: proposal.lesson.courseId,
      unitId: proposal.lesson.unitId,
      lessonId: proposal.lesson.id,
      targetSnapshotId: proposal.targetSnapshotId,
      targetAnalysisId: proposal.targetAnalysisId ?? null,
      status: "pending",
      completedComponents: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  writeReceipt(path, receipt);
  const complete = (component: string): void => {
    let newlyCompleted = false;
    if (!receipt.completedComponents.includes(component)) {
      receipt = OperationReceiptSchema.parse({
        ...receipt,
        completedComponents: [...receipt.completedComponents, component],
        updatedAt: (input.now ?? new Date()).toISOString(),
      });
      writeReceipt(path, receipt);
      newlyCompleted = true;
    }
    if (newlyCompleted) input.onComponentWritten?.(component);
  };

  try {
    const latestLesson = readLatestLesson(
      input.studiesRoot,
      input.studyId,
      bundle.lesson.courseId,
      bundle.lesson.unitId,
      bundle.lesson.id,
    ).manifest;
    if (latestLesson.contentRevision === proposal.lesson.expectedRevision) {
      const { contentHash: _contentHash, ...manifest } = bundle.lesson;
      writeLessonRevision(input.studiesRoot, input.studyId, {
        manifest,
        content: bundle.lessonContent,
        assetFiles: bundle.assetFiles,
      });
    }
    complete(`lesson:${bundle.lesson.id}`);

    // Each write is skipped when the target revision is already installed, so a
    // retry resumes rather than repeats. A newly added item has nothing stored
    // yet, and its target revision is 1, so absence is exactly the state that
    // means "still to write".
    for (const card of bundle.cards) {
      const latest = readLatestCardIfPresent(
        input.studiesRoot,
        input.studyId,
        card.courseId,
        card.unitId,
        card.lessonId,
        card.id,
      );
      if ((latest?.contentRevision ?? 0) === card.contentRevision - 1) {
        const { contentHash: _contentHash, ...candidate } = card;
        writeCardRevision(input.studiesRoot, input.studyId, candidate);
      }
      complete(`card:${card.id}`);
    }
    for (const exercise of bundle.exercises) {
      const latest = readLatestExerciseIfPresent(
        input.studiesRoot,
        input.studyId,
        exercise.courseId,
        exercise.unitId,
        exercise.lessonId,
        exercise.id,
      );
      if ((latest?.contentRevision ?? 0) === exercise.contentRevision - 1) {
        const { contentHash: _contentHash, ...candidate } = exercise;
        writeExerciseRevision(input.studiesRoot, input.studyId, candidate);
      }
      complete(`exercise:${exercise.id}`);
    }
    assertStoredBundle(input.studiesRoot, input.studyId, bundle);
    receipt = OperationReceiptSchema.parse({
      ...receipt,
      status: "complete",
      updatedAt: (input.now ?? new Date()).toISOString(),
    });
    writeReceipt(path, receipt);
  } catch (error) {
    throw new CourseRevisionPartialError(receipt, error);
  }

  return result(
    "apply",
    existing ? "recovered" : "created",
    input.studyId,
    proposal,
    proposalHash,
    bundle,
    receipt.completedComponents,
  );
}

export function reviseCourseLesson(input: ReviseCourseInput): CourseRevisionResult {
  return withSourceStatusGuard(
    input.studiesRoot,
    input.studyId,
    "Studied repository status changed while course content was being revised",
    () => reviseCourseLessonUnchecked(input),
  );
}

function reactivateCourseUnchecked(input: ReactivateCourseInput): ReactivateCourseResult {
  const audit = auditStudyFreshness({
    studiesRoot: input.studiesRoot,
    studyId: input.studyId,
    targetSnapshotId: input.targetSnapshotId,
    ...(input.targetAnalysisId ? { targetAnalysisId: input.targetAnalysisId } : {}),
  });
  const report = audit.reports.find((candidate) => candidate.courseId === input.courseId);
  if (!report) throw new Error(`Course freshness report not found: ${input.courseId}`);
  if (report.status !== "fresh") {
    throw new Error(
      `Course remains stale for target ${input.targetSnapshotId}; revise every stale item before reactivation`,
    );
  }
  if (report.items.some((item) => item.contentStatus !== "active")) {
    throw new Error("Every lesson, card, and exercise must be active before course reactivation");
  }

  let course = readCourse(input.studiesRoot, input.studyId, input.courseId);
  const unitStatuses = course.unitIds.map((unitId) =>
    readUnit(input.studiesRoot, input.studyId, course.id, unitId),
  );
  if (course.status === "active") {
    const nonActiveUnit = unitStatuses.find((unit) => unit.status !== "active");
    if (nonActiveUnit) {
      throw new Error(
        `Active course has a non-active unit and requires inspection: ${nonActiveUnit.id}`,
      );
    }
    return {
      schemaVersion: 1,
      operation: "course-reactivate",
      disposition: "reused",
      studyId: input.studyId,
      courseId: input.courseId,
      targetSnapshotId: input.targetSnapshotId,
      targetAnalysisId: input.targetAnalysisId ?? null,
      reportHash: report.reportHash,
      activatedUnitIds: [],
      courseStatus: "active",
    };
  }
  if (course.status !== "stale") {
    throw new Error(`Course must be stale before reactivation: ${course.id} is ${course.status}`);
  }
  // `draft` used to mean only one thing — an interrupted `course create` — and
  // was refused for that reason. `course add-lessons` gives it a second, valid
  // meaning: a unit added to this course and never published. Both are safe to
  // let through here because the gate is not the status, it is the audit above
  // plus `assertUnitReadyForActivation`, which walks every lesson, card and
  // exercise and re-checks its evidence. A half-built unit fails those.
  for (const unit of unitStatuses) {
    if (unit.status === "retired") {
      throw new Error(`Unit cannot be reactivated from ${unit.status}: ${unit.id}`);
    }
  }

  const activatedUnitIds: string[] = [];
  try {
    for (const unitId of course.unitIds) {
      const unit = readUnit(input.studiesRoot, input.studyId, course.id, unitId);
      if (unit.status === "stale" || unit.status === "draft") {
        updateUnitStatus(input.studiesRoot, input.studyId, course.id, unit.id, "active");
        activatedUnitIds.push(unit.id);
      }
    }
    course = updateCourseStatus(input.studiesRoot, input.studyId, course.id, "active");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Course reactivation stopped safely while the course remained stale. Retry after inspection. Cause: ${detail}`,
    );
  }
  return {
    schemaVersion: 1,
    operation: "course-reactivate",
    disposition: "activated",
    studyId: input.studyId,
    courseId: input.courseId,
    targetSnapshotId: input.targetSnapshotId,
    targetAnalysisId: input.targetAnalysisId ?? null,
    reportHash: report.reportHash,
    activatedUnitIds,
    courseStatus: course.status as "active",
  };
}

export function reactivateCourse(input: ReactivateCourseInput): ReactivateCourseResult {
  return withSourceStatusGuard(
    input.studiesRoot,
    input.studyId,
    "Studied repository status changed while the course was being reactivated",
    () => reactivateCourseUnchecked(input),
  );
}
