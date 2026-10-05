import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { z } from "zod";
import { StableId } from "@pieai/university-core/domain/schemas.js";
import { canonicalizePotentialPath, isPathInside } from "../config/load-config.js";
import {
  readCourse,
  readUnit,
  updateCourseManifest,
  updateUnitManifest,
  updateCourseStatus,
  updateUnitStatus,
} from "../content/repository.js";
import { exportCourseRecovery } from "../recovery/course-recovery.js";
import { writeJsonAtomically } from "../storage/atomic-json.js";
import { getStudyPaths, getCoursePaths, getUnitPaths, getLessonPaths } from "../studies/paths.js";
import { setDefaultCourse, setStudyDescription, setStudyStatus } from "../studies/repository.js";
import { openCourseForEdit } from "./revise-course.js";

const ProposalSchema = z
  .object({
    schemaVersion: z.literal(1),
    proposalId: StableId,
    reason: z.string().min(1).max(2000),
    expectedPackages: z.record(StableId, z.string().regex(/^sha256:[a-f0-9]{64}$/)),
    retain: z.array(
      z
        .object({
          courseId: StableId,
          units: z
            .array(z.object({ unitId: StableId, lessonIds: z.array(StableId).min(1) }).strict())
            .min(1),
        })
        .strict(),
    ),
    description: z.string().min(1).max(2000).optional(),
  })
  .strict();

/** Deliberate removal of a native outline, with a complete archive first.
 * Lesson/assessment revisions and learner storage are never rewritten here. */
