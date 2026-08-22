import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  bakeLessonEvidence,
  BUZZ_ATTRIBUTION,
  hasAnyStudyRepository,
  inferSnippetLanguage,
  studyRepository,
  windowCitedRange,
} from "./bake-evidence.mjs";

const trash = [];

afterEach(() => {
  for (const path of trash.splice(0)) rmSync(path, { recursive: true, force: true });
});

function sha(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "W7",
      GIT_AUTHOR_EMAIL: "w7@test",
      GIT_COMMITTER_NAME: "W7",
      GIT_COMMITTER_EMAIL: "w7@test",
    },
  });
}

function makeStudyShelf(files) {
  const root = mkdtempSync(join(tmpdir(), "w7-studies-"));
  const work = mkdtempSync(join(tmpdir(), "w7-work-"));
  trash.push(root, work);
  git(work, ["init"]);
  git(work, ["config", "user.email", "w7@test"]);
  git(work, ["config", "user.name", "W7"]);
  git(work, ["config", "commit.gpgsign", "false"]);
  for (const [path, contents] of Object.entries(files)) {
    const full = join(work, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, contents);
  }
  git(work, ["add", "-A"]);
  git(work, ["commit", "-m", "init"]);
  const commit = git(work, ["rev-parse", "HEAD"]).toString().trim();
  const studyId = "sample";
  mkdirSync(join(root, studyId, "source"), { recursive: true });
  git(work, ["clone", "--bare", "--quiet", work, join(root, studyId, "source", "repository.git")]);
  return { root, commit, studyId };
}

describe("bake-evidence", () => {
  it("windows the cited range with five lines of context", () => {
    expect(windowCitedRange(40, 10, 12, 5)).toEqual({
      startLine: 5,
      endLine: 17,
      highlightStartLine: 10,
      highlightEndLine: 12,
    });
  });

  it("infers language from the cited path", () => {
    expect(inferSnippetLanguage("apps/web/src/main.ts")).toBe("typescript");
    expect(inferSnippetLanguage("VISION.md")).toBe("markdown");
  });

  it("bakes nothing when the studies shelf has no checkout", () => {
    const empty = mkdtempSync(join(tmpdir(), "w7-empty-"));
    trash.push(empty);
    expect(hasAnyStudyRepository(empty)).toBe(false);
    expect(studyRepository(empty, "buzz")).toBeNull();
    const evidence = [
      {
        sourceCommit: "abc",
        sourcePath: "a.ts",
        lineStart: 1,
        lineEnd: 2,
      },
    ];
    const stats = bakeLessonEvidence({
      studiesRoot: empty,
      studyId: "buzz",
      courseId: "demo",
      evidence,
      contentRoot: join(empty, "content"),
      sha,
    });
    expect(stats).toEqual({ baked: 0, skipped: 1, bytes: 0, files: 0 });
    expect(evidence[0]).not.toHaveProperty("snippetUrl");
  });

  it("writes a content-addressed snippet and stamps snippetUrl", () => {
    const lines = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`).join("\n");
    const { root, commit, studyId } = makeStudyShelf({ "src/app.ts": `${lines}\n` });
    const contentRoot = mkdtempSync(join(tmpdir(), "w7-content-"));
    trash.push(contentRoot);
    const evidence = [
      {
        sourceCommit: commit,
        sourcePath: "src/app.ts",
        lineStart: 10,
        lineEnd: 12,
      },
    ];
    const stats = bakeLessonEvidence({
      studiesRoot: root,
      studyId,
      courseId: "demo",
      evidence,
      contentRoot,
      sha,
    });
    expect(stats.baked).toBe(1);
    expect(stats.skipped).toBe(0);
    expect(stats.files).toBe(1);
    expect(evidence[0]?.snippetUrl).toMatch(/^\/content\/sample\/demo\/evidence\/[a-f0-9]{64}\.json$/);
  });

  it("puts Apache-2.0 attribution on baked buzz snippets", () => {
    const { root, commit } = makeStudyShelf({ "VISION.md": "one\ntwo\nthree\n" });
    const contentRoot = mkdtempSync(join(tmpdir(), "w7-content-"));
    trash.push(contentRoot);
    mkdirSync(join(root, "buzz", "source"), { recursive: true });
    execFileSync("git", [
      "clone",
      "--bare",
      "--quiet",
      join(root, "sample", "source", "repository.git"),
      join(root, "buzz", "source", "repository.git"),
    ]);
    const evidence = [{ sourceCommit: commit, sourcePath: "VISION.md", lineStart: 2, lineEnd: 2 }];
    bakeLessonEvidence({
      studiesRoot: root,
      studyId: "buzz",
      courseId: "orientation",
      evidence,
      contentRoot,
      sha,
    });
    expect(evidence[0]?.snippetUrl).toBeDefined();
    const url = String(evidence[0].snippetUrl);
    const file = join(contentRoot, url.replace(/^\/content\//, ""));
    const body = JSON.parse(readFileSync(file, "utf8"));
    expect(body.attribution).toBe(BUZZ_ATTRIBUTION);
    expect(body.code.split("\n")).toContain("two");
  });
});
