import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { EvidenceReference } from "../../src/domain/schemas.js";
import { writeKnowledgeNoteRevision } from "../knowledge/repository.js";
import { SqliteLearningStore } from "../learning/sqlite-learning-store.js";
import { knowledgeCardContentKey } from "../learning/types.js";
import { getKnowledgeNotePaths, getStudyPaths } from "../studies/paths.js";
import { createStudy, registerLocalGitSource } from "../studies/repository.js";
import { createCleanSnapshot } from "../studies/snapshots.js";
import { captureKnowledge } from "./capture-knowledge.js";

const NOW = "2026-07-20T10:00:00.000Z";

function git(repository: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", repository, ...args], { encoding: "utf8" }).trim();
}

function setup() {
  const container = mkdtempSync(join(tmpdir(), "university-local-capture-workflow-"));
  const studiesRoot = join(container, "studies");
  const sourceRoot = join(container, "source");
  execFileSync("git", ["init", "-q", "-b", "main", sourceRoot]);
  git(sourceRoot, ["config", "user.name", "UniversityLocal Test"]);
  git(sourceRoot, ["config", "user.email", "test@university.local"]);
  writeFileSync(join(sourceRoot, "auth.ts"), "export const owner = 'session-service';\n");
  git(sourceRoot, ["add", "auth.ts"]);
  git(sourceRoot, ["commit", "-q", "-m", "Initial"]);
  createStudy(studiesRoot, { id: "sample", title: "Sample" });
  registerLocalGitSource(studiesRoot, "sample", sourceRoot);
  const snapshot = createCleanSnapshot(studiesRoot, "sample");
  const evidence: EvidenceReference = {
    kind: "fact",
    snapshotId: snapshot.id,
    sourceCommit: snapshot.sourceCommit,
    sourcePath: "auth.ts",
    lineStart: 1,
    lineEnd: 1,
    nodeIds: [],
  };
  return { studiesRoot, sourceRoot, evidence };
}

function proposal(
  options: {
    readonly status?: "draft" | "active";
    readonly evidence?: readonly EvidenceReference[];
    readonly claimType?: "source-fact" | "personal-understanding";
    readonly captureId?: string;
    readonly contentRevision?: number;
    readonly cardCount?: number;
  } = {},
) {
  return {
    note: {
      schemaVersion: 1 as const,
      id: "auth-owner",
      title: "Authentication ownership",
      question: "Which module owns authentication?",
      summary: "The session service owns authentication.",
      claimType: options.claimType ?? "personal-understanding",
      status: options.status ?? "draft",
      contentRevision: options.contentRevision ?? 1,
      tags: ["auth"],
      evidence: [...(options.evidence ?? [])],
      origin: {
        kind: "ai-conversation" as const,
        host: "Grok",
        capturedAt: NOW,
        captureId: options.captureId ?? "capture-auth-1",
      },
      cards: Array.from({ length: options.cardCount ?? 1 }, (_, index) => ({
        id: index === 0 ? "auth-owner-card" : `auth-owner-card-${index + 1}`,
        kind: "basic" as const,
        front: `Which module owns authentication? (${index + 1})`,
        back: "The session service.",
        tags: ["auth"],
      })),
      createdAt: NOW,
      updatedAt: NOW,
    },
    content: "# Authentication ownership\n\nThe session service owns authentication.\n",
  };
}

