import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";

import {
  CourseManifestSchema,
  StableId,
  SourceRegistrationSchema,
  StudyManifestSchema,
  type SourceRegistration,
  type StudyManifest,
} from "../../src/domain/schemas.js";
import { STUDIES_ROOT_MARKER, assertSeparatedRoots } from "../config/load-config.js";
import { writeJsonAtomically } from "../storage/atomic-json.js";
import { getCoursePaths, getStudyPaths } from "./paths.js";

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

export interface CreateStudyInput {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly goals?: readonly string[];
  readonly now?: Date;
}

export interface RegisteredSource {
  readonly registration: SourceRegistration;
  readonly resolvedCommit: string;
}

export function createStudy(studiesRoot: string, input: CreateStudyInput): StudyManifest {
  mkdirSync(studiesRoot, { recursive: true, mode: 0o700 });
  const marker = join(studiesRoot, STUDIES_ROOT_MARKER);
  if (!existsSync(marker)) {
    writeJsonAtomically(marker, { schemaVersion: 1, product: "UniversityLocal" });
  }
  const paths = getStudyPaths(studiesRoot, input.id);
  if (existsSync(paths.root)) {
    throw new Error(`Study already exists: ${input.id}`);
  }

  const timestamp = (input.now ?? new Date()).toISOString();
  const manifest = StudyManifestSchema.parse({
    schemaVersion: 1,
    id: input.id,
    title: input.title,
    description: input.description ?? "",
    goals: input.goals ?? [],
    defaultCourseId: null,
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const stagingRoot = mkdtempSync(join(studiesRoot, ".creating-"));
  try {
    for (const directory of [
      join(stagingRoot, "source", "snapshots"),
      join(stagingRoot, "ua"),
      join(stagingRoot, "courses"),
      join(stagingRoot, "learner", "backups"),
    ]) {
      mkdirSync(directory, { recursive: true, mode: 0o700 });
    }
    writeJsonAtomically(join(stagingRoot, "study.json"), manifest);
    renameSync(stagingRoot, paths.root);
  } catch (error) {
    rmSync(stagingRoot, { recursive: true, force: true });
    throw error;
  }
  return manifest;
}

export function readStudy(studiesRoot: string, id: string): StudyManifest {
  return StudyManifestSchema.parse(readJson(getStudyPaths(studiesRoot, id).manifest));
}

export function setDefaultCourse(
  studiesRoot: string,
  studyId: string,
  candidateCourseId: string,
  now = new Date(),
): StudyManifest {
  const study = readStudy(studiesRoot, studyId);
  const courseId = StableId.parse(candidateCourseId);
  const course = CourseManifestSchema.parse(
    readJson(getCoursePaths(studiesRoot, studyId, courseId).manifest),
  );
  if (course.id !== courseId) throw new Error("Course manifest ID does not match its directory");
  if (course.status !== "active") {
    throw new Error(`Only an active course can become the study default: ${course.id}`);
  }
  const updated = StudyManifestSchema.parse({
    ...study,
    defaultCourseId: courseId,
    updatedAt: now.toISOString(),
  });
  writeJsonAtomically(getStudyPaths(studiesRoot, studyId).manifest, updated);
  return updated;
}

export interface StudyDiscovery {
  readonly studies: readonly StudyManifest[];
  readonly issues: readonly string[];
}

/**
 * Moves a study on or off the active shelf without touching its data.
 *
 * Archiving is presentation, not deletion: courses, snapshots, and the learner
 * database all stay exactly where they are, and flipping the status back is
 * the whole undo. This exists so a study that has been superseded — the
 * self-referential ul-meta once its course was rebuilt on real code — can stop
 * occupying the shelf without anyone having to destroy learning history to
 * get it out of the way.
 */
export function setStudyStatus(
  studiesRoot: string,
  studyId: string,
  status: "active" | "archived",
  now = new Date(),
): StudyManifest {
  const study = readStudy(studiesRoot, studyId);
  if (study.status === status) return study;
  const updated = StudyManifestSchema.parse({
    ...study,
    status,
    updatedAt: now.toISOString(),
  });
  writeJsonAtomically(getStudyPaths(studiesRoot, studyId).manifest, updated);
  return updated;
}

export function inspectStudyShelf(studiesRoot: string): StudyDiscovery {
  if (!existsSync(studiesRoot)) return { studies: [], issues: [] };
  const studies: StudyManifest[] = [];
  const issues: string[] = [];
  for (const entry of readdirSync(studiesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    if (!StableId.safeParse(entry.name).success) {
      issues.push(`Ignored invalid study directory: ${entry.name}`);
      continue;
    }
    const manifestPath = getStudyPaths(studiesRoot, entry.name).manifest;
    if (!existsSync(manifestPath)) {
      issues.push(`Ignored study directory without study.json: ${entry.name}`);
      continue;
    }
    try {
      const manifest = StudyManifestSchema.parse(readJson(manifestPath));
      if (manifest.id !== entry.name) {
        issues.push(`Ignored study whose id does not match its directory: ${entry.name}`);
      } else {
        studies.push(manifest);
      }
    } catch (error) {
      issues.push(
        `Ignored invalid study manifest ${entry.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return { studies: studies.sort((left, right) => left.title.localeCompare(right.title)), issues };
}

export function discoverStudies(studiesRoot: string): readonly StudyManifest[] {
  return inspectStudyShelf(studiesRoot).studies;
}

function git(sourceRoot: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", sourceRoot, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function registerLocalGitSource(
  studiesRoot: string,
  studyId: string,
  sourceCandidate: string,
  defaultRef = "HEAD",
  now = new Date(),
): RegisteredSource {
  const paths = getStudyPaths(studiesRoot, studyId);
  readStudy(studiesRoot, studyId);
  if (existsSync(paths.source.registration)) {
    throw new Error(`Source is already registered for study: ${studyId}`);
  }

  const candidateRoot = realpathSync.native(sourceCandidate);
  const sourceRoot = realpathSync.native(git(candidateRoot, ["rev-parse", "--show-toplevel"]));
  assertSeparatedRoots(realpathSync.native(studiesRoot), sourceRoot);
  const resolvedCommit = git(sourceRoot, ["rev-parse", `${defaultRef}^{commit}`]);

  const registration = SourceRegistrationSchema.parse({
    schemaVersion: 1,
    kind: "local-git",
    sourceRoot,
    defaultRef,
    registeredAt: now.toISOString(),
  });
  writeJsonAtomically(paths.source.registration, registration);
  return { registration, resolvedCommit };
}

export function readSourceRegistration(studiesRoot: string, studyId: string): SourceRegistration {
  return SourceRegistrationSchema.parse(
    readJson(getStudyPaths(studiesRoot, studyId).source.registration),
  );
}
