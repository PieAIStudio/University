import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  PROJECT_ROOT,
  sha256,
  validateDeliveryArtifact,
  validateRecoveryInput,
  writeReleaseMetadata,
} from "./delivery-artifact.mjs";

const temporaryRoots = [];

function temporaryRoot() {
  const root = mkdtempSync(join(tmpdir(), "university-delivery-test-"));
  temporaryRoots.push(root);
  return root;
}

function writePublicCourse(root, course = {}) {
  const body = {
    course: {
      id: "course",
      title: "Course",
      isBeingRewritten: false,
      units: [
        {
          id: "unit",
          title: "Unit",
          lessons: [
            {
              id: "lesson",
              title: "Lesson",
              content: "Read this.",
              contentRevision: 1,
              evidence: [],
              assets: [],
              cards: [],
              exercises: [
                {
                  id: "exercise",
                  kind: "short-answer",
                  title: "Question",
                  prompt: "What did you read?",
                  answerKey: { fp: "abc", len: 1 },
                },
              ],
            },
          ],
        },
      ],
    },
  };
  mkdirSync(join(root, "content", "study"), { recursive: true });
  body.course.units[0].lessons[0] = {
    ...body.course.units[0].lessons[0],
    ...course,
  };
  const target = join(root, "content", "study", "course.json");
  const bytes = Buffer.from(`${JSON.stringify(body)}\n`);
  writeFileSync(target, bytes);
  return { target, bytes };
}

function writeArtifactFixture() {
  const root = temporaryRoot();
  mkdirSync(join(root, "content", "assets"), { recursive: true });
  const { target, bytes } = writePublicCourse(root);
  writeFileSync(
    join(root, "content", "manifest.json"),
    `${JSON.stringify({
      importedAt: "2026-08-26",
      studies: [
        {
          studyId: "study",
          title: "Study",
          defaultCourseId: "course",
          courses: [
            {
              courseId: "course",
              title: "Course",
              isBeingRewritten: false,
              sha256: sha256(bytes),
              packageBytes: bytes.length,
              servedBytes: bytes.length,
              lessons: 1,
            },
          ],
        },
      ],
    })}\n`,
  );
  writeFileSync(
    join(root, "content", "shelf.json"),
    `${JSON.stringify({
      studies: [
        {
          id: "study",
          title: "Study",
          courses: [
            {
              id: "course",
              title: "Course",
              isBeingRewritten: false,
              units: [
                {
                  id: "unit",
                  lessons: [{ id: "lesson" }],
                },
              ],
            },
          ],
        },
      ],
    })}\n`,
  );
  writeReleaseMetadata(root, {
    version: "1.2.3",
    sourceCommit: "a".repeat(40),
    importDate: "2026-08-26",
    inputs: {
      recovery: {
        path: "apps/local/course-proposals/recovery",
        sha256: `sha256:${"b".repeat(64)}`,
        files: 2,
        bytes: 10,
        studies: 1,
        courses: 1,
      },
      lexicon: {
        path: "apps/local/data/vocabulary/en.json",
        sha256: `sha256:${"c".repeat(64)}`,
        bytes: 10,
        senses: 1,
      },
    },
    evidence: { mode: "none" },
  });
  return { root, coursePath: target };
}

