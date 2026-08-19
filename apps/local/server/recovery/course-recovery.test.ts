import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { EvidenceReference, LessonAsset } from "@pieai/university-core/domain/schemas.js";
import { executeUniversityLocalCli } from "../cli/execute.js";
import { HELP } from "../cli/commands.js";
import { parseUniversityLocalCli } from "../cli/parse.js";
import {
  readCourse,
  readLatestCard,
  readLatestExercise,
  readLatestLesson,
  setCourseCurrency,
  updateCourseStatus,
  updateUnitStatus,
  writeCardRevision,
  writeCourse,
  writeExerciseRevision,
  writeLessonRevision,
  writeUnit,
} from "../content/repository.js";
import {
  getCoursePaths,
  getLessonPaths,
  getStudyPaths,
  getUaAnalysisPaths,
  getUnitPaths,
} from "../studies/paths.js";
import {
  createStudy,
  readSourceRegistration,
  registerLocalGitSource,
  setDefaultCourse,
  setStudyStatus,
} from "../studies/repository.js";
import { createCleanSnapshot } from "../studies/snapshots.js";
import {
  exportCourseRecovery,
  importCourseRecovery,
  loadCourseRecovery,
} from "./course-recovery.js";

const STUDY_ID = "recovery-study";
const COURSE_ID = "system-boundaries";
const UNIT_ID = "source-truth";
const LESSON_ID = "source-evidence";
const CREATED_AT = "2026-08-17T00:00:00.000Z";

function git(repository: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", repository, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function sha256(value: string | Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function makeSource(container: string): string {
  const sourceRoot = join(container, "source");
  execFileSync("git", ["init", "-q", "-b", "main", sourceRoot]);
  git(sourceRoot, ["config", "user.name", "UniversityLocal Test"]);
  git(sourceRoot, ["config", "user.email", "test@university.local"]);
  writeFileSync(
    join(sourceRoot, "truth.ts"),
    "export const sourceOfTruth = 'repository';\nexport const runtimeWins = true;\n",
  );
  git(sourceRoot, ["add", "truth.ts"]);
  git(sourceRoot, ["commit", "-q", "-m", "Initial source truth"]);
  return sourceRoot;
}

