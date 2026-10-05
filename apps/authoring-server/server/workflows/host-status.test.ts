import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { writeCourse } from "../content/repository.js";
import { SqliteLearningStore } from "../learning/sqlite-learning-store.js";
import { getStudyPaths } from "../studies/paths.js";
import { createStudy, registerLocalGitSource } from "../studies/repository.js";
import { createCleanSnapshot } from "../studies/snapshots.js";
import { prepareUaAnalysis } from "../ua/adapter.js";
import { captureKnowledge } from "./capture-knowledge.js";
import { getHostStudyStatus } from "./host-status.js";

const NOW = "2026-07-20T10:00:00.000Z";

function git(repository: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", repository, ...args], { encoding: "utf8" }).trim();
}

function setup() {
  const container = mkdtempSync(join(tmpdir(), "university-local-host-status-"));
  const studiesRoot = join(container, "studies");
  const sourceRoot = join(container, "source");
  execFileSync("git", ["init", "-q", "-b", "main", sourceRoot]);
  git(sourceRoot, ["config", "user.name", "UniversityLocal Test"]);
  git(sourceRoot, ["config", "user.email", "test@university.local"]);
  writeFileSync(join(sourceRoot, "app.ts"), "export const answer = 42;\n");
  git(sourceRoot, ["add", "app.ts"]);
  git(sourceRoot, ["commit", "-q", "-m", "Initial"]);
  createStudy(studiesRoot, { id: "sample", title: "Sample", now: new Date(NOW) });
  registerLocalGitSource(studiesRoot, "sample", sourceRoot, "HEAD", new Date(NOW));
  const snapshot = createCleanSnapshot(studiesRoot, "sample", "HEAD", new Date(NOW));
  return { studiesRoot, sourceRoot, snapshot };
}

function captureDraft(studiesRoot: string): void {
  captureKnowledge({
    studiesRoot,
    studyId: "sample",
    proposal: {
      note: {
        schemaVersion: 1,
        id: "answer-note",
        title: "The answer",
        question: "What is the answer?",
        summary: "The answer is 42.",
        claimType: "personal-understanding",
        status: "draft",
        contentRevision: 1,
        tags: ["answer"],
        evidence: [],
        origin: {
          kind: "ai-conversation",
          host: "Grok",
          capturedAt: NOW,
          captureId: "capture-answer-1",
        },
        cards: [],
        createdAt: NOW,
        updatedAt: NOW,
      },
      content: "# The answer\n\nThe answer is 42.\n",
    },
  });
}

describe("host study status", () => {
  it("reports source, snapshots, UA, courses, notes, and does not create a learner database", () => {
    const { studiesRoot, sourceRoot, snapshot } = setup();
    const paths = getStudyPaths(studiesRoot, "sample");
    writeFileSync(join(sourceRoot, "scratch.ts"), "export const dirty = true;\n");
    prepareUaAnalysis({
      studiesRoot,
      studyId: "sample",
      snapshotId: snapshot.id,
      analysisId: "ua-preparing",
      engineVersion: "2.9.4",
      outputLanguage: "zh",
      now: new Date(NOW),
    });
    writeCourse(studiesRoot, "sample", {
      schemaVersion: 1,
      id: "sample-course",
      title: "Sample course",
      description: "",
      audience: "Owner",
      objectives: ["Understand the sample"],
      unitIds: [],
      status: "draft",
      createdAt: NOW,
      updatedAt: NOW,
    });
    captureDraft(studiesRoot);

    expect(existsSync(paths.learner.database)).toBe(false);
    const status = getHostStudyStatus({ studiesRoot, studyId: "sample" });
    expect(status).toMatchObject({
      operation: "host-status",
      source: {
        branch: "main",
        dirty: true,
        localCommitSufficient: true,
        pushRequiredForRefresh: false,
        refreshBlockedReason: expect.stringContaining("Commit or discard"),
      },
      snapshots: { count: 1, latest: { id: snapshot.id } },
      ua: { counts: { preparing: 1, ready: 0 } },
      courses: { count: 1, byStatus: { draft: 1 } },
      notes: { count: 1, byStatus: { draft: 1 } },
      learner: { databaseExists: false, databaseBytes: 0, openSession: null },
    });
    expect(existsSync(paths.learner.database)).toBe(false);
  });

  it("reads an existing open session and backup inventory without migrating via the workflow", () => {
    const { studiesRoot } = setup();
    const paths = getStudyPaths(studiesRoot, "sample");
    const store = new SqliteLearningStore(paths.learner.database);
    try {
      store.startSession({ host: "Grok", objective: "Understand the source" });
    } finally {
      store.close();
    }
    writeFileSync(join(paths.learner.backups, "owner-backup.sqlite"), "backup-bytes");

    const status = getHostStudyStatus({ studiesRoot, studyId: "sample" });
    expect(status.learner).toMatchObject({
      databaseExists: true,
      openSession: { host: "Grok", objective: "Understand the source" },
      backups: { count: 1, latestName: "owner-backup.sqlite" },
    });
    expect(status.learner.databaseBytes).toBeGreaterThan(0);
    expect(status.learner.openSession?.sessionId).toBeTruthy();
  });
});