export function retireStudyContent(input: {
  studiesRoot: string;
  studyId: string;
  proposal: unknown;
  outDirectory: string;
  dryRun?: boolean;
}) {
  const proposal = ProposalSchema.parse(input.proposal);
  const paths = getStudyPaths(input.studiesRoot, input.studyId);
  const archive = canonicalizePotentialPath(resolve(input.outDirectory));
  if (
    isPathInside(archive, resolve(input.studiesRoot)) ||
    isPathInside(resolve(input.studiesRoot), archive)
  ) {
    throw new Error("Retirement archive and studies root must be separate");
  }
  if (existsSync(archive))
    throw new Error("Retirement archive already exists; inspect its receipt before retrying");
  const temporary = mkdtempSync(join(tmpdir(), "university-retirement-"));
  try {
    const before = exportCourseRecovery({
      studiesRoot: input.studiesRoot,
      studyId: input.studyId,
      outDirectory: temporary,
    });
    const actual = Object.fromEntries(before.courses.map((c) => [c.courseId, c.sha256]));
    if (
      JSON.stringify(Object.entries(actual).sort()) !==
      JSON.stringify(Object.entries(proposal.expectedPackages).sort())
    ) {
      throw new Error(
        "Retirement expectedPackages do not match the complete current native export",
      );
    }
    const retainedIds = proposal.retain.map((c) => c.courseId);
    if (new Set(retainedIds).size !== retainedIds.length)
      throw new Error("Retained course IDs must be unique");
    const originals = before.courses.map((c) =>
      readCourse(input.studiesRoot, input.studyId, c.courseId),
    );
    const removed: string[] = [];
    for (const keep of proposal.retain) {
      const course = originals.find((c) => c.id === keep.courseId);
      if (!course) throw new Error(`Retained course is not published: ${keep.courseId}`);
      if (course.prerequisiteCourseIds.some((id) => !retainedIds.includes(id)))
        throw new Error("Cannot retire a retained course prerequisite");
      const unitIds = keep.units.map((u) => u.unitId);
      if (new Set(unitIds).size !== unitIds.length)
        throw new Error("Retained unit IDs must be unique");
      if (course.unitIds.filter((id) => unitIds.includes(id)).join() !== unitIds.join())
        throw new Error("Retain existing units in their original order");
      for (const target of keep.units) {
        const unit = readUnit(input.studiesRoot, input.studyId, keep.courseId, target.unitId);
        if (unit.prerequisiteUnitIds.some((id) => !unitIds.includes(id)))
          throw new Error("Cannot retire a retained unit prerequisite");
        if (
          new Set(target.lessonIds).size !== target.lessonIds.length ||
          unit.lessonIds.filter((id) => target.lessonIds.includes(id)).join() !==
            target.lessonIds.join()
        ) {
          throw new Error("Retain existing lessons in their original order");
        }
      }
    }
    for (const course of originals) {
      const keep = proposal.retain.find((c) => c.courseId === course.id);
      for (const unitId of course.unitIds) {
        const unit = readUnit(input.studiesRoot, input.studyId, course.id, unitId);
        const lessons = keep?.units.find((u) => u.unitId === unitId)?.lessonIds ?? [];
        for (const id of unit.lessonIds)
          if (!lessons.includes(id)) removed.push(`${input.studyId}/${course.id}/${unitId}/${id}`);
      }
    }
    const receipt = {
      schemaVersion: 1,
      operation: "study-retire-content",
      proposalId: proposal.proposalId,
      studyId: input.studyId,
      reason: proposal.reason,
      originalPackages: actual,
      retained: proposal.retain,
      removed,
      archive,
    };
    if (input.dryRun) return { ...receipt, mode: "dry-run", outcome: "validated" };
    mkdirSync(archive, { recursive: true });
    cpSync(temporary, join(archive, "recovery"), { recursive: true });
    const native = join(archive, "native", input.studyId);
    mkdirSync(native, { recursive: true });
    // Keep the registered mirror for restoring repository-backed courses. Never
    // copy, delete or modify learner databases and their backups.
    for (const name of ["study.json", "courses", "source", "language"]) {
      const source = join(paths.root, name);
      if (existsSync(source)) cpSync(source, join(native, name), { recursive: true });
    }
    writeJsonAtomically(join(archive, "receipt.json"), {
      ...receipt,
      mode: "apply",
      outcome: "pending",
    });
    try {
      for (const course of originals) {
        const keep = proposal.retain.find((c) => c.courseId === course.id);
        if (!keep) {
          updateCourseStatus(input.studiesRoot, input.studyId, course.id, "retired");
          continue;
        }
        openCourseForEdit({
          studiesRoot: input.studiesRoot,
          studyId: input.studyId,
          courseId: course.id,
        });
        for (const target of keep.units) {
          const unit = readUnit(input.studiesRoot, input.studyId, course.id, target.unitId);
          updateUnitManifest(input.studiesRoot, input.studyId, course.id, {
            ...unit,
            lessonIds: target.lessonIds,
          });
        }
        updateCourseManifest(input.studiesRoot, input.studyId, {
          ...course,
          unitIds: keep.units.map((u) => u.unitId),
        });
        for (const unit of keep.units)
          updateUnitStatus(input.studiesRoot, input.studyId, course.id, unit.unitId, "active");
        updateCourseStatus(input.studiesRoot, input.studyId, course.id, "active");
      }
      if (proposal.retain.length) {
        setDefaultCourse(input.studiesRoot, input.studyId, proposal.retain[0]!.courseId);
        if (proposal.description)
          setStudyDescription(input.studiesRoot, input.studyId, proposal.description);
        exportCourseRecovery({
          studiesRoot: input.studiesRoot,
          studyId: input.studyId,
          outDirectory: join(archive, "retained-export"),
        });
      } else setStudyStatus(input.studiesRoot, input.studyId, "archived");
      // Original bytes are durable in native/ and recovery/. Remove only content
      // omitted from the validated outline; immutable retained revisions stay put.
      for (const course of originals) {
        const keep = proposal.retain.find((c) => c.courseId === course.id);
        if (!keep) {
          rmSync(getCoursePaths(input.studiesRoot, input.studyId, course.id).root, {
            recursive: true,
          });
          continue;
        }
        for (const unitId of course.unitIds) {
          const target = keep.units.find((u) => u.unitId === unitId);
          if (!target) {
            rmSync(getUnitPaths(input.studiesRoot, input.studyId, course.id, unitId).root, {
              recursive: true,
            });
            continue;
          }
          const originalUnit = JSON.parse(
            readFileSync(join(native, "courses", course.id, "units", unitId, "unit.json"), "utf8"),
          ) as { lessonIds: string[] };
          for (const id of originalUnit.lessonIds)
            if (!target.lessonIds.includes(id))
              rmSync(getLessonPaths(input.studiesRoot, input.studyId, course.id, unitId, id).root, {
                recursive: true,
              });
        }
      }
      const result = { ...receipt, mode: "apply", outcome: "retired" };
      writeJsonAtomically(join(archive, "receipt.json"), result);
      return result;
    } catch (error) {
      cpSync(join(native, "courses"), paths.courses, { recursive: true });
      cpSync(join(native, "study.json"), paths.manifest);
      writeJsonAtomically(join(archive, "receipt.json"), {
        ...receipt,
        mode: "apply",
        outcome: "rolled-back",
        error: String(error),
      });
      throw error;
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
