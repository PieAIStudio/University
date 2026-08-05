import { existsSync } from "node:fs";

import { z } from "zod";

import {
  EvidenceReferenceSchema,
  StableId,
  type CourseManifest,
  type UnitManifest,
} from "../../src/domain/schemas.js";
import {
  readCourse,
  updateCourseStatus,
  updateUnitStatus,
  writeCardRevision,
  writeCourse,
  writeExerciseRevision,
  writeLessonRevision,
  writeUnit,
} from "../content/repository.js";
import { getCoursePaths } from "../studies/paths.js";
import {
  readTargetIdentity,
  validateTargetEvidence,
  type TargetIdentity,
} from "./revise-course.js";

const CardCreationProposalSchema = z
  .object({
    id: StableId,
    kind: z.enum(["basic", "cloze"]).optional(),
    front: z.string().min(1).max(20_000),
    back: z.string().min(1).max(20_000),
    tags: z.array(StableId).optional(),
    evidence: z.array(EvidenceReferenceSchema).min(1),
  })
  .strict();

const ExerciseCreationBaseSchema = z.object({
  id: StableId,
  title: z.string().min(1).max(200),
  prompt: z.string().min(1).max(20_000),
  evidence: z.array(EvidenceReferenceSchema).min(1),
});

const ExerciseCreationProposalSchema = z.union([
  ExerciseCreationBaseSchema.extend({
    kind: z.literal("short-answer").optional(),
    expectedAnswer: z.string().min(1),
  }).strict(),
  ExerciseCreationBaseSchema.extend({
    kind: z.literal("explain"),
    rubric: z.array(z.string().min(1)).min(1),
  }).strict(),
]);

const LessonCreationProposalSchema = z
  .object({
    id: StableId,
    title: z.string().min(1).max(200),
    content: z.string().min(1),
    evidence: z.array(EvidenceReferenceSchema).min(1),
    cards: z.array(CardCreationProposalSchema).default([]),
    exercises: z.array(ExerciseCreationProposalSchema).default([]),
  })
  .strict()
  /**
   * Cards enter the spaced-repetition queue when their lesson is completed, and
   * a lesson is completed by answering its exercises. A lesson that carries
   * cards but no exercises can therefore never be completed, so those cards are
   * written to disk and never scheduled — silently invisible work. Refuse the
   * shape rather than let the course look finished while part of it is inert.
   */
  .refine((lesson) => lesson.cards.length === 0 || lesson.exercises.length > 0, {
    message:
      "A lesson with cards needs at least one exercise; cards are only enrolled for review once the lesson is completed",
    path: ["exercises"],
  });

const UnitCreationProposalSchema = z
  .object({
    id: StableId,
    title: z.string().min(1).max(200),
    objective: z.string().min(1).max(1_000),
    prerequisiteUnitIds: z.array(StableId).default([]),
    lessons: z.array(LessonCreationProposalSchema).min(1),
  })
  .strict();

export const CourseCreationProposalSchema = z
  .object({
    schemaVersion: z.literal(1),
    proposalId: StableId,
    targetSnapshotId: StableId,
    targetAnalysisId: StableId.optional(),
    course: z
      .object({
        id: StableId,
        title: z.string().min(1).max(200),
        description: z.string().max(2_000).default(""),
        audience: z.string().min(1).max(500),
        objectives: z.array(z.string().min(1).max(500)).min(1),
        units: z.array(UnitCreationProposalSchema).min(1),
      })
      .strict(),
  })
  .strict();

export type CourseCreationProposal = z.infer<typeof CourseCreationProposalSchema>;

export interface CreateCourseInput {
  readonly studiesRoot: string;
  readonly studyId: string;
  readonly proposal: unknown;
  readonly dryRun?: boolean;
  readonly now?: Date;
}

export interface CreateCourseResult {
  readonly schemaVersion: 1;
  readonly operation: "course-create";
  readonly mode: "apply" | "dry-run";
  readonly outcome: "created" | "resumed" | "validated";
  readonly studyId: string;
  readonly courseId: string;
  readonly unitIds: readonly string[];
  readonly lessonIds: readonly string[];
  readonly cardIds: readonly string[];
  readonly exerciseIds: readonly string[];
  readonly targetSnapshotId: string;
  readonly targetAnalysisId: string | null;
  readonly courseStatus: CourseManifest["status"];
}

