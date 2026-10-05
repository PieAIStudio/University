import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { inspectImportRisk, MAX_IMPORT_BLOB_BYTES } from "../airlock/import-gate.js";
import { createStudy, registerLocalGitSource } from "./repository.js";
import { getSnapshotPaths, getStudyPaths } from "./paths.js";
import { createCleanSnapshot, openStudyRepository, refreshStudyRepository } from "./snapshots.js";

function git(repository: string, args: string[]): string {
  return execFileSync("git", ["-C", repository, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function bareGit(repository: string, args: string[]): string {
  return execFileSync("git", ["--git-dir", repository, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function makeGitRepository(): string {
  const repository = mkdtempSync(join(tmpdir(), "university-local-snapshot-source-"));
  execFileSync("git", ["init", "-q", repository]);
  git(repository, ["config", "user.name", "UniversityLocal Test"]);
  git(repository, ["config", "user.email", "test@university.local"]);
  writeFileSync(join(repository, "source.txt"), "version one\n");
  git(repository, ["add", "source.txt"]);
  git(repository, ["commit", "-q", "-m", "Initial"]);
  return repository;
}

function setup() {
  const container = mkdtempSync(join(tmpdir(), "university-local-snapshot-"));
  const studiesRoot = join(container, "studies");
  const sourceRoot = makeGitRepository();
  createStudy(studiesRoot, { id: "sample", title: "Sample" });
  registerLocalGitSource(studiesRoot, "sample", sourceRoot);
  return { studiesRoot, sourceRoot };
}

describe("clean snapshots", () => {
  it("stores only an immutable manifest and leaves the source untouched", () => {
    const { studiesRoot, sourceRoot } = setup();
    writeFileSync(join(sourceRoot, "untracked.txt"), "local only\n");
    const before = git(sourceRoot, ["status", "--porcelain=v1"]);

    const manifest = createCleanSnapshot(
      studiesRoot,
      "sample",
      "HEAD",
      new Date("2026-07-20T00:00:00.000Z"),
    );
    const paths = getSnapshotPaths(studiesRoot, "sample", manifest.id);

    expect(manifest.status).toBe("ready");
    expect(manifest.sourceCommit).toBe(git(sourceRoot, ["rev-parse", "HEAD"]));
    expect(manifest.sourceTree).toBe(git(sourceRoot, ["rev-parse", "HEAD^{tree}"]));
    expect(JSON.parse(readFileSync(paths.manifest, "utf8"))).toEqual(manifest);
    expect(existsSync(join(dirname(paths.manifest), manifest.id, "checkout"))).toBe(false);
    expect(git(sourceRoot, ["status", "--porcelain=v1"])).toBe(before);
  });

  it("fetches only an explicitly resolved commit and imports no source refs", () => {
    const { studiesRoot, sourceRoot } = setup();
    const parentCommit = git(sourceRoot, ["rev-parse", "HEAD"]);
    writeFileSync(join(sourceRoot, "source.txt"), "version two\n");
    git(sourceRoot, ["add", "source.txt"]);
    git(sourceRoot, ["commit", "-q", "-m", "Second"]);
    git(sourceRoot, ["tag", "source-tag"]);
    const refresh = refreshStudyRepository(studiesRoot, "sample", "HEAD");
    const repository = openStudyRepository(studiesRoot, "sample");

    expect(refresh.repository).toBe(repository);
    expect(bareGit(repository, ["rev-parse", `${refresh.sourceCommit}^{commit}`])).toBe(
      refresh.sourceCommit,
    );
    expect(
      bareGit(repository, ["for-each-ref", "--format=%(refname)", "refs/heads", "refs/tags"]),
    ).toBe("");
    expect(
      bareGit(repository, ["for-each-ref", "--format=%(refname)", "refs/university-local"]),
    ).toContain(refresh.sourceCommit);
    expect(() => bareGit(repository, ["cat-file", "-e", `${parentCommit}^{commit}`])).toThrow();
    expect(git(sourceRoot, ["tag", "--list"])).toBe("source-tag");
  });

  it("records external symlinks so analysis can exclude them", () => {
    const { studiesRoot, sourceRoot } = setup();
    symlinkSync("../../outside-secret", join(sourceRoot, "external-link"));
    symlinkSync("source.txt", join(sourceRoot, "internal-link"));
    git(sourceRoot, ["add", "external-link", "internal-link"]);
    git(sourceRoot, ["commit", "-q", "-m", "Add symlinks"]);

    const manifest = createCleanSnapshot(studiesRoot, "sample", "HEAD");
    expect(manifest.excludedPaths).toEqual(["external-link"]);
  });

  it("allows the example env file but refuses tracked secret-like paths without exposing content", () => {
    const allowed = setup();
    writeFileSync(join(allowed.sourceRoot, ".env.example"), "TOKEN=replace-me\n");
    mkdirSync(join(allowed.sourceRoot, "mobile"));
    writeFileSync(join(allowed.sourceRoot, "mobile", ".env.json.example"), "TOKEN=replace-me\n");
    git(allowed.sourceRoot, ["add", ".env.example", "mobile/.env.json.example"]);
    git(allowed.sourceRoot, ["commit", "-q", "-m", "Add example env"]);
    expect(createCleanSnapshot(allowed.studiesRoot, "sample", "HEAD").status).toBe("ready");

    const blocked = setup();
    const secretContent = "PRODUCTION_TOKEN=do-not-print\n";
    writeFileSync(join(blocked.sourceRoot, ".env.production"), secretContent);
    mkdirSync(join(blocked.sourceRoot, "keys"));
    writeFileSync(join(blocked.sourceRoot, "keys", "id_ed25519"), "PRIVATE KEY do-not-print\n");
    writeFileSync(
      join(blocked.sourceRoot, ".npmrc"),
      "//registry.example/:_authToken=do-not-print\n",
    );
    git(blocked.sourceRoot, ["add", "-A"]);
    git(blocked.sourceRoot, ["commit", "-q", "-m", "Add tracked credentials"]);

    let message = "";
    try {
      createCleanSnapshot(blocked.studiesRoot, "sample", "HEAD");
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toMatch(/Git tracked tree/);
    expect(message).toMatch(/\.env\.production/);
    expect(message).toMatch(/keys\/id_ed25519/);
    expect(message).toMatch(/\.npmrc/);
    expect(message).toContain("不会读取或输出这些文件的具体内容");
    expect(message).not.toContain(secretContent);
    expect(message).not.toContain("do-not-print");
  });

  it("allows a large committed GLB in a clean snapshot while the airlock gate still rejects its size", () => {
    const { studiesRoot, sourceRoot } = setup();
    mkdirSync(join(sourceRoot, "assets"));
    writeFileSync(
      join(sourceRoot, "assets", "scene.glb"),
      Buffer.alloc(MAX_IMPORT_BLOB_BYTES + 1, 0),
    );
    git(sourceRoot, ["add", "assets/scene.glb"]);
    git(sourceRoot, ["commit", "-q", "-m", "Add study media"]);

    expect(createCleanSnapshot(studiesRoot, "sample", "HEAD").status).toBe("ready");
    expect(
      inspectImportRisk([{ path: "assets/scene.glb", sizeBytes: MAX_IMPORT_BLOB_BYTES + 1 }])
        .blocked,
    ).toEqual([
      {
        path: "assets/scene.glb",
        reason: "单个文件超过 5MB 导入上限",
      },
    ]);
  });

  it("rejects a tracked credential before fetching its commit or blob into the mirror", () => {
    const { studiesRoot, sourceRoot } = setup();
    const first = createCleanSnapshot(studiesRoot, "sample", "HEAD");
    const repository = openStudyRepository(studiesRoot, "sample");

    const secretContent = "PRODUCTION_TOKEN=must-not-enter-the-mirror\n";
    writeFileSync(join(sourceRoot, ".env.production"), secretContent);
    git(sourceRoot, ["add", ".env.production"]);
    git(sourceRoot, ["commit", "-q", "-m", "Add tracked credential"]);
    const blockedCommit = git(sourceRoot, ["rev-parse", "HEAD"]);
    const secretBlob = git(sourceRoot, ["rev-parse", `${blockedCommit}:.env.production`]);

    expect(() => createCleanSnapshot(studiesRoot, "sample", "HEAD")).toThrow(/\.env\.production/);
    expect(bareGit(repository, ["rev-parse", `${first.sourceCommit}^{commit}`])).toBe(
      first.sourceCommit,
    );
    expect(() => bareGit(repository, ["cat-file", "-e", `${blockedCommit}^{commit}`])).toThrow();
    expect(() => bareGit(repository, ["cat-file", "-e", `${secretBlob}^{blob}`])).toThrow();
  });

  it("rejects submodules and Git LFS pointers instead of creating incomplete snapshots", () => {
    const submoduleSetup = setup();
    const submoduleCommit = git(submoduleSetup.sourceRoot, ["rev-parse", "HEAD"]);
    git(submoduleSetup.sourceRoot, [
      "update-index",
      "--add",
      "--cacheinfo",
      `160000,${submoduleCommit},vendor/module`,
    ]);
    git(submoduleSetup.sourceRoot, ["commit", "-q", "-m", "Add gitlink"]);
    expect(() => createCleanSnapshot(submoduleSetup.studiesRoot, "sample", "HEAD")).toThrow(
      /unsupported Git submodules.*vendor\/module/,
    );

    const lfsSetup = setup();
    writeFileSync(
      join(lfsSetup.sourceRoot, "large.bin"),
      [
        "version https://git-lfs.github.com/spec/v1",
        `oid sha256:${"a".repeat(64)}`,
        "size 123456",
        "",
      ].join("\n"),
    );
    git(lfsSetup.sourceRoot, ["add", "large.bin"]);
    git(lfsSetup.sourceRoot, ["commit", "-q", "-m", "Add LFS pointer"]);
    expect(() => createCleanSnapshot(lfsSetup.studiesRoot, "sample", "HEAD")).toThrow(
      /unsupported Git LFS pointers.*large\.bin/,
    );
  });

  it("returns the same immutable snapshot for the same commit", () => {
    const { studiesRoot } = setup();
    const first = createCleanSnapshot(studiesRoot, "sample");
    const second = createCleanSnapshot(studiesRoot, "sample");
    expect(second).toEqual(first);
    expect(getStudyPaths(studiesRoot, "sample").source.repository).toContain("repository.git");
  });
});