describe("capture knowledge workflow", () => {
  it("validates a dry run without writing a note or learner database", () => {
    const { studiesRoot } = setup();
    const paths = getStudyPaths(studiesRoot, "sample");
    const receipt = captureKnowledge({
      studiesRoot,
      studyId: "sample",
      proposal: proposal({ status: "active" }),
      dryRun: true,
    });

    expect(receipt).toMatchObject({
      mode: "dry-run",
      disposition: "created",
      revision: 1,
      enrolledCardKeys: [],
      wouldEnrollCardKeys: ["knowledge/auth-owner/auth-owner-card"],
      rawTranscriptStored: false,
    });
    expect(existsSync(getKnowledgeNotePaths(studiesRoot, "sample", "auth-owner").root)).toBe(false);
    expect(existsSync(paths.learner.database)).toBe(false);
  });

  it("limits new captures to three cards without narrowing the version-1 read schema", () => {
    const { studiesRoot } = setup();

    expect(() =>
      captureKnowledge({
        studiesRoot,
        studyId: "sample",
        proposal: proposal({ cardCount: 4 }),
        dryRun: true,
      }),
    ).toThrow(/at most 3 cards/);
    expect(existsSync(getKnowledgeNotePaths(studiesRoot, "sample", "auth-owner").root)).toBe(false);
  });

  it("reuses and recovers an exact legacy capture with more than three cards", () => {
    const { studiesRoot } = setup();
    const legacyProposal = proposal({ cardCount: 4 });
    writeKnowledgeNoteRevision(studiesRoot, "sample", legacyProposal);

    const dryRun = captureKnowledge({
      studiesRoot,
      studyId: "sample",
      proposal: legacyProposal,
      dryRun: true,
    });
    expect(dryRun).toMatchObject({ disposition: "reused", revision: 1 });

    const paths = getKnowledgeNotePaths(studiesRoot, "sample", "auth-owner");
    unlinkSync(paths.latest);
    const recovered = captureKnowledge({
      studiesRoot,
      studyId: "sample",
      proposal: legacyProposal,
    });
    expect(recovered).toMatchObject({ disposition: "reused", revision: 1 });
    expect(existsSync(paths.latest)).toBe(true);
  });

  it("stores drafts without enrollment and enrolls every active derived card", () => {
    const first = setup();
    const draft = captureKnowledge({
      studiesRoot: first.studiesRoot,
      studyId: "sample",
      proposal: proposal(),
    });
    expect(draft).toMatchObject({ mode: "apply", disposition: "created", status: "draft" });
    expect(existsSync(getStudyPaths(first.studiesRoot, "sample").learner.database)).toBe(false);

    const second = setup();
    const active = captureKnowledge({
      studiesRoot: second.studiesRoot,
      studyId: "sample",
      proposal: proposal({ status: "active" }),
      now: new Date(NOW),
    });
    const key = knowledgeCardContentKey({ noteId: "auth-owner", cardId: "auth-owner-card" });
    expect(active.enrolledCardKeys).toEqual([key]);
    const store = new SqliteLearningStore(
      getStudyPaths(second.studiesRoot, "sample").learner.database,
    );
    try {
      expect(store.getCard(key)).toMatchObject({ contentRevision: 1 });
    } finally {
      store.close();
    }
  });

  it("is idempotent for the same noteId and captureId", () => {
    const { studiesRoot } = setup();
    const first = captureKnowledge({ studiesRoot, studyId: "sample", proposal: proposal() });
    const second = captureKnowledge({ studiesRoot, studyId: "sample", proposal: proposal() });
    const revisions = readdirSync(
      getKnowledgeNotePaths(studiesRoot, "sample", "auth-owner").revisions,
    ).filter((entry) => /^\d+$/.test(entry));

    expect(first.disposition).toBe("created");
    expect(second).toMatchObject({ disposition: "reused", revision: 1 });
    expect(revisions).toEqual(["1"]);
  });

  it("validates evidence, rejects raw transcripts, and never mutates the studied source", () => {
    const { studiesRoot, sourceRoot, evidence } = setup();
    writeFileSync(join(sourceRoot, "scratch.ts"), "export const dirty = true;\n");
    const sourceBefore = git(sourceRoot, ["status", "--porcelain=v1"]);
    const receipt = captureKnowledge({
      studiesRoot,
      studyId: "sample",
      proposal: proposal({ status: "active", claimType: "source-fact", evidence: [evidence] }),
    });
    expect(receipt.status).toBe("active");
    expect(git(sourceRoot, ["status", "--porcelain=v1"])).toBe(sourceBefore);

    const invalid = setup();
    expect(() =>
      captureKnowledge({
        studiesRoot: invalid.studiesRoot,
        studyId: "sample",
        proposal: {
          ...proposal(),
          rawTranscript: "User: keep the entire private conversation",
        },
      }),
    ).toThrow();
    expect(() =>
      captureKnowledge({
        studiesRoot: invalid.studiesRoot,
        studyId: "sample",
        proposal: proposal({
          status: "active",
          claimType: "source-fact",
          evidence: [{ ...invalid.evidence, sourcePath: "missing.ts" }],
        }),
      }),
    ).toThrow(/does not exist/);
  });
});