function assertUniqueIds(ids: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`${label} must not contain duplicate IDs: ${id}`);
    seen.add(id);
  }
}

/**
 * Every ID in the proposal has to be unique inside its own kind, and lesson,
 * card and exercise IDs are checked across the whole course rather than per
 * unit: they all become directory names under one course root, and two units
 * claiming the same lesson ID would silently write into the same place.
 */
function assertProposalIdsAreUnique(proposal: CourseCreationProposal): void {
  assertUniqueIds(
    proposal.course.units.map((unit) => unit.id),
    "Units",
  );
  const lessonIds: string[] = [];
  const cardIds: string[] = [];
  const exerciseIds: string[] = [];
  for (const unit of proposal.course.units) {
    for (const lesson of unit.lessons) {
      lessonIds.push(lesson.id);
      for (const card of lesson.cards) cardIds.push(card.id);
      for (const exercise of lesson.exercises) exerciseIds.push(exercise.id);
    }
  }
  assertUniqueIds(lessonIds, "Lessons");
  assertUniqueIds(cardIds, "Cards");
  assertUniqueIds(exerciseIds, "Exercises");
}

function validateAllEvidence(
  studiesRoot: string,
  studyId: string,
  proposal: CourseCreationProposal,
  target: TargetIdentity,
): void {
  for (const unit of proposal.course.units) {
    for (const lesson of unit.lessons) {
      validateTargetEvidence(studiesRoot, studyId, lesson.evidence, target, `Lesson ${lesson.id}`);
      for (const card of lesson.cards) {
        validateTargetEvidence(studiesRoot, studyId, card.evidence, target, `Card ${card.id}`);
      }
      for (const exercise of lesson.exercises) {
        validateTargetEvidence(
          studiesRoot,
          studyId,
          exercise.evidence,
          target,
          `Exercise ${exercise.id}`,
        );
      }
    }
  }
}

