import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { EvidenceReference, KnowledgeNote } from "../../src/domain/schemas.js";
import { getKnowledgeNotePaths, getStudyPaths } from "../studies/paths.js";
import { createStudy, registerLocalGitSource } from "../studies/repository.js";
import { createCleanSnapshot } from "../studies/snapshots.js";
import {
  listActiveKnowledgeCards,
  listKnowledgeNotes,
  markKnowledgeNoteStale,
  readActiveKnowledgeCard,
  readLatestKnowledgeNote,
  writeKnowledgeNoteRevision,
} from "./repository.js";

const STUDY_ID = "sample";
const NOTE_ID = "auth-owner";
const CREATED_AT = "2026-07-20T10:00:00.000Z";

function git(repository: string, args: string[]): string {
  return execFileSync("git", ["-C", repository, ...args], { encoding: "utf8" }).trim();
}

function setup() {
  const container = mkdtempSync(join(tmpdir(), "university-local-knowledge-"));
  const studiesRoot = join(container, "studies");
  const sourceRoot = join(container, "source");
  execFileSync("git", ["init", "-q", sourceRoot]);
  git(sourceRoot, ["config", "user.name", "UniversityLocal Test"]);
  git(sourceRoot, ["config", "user.email", "test@university.local"]);
  writeFileSync(join(sourceRoot, "auth.ts"), "export const owner = 'session-service';\n");
  git(sourceRoot, ["add", "auth.ts"]);
  git(sourceRoot, ["commit", "-q", "-m", "Initial"]);
  createStudy(studiesRoot, { id: STUDY_ID, title: "Sample" });
  registerLocalGitSource(studiesRoot, STUDY_ID, sourceRoot);
  const snapshot = createCleanSnapshot(studiesRoot, STUDY_ID);
  const evidence: EvidenceReference = {
    kind: "fact",
    snapshotId: snapshot.id,
    sourceCommit: snapshot.sourceCommit,
    sourcePath: "auth.ts",
    lineStart: 1,
    lineEnd: 1,
    nodeIds: [],
  };
  return { container, studiesRoot, evidence };
}

