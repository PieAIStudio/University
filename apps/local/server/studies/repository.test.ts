import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getStudyPaths } from "./paths.js";
import {
  createStudy,
  discoverStudies,
  readStudy,
  readSourceRegistration,
  rebindLocalGitSource,
  registerLocalGitSource,
  setDefaultCourse,
} from "./repository.js";
import { writeCourse, updateCourseStatus } from "../content/repository.js";
import { createCleanSnapshot } from "./snapshots.js";

function makeRoot(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function makeGitRepository(readme = "# Source\n"): string {
  const repository = makeRoot("university-local-source-");
  execFileSync("git", ["init", "-q", repository]);
  execFileSync("git", ["-C", repository, "config", "user.name", "UniversityLocal Test"]);
  execFileSync("git", ["-C", repository, "config", "user.email", "test@university.local"]);
  writeFileSync(join(repository, "README.md"), readme);
  execFileSync("git", ["-C", repository, "add", "README.md"]);
  execFileSync("git", ["-C", repository, "commit", "-q", "-m", "Initial"]);
  return repository;
}

describe("study repository", () => {
  it("creates the stable study layout and discovers valid studies", () => {
    const studiesRoot = join(makeRoot("university-local-studies-"), "studies");
    const manifest = createStudy(studiesRoot, {
      id: "supaluv",
      title: "SupaLuv",
      goals: ["Understand the product architecture"],
      now: new Date("2026-07-20T00:00:00.000Z"),
    });
    const paths = getStudyPaths(studiesRoot, "supaluv");

    expect(manifest.createdAt).toBe("2026-07-20T00:00:00.000Z");
    expect(existsSync(paths.manifest)).toBe(true);
    expect(existsSync(paths.courses)).toBe(true);
    expect(existsSync(paths.learner.backups)).toBe(true);
    expect(discoverStudies(studiesRoot)).toEqual([manifest]);
    expect(readdirSync(paths.root)).toContain("ua");
  });

  it("rejects duplicate studies and path traversal ids", () => {
    const studiesRoot = join(makeRoot("university-local-studies-"), "studies");
    createStudy(studiesRoot, { id: "supaluv", title: "SupaLuv" });
    expect(() => createStudy(studiesRoot, { id: "supaluv", title: "Again" })).toThrow(
      /already exists/,
    );
    expect(() => getStudyPaths(studiesRoot, "../escape")).toThrow();
  });

  it("ignores unrelated invalid directory names during discovery", () => {
    const studiesRoot = join(makeRoot("university-local-studies-"), "studies");
    const manifest = createStudy(studiesRoot, { id: "supaluv", title: "SupaLuv" });
    mkdirSync(join(studiesRoot, "Not A Study"));
    expect(discoverStudies(studiesRoot)).toEqual([manifest]);
  });

  it("registers a Git repository without writing to the source", () => {
    const studiesRoot = join(makeRoot("university-local-studies-"), "studies");
    const sourceRoot = makeGitRepository();
    createStudy(studiesRoot, { id: "supaluv", title: "SupaLuv" });
    const before = gitStatus(sourceRoot);

    const result = registerLocalGitSource(
      studiesRoot,
      "supaluv",
      sourceRoot,
      "HEAD",
      new Date("2026-07-20T00:00:00.000Z"),
    );

    expect(result.resolvedCommit).toMatch(/^[a-f0-9]{40}$/);
    expect(readSourceRegistration(studiesRoot, "supaluv")).toEqual(result.registration);
    expect(gitStatus(sourceRoot)).toBe(before);
    expect(() => registerLocalGitSource(studiesRoot, "supaluv", sourceRoot)).toThrow(
      /already registered/,
    );
    expect(() => registerLocalGitSource(studiesRoot, "supaluv", sourceRoot, "-bad-ref")).toThrow(
      /Invalid default ref/,
    );
  });

  it("points a study only at an active, existing default course", () => {
    const studiesRoot = join(makeRoot("university-local-studies-"), "studies");
    createStudy(studiesRoot, { id: "supaluv", title: "SupaLuv" });
    expect(() => setDefaultCourse(studiesRoot, "supaluv", "missing-course")).toThrow();

    writeCourse(studiesRoot, "supaluv", {
      schemaVersion: 1,
      id: "founder-engineer",
      title: "Founder Engineer",
      description: "",
      audience: "Founder",
      objectives: ["Understand the product"],
      unitIds: [],
      status: "draft",
      createdAt: "2026-07-20T00:00:00.000Z",
      updatedAt: "2026-07-20T00:00:00.000Z",
    });
    expect(() => setDefaultCourse(studiesRoot, "supaluv", "founder-engineer")).toThrow(
      /Only an active course/,
    );
    expect(readStudy(studiesRoot, "supaluv").defaultCourseId).toBeNull();

    // A structurally incomplete course cannot be activated, so this test preserves the guard.
    expect(() => updateCourseStatus(studiesRoot, "supaluv", "founder-engineer", "active")).toThrow(
      /without units/,
    );
  });

  it("rejects a source repository inside its studies root", () => {
    const container = makeRoot("university-local-overlap-");
    const studiesRoot = join(container, "studies");
    createStudy(studiesRoot, { id: "nested", title: "Nested" });
    const sourceRoot = join(getStudyPaths(studiesRoot, "nested").root, "nested-source");
    execFileSync("git", ["init", "-q", sourceRoot]);
    expect(() => registerLocalGitSource(studiesRoot, "nested", sourceRoot)).toThrow(
      /must be separate/,
    );
  });

  it("rebinds a moved checkout only after proving every stored snapshot", () => {
    const studiesRoot = join(makeRoot("university-local-studies-"), "studies");
    const sourceRoot = makeGitRepository();
    createStudy(studiesRoot, { id: "portable", title: "Portable" });
    registerLocalGitSource(studiesRoot, "portable", sourceRoot);
    const snapshot = createCleanSnapshot(studiesRoot, "portable");
    const cloneRoot = join(makeRoot("university-local-clone-container-"), "source-clone");
    execFileSync("git", ["clone", "-q", sourceRoot, cloneRoot]);

    const result = rebindLocalGitSource(
      studiesRoot,
      "portable",
      cloneRoot,
      "HEAD",
      new Date("2026-08-17T00:00:00.000Z"),
    );

    expect(result.verifiedSnapshotCount).toBe(1);
    expect(result.resolvedCommit).toBe(snapshot.sourceCommit);
    expect(result.registration.sourceRoot).toBe(realpathSync.native(cloneRoot));
    expect(readSourceRegistration(studiesRoot, "portable")).toEqual(result.registration);
    expect(() => rebindLocalGitSource(studiesRoot, "portable", cloneRoot, "-bad-ref")).toThrow(
      /Invalid default ref/,
    );
  });

  it("refuses to rebind to an unrelated Git repository", () => {
    const studiesRoot = join(makeRoot("university-local-studies-"), "studies");
    const sourceRoot = makeGitRepository();
    createStudy(studiesRoot, { id: "portable", title: "Portable" });
    registerLocalGitSource(studiesRoot, "portable", sourceRoot);
    createCleanSnapshot(studiesRoot, "portable");

    expect(() =>
      rebindLocalGitSource(studiesRoot, "portable", makeGitRepository("# Other source\n")),
    ).toThrow(/cannot prove snapshot.*commit.*missing/i);
    expect(readSourceRegistration(studiesRoot, "portable").sourceRoot).toBe(
      realpathSync.native(sourceRoot),
    );
  });

  it("refuses an unprovable rebind before a study has a snapshot", () => {
    const studiesRoot = join(makeRoot("university-local-studies-"), "studies");
    const sourceRoot = makeGitRepository();
    createStudy(studiesRoot, { id: "portable", title: "Portable" });
    registerLocalGitSource(studiesRoot, "portable", sourceRoot);

    expect(() => rebindLocalGitSource(studiesRoot, "portable", sourceRoot)).toThrow(
      /no immutable snapshots/i,
    );
  });
});

function gitStatus(repository: string): string {
  return execFileSync("git", ["-C", repository, "status", "--porcelain=v1"], {
    encoding: "utf8",
  });
}