function buildCourseManifest(proposal: CourseCreationProposal, timestamp: string): CourseManifest {
  return {
    schemaVersion: 1,
    id: proposal.course.id,
    title: proposal.course.title,
    description: proposal.course.description,
    audience: proposal.course.audience,
    objectives: proposal.course.objectives,
    unitIds: proposal.course.units.map((unit) => unit.id),
    status: "draft",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildUnitManifest(unit: CourseCreationProposal["course"]["units"][number]): UnitManifest {
  return {
    schemaVersion: 1,
    id: unit.id,
    title: unit.title,
    objective: unit.objective,
    prerequisiteUnitIds: unit.prerequisiteUnitIds,
    lessonIds: unit.lessons.map((lesson) => lesson.id),
    status: "draft",
  };
}

/**
 * A course directory that already exists is only safe to continue writing into
 * when it is still a draft that this same proposal produced. Anything else — an
 * activated course, or a draft whose shape disagrees with the proposal — is a
 * different course wearing the same ID, so refuse instead of merging the two.
 */
function assertResumable(
  studiesRoot: string,
  studyId: string,
  proposal: CourseCreationProposal,
): void {
  const existing = readCourse(studiesRoot, studyId, proposal.course.id);
  if (existing.status !== "draft") {
    throw new Error(
      `Course already exists and is ${existing.status}: ${proposal.course.id}. ` +
        `Use "course revise" to change an existing course.`,
    );
  }
  const wanted = proposal.course.units.map((unit) => unit.id).join(",");
  if (existing.unitIds.join(",") !== wanted || existing.title !== proposal.course.title) {
    throw new Error(
      `A different draft course already occupies ID ${proposal.course.id}; ` +
        `remove it or choose another course ID.`,
    );
  }
}

/**
 * Creates a whole course — units, lessons, cards and exercises — in one
 * operation. Everything is validated before anything is written, and the course
 * is only activated once every piece is on disk, so a failure part-way leaves an
 * inert draft that re-running the same proposal picks back up.
 */
export function createCourse(input: CreateCourseInput): CreateCourseResult {
  const proposal = CourseCreationProposalSchema.parse(input.proposal);
  assertProposalIdsAreUnique(proposal);
  const target = readTargetIdentity(input.studiesRoot, input.studyId, {
    targetSnapshotId: proposal.targetSnapshotId,
    ...(proposal.targetAnalysisId ? { targetAnalysisId: proposal.targetAnalysisId } : {}),
  });
  validateAllEvidence(input.studiesRoot, input.studyId, proposal, target);

  const coursePaths = getCoursePaths(input.studiesRoot, input.studyId, proposal.course.id);
  const courseExists = existsSync(coursePaths.manifest);
  if (courseExists) assertResumable(input.studiesRoot, input.studyId, proposal);

  const lessonIds: string[] = [];
  const cardIds: string[] = [];
  const exerciseIds: string[] = [];
  for (const unit of proposal.course.units) {
    for (const lesson of unit.lessons) {
      lessonIds.push(lesson.id);
      for (const card of lesson.cards) cardIds.push(card.id);
      for (const exercise of lesson.exercises) exerciseIds.push(exercise.id);
    }
  }

  if (input.dryRun) {
    return {
      schemaVersion: 1,
      operation: "course-create",
      mode: "dry-run",
      outcome: "validated",
      studyId: input.studyId,
      courseId: proposal.course.id,
      unitIds: proposal.course.units.map((unit) => unit.id),
      lessonIds,
      cardIds,
      exerciseIds,
      targetSnapshotId: proposal.targetSnapshotId,
      targetAnalysisId: proposal.targetAnalysisId ?? null,
      courseStatus: "draft",
    };
  }

  const timestamp = (input.now ?? new Date()).toISOString();
  if (!courseExists) {
    writeCourse(input.studiesRoot, input.studyId, buildCourseManifest(proposal, timestamp));
  }

  for (const unit of proposal.course.units) {
    writeUnit(input.studiesRoot, input.studyId, proposal.course.id, buildUnitManifest(unit));
    for (const lesson of unit.lessons) {
      writeLessonRevision(input.studiesRoot, input.studyId, {
        manifest: {
          schemaVersion: 1,
          id: lesson.id,
          title: lesson.title,
          courseId: proposal.course.id,
          unitId: unit.id,
          exerciseIds: lesson.exercises.map((exercise) => exercise.id),
          cardIds: lesson.cards.map((card) => card.id),
          contentRevision: 1,
          status: "active",
          evidence: lesson.evidence,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        content: lesson.content,
      });
      for (const card of lesson.cards) {
        writeCardRevision(input.studiesRoot, input.studyId, {
          schemaVersion: 1,
          id: card.id,
          kind: card.kind ?? "basic",
          courseId: proposal.course.id,
          unitId: unit.id,
          lessonId: lesson.id,
          front: card.front,
          back: card.back,
          contentRevision: 1,
          status: "active",
          tags: card.tags ?? [],
          evidence: card.evidence,
        });
      }
      for (const exercise of lesson.exercises) {
        const base = {
          schemaVersion: 1 as const,
          id: exercise.id,
          courseId: proposal.course.id,
          unitId: unit.id,
          lessonId: lesson.id,
          title: exercise.title,
          prompt: exercise.prompt,
          contentRevision: 1,
          status: "active" as const,
          evidence: exercise.evidence,
        };
        writeExerciseRevision(
          input.studiesRoot,
          input.studyId,
          "rubric" in exercise
            ? { ...base, kind: "explain", rubric: exercise.rubric }
            : { ...base, kind: "short-answer", expectedAnswer: exercise.expectedAnswer },
        );
      }
    }
  }

  for (const unit of proposal.course.units) {
    updateUnitStatus(input.studiesRoot, input.studyId, proposal.course.id, unit.id, "active");
  }
  const course = updateCourseStatus(
    input.studiesRoot,
    input.studyId,
    proposal.course.id,
    "active",
    input.now ?? new Date(),
  );

  return {
    schemaVersion: 1,
    operation: "course-create",
    mode: "apply",
    outcome: courseExists ? "resumed" : "created",
    studyId: input.studyId,
    courseId: proposal.course.id,
    unitIds: proposal.course.units.map((unit) => unit.id),
    lessonIds,
    cardIds,
    exerciseIds,
    targetSnapshotId: proposal.targetSnapshotId,
    targetAnalysisId: proposal.targetAnalysisId ?? null,
    courseStatus: course.status,
  };
}