function noteCandidate(
  overrides: Partial<Omit<KnowledgeNote, "contentHash">> = {},
): Omit<KnowledgeNote, "contentHash"> {
  return {
    schemaVersion: 1,
    id: NOTE_ID,
    title: "Authentication ownership",
    question: "Which module owns authentication?",
    summary: "The session service owns authentication.",
    claimType: "personal-understanding",
    status: "draft",
    contentRevision: 1,
    tags: ["auth"],
    evidence: [],
    origin: {
      kind: "ai-conversation",
      host: "Grok",
      capturedAt: CREATED_AT,
      captureId: "capture-auth-1",
    },
    cards: [
      {
        id: "auth-owner-card",
        kind: "basic",
        front: "Which module owns authentication?",
        back: "The session service.",
        tags: ["auth"],
      },
    ],
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

const content = "# Authentication ownership\n\nThe session service owns authentication.\n";

describe("atomic knowledge note repository", () => {
  it("stores Markdown as the body truth and JSON/card metadata as an immutable revision", () => {
    const { studiesRoot } = setup();
    const written = writeKnowledgeNoteRevision(studiesRoot, STUDY_ID, {
      note: noteCandidate(),
      content,
    });
    const expectedHash = `sha256:${createHash("sha256").update(content).digest("hex")}`;
    const paths = getKnowledgeNotePaths(studiesRoot, STUDY_ID, NOTE_ID);

    expect(written.contentHash).toBe(expectedHash);
    expect(readFileSync(join(paths.revisions, "1", "content.md"), "utf8")).toBe(content);
    expect(JSON.parse(readFileSync(join(paths.revisions, "1", "note.json"), "utf8"))).toEqual(
      written,
    );
    expect(readLatestKnowledgeNote(studiesRoot, STUDY_ID, NOTE_ID)).toEqual({
      note: written,
      content,
    });
    expect(written).not.toHaveProperty("rawTranscript");
  });

  it("allows evidence-free drafts and personal understanding but gates active source claims", () => {
    const first = setup();
    expect(
      writeKnowledgeNoteRevision(first.studiesRoot, STUDY_ID, {
        note: noteCandidate({ claimType: "source-fact", status: "draft" }),
        content,
      }).status,
    ).toBe("draft");

    const second = setup();
    expect(() =>
      writeKnowledgeNoteRevision(second.studiesRoot, STUDY_ID, {
        note: noteCandidate({ claimType: "source-fact", status: "active" }),
        content,
      }),
    ).toThrow(/requires source evidence/);
    expect(existsSync(getKnowledgeNotePaths(second.studiesRoot, STUDY_ID, NOTE_ID).root)).toBe(
      false,
    );

    const third = setup();
    expect(() =>
      writeKnowledgeNoteRevision(third.studiesRoot, STUDY_ID, {
        note: noteCandidate({ claimType: "inference", status: "active" }),
        content,
      }),
    ).toThrow(/requires source evidence/);

    const fourth = setup();
    expect(
      writeKnowledgeNoteRevision(fourth.studiesRoot, STUDY_ID, {
        note: noteCandidate({ status: "active" }),
        content,
      }).status,
    ).toBe("active");
  });

  it("reuses immutable snapshot validation for every supplied evidence reference", () => {
    const { studiesRoot, evidence } = setup();
    expect(
      writeKnowledgeNoteRevision(studiesRoot, STUDY_ID, {
        note: noteCandidate({
          claimType: "source-fact",
          status: "active",
          evidence: [evidence],
        }),
        content,
      }).evidence,
    ).toEqual([evidence]);

    const invalid = setup();
    expect(() =>
      writeKnowledgeNoteRevision(invalid.studiesRoot, STUDY_ID, {
        note: noteCandidate({
          claimType: "source-fact",
          status: "active",
          evidence: [{ ...invalid.evidence, sourcePath: "missing.ts" }],
        }),
        content,
      }),
    ).toThrow(/does not exist/);
    expect(existsSync(getKnowledgeNotePaths(invalid.studiesRoot, STUDY_ID, NOTE_ID).root)).toBe(
      false,
    );
  });

  it("rejects inference references on a source-fact note", () => {
    const { studiesRoot, evidence } = setup();
    expect(() =>
      writeKnowledgeNoteRevision(studiesRoot, STUDY_ID, {
        note: noteCandidate({
          claimType: "source-fact",
          status: "active",
          evidence: [{ ...evidence, kind: "inference" }],
        }),
        content,
      }),
    ).toThrow(/only use fact evidence/);
  });

  it("is idempotent for the same capture or the same complete teaching content", () => {
    const { studiesRoot } = setup();
    const first = writeKnowledgeNoteRevision(studiesRoot, STUDY_ID, {
      note: noteCandidate(),
      content,
    });
    expect(
      writeKnowledgeNoteRevision(studiesRoot, STUDY_ID, {
        note: noteCandidate(),
        content,
      }),
    ).toEqual(first);

    expect(
      writeKnowledgeNoteRevision(studiesRoot, STUDY_ID, {
        note: noteCandidate({
          contentRevision: 2,
          updatedAt: "2026-07-20T10:05:00.000Z",
          origin: {
            kind: "ai-conversation",
            host: "Codex",
            capturedAt: "2026-07-20T10:05:00.000Z",
            captureId: "capture-auth-duplicate",
          },
        }),
        content,
      }),
    ).toEqual(first);

    const paths = getKnowledgeNotePaths(studiesRoot, STUDY_ID, NOTE_ID);
    expect(readdirSync(paths.revisions).filter((entry) => /^\d+$/.test(entry))).toEqual(["1"]);
    expect(() =>
      writeKnowledgeNoteRevision(studiesRoot, STUDY_ID, {
        note: noteCandidate({
          contentRevision: 2,
          summary: "A conflicting answer.",
        }),
        content: `${content}\nConflict.\n`,
      }),
    ).toThrow(/captureId was already used/);
  });

  it("requires contiguous revisions and preserves lifecycle identity", () => {
    const { studiesRoot } = setup();
    writeKnowledgeNoteRevision(studiesRoot, STUDY_ID, { note: noteCandidate(), content });
    expect(() =>
      writeKnowledgeNoteRevision(studiesRoot, STUDY_ID, {
        note: noteCandidate({
          contentRevision: 3,
          summary: "A newer explanation.",
          updatedAt: "2026-07-20T11:00:00.000Z",
          origin: {
            kind: "ai-conversation",
            host: "Grok",
            capturedAt: "2026-07-20T11:00:00.000Z",
            captureId: "capture-auth-3",
          },
        }),
        content: `${content}\nNew explanation.\n`,
      }),
    ).toThrow(/revision must be 2/);

    const second = writeKnowledgeNoteRevision(studiesRoot, STUDY_ID, {
      note: noteCandidate({
        contentRevision: 2,
        summary: "A clearer explanation.",
        status: "active",
        updatedAt: "2026-07-20T11:00:00.000Z",
        origin: {
          kind: "ai-conversation",
          host: "Grok",
          capturedAt: "2026-07-20T11:00:00.000Z",
          captureId: "capture-auth-2",
        },
      }),
      content: `${content}\nClearer explanation.\n`,
    });
    expect(second.contentRevision).toBe(2);

    expect(() =>
      writeKnowledgeNoteRevision(studiesRoot, STUDY_ID, {
        note: noteCandidate({
          contentRevision: 3,
          createdAt: "2026-07-20T11:00:00.000Z",
          updatedAt: "2026-07-20T12:00:00.000Z",
          summary: "Changed creation time.",
          origin: {
            kind: "ai-conversation",
            host: "Grok",
            capturedAt: "2026-07-20T12:00:00.000Z",
            captureId: "capture-auth-created-at",
          },
        }),
        content: `${content}\nChanged.\n`,
      }),
    ).toThrow(/createdAt must remain stable/);
  });

  it("appends an idempotent source-refresh revision without changing note content", () => {
    const { studiesRoot, evidence } = setup();
    const active = writeKnowledgeNoteRevision(studiesRoot, STUDY_ID, {
      note: noteCandidate({
        claimType: "source-fact",
        status: "active",
        evidence: [evidence],
      }),
      content,
    });
    const reportHash = `sha256:${"a".repeat(64)}`;
    const first = markKnowledgeNoteStale({
      studiesRoot,
      studyId: STUDY_ID,
      noteId: NOTE_ID,
      reportHash,
      now: new Date("2026-07-20T12:00:00.000Z"),
    });
    const stored = readLatestKnowledgeNote(studiesRoot, STUDY_ID, NOTE_ID);

    expect(first.transitioned).toBe(true);
    expect(first.note).toMatchObject({
      status: "stale",
      contentRevision: 2,
      contentHash: active.contentHash,
      origin: {
        kind: "source-refresh",
        host: "UniversityLocal freshness",
        capturedAt: "2026-07-20T12:00:00.000Z",
        captureId: `freshness:${reportHash}:r1`,
      },
    });
    expect(stored.content).toBe(content);
    expect(stored.note.summary).toBe(active.summary);
    expect(stored.note.cards).toEqual(active.cards);
    expect(
      markKnowledgeNoteStale({
        studiesRoot,
        studyId: STUDY_ID,
        noteId: NOTE_ID,
        reportHash,
        now: new Date("2026-07-20T13:00:00.000Z"),
      }),
    ).toEqual({ note: first.note, transitioned: false });
    expect(readdirSync(getKnowledgeNotePaths(studiesRoot, STUDY_ID, NOTE_ID).revisions)).toEqual([
      "1",
      "2",
    ]);
  });

  it("does not rewrite draft, stale, or retired notes during a freshness transition", () => {
    const reportHash = `sha256:${"b".repeat(64)}`;
    for (const status of ["draft", "stale", "retired"] as const) {
      const { studiesRoot } = setup();
      const original = writeKnowledgeNoteRevision(studiesRoot, STUDY_ID, {
        note: noteCandidate({ status }),
        content,
      });
      expect(
        markKnowledgeNoteStale({
          studiesRoot,
          studyId: STUDY_ID,
          noteId: NOTE_ID,
          reportHash,
        }),
      ).toEqual({ note: original, transitioned: false });
      expect(readdirSync(getKnowledgeNotePaths(studiesRoot, STUDY_ID, NOTE_ID).revisions)).toEqual([
        "1",
      ]);
    }
  });

  it("detects body tampering through the stored content hash", () => {
    const { studiesRoot } = setup();
    writeKnowledgeNoteRevision(studiesRoot, STUDY_ID, { note: noteCandidate(), content });
    const paths = getKnowledgeNotePaths(studiesRoot, STUDY_ID, NOTE_ID);
    writeFileSync(join(paths.revisions, "1", "content.md"), "tampered\n");
    expect(() => readLatestKnowledgeNote(studiesRoot, STUDY_ID, NOTE_ID)).toThrow(/hash mismatch/);
  });

  it("ignores crash-left staging and repairs only an exact pending revision retry", () => {
    const { studiesRoot } = setup();
    const paths = getKnowledgeNotePaths(studiesRoot, STUDY_ID, NOTE_ID);
    const staleStaging = join(paths.revisions, ".creating-1-crash");
    mkdirSync(staleStaging, { recursive: true });
    writeFileSync(join(staleStaging, "marker"), "unfinished");
    const first = writeKnowledgeNoteRevision(studiesRoot, STUDY_ID, {
      note: noteCandidate(),
      content,
    });
    expect(readFileSync(join(staleStaging, "marker"), "utf8")).toBe("unfinished");

    rmSync(paths.latest);
    expect(() =>
      writeKnowledgeNoteRevision(studiesRoot, STUDY_ID, {
        note: noteCandidate({ summary: "Conflicting retry." }),
        content: `${content}\nConflict.\n`,
      }),
    ).toThrow(/captureId was already used/);
    expect(existsSync(paths.latest)).toBe(false);
    expect(
      writeKnowledgeNoteRevision(studiesRoot, STUDY_ID, {
        note: noteCandidate(),
        content,
      }),
    ).toEqual(first);
    expect(readLatestKnowledgeNote(studiesRoot, STUDY_ID, NOTE_ID).note).toEqual(first);
  });

  it("blocks revision gaps and never treats staging as a committed revision", () => {
    const { studiesRoot } = setup();
    const paths = getKnowledgeNotePaths(studiesRoot, STUDY_ID, NOTE_ID);
    mkdirSync(join(paths.revisions, "2"), { recursive: true });
    expect(() =>
      writeKnowledgeNoteRevision(studiesRoot, STUDY_ID, {
        note: noteCandidate(),
        content,
      }),
    ).toThrow(/history contains a gap/);
  });

  it("serializes concurrent writers and reclaims a lock left by a dead process", () => {
    const activeWriter = setup();
    const activeLock = join(
      getStudyPaths(activeWriter.studiesRoot, STUDY_ID).notes,
      `.write-${NOTE_ID}.lock`,
    );
    mkdirSync(getStudyPaths(activeWriter.studiesRoot, STUDY_ID).notes, { recursive: true });
    // An actually-running writer: live PID and a lock taken just now.
    writeFileSync(
      activeLock,
      `${JSON.stringify({
        schemaVersion: 1,
        pid: process.pid,
        token: "00000000-0000-4000-8000-000000000000",
        createdAt: new Date().toISOString(),
      })}\n`,
    );
    expect(() =>
      writeKnowledgeNoteRevision(activeWriter.studiesRoot, STUDY_ID, {
        note: noteCandidate(),
        content,
      }),
    ).toThrow(/write is already in progress/);
    expect(existsSync(activeLock)).toBe(true);

    // A crashed writer whose PID the OS has since handed to something else:
    // liveness says "held" forever, so the age limit is the only way out.
    const reusedPidWriter = setup();
    const reusedPidLock = join(
      getStudyPaths(reusedPidWriter.studiesRoot, STUDY_ID).notes,
      `.write-${NOTE_ID}.lock`,
    );
    mkdirSync(getStudyPaths(reusedPidWriter.studiesRoot, STUDY_ID).notes, { recursive: true });
    writeFileSync(
      reusedPidLock,
      `${JSON.stringify({
        schemaVersion: 1,
        pid: process.pid,
        token: "00000000-0000-4000-8000-000000000001",
        createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      })}\n`,
    );
    expect(
      writeKnowledgeNoteRevision(reusedPidWriter.studiesRoot, STUDY_ID, {
        note: noteCandidate(),
        content,
      }),
    ).toMatchObject({ contentRevision: 1 });

    const crashedWriter = setup();
    const staleLock = join(
      getStudyPaths(crashedWriter.studiesRoot, STUDY_ID).notes,
      `.write-${NOTE_ID}.lock`,
    );
    mkdirSync(getStudyPaths(crashedWriter.studiesRoot, STUDY_ID).notes, { recursive: true });
    writeFileSync(
      staleLock,
      `${JSON.stringify({
        schemaVersion: 1,
        pid: 99_999_999,
        token: "00000000-0000-4000-8000-000000000000",
        createdAt: CREATED_AT,
      })}\n`,
    );
    expect(
      writeKnowledgeNoteRevision(crashedWriter.studiesRoot, STUDY_ID, {
        note: noteCandidate(),
        content,
      }).contentRevision,
    ).toBe(1);
    expect(existsSync(staleLock)).toBe(false);
  });

  it("lists notes and exposes derived cards only from active notes", () => {
    const { studiesRoot } = setup();
    const active = writeKnowledgeNoteRevision(studiesRoot, STUDY_ID, {
      note: noteCandidate({ status: "active" }),
      content,
    });
    writeKnowledgeNoteRevision(studiesRoot, STUDY_ID, {
      note: noteCandidate({
        id: "draft-note",
        title: "Draft note",
        status: "draft",
        cards: [
          {
            id: "draft-card",
            kind: "basic",
            front: "Draft?",
            back: "Draft.",
            tags: [],
          },
        ],
        origin: {
          kind: "ai-conversation",
          host: "Grok",
          capturedAt: "2026-07-20T11:00:00.000Z",
          captureId: "capture-draft",
        },
        createdAt: "2026-07-20T11:00:00.000Z",
        updatedAt: "2026-07-20T11:00:00.000Z",
      }),
      content: "# Draft\n",
    });

    expect(listKnowledgeNotes(studiesRoot, STUDY_ID).map((note) => note.id)).toEqual([
      "draft-note",
      NOTE_ID,
    ]);
    expect(listActiveKnowledgeCards(studiesRoot, STUDY_ID)).toEqual([
      { note: active, card: active.cards[0] },
    ]);
    expect(readActiveKnowledgeCard(studiesRoot, STUDY_ID, NOTE_ID, "auth-owner-card")).toEqual({
      note: active,
      card: active.cards[0],
    });
    expect(() =>
      readActiveKnowledgeCard(studiesRoot, STUDY_ID, "draft-note", "draft-card"),
    ).toThrow(/is not active/);
  });

  it("rejects path traversal and unknown raw-conversation fields before writing", () => {
    const { container, studiesRoot } = setup();
    expect(() =>
      writeKnowledgeNoteRevision(studiesRoot, STUDY_ID, {
        note: noteCandidate({ id: "../escape" }),
        content,
      }),
    ).toThrow();
    expect(existsSync(join(container, "escape"))).toBe(false);

    expect(() =>
      writeKnowledgeNoteRevision(studiesRoot, STUDY_ID, {
        note: { ...noteCandidate(), rawTranscript: "Do not persist this chat." } as never,
        content,
      }),
    ).toThrow();
  });
});