function setupActiveCourse(defaultRef = "HEAD") {
  const container = mkdtempSync(join(tmpdir(), "university-local-course-recovery-"));
  const sourceRoot = makeSource(container);
  const studiesRoot = join(container, "original-studies");
  createStudy(studiesRoot, {
    id: STUDY_ID,
    title: "Recovery Study",
    description: "A canonical recovery fixture",
    goals: ["Recover current courses without learner data"],
    now: new Date(CREATED_AT),
  });
  registerLocalGitSource(studiesRoot, STUDY_ID, sourceRoot, defaultRef, new Date(CREATED_AT));
  const snapshot = createCleanSnapshot(studiesRoot, STUDY_ID, "HEAD", new Date(CREATED_AT));

  const graphBytes = `${JSON.stringify({
    nodes: [{ id: "file:truth.ts", type: "file", filePath: "truth.ts" }],
    edges: [],
  })}\n`;
  const analysisId = "ua-source-truth";
  const analysisPaths = getUaAnalysisPaths(studiesRoot, STUDY_ID, analysisId);
  mkdirSync(analysisPaths.data, { recursive: true });
  writeFileSync(join(analysisPaths.data, "knowledge-graph.json"), graphBytes);
  const graphHash = sha256(graphBytes);
  writeFileSync(
    analysisPaths.manifest,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        id: analysisId,
        engine: "understand-anything",
        engineVersion: "2.9.4",
        snapshotId: snapshot.id,
        sourceCommit: snapshot.sourceCommit,
        outputLanguage: "zh",
        configHash: `sha256:${"a".repeat(64)}`,
        createdAt: CREATED_AT,
        status: "ready",
        graphHash,
        nodeCount: 1,
        edgeCount: 0,
        completedAt: CREATED_AT,
      },
      null,
      2,
    )}\n`,
  );

  const evidence: EvidenceReference = {
    kind: "fact",
    snapshotId: snapshot.id,
    sourceCommit: snapshot.sourceCommit,
    sourcePath: "truth.ts",
    lineStart: 1,
    lineEnd: 2,
    analysisId,
    graphHash,
    nodeIds: ["file:truth.ts"],
    note: "Repository source remains the authority.",
  };
  const assetBytes = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="6"/></svg>\n',
  );
  const assetSource = join(container, "boundary.svg");
  writeFileSync(assetSource, assetBytes);
  const asset: LessonAsset = {
    id: "boundary-diagram",
    kind: "diagram",
    path: "assets/boundary.svg",
    sha256: sha256(assetBytes),
    mime: "image/svg+xml",
    bytes: assetBytes.byteLength,
    width: 16,
    height: 16,
    alt: "A small circle representing a system boundary",
    caption: "The boundary keeps source truth separate from learner state.",
    capture: {
      sourceCommit: snapshot.sourceCommit,
      route: `file-manager:${sourceRoot}`,
      state: "Repository root selected in the file manager",
      viewport: { width: 1440, height: 900 },
      locale: "en-US",
      captureRecipe: "Open the registered source repository root.",
      capturedAt: CREATED_AT,
    },
  };

  writeCourse(studiesRoot, STUDY_ID, {
    schemaVersion: 1,
    id: COURSE_ID,
    title: "System Boundaries",
    description: "Learn what is canonical and what is disposable.",
    audience: "A beginning product builder",
    objectives: ["Separate source truth from learner state"],
    unitIds: [UNIT_ID],
    status: "draft",
    currency: "pinned-history",
    prerequisiteCourseIds: [],
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  });
  writeUnit(studiesRoot, STUDY_ID, COURSE_ID, {
    schemaVersion: 1,
    id: UNIT_ID,
    title: "Source truth",
    objective: "Explain why recovery binds to exact Git commits.",
    prerequisiteUnitIds: [],
    lessonIds: [LESSON_ID],
    status: "draft",
  });
  writeLessonRevision(studiesRoot, STUDY_ID, {
    manifest: {
      schemaVersion: 1,
      id: LESSON_ID,
      title: "Source evidence survives",
      courseId: COURSE_ID,
      unitId: UNIT_ID,
      exerciseIds: ["boundary-recall"],
      cardIds: ["boundary-card"],
      contentRevision: 1,
      status: "active",
      evidence: [evidence],
      sections: [{ id: "why-source", title: "Why source" }],
      assets: [asset],
      variant: "对比",
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    },
    content:
      "# Why source\n\nThe exact Git commit is recoverable; learner history and UA caches are not part of the course package.\n",
    assetFiles: [{ path: asset.path, sourcePath: assetSource }],
  });
  writeCardRevision(studiesRoot, STUDY_ID, {
    schemaVersion: 1,
    id: "boundary-card",
    kind: "basic",
    courseId: COURSE_ID,
    unitId: UNIT_ID,
    lessonId: LESSON_ID,
    front: "课程恢复包绑定什么？",
    back: "精确的 Git commit 与 source path。",
    contentRevision: 1,
    status: "active",
    tags: ["recovery"],
    evidence: [evidence],
  });
  writeExerciseRevision(studiesRoot, STUDY_ID, {
    schemaVersion: 1,
    id: "boundary-recall",
    kind: "short-answer",
    title: "Recall the recovery boundary",
    courseId: COURSE_ID,
    unitId: UNIT_ID,
    lessonId: LESSON_ID,
    prompt: "Name the durable source binding.",
    expectedAnswer: "The exact Git commit and repository-relative source path.",
    contentRevision: 1,
    status: "active",
    evidence: [evidence],
  });
  updateUnitStatus(studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID, "active");
  updateCourseStatus(studiesRoot, STUDY_ID, COURSE_ID, "active", new Date(CREATED_AT));
  setDefaultCourse(studiesRoot, STUDY_ID, COURSE_ID, new Date(CREATED_AT));
  return { container, sourceRoot, studiesRoot, assetBytes, assetSource };
}

function exportFixture(studiesRoot: string, container: string, name: string): string {
  const output = join(container, name);
  exportCourseRecovery({ studiesRoot, studyId: STUDY_ID, outDirectory: output });
  return output;
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function rewriteCourseAndIndex(
  directory: string,
  update: (course: Record<string, unknown>) => void,
): void {
  const indexPath = join(directory, "index.json");
  const index = readJson(indexPath);
  const courses = index["courses"] as Array<Record<string, unknown>>;
  const entry = courses[0]!;
  const coursePath = join(directory, String(entry["file"]));
  const course = readJson(coursePath);
  update(course);
  const bytes = `${JSON.stringify(course, null, 2)}\n`;
  const contentHash = sha256(bytes);
  const file = `${String(entry["courseId"])}.${contentHash.slice("sha256:".length)}.recovery.json`;
  writeFileSync(join(directory, file), bytes);
  entry["file"] = file;
  entry["sha256"] = contentHash;
  writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
}

function firstIndexEntry(directory: string): Record<string, unknown> {
  return (readJson(join(directory, "index.json"))["courses"] as Array<Record<string, unknown>>)[0]!;
}

function appendCourseClone(directory: string, courseId: string): void {
  const indexPath = join(directory, "index.json");
  const index = readJson(indexPath);
  const sourceEntry = firstIndexEntry(directory);
  const sourceCourse = readJson(join(directory, String(sourceEntry["file"])));
  const clonedCourse = structuredClone(sourceCourse) as Record<string, unknown>;
  const course = clonedCourse["course"] as Record<string, unknown>;
  course["id"] = courseId;
  course["title"] = "Second recovery course";
  const bytes = `${JSON.stringify(clonedCourse, null, 2)}\n`;
  const contentHash = sha256(bytes);
  const file = `${courseId}.${contentHash.slice("sha256:".length)}.recovery.json`;
  writeFileSync(join(directory, file), bytes);
  (index["courses"] as Array<Record<string, unknown>>).push({
    courseId,
    file,
    sha256: contentHash,
  });
  index["droppedUaBindingCount"] = Number(index["droppedUaBindingCount"]) * 2;
  writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
}

describe("canonical course recovery", () => {
  it("parses, documents, and executes both recovery CLI lanes", async () => {
    const fixture = setupActiveCourse();
    expect(
      parseUniversityLocalCli([
        "course",
        "recovery",
        "export",
        "--study",
        STUDY_ID,
        "--out",
        "recovery-output",
      ]),
    ).toEqual({
      kind: "course-recovery-export",
      studyId: STUDY_ID,
      outDirectory: "recovery-output",
    });
    expect(
      parseUniversityLocalCli([
        "course",
        "recovery",
        "import",
        "--study",
        STUDY_ID,
        "--input",
        "recovery-output",
        "--source",
        "source",
        "--dry-run",
      ]),
    ).toEqual({
      kind: "course-recovery-import",
      studyId: STUDY_ID,
      inputDirectory: "recovery-output",
      sourceRoot: "source",
      dryRun: true,
    });
    expect(HELP).toContain("course recovery export");
    expect(HELP).toContain("course recovery import");

    const exportProject = join(fixture.container, "export-project");
    mkdirSync(exportProject);
    writeFileSync(
      join(exportProject, "university-local.config.json"),
      `${JSON.stringify({ schemaVersion: 1, studiesRoot: fixture.studiesRoot })}\n`,
    );
    const exportCommand = parseUniversityLocalCli([
      "course",
      "recovery",
      "export",
      "--study",
      STUDY_ID,
      "--out",
      "cli-recovery",
    ]);
    const exported = await executeUniversityLocalCli({
      projectRoot: exportProject,
      cwd: fixture.container,
      command: exportCommand,
    });
    expect(exported).toMatchObject({ operation: "course-recovery-export", studyId: STUDY_ID });

    const importProject = join(fixture.container, "import-project");
    mkdirSync(importProject);
    const dryRunStudies = join(importProject, "studies");
    writeFileSync(
      join(importProject, "university-local.config.json"),
      `${JSON.stringify({ schemaVersion: 1, studiesRoot: dryRunStudies })}\n`,
    );
    const imported = await executeUniversityLocalCli({
      projectRoot: importProject,
      cwd: fixture.container,
      command: parseUniversityLocalCli([
        "course",
        "recovery",
        "import",
        "--study",
        STUDY_ID,
        "--input",
        "cli-recovery",
        "--source",
        "source",
        "--dry-run",
      ]),
    });
    expect(imported).toMatchObject({
      operation: "course-recovery-import",
      mode: "dry-run",
      outcome: "validated",
    });
    expect(existsSync(dryRunStudies)).toBe(false);
  });

  it("commits with the index after publishing immutable content-addressed course files", () => {
    const fixture = setupActiveCourse();
    const output = exportFixture(fixture.studiesRoot, fixture.container, "atomic-package");
    const oldIndexBytes = readFileSync(join(output, "index.json"));
    const oldEntry = firstIndexEntry(output);
    const oldFile = String(oldEntry["file"]);
    const oldHash = String(oldEntry["sha256"]);
    const oldCourseBytes = readFileSync(join(output, oldFile));
    expect(oldFile).toBe(`${COURSE_ID}.${oldHash.slice("sha256:".length)}.recovery.json`);
    expect(sha256(oldCourseBytes)).toBe(oldHash);

    setCourseCurrency(
      fixture.studiesRoot,
      STUDY_ID,
      COURSE_ID,
      "follow-ref",
      new Date("2026-08-17T01:00:00.000Z"),
    );
    expect(() =>
      exportCourseRecovery({
        studiesRoot: fixture.studiesRoot,
        studyId: STUDY_ID,
        outDirectory: output,
        beforeIndexCommit: () => {
          throw new Error("injected before index commit");
        },
      }),
    ).toThrow(/injected before index commit/);

    // The changed course object exists, but the old index and the immutable
    // object it names are untouched and still form a complete loadable package.
    expect(readFileSync(join(output, "index.json"))).toEqual(oldIndexBytes);
    expect(readFileSync(join(output, oldFile))).toEqual(oldCourseBytes);
    expect(loadCourseRecovery(output).packages[0]!.course.currency).toBe("pinned-history");
    expect(readdirSync(output).filter((file) => file.endsWith(".recovery.json"))).toHaveLength(2);

    exportCourseRecovery({
      studiesRoot: fixture.studiesRoot,
      studyId: STUDY_ID,
      outDirectory: output,
    });
    const newEntry = firstIndexEntry(output);
    expect(newEntry["file"]).not.toBe(oldFile);
    expect(existsSync(join(output, oldFile))).toBe(true);
    expect(readFileSync(join(output, oldFile))).toEqual(oldCourseBytes);
    expect(loadCourseRecovery(output).packages[0]!.course.currency).toBe("follow-ref");
  });

  it("refuses to export recovery for an archived study", () => {
    const fixture = setupActiveCourse();
    setStudyStatus(fixture.studiesRoot, STUDY_ID, "archived");

    expect(() =>
      exportCourseRecovery({
        studiesRoot: fixture.studiesRoot,
        studyId: STUDY_ID,
        outDirectory: join(fixture.container, "archived-recovery"),
      }),
    ).toThrow(/Only an active study can be exported for recovery: recovery-study is archived/);
  });

  it("round-trips current course bytes while explicitly dropping UA bindings", () => {
    const fixture = setupActiveCourse();
    const firstOutput = exportFixture(fixture.studiesRoot, fixture.container, "recovery-a");
    const loaded = loadCourseRecovery(firstOutput);
    expect(loaded.index.evidenceMode).toBe("source-only");
    expect(loaded.index.droppedUaBindingCount).toBe(3);
    const firstCourse = loaded.packages[0]!;
    expect(firstCourse.droppedUaBindingCount).toBe(3);
    const recoveredEvidence = firstCourse.course.units[0]!.lessons[0]!.evidence[0]!;
    expect(recoveredEvidence).toMatchObject({ nodeIds: [] });
    expect(recoveredEvidence).not.toHaveProperty("analysisId");
    expect(recoveredEvidence).not.toHaveProperty("graphHash");
    const firstRecoveryFile = String(firstIndexEntry(firstOutput)["file"]);
    const firstRecoveryBytes = readFileSync(join(firstOutput, firstRecoveryFile), "utf8");
    expect(firstRecoveryBytes).not.toContain(fixture.sourceRoot);
    expect(firstRecoveryBytes).toContain("file-manager:<source-root>");

    const targetStudiesRoot = join(fixture.container, "recovered-studies");
    const relocatedSourceRoot = join(fixture.container, "relocated-source");
    execFileSync("git", ["clone", "-q", fixture.sourceRoot, relocatedSourceRoot]);
    const applied = importCourseRecovery({
      studiesRoot: targetStudiesRoot,
      studyId: STUDY_ID,
      inputDirectory: firstOutput,
      sourceRoot: relocatedSourceRoot,
    });
    expect(applied.mode).toBe("apply");
    expect(applied.courses).toEqual([{ courseId: COURSE_ID, outcome: "created" }]);
    expect(readCourse(targetStudiesRoot, STUDY_ID, COURSE_ID)).toMatchObject({
      status: "active",
      currency: "pinned-history",
      prerequisiteCourseIds: [],
    });
    expect(
      readLatestCard(targetStudiesRoot, STUDY_ID, COURSE_ID, UNIT_ID, LESSON_ID, "boundary-card")
        .status,
    ).toBe("active");
    expect(
      readLatestExercise(
        targetStudiesRoot,
        STUDY_ID,
        COURSE_ID,
        UNIT_ID,
        LESSON_ID,
        "boundary-recall",
      ).status,
    ).toBe("active");
    const recoveredLesson = readLatestLesson(
      targetStudiesRoot,
      STUDY_ID,
      COURSE_ID,
      UNIT_ID,
      LESSON_ID,
    );
    expect(recoveredLesson.manifest.evidence[0]).not.toHaveProperty("analysisId");
    expect(recoveredLesson.manifest.assets[0]!.capture?.route).toBe(
      `file-manager:${realpathSync.native(relocatedSourceRoot)}`,
    );
    const recoveredAsset = readFileSync(
      join(
        getLessonPaths(targetStudiesRoot, STUDY_ID, COURSE_ID, UNIT_ID, LESSON_ID).revisions,
        "1",
        "assets",
        "boundary.svg",
      ),
    );
    expect(recoveredAsset).toEqual(fixture.assetBytes);
    const targetPaths = getStudyPaths(targetStudiesRoot, STUDY_ID);
    expect(existsSync(targetPaths.learner.database)).toBe(false);
    expect(readdirSync(targetPaths.ua)).toEqual([]);

    const secondOutput = exportFixture(targetStudiesRoot, fixture.container, "recovery-b");
    expect(readFileSync(join(secondOutput, "index.json"))).toEqual(
      readFileSync(join(firstOutput, "index.json")),
    );
    const recoveryFile = String(firstIndexEntry(firstOutput)["file"]);
    expect(readFileSync(join(secondOutput, recoveryFile))).toEqual(
      readFileSync(join(firstOutput, recoveryFile)),
    );

    const reused = importCourseRecovery({
      studiesRoot: targetStudiesRoot,
      studyId: STUDY_ID,
      inputDirectory: firstOutput,
      sourceRoot: relocatedSourceRoot,
    });
    expect(reused.courses).toEqual([{ courseId: COURSE_ID, outcome: "reused" }]);
  });

  it("preserves the source default ref and treats old indexes as HEAD", () => {
    const fixture = setupActiveCourse("main");
    const output = exportFixture(fixture.studiesRoot, fixture.container, "default-ref-package");
    const index = readJson(join(output, "index.json"));
    expect(index["source"]).toMatchObject({ defaultRef: "main" });

    const targetStudiesRoot = join(fixture.container, "default-ref-target");
    importCourseRecovery({
      studiesRoot: targetStudiesRoot,
      studyId: STUDY_ID,
      inputDirectory: output,
      sourceRoot: fixture.sourceRoot,
    });
    expect(readSourceRegistration(targetStudiesRoot, STUDY_ID).defaultRef).toBe("main");

    const legacy = join(fixture.container, "legacy-default-ref-package");
    cpSync(output, legacy, { recursive: true });
    const legacyIndex = readJson(join(legacy, "index.json"));
    delete legacyIndex["source"];
    writeFileSync(join(legacy, "index.json"), `${JSON.stringify(legacyIndex, null, 2)}\n`);
    expect(loadCourseRecovery(legacy).index.source).toBeUndefined();

    const legacyTargetStudiesRoot = join(fixture.container, "legacy-default-ref-target");
    importCourseRecovery({
      studiesRoot: legacyTargetStudiesRoot,
      studyId: STUDY_ID,
      inputDirectory: legacy,
      sourceRoot: fixture.sourceRoot,
    });
    expect(readSourceRegistration(legacyTargetStudiesRoot, STUDY_ID).defaultRef).toBe("HEAD");
  });

  it("rejects file-manager capture provenance outside the registered source", () => {
    const fixture = setupActiveCourse();
    const lesson = readLatestLesson(fixture.studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID, LESSON_ID);
    const asset = lesson.manifest.assets[0]!;
    updateCourseStatus(
      fixture.studiesRoot,
      STUDY_ID,
      COURSE_ID,
      "stale",
      new Date("2026-08-17T02:00:00.000Z"),
    );
    updateUnitStatus(fixture.studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID, "stale");
    writeLessonRevision(fixture.studiesRoot, STUDY_ID, {
      manifest: {
        ...lesson.manifest,
        contentRevision: 2,
        assets: [
          {
            ...asset,
            capture: {
              ...asset.capture!,
              route: `file-manager:${fixture.container}`,
            },
          },
        ],
      },
      content: lesson.content,
      assetFiles: [{ path: asset.path, sourcePath: fixture.assetSource }],
    });
    updateUnitStatus(fixture.studiesRoot, STUDY_ID, COURSE_ID, UNIT_ID, "active");
    updateCourseStatus(
      fixture.studiesRoot,
      STUDY_ID,
      COURSE_ID,
      "active",
      new Date("2026-08-17T02:01:00.000Z"),
    );

    expect(() =>
      exportCourseRecovery({
        studiesRoot: fixture.studiesRoot,
        studyId: STUDY_ID,
        outDirectory: join(fixture.container, "unsafe-capture-package"),
      }),
    ).toThrow(/outside the registered source root/);
  });

  it("validates a dry run without creating the studies root", () => {
    const fixture = setupActiveCourse();
    const output = exportFixture(fixture.studiesRoot, fixture.container, "dry-run-package");
    const targetStudiesRoot = join(fixture.container, "must-not-exist");
    const result = importCourseRecovery({
      studiesRoot: targetStudiesRoot,
      studyId: STUDY_ID,
      inputDirectory: output,
      sourceRoot: fixture.sourceRoot,
      dryRun: true,
    });
    expect(result).toMatchObject({ mode: "dry-run", outcome: "validated" });
    expect(existsSync(targetStudiesRoot)).toBe(false);

    const unsafeNestedRoot = join(fixture.sourceRoot, "must-not-be-created");
    expect(() =>
      importCourseRecovery({
        studiesRoot: unsafeNestedRoot,
        studyId: STUDY_ID,
        inputDirectory: output,
        sourceRoot: fixture.sourceRoot,
        dryRun: true,
      }),
    ).toThrow(/must be separate/);
    expect(existsSync(unsafeNestedRoot)).toBe(false);
  });

  it("rejects tampered hashes, unsafe filenames, invalid base64, and asset bytes", () => {
    const fixture = setupActiveCourse();
    const output = exportFixture(fixture.studiesRoot, fixture.container, "trusted-package");
    writeFileSync(join(output, "old-unreferenced.recovery.json"), "not part of this package\n");
    expect(loadCourseRecovery(output).packages).toHaveLength(1);

    const badHash = join(fixture.container, "bad-hash");
    cpSync(output, badHash, { recursive: true });
    writeFileSync(join(badHash, String(firstIndexEntry(badHash)["file"])), "{}\n");
    expect(() => loadCourseRecovery(badHash)).toThrow(/hash mismatch/);

    const unsafePath = join(fixture.container, "unsafe-path");
    cpSync(output, unsafePath, { recursive: true });
    const unsafeIndex = readJson(join(unsafePath, "index.json"));
    (unsafeIndex["courses"] as Array<Record<string, unknown>>)[0]!["file"] =
      "../escape.recovery.json";
    writeFileSync(join(unsafePath, "index.json"), `${JSON.stringify(unsafeIndex, null, 2)}\n`);
    expect(() => loadCourseRecovery(unsafePath)).toThrow();

    const tamperedName = join(fixture.container, "tampered-name");
    cpSync(output, tamperedName, { recursive: true });
    const nameIndex = readJson(join(tamperedName, "index.json"));
    (nameIndex["courses"] as Array<Record<string, unknown>>)[0]!["file"] =
      `${COURSE_ID}.${"f".repeat(64)}.recovery.json`;
    writeFileSync(join(tamperedName, "index.json"), `${JSON.stringify(nameIndex, null, 2)}\n`);
    expect(() => loadCourseRecovery(tamperedName)).toThrow(/must be named/);

    const tamperedIndexHash = join(fixture.container, "tampered-index-hash");
    cpSync(output, tamperedIndexHash, { recursive: true });
    const hashIndex = readJson(join(tamperedIndexHash, "index.json"));
    (hashIndex["courses"] as Array<Record<string, unknown>>)[0]!["sha256"] =
      `sha256:${"f".repeat(64)}`;
    writeFileSync(join(tamperedIndexHash, "index.json"), `${JSON.stringify(hashIndex, null, 2)}\n`);
    expect(() => loadCourseRecovery(tamperedIndexHash)).toThrow(/must be named/);

    const badBase64 = join(fixture.container, "bad-base64");
    cpSync(output, badBase64, { recursive: true });
    rewriteCourseAndIndex(badBase64, (course) => {
      const asset = (
        (
          (
            (course["course"] as Record<string, unknown>)["units"] as Array<Record<string, unknown>>
          )[0]!["lessons"] as Array<Record<string, unknown>>
        )[0]!["assets"] as Array<Record<string, unknown>>
      )[0]!;
      asset["dataBase64"] = "***";
    });
    expect(() => loadCourseRecovery(badBase64)).toThrow(/base64/);

    const badAsset = join(fixture.container, "bad-asset");
    cpSync(output, badAsset, { recursive: true });
    rewriteCourseAndIndex(badAsset, (course) => {
      const asset = (
        (
          (
            (course["course"] as Record<string, unknown>)["units"] as Array<Record<string, unknown>>
          )[0]!["lessons"] as Array<Record<string, unknown>>
        )[0]!["assets"] as Array<Record<string, unknown>>
      )[0]!;
      asset["dataBase64"] = Buffer.from("different bytes").toString("base64");
    });
    expect(() => loadCourseRecovery(badAsset)).toThrow(/hash\/size mismatch/);
  });

  it("refuses to overwrite an active course whose canonical content differs", () => {
    const fixture = setupActiveCourse();
    const output = exportFixture(fixture.studiesRoot, fixture.container, "conflict-source");
    const targetStudiesRoot = join(fixture.container, "conflict-target");
    importCourseRecovery({
      studiesRoot: targetStudiesRoot,
      studyId: STUDY_ID,
      inputDirectory: output,
      sourceRoot: fixture.sourceRoot,
    });

    const changed = join(fixture.container, "changed-package");
    cpSync(output, changed, { recursive: true });
    rewriteCourseAndIndex(changed, (course) => {
      (course["course"] as Record<string, unknown>)["title"] = "A different course";
    });
    expect(() =>
      importCourseRecovery({
        studiesRoot: targetStudiesRoot,
        studyId: STUDY_ID,
        inputDirectory: changed,
        sourceRoot: fixture.sourceRoot,
      }),
    ).toThrow(/Active course conflicts/);
    expect(readCourse(targetStudiesRoot, STUDY_ID, COURSE_ID).title).toBe("System Boundaries");
  });

  it("preflights later course conflicts before writing earlier courses", () => {
    const fixture = setupActiveCourse();
    const output = exportFixture(fixture.studiesRoot, fixture.container, "multi-course-package");
    appendCourseClone(output, "second-course");
    const secondCourse = loadCourseRecovery(output).packages.find(
      (coursePackage) => coursePackage.course.id === "second-course",
    )!.course;

    const targetStudiesRoot = join(fixture.container, "preflight-target");
    createStudy(targetStudiesRoot, {
      id: STUDY_ID,
      title: "Recovery Study",
      description: "A canonical recovery fixture",
      goals: ["Recover current courses without learner data"],
      now: new Date(CREATED_AT),
    });
    registerLocalGitSource(
      targetStudiesRoot,
      STUDY_ID,
      fixture.sourceRoot,
      "HEAD",
      new Date(CREATED_AT),
    );
    writeCourse(targetStudiesRoot, STUDY_ID, {
      schemaVersion: 1,
      id: secondCourse.id,
      title: secondCourse.title,
      description: secondCourse.description,
      audience: secondCourse.audience,
      objectives: secondCourse.objectives,
      unitIds: secondCourse.units.map((unit) => unit.id),
      status: "draft",
      currency: secondCourse.currency,
      prerequisiteCourseIds: secondCourse.prerequisiteCourseIds,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    });
    const conflictingUnit = secondCourse.units[0]!;
    writeUnit(targetStudiesRoot, STUDY_ID, secondCourse.id, {
      schemaVersion: 1,
      id: conflictingUnit.id,
      title: "A conflicting unit",
      objective: conflictingUnit.objective,
      prerequisiteUnitIds: conflictingUnit.prerequisiteUnitIds,
      lessonIds: conflictingUnit.lessons.map((lesson) => lesson.id),
      status: "draft",
    });

    expect(() =>
      importCourseRecovery({
        studiesRoot: targetStudiesRoot,
        studyId: STUDY_ID,
        inputDirectory: output,
        sourceRoot: fixture.sourceRoot,
      }),
    ).toThrow(/Existing unit conflicts with recovery package/);
    expect(existsSync(getCoursePaths(targetStudiesRoot, STUDY_ID, COURSE_ID).manifest)).toBe(false);
    expect(
      readdirSync(getStudyPaths(targetStudiesRoot, STUDY_ID).source.snapshots).filter((file) =>
        file.endsWith(".json"),
      ),
    ).toEqual([]);
  });

  it("rejects a late orphan path before writing earlier recovery objects", () => {
    const fixture = setupActiveCourse();
    const output = exportFixture(fixture.studiesRoot, fixture.container, "orphan-late-path");
    appendCourseClone(output, "second-course");
    const secondCourse = loadCourseRecovery(output).packages.find(
      (coursePackage) => coursePackage.course.id === "second-course",
    )!.course;

    const targetStudiesRoot = join(fixture.container, "orphan-target");
    createStudy(targetStudiesRoot, {
      id: STUDY_ID,
      title: "Recovery Study",
      description: "A canonical recovery fixture",
      goals: ["Recover current courses without learner data"],
      now: new Date(CREATED_AT),
    });
    registerLocalGitSource(
      targetStudiesRoot,
      STUDY_ID,
      fixture.sourceRoot,
      "HEAD",
      new Date(CREATED_AT),
    );
    writeCourse(targetStudiesRoot, STUDY_ID, {
      schemaVersion: 1,
      id: secondCourse.id,
      title: secondCourse.title,
      description: secondCourse.description,
      audience: secondCourse.audience,
      objectives: secondCourse.objectives,
      unitIds: secondCourse.units.map((unit) => unit.id),
      status: "draft",
      currency: secondCourse.currency,
      prerequisiteCourseIds: secondCourse.prerequisiteCourseIds,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    });
    const orphanUnit = getUnitPaths(
      targetStudiesRoot,
      STUDY_ID,
      secondCourse.id,
      secondCourse.units[0]!.id,
    );
    mkdirSync(orphanUnit.root, { recursive: true });

    expect(() =>
      importCourseRecovery({
        studiesRoot: targetStudiesRoot,
        studyId: STUDY_ID,
        inputDirectory: output,
        sourceRoot: fixture.sourceRoot,
      }),
    ).toThrow(/Existing unit path has no canonical manifest/);
    expect(existsSync(getCoursePaths(targetStudiesRoot, STUDY_ID, COURSE_ID).manifest)).toBe(false);
    expect(
      readdirSync(getStudyPaths(targetStudiesRoot, STUDY_ID).source.snapshots).filter((file) =>
        file.endsWith(".json"),
      ),
    ).toEqual([]);
  });
});