function reseal(root, { evidenceMode = "none" } = {}) {
  const coursePath = join(root, "content", "study", "course.json");
  const body = readFileSync(coursePath);
  const manifestPath = join(root, "content", "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.studies[0].courses[0].servedBytes = body.length;
  manifest.studies[0].courses[0].sha256 = sha256(body);
  writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
  rmSync(join(root, "release.json"), { force: true });
  rmSync(join(root, "SHA256SUMS"), { force: true });
  writeReleaseMetadata(root, {
    version: "1.2.3",
    sourceCommit: "a".repeat(40),
    importDate: "2026-08-26",
    inputs: {
      recovery: {
        path: "apps/local/course-proposals/recovery",
        sha256: `sha256:${"b".repeat(64)}`,
        files: 2,
        bytes: 10,
        studies: 1,
        courses: 1,
      },
      lexicon: {
        path: "apps/local/data/vocabulary/en.json",
        sha256: `sha256:${"c".repeat(64)}`,
        bytes: 10,
        senses: 1,
      },
    },
    evidence: { mode: evidenceMode },
  });
}

function writeRecoveryFixture(root) {
  const recovery = join(root, "recovery");
  const study = join(recovery, "study");
  mkdirSync(study, { recursive: true });
  const pkg = Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      packageKind: "university-local-course-recovery",
      course: { id: "course", units: [] },
    }),
  );
  const file = "course.recovery.json";
  writeFileSync(join(study, file), pkg);
  writeFileSync(
    join(study, "index.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      packageKind: "university-local-course-recovery",
      study: { id: "study", title: "Study" },
      courses: [{ courseId: "course", file, sha256: sha256(pkg), isBeingRewritten: false }],
    })}\n`,
  );
  return { recovery, packagePath: join(study, file) };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("delivery artifact gate", () => {
  it("fails closed when an artifact is missing", () => {
    expect(() => validateDeliveryArtifact(join(temporaryRoot(), "missing"))).toThrow(/missing/);
  });

  it("validates a sealed artifact", () => {
    const { root } = writeArtifactFixture();
    expect(validateDeliveryArtifact(root)).toMatchObject({
      version: "1.2.3",
      studies: 1,
      courses: 1,
      lessons: 1,
    });
  });

  it("rejects a baked release that contains no baked evidence snippets", () => {
    const { root } = writeArtifactFixture();
    rmSync(join(root, "release.json"), { force: true });
    rmSync(join(root, "SHA256SUMS"), { force: true });
    reseal(root, { evidenceMode: "baked" });

    expect(() => validateDeliveryArtifact(root)).toThrow(
      /release evidence mode baked but artifact contains 0 baked evidence snippets/,
    );
  });

  it("rejects a baked release with only partial repository evidence coverage", () => {
    const { root, coursePath } = writeArtifactFixture();
    const pkg = JSON.parse(readFileSync(coursePath, "utf8"));
    const snippetUrl = `/content/study/course/evidence/${"a".repeat(64)}.json`;
    pkg.course.units[0].lessons[0].evidence = [
      { sourcePath: "src/first.ts", lineStart: 1, lineEnd: 1, snippetUrl },
      { sourcePath: "src/second.ts", lineStart: 2, lineEnd: 2 },
    ];
    writeFileSync(coursePath, `${JSON.stringify(pkg)}\n`);
    mkdirSync(join(root, "content", "study", "course", "evidence"), { recursive: true });
    writeFileSync(join(root, "content", snippetUrl.slice("/content/".length)), "{}\n");
    reseal(root, { evidenceMode: "baked" });

    expect(() => validateDeliveryArtifact(root)).toThrow(
      /release evidence mode baked but only 1\/2 repository evidence anchors have baked snippets/,
    );
  });

  it("rejects a changed payload even when release metadata was not changed", () => {
    const { root, coursePath } = writeArtifactFixture();
    writeFileSync(coursePath, `${readFileSync(coursePath, "utf8")} `);
    expect(() => validateDeliveryArtifact(root)).toThrow(/SHA256SUMS|release file record/);
  });

  it("catches a recursive author field and machine route, then passes after removal", () => {
    const { root, coursePath } = writeArtifactFixture();
    const pkg = JSON.parse(readFileSync(coursePath, "utf8"));
    const lesson = pkg.course.units[0].lessons[0];
    lesson.exercises[0].referenceAnswer = "secret";
    lesson.evidence = [{ note: "file-manager:/private/source" }];
    pkg.course.status = "stale";
    writeFileSync(coursePath, `${JSON.stringify(pkg)}\n`);
    reseal(root);
    expect(() => validateDeliveryArtifact(root)).toThrow(/public DTO violation/);

    delete lesson.exercises[0].referenceAnswer;
    lesson.evidence = [];
    delete pkg.course.status;
    writeFileSync(coursePath, `${JSON.stringify(pkg)}\n`);
    reseal(root);
    expect(validateDeliveryArtifact(root).courses).toBe(1);
  });

  it("validates a recovery index and rejects a package changed after its hash", () => {
    const root = temporaryRoot();
    const { recovery, packagePath } = writeRecoveryFixture(root);
    expect(validateRecoveryInput(recovery, { projectRoot: PROJECT_ROOT })).toMatchObject({
      studies: 1,
      courses: 1,
      files: 2,
    });
    const indexPath = join(recovery, "study", "index.json");
    const index = JSON.parse(readFileSync(indexPath, "utf8"));
    delete index.courses[0].isBeingRewritten;
    writeFileSync(indexPath, `${JSON.stringify(index)}\n`);
    expect(() => validateRecoveryInput(recovery, { projectRoot: PROJECT_ROOT })).toThrow(
      /isBeingRewritten must be a boolean learner fact/,
    );
    index.courses[0].isBeingRewritten = false;
    writeFileSync(indexPath, `${JSON.stringify(index)}\n`);
    expect(validateRecoveryInput(recovery, { projectRoot: PROJECT_ROOT }).courses).toBe(1);
    writeFileSync(packagePath, `${readFileSync(packagePath, "utf8")} `);
    expect(() => validateRecoveryInput(recovery, { projectRoot: PROJECT_ROOT })).toThrow(
      /hash mismatch/,
    );
  });

  it("rejects a recovery package that reuses a lesson id across units", () => {
    const root = temporaryRoot();
    const { recovery, packagePath } = writeRecoveryFixture(root);
    const packageValue = JSON.parse(readFileSync(packagePath, "utf8"));
    const lesson = { id: "shared-lesson" };
    packageValue.course.units = [
      { id: "unit-first", lessons: [lesson] },
      { id: "unit-second", lessons: [{ ...lesson }] },
    ];
    const bytes = Buffer.from(JSON.stringify(packageValue));
    writeFileSync(packagePath, bytes);

    const indexPath = join(recovery, "study", "index.json");
    const index = JSON.parse(readFileSync(indexPath, "utf8"));
    index.courses[0].sha256 = sha256(bytes);
    writeFileSync(indexPath, `${JSON.stringify(index)}\n`);

    expect(() => validateRecoveryInput(recovery, { projectRoot: PROJECT_ROOT })).toThrow(
      /lesson id shared-lesson is reused.*unitId/,
    );
  });

  it("refuses the private studies shelf as a release input", () => {
    expect(() => validateRecoveryInput(resolve(PROJECT_ROOT, "apps/local/studies"))).toThrow(
      /apps\/local\/studies/,
    );
  });
});
