import { existsSync } from "node:fs";

import { z } from "zod";

import { StableId, type UnitManifest } from "../../src/domain/schemas.js";
import {
  readCourse,
  readUnit,
  updateCourseManifest,
  updateUnitManifest,
  writeUnit,
} from "../content/repository.js";
import { getUnitPaths } from "../studies/paths.js";
import {
  LessonCreationProposalSchema,
  collectLessonIds,
  validateLessonEvidence,
  writeLessonBundle,
} from "./lesson-proposal.js";
import { readTargetIdentity } from "./revise-course.js";

/**
 * Adds lessons to a course that is already published — into a unit it already
 * has, or into a new unit created alongside them.
 *
 * `course create` builds a course once and `course revise` changes what is
 * already there; neither could make a course longer. Writing a new course every
 * time a subject grew a chapter is not what a curriculum should have to do.
 */
const UnitTargetSchema = z
  .object({
    id: StableId,
    /**
     * Required only when the unit does not exist yet. Supplying them for a unit
     * that does exist is refused rather than silently ignored, so a proposal
     * never quietly fails to do what it appears to say.
     */
    title: z.string().min(1).max(200).optional(),
    objective: z.string().min(1).max(1_000).optional(),
    prerequisiteUnitIds: z.array(StableId).optional(),
  })
  .strict();

export const AddLessonsProposalSchema = z
  .object({
    schemaVersion: z.literal(1),
    proposalId: StableId,
    targetSnapshotId: StableId,
    targetAnalysisId: StableId.optional(),
    courseId: StableId,
    unit: UnitTargetSchema,
    lessons: z.array(LessonCreationProposalSchema).min(1),
  })
  .strict();

export type AddLessonsProposal = z.infer<typeof AddLessonsProposalSchema>;

interface AddLessonsInput {
  readonly studiesRoot: string;
  readonly studyId: string;
  readonly proposal: unknown;
  readonly dryRun?: boolean;
  readonly now?: Date;
}

interface AddLessonsResult {
  readonly schemaVersion: 1;
  readonly operation: "course-add-lessons";
  readonly mode: "apply" | "dry-run";
  readonly outcome: "added" | "validated";
  readonly studyId: string;
  readonly courseId: string;
  readonly unitId: string;
  readonly unitCreated: boolean;
  readonly lessonIds: readonly string[];
  readonly cardIds: readonly string[];
  readonly exerciseIds: readonly string[];
  readonly targetSnapshotId: string;
  readonly targetAnalysisId: string | null;
}

/**
 * Lesson, card and exercise IDs are directory names under one course root, so a
 * new lesson must not collide with anything the course already holds — in any
 * unit, not just the one being added to.
 */
function assertIdsAreFree(
  studiesRoot: string,
  studyId: string,
  proposal: AddLessonsProposal,
  unitIds: readonly string[],
): void {
  const taken = new Set<string>();
  for (const unitId of unitIds) {
    if (!existsSync(getUnitPaths(studiesRoot, studyId, proposal.courseId, unitId).manifest)) {
      continue;
    }
    const unit = readUnit(studiesRoot, studyId, proposal.courseId, unitId);
    for (const lessonId of unit.lessonIds) taken.add(lessonId);
  }
  const seen = new Set<string>();
  for (const lesson of proposal.lessons) {
    if (seen.has(lesson.id)) {
      throw new Error(`Proposal lists lesson ${lesson.id} twice`);
    }
    seen.add(lesson.id);
    if (taken.has(lesson.id)) {
      throw new Error(
        `Course ${proposal.courseId} already has a lesson named ${lesson.id}; ` +
          `use "course revise" to change it.`,
      );
    }
  }
}

export function addCourseLessons(input: AddLessonsInput): AddLessonsResult {
  const proposal = AddLessonsProposalSchema.parse(input.proposal);
  const course = readCourse(input.studiesRoot, input.studyId, proposal.courseId);
  if (course.status !== "draft" && course.status !== "stale") {
    throw new Error(
      `Course must be draft or stale before lessons can be added: ${course.id} is ${course.status}. ` +
        `Run "course open-for-edit" first.`,
    );
  }

  const unitExists = course.unitIds.includes(proposal.unit.id);
  const describesNewUnit =
    proposal.unit.title !== undefined || proposal.unit.objective !== undefined;
  if (unitExists && describesNewUnit) {
    throw new Error(
      `Unit ${proposal.unit.id} already exists; drop title and objective to add lessons to it.`,
    );
  }
  if (!unitExists && (proposal.unit.title === undefined || proposal.unit.objective === undefined)) {
    throw new Error(
      `Unit ${proposal.unit.id} does not exist; supply title and objective to create it.`,
    );
  }
  if (unitExists) {
    const unit = readUnit(input.studiesRoot, input.studyId, course.id, proposal.unit.id);
    if (unit.status !== "draft" && unit.status !== "stale") {
      throw new Error(`Unit must be draft or stale before lessons can be added: ${unit.id}`);
    }
  }

  assertIdsAreFree(input.studiesRoot, input.studyId, proposal, course.unitIds);

  const target = readTargetIdentity(input.studiesRoot, input.studyId, {
    targetSnapshotId: proposal.targetSnapshotId,
    ...(proposal.targetAnalysisId ? { targetAnalysisId: proposal.targetAnalysisId } : {}),
  });
  for (const lesson of proposal.lessons) {
    validateLessonEvidence(input.studiesRoot, input.studyId, lesson, target);
  }

  const ids = proposal.lessons.map(collectLessonIds);
  const summary = {
    lessonIds: ids.map((entry) => entry.lessonId),
    cardIds: ids.flatMap((entry) => entry.cardIds),
    exerciseIds: ids.flatMap((entry) => entry.exerciseIds),
  };

  if (input.dryRun) {
    return {
      schemaVersion: 1,
      operation: "course-add-lessons",
      mode: "dry-run",
      outcome: "validated",
      studyId: input.studyId,
      courseId: course.id,
      unitId: proposal.unit.id,
      unitCreated: !unitExists,
      ...summary,
      targetSnapshotId: proposal.targetSnapshotId,
      targetAnalysisId: proposal.targetAnalysisId ?? null,
    };
  }

  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  const newLessonIds = summary.lessonIds;

  // Declaration precedes content, all the way down: the course names the unit,
  // the unit names the lesson, and only then can the lesson be written. That is
  // the order every reader walks, so it is the order the writer uses. An
  // interrupted run therefore leaves a declaration pointing at content that is
  // not there yet — which makes reactivation refuse loudly instead of leaving a
  // course that looks whole. Re-running the same proposal finishes the job.
  if (!unitExists) {
    updateCourseManifest(
      input.studiesRoot,
      input.studyId,
      { ...course, unitIds: [...course.unitIds, proposal.unit.id] },
      now,
    );
    const unit: UnitManifest = {
      schemaVersion: 1,
      id: proposal.unit.id,
      title: proposal.unit.title!,
      objective: proposal.unit.objective!,
      prerequisiteUnitIds: proposal.unit.prerequisiteUnitIds ?? [],
      lessonIds: newLessonIds,
      status: "draft",
    };
    writeUnit(input.studiesRoot, input.studyId, course.id, unit);
  } else {
    const unit = readUnit(input.studiesRoot, input.studyId, course.id, proposal.unit.id);
    updateUnitManifest(input.studiesRoot, input.studyId, course.id, {
      ...unit,
      lessonIds: [...unit.lessonIds, ...newLessonIds],
    });
  }

  for (const lesson of proposal.lessons) {
    writeLessonBundle({
      studiesRoot: input.studiesRoot,
      studyId: input.studyId,
      courseId: course.id,
      unitId: proposal.unit.id,
      lesson,
      timestamp,
    });
  }

  return {
    schemaVersion: 1,
    operation: "course-add-lessons",
    mode: "apply",
    outcome: "added",
    studyId: input.studyId,
    courseId: course.id,
    unitId: proposal.unit.id,
    unitCreated: !unitExists,
    ...summary,
    targetSnapshotId: proposal.targetSnapshotId,
    targetAnalysisId: proposal.targetAnalysisId ?? null,
  };
}
