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

import { SqliteLearningStore } from "./learning/sqlite-learning-store.js";
import { writeKnowledgeNoteRevision } from "./knowledge/repository.js";
import { getStudyPaths } from "./studies/paths.js";
import {
  createStudy,
  readSourceRegistration,
  registerLocalGitSource,
} from "./studies/repository.js";
import { createCleanSnapshot } from "./studies/snapshots.js";
import { executeUniversityLocalCli, main, parseUniversityLocalCli } from "./cli.js";

const STUDY_ID = "sample-study";

function setupCliStudy(): { readonly projectRoot: string; readonly studiesRoot: string } {
  const projectRoot = join(mkdtempSync(join(tmpdir(), "university-local-cli-")), "project");
  const studiesRoot = join(projectRoot, "studies");
  mkdirSync(projectRoot);
  writeFileSync(
    join(projectRoot, "university-local.config.json"),
    `${JSON.stringify({ schemaVersion: 1, studiesRoot: "./studies" })}\n`,
  );
  createStudy(studiesRoot, { id: STUDY_ID, title: "Sample Study" });
  return { projectRoot, studiesRoot };
}

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected an object result");
  }
  return value as Record<string, unknown>;
}

describe("UniversityLocal CLI parser", () => {
  it.each([
    [["status", "--study", "supaluv"], { kind: "status", studyId: "supaluv" }],
    [
      ["capture", "--study", "supaluv", "--input", "capture.json", "--dry-run"],
      {
        kind: "capture",
        studyId: "supaluv",
        inputPath: "capture.json",
        dryRun: true,
      },
    ],
    [["knowledge", "list", "--study", "supaluv"], { kind: "knowledge-list", studyId: "supaluv" }],
    [
      ["refresh", "prepare", "--study", "supaluv", "--ref", "HEAD", "--acknowledge-dirty-excluded"],
      {
        kind: "refresh-prepare",
        studyId: "supaluv",
        reference: "HEAD",
        acknowledgeDirtyExcluded: true,
      },
    ],
    [
      ["refresh", "finalize", "--study", "supaluv", "--analysis", "ua-analysis"],
      { kind: "refresh-finalize", studyId: "supaluv", analysisId: "ua-analysis" },
    ],
    [
      ["refresh", "verify", "--study", "supaluv", "--analysis", "ua-analysis"],
      { kind: "refresh-verify", studyId: "supaluv", analysisId: "ua-analysis" },
    ],
    [
      [
        "refresh",
        "retire",
        "--study",
        "supaluv",
        "--analysis",
        "ua-analysis",
        "--reason",
        "template collapse",
        "--superseded-by",
        "ua-successor",
        "--force",
      ],
      {
        kind: "refresh-retire",
        studyId: "supaluv",
        analysisId: "ua-analysis",
        reason: "template collapse",
        supersededBy: "ua-successor",
        force: true,
      },
    ],
    [
      [
        "refresh",
        "audit",
        "--study",
        "supaluv",
        "--snapshot",
        "git-aaaaaaaaaaaa",
        "--analysis",
        "ua-analysis",
        "--apply",
      ],
      {
        kind: "refresh-audit",
        studyId: "supaluv",
        snapshotId: "git-aaaaaaaaaaaa",
        analysisId: "ua-analysis",
        apply: true,
      },
    ],
    [
      ["course", "create", "--study", "turing-pact", "--input", "course.json"],
      {
        kind: "course-create",
        studyId: "turing-pact",
        inputPath: "course.json",
        dryRun: false,
      },
    ],
    [
      ["course", "create", "--study", "turing-pact", "--input", "course.json", "--dry-run"],
      {
        kind: "course-create",
        studyId: "turing-pact",
        inputPath: "course.json",
        dryRun: true,
      },
    ],
    [
      ["course", "revise", "--study", "supaluv", "--input", "revision.json", "--dry-run"],
      {
        kind: "course-revise",
        studyId: "supaluv",
        inputPath: "revision.json",
        dryRun: true,
      },
    ],
    [
      [
        "course",
        "reactivate",
        "--study",
        "supaluv",
        "--course",
        "founder-engineer",
        "--snapshot",
        "git-aaaaaaaaaaaa",
        "--analysis",
        "ua-analysis",
      ],
      {
        kind: "course-reactivate",
        studyId: "supaluv",
        courseId: "founder-engineer",
        snapshotId: "git-aaaaaaaaaaaa",
        analysisId: "ua-analysis",
      },
    ],
    [
      ["course", "set-default", "--study", "supaluv", "--course", "ai-cost-and-boundaries"],
      {
        kind: "course-set-default",
        studyId: "supaluv",
        courseId: "ai-cost-and-boundaries",
      },
    ],
    [
      ["course", "open-for-edit", "--study", "supaluv", "--course", "ai-cost-and-boundaries"],
      {
        kind: "course-open-for-edit",
        studyId: "supaluv",
        courseId: "ai-cost-and-boundaries",
      },
    ],
    [
      ["course", "add-lessons", "--study", "supaluv", "--input", "lessons.json", "--dry-run"],
      {
        kind: "course-add-lessons",
        studyId: "supaluv",
        inputPath: "lessons.json",
        dryRun: true,
      },
    ],
    [
      [
        "course",
        "set-prerequisites",
        "--study",
        "turing-pact",
        "--course",
        "foundations-terrain",
        "--requires",
        "foundations-before-zero",
      ],
      {
        kind: "course-set-prerequisites",
        studyId: "turing-pact",
        courseId: "foundations-terrain",
        prerequisiteCourseIds: ["foundations-before-zero"],
      },
    ],
    [
      // Omitting --requires clears the list, same as an empty focus run.
      ["course", "set-prerequisites", "--study", "turing-pact", "--course", "foundations-terrain"],
      {
        kind: "course-set-prerequisites",
        studyId: "turing-pact",
        courseId: "foundations-terrain",
        prerequisiteCourseIds: [],
      },
    ],
    [
      ["focus", "set", "--study", "turing-pact", "--course", "contracts-and-drift"],
      { kind: "focus-set", studyId: "turing-pact", courseIds: ["contracts-and-drift"] },
    ],
    [
      // A run, in the order it was typed — and a stray space after a comma is
      // a typing habit, not a different course.
      ["focus", "set", "--study", "turing-pact", "--course", "state-and-process, testing-strategy"],
      {
        kind: "focus-set",
        studyId: "turing-pact",
        courseIds: ["state-and-process", "testing-strategy"],
      },
    ],
    [
      ["focus", "set", "--study", "turing-pact"],
      { kind: "focus-set", studyId: "turing-pact", courseIds: [] },
    ],
    [["focus", "show"], { kind: "focus-show" }],
    [["focus", "clear"], { kind: "focus-clear" }],
    [["teach", "next"], { kind: "teach-next" }],
    [
      [
        "session",
        "start",
        "--study",
        "supaluv",
        "--host",
        "grok-build",
        "--objective",
        "Understand auth",
      ],
      {
        kind: "session-start",
        studyId: "supaluv",
        host: "grok-build",
        objective: "Understand auth",
      },
    ],
    [["session", "status", "--study", "supaluv"], { kind: "session-status", studyId: "supaluv" }],
    [
      ["session", "end", "--study", "supaluv", "--session", "session-123"],
      { kind: "session-end", studyId: "supaluv", sessionId: "session-123" },
    ],
    [["learner", "backup", "--study", "supaluv"], { kind: "learner-backup", studyId: "supaluv" }],
    [
      ["learner", "reset", "--study", "supaluv", "--confirm", "supaluv"],
      { kind: "learner-reset", studyId: "supaluv", confirmStudyId: "supaluv" },
    ],
    [
      ["learner", "restore", "--study", "supaluv", "--from", "/tmp/backup.sqlite"],
      { kind: "learner-restore", studyId: "supaluv", fromPath: "/tmp/backup.sqlite" },
    ],
  ] as const)("parses %j", (argv, expected) => {
    expect(parseUniversityLocalCli(argv)).toEqual(expected);
  });

  it("rejects missing, unknown, and command-specific options", () => {
    expect(() => parseUniversityLocalCli(["status"])).toThrow(/--study/);
    expect(() => parseUniversityLocalCli(["unknown", "--study", "supaluv"])).toThrow(
      /Unknown command/,
    );
    expect(() => parseUniversityLocalCli(["status", "--study", "supaluv", "--apply"])).toThrow(
      /does not belong/,
    );
    expect(() =>
      parseUniversityLocalCli([
        "knowledge",
        "list",
        "--study",
        "supaluv",
        "--input",
        "capture.json",
      ]),
    ).toThrow(/does not belong/);
    expect(() =>
      parseUniversityLocalCli(["refresh", "prepare", "--study", "supaluv", "--acknowledge-dirty"]),
    ).toThrow();
    expect(() =>
      parseUniversityLocalCli(["learner", "backup", "--study", "supaluv", "--confirm", "supaluv"]),
    ).toThrow(/does not belong/);
    expect(() =>
      parseUniversityLocalCli(["session", "start", "--study", "supaluv", "--host", "grok-build"]),
    ).toThrow(/--objective/);
    expect(() =>
      parseUniversityLocalCli([
        "course",
        "revise",
        "--study",
        "supaluv",
        "--input",
        "revision.json",
        "--snapshot",
        "git-aaaaaaaaaaaa",
      ]),
    ).toThrow(/does not belong/);
    expect(() =>
      parseUniversityLocalCli([
        "course",
        "reactivate",
        "--study",
        "supaluv",
        "--course",
        "founder-engineer",
      ]),
    ).toThrow(/--snapshot/);
  });

  it("returns a non-zero beginner-readable error without throwing from main", async () => {
    let stdout = "";
    let stderr = "";
    const exitCode = await main(["status"], {
      io: {
        stdout: { write: (value) => (stdout += value) },
        stderr: { write: (value) => (stderr += value) },
      },
    });
    expect(exitCode).toBe(2);
    expect(stdout).toBe("");
    expect(JSON.parse(stderr)).toMatchObject({
      ok: false,
      error: expect.stringContaining("--study"),
      hint: expect.stringContaining("--help"),
    });
  });

  it("routes session commands through the session workflow", async () => {
    const { projectRoot, studiesRoot } = setupCliStudy();
    const database = getStudyPaths(studiesRoot, STUDY_ID).learner.database;

    const emptyStatus = record(
      await executeUniversityLocalCli({
        projectRoot,
        command: { kind: "session-status", studyId: STUDY_ID },
      }),
    );
    expect(emptyStatus).toMatchObject({
      operation: "session-status",
      databaseExists: false,
      openSession: null,
    });
    expect(existsSync(database)).toBe(false);

    const started = record(
      await executeUniversityLocalCli({
        projectRoot,
        command: {
          kind: "session-start",
          studyId: STUDY_ID,
          host: "grok-build",
          objective: "Understand authentication",
        },
      }),
    );
    expect(started).toMatchObject({
      operation: "session-start",
      sessionId: expect.any(String),
      session: { host: "grok-build", objective: "Understand authentication" },
    });

    const ended = record(
      await executeUniversityLocalCli({
        projectRoot,
        command: { kind: "session-end", studyId: STUDY_ID },
      }),
    );
    expect(ended).toMatchObject({
      operation: "session-end",
      summary: { sessionId: started["sessionId"], host: "grok-build" },
    });
  });

  it("reads the next teaching context without creating a learner database", async () => {
    const { projectRoot, studiesRoot } = setupCliStudy();
    const database = getStudyPaths(studiesRoot, STUDY_ID).learner.database;

    const result = record(
      await executeUniversityLocalCli({
        projectRoot,
        command: { kind: "teach-next" },
      }),
    );

    expect(result).toMatchObject({
      operation: "teach-next",
      teachingStudyId: STUDY_ID,
      nextLesson: null,
      openSession: null,
    });
    expect(existsSync(database)).toBe(false);
  });

  it("lists stable minimal knowledge metadata without teaching content or card answers", async () => {
    const { projectRoot, studiesRoot } = setupCliStudy();
    const makeNote = (input: {
      readonly id: string;
      readonly title: string;
      readonly updatedAt: string;
      readonly cardBack: string;
    }) => ({
      schemaVersion: 1 as const,
      id: input.id,
      title: input.title,
      question: `Question for ${input.title}`,
      summary: `Summary for ${input.title}`,
      claimType: "personal-understanding" as const,
      status: "active" as const,
      contentRevision: 1,
      tags: ["learning"],
      evidence: [],
      origin: {
        kind: "ai-conversation" as const,
        host: "Grok",
        capturedAt: input.updatedAt,
        captureId: `capture-${input.id}`,
      },
      cards: [
        {
          id: `${input.id}-card`,
          kind: "basic" as const,
          front: `Card question for ${input.title}`,
          back: input.cardBack,
          tags: ["learning"],
        },
      ],
      createdAt: input.updatedAt,
      updatedAt: input.updatedAt,
    });
    writeKnowledgeNoteRevision(studiesRoot, STUDY_ID, {
      note: makeNote({
        id: "zeta-note",
        title: "Zeta note",
        updatedAt: "2026-07-20T10:00:00.000Z",
        cardBack: "PRIVATE_ZETA_CARD_ANSWER",
      }),
      content: "# Zeta\n\nPRIVATE_ZETA_TEACHING_CONTENT\n",
    });
    writeKnowledgeNoteRevision(studiesRoot, STUDY_ID, {
      note: makeNote({
        id: "alpha-note",
        title: "Alpha note",
        updatedAt: "2026-07-20T11:00:00.000Z",
        cardBack: "PRIVATE_ALPHA_CARD_ANSWER",
      }),
      content: "# Alpha\n\nPRIVATE_ALPHA_TEACHING_CONTENT\n",
    });

    const result = await executeUniversityLocalCli({
      projectRoot,
      command: { kind: "knowledge-list", studyId: STUDY_ID },
    });

    expect(result).toEqual({
      schemaVersion: 1,
      operation: "knowledge-list",
      studyId: STUDY_ID,
      notes: [
        {
          id: "alpha-note",
          title: "Alpha note",
          question: "Question for Alpha note",
          summary: "Summary for Alpha note",
          tags: ["learning"],
          status: "active",
          contentRevision: 1,
        },
        {
          id: "zeta-note",
          title: "Zeta note",
          question: "Question for Zeta note",
          summary: "Summary for Zeta note",
          tags: ["learning"],
          status: "active",
          contentRevision: 1,
        },
      ],
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("PRIVATE_");
    expect(serialized).not.toContain("cards");
    expect(serialized).not.toContain("origin");
  });

  it("routes guarded learner backup, reset, and exact-file restore without bypassing confirmation", async () => {
    const { projectRoot, studiesRoot } = setupCliStudy();
    const paths = getStudyPaths(studiesRoot, STUDY_ID);
    await executeUniversityLocalCli({
      projectRoot,
      command: {
        kind: "session-start",
        studyId: STUDY_ID,
        host: "grok-build",
        objective: "Preserve this session",
      },
    });
    await executeUniversityLocalCli({
      projectRoot,
      command: { kind: "session-end", studyId: STUDY_ID },
    });

    const backup = record(
      await executeUniversityLocalCli({
        projectRoot,
        command: { kind: "learner-backup", studyId: STUDY_ID },
      }),
    );
    const backupPath = backup["databasePath"];
    expect(backup).toMatchObject({ operation: "backup", studyId: STUDY_ID, integrityCheck: "ok" });
    expect(backupPath).toEqual(expect.any(String));
    expect(existsSync(backupPath as string)).toBe(true);

    const backupCount = readdirSync(paths.learner.backups).filter((entry) =>
      entry.endsWith(".sqlite"),
    ).length;
    await expect(
      executeUniversityLocalCli({
        projectRoot,
        command: {
          kind: "learner-reset",
          studyId: STUDY_ID,
          confirmStudyId: `wrong-${STUDY_ID}`,
        },
      }),
    ).rejects.toThrow(/exactly equal/);
    expect(
      readdirSync(paths.learner.backups).filter((entry) => entry.endsWith(".sqlite")),
    ).toHaveLength(backupCount);

    const reset = record(
      await executeUniversityLocalCli({
        projectRoot,
        command: {
          kind: "learner-reset",
          studyId: STUDY_ID,
          confirmStudyId: STUDY_ID,
        },
      }),
    );
    expect(reset).toMatchObject({
      operation: "reset",
      preResetBackup: { purpose: "pre-reset" },
      activeCardReenrollmentRequired: true,
    });
    const empty = new SqliteLearningStore(paths.learner.database);
    expect(empty.listSessions()).toEqual([]);
    empty.close();

    const restored = record(
      await executeUniversityLocalCli({
        projectRoot,
        command: {
          kind: "learner-restore",
          studyId: STUDY_ID,
          fromPath: backupPath as string,
        },
      }),
    );
    expect(restored).toMatchObject({
      operation: "restore",
      candidatePath: backupPath,
      preRestoreBackup: { purpose: "pre-restore" },
      activeCardReenrollmentRequired: false,
    });
    const installed = new SqliteLearningStore(paths.learner.database);
    expect(installed.listSessions()).toHaveLength(1);
    installed.close();
  });
});

describe("study and airlock verbs", () => {
  it("parses study create with its source path", () => {
    expect(
      parseUniversityLocalCli([
        "study",
        "create",
        "--study",
        "university-local",
        "--title",
        "UniversityLocal 自身",
        "--source",
        "/tmp/ul-airlock",
      ]),
    ).toEqual({
      kind: "study-create",
      studyId: "university-local",
      title: "UniversityLocal 自身",
      sourceRoot: "/tmp/ul-airlock",
    });
  });

  /*
    It used to require `--source`, and that requirement was the reason 通用课 had
    nowhere to live: a course whose citations are MDN and the W3C is about no
    repository at all, and the only way past the check was to invent a snapshot
    — which would have made "every citation points at real lines in the studied
    code" false for every study on the shelf.
  */
  it("creates a study with no repository when no source is given", () => {
    expect(
      parseUniversityLocalCli(["study", "create", "--study", "general", "--title", "通用课"]),
    ).toEqual({
      kind: "study-create",
      studyId: "general",
      title: "通用课",
    });
  });

  it("parses a source rebind without conflating it with study creation", () => {
    expect(
      parseUniversityLocalCli([
        "study",
        "source",
        "rebind",
        "--study",
        "turing-pact",
        "--source",
        "/tmp/turing-pact-clone",
        "--ref",
        "main",
      ]),
    ).toEqual({
      kind: "study-source-rebind",
      studyId: "turing-pact",
      sourceRoot: "/tmp/turing-pact-clone",
      reference: "main",
    });
  });

  it("wires source rebind through the CLI after immutable snapshot proof", async () => {
    const { projectRoot, studiesRoot } = setupCliStudy();
    const sourceRoot = mkdtempSync(join(tmpdir(), "university-local-cli-source-"));
    execFileSync("git", ["init", "-q", sourceRoot]);
    execFileSync("git", ["-C", sourceRoot, "config", "user.name", "UniversityLocal Test"]);
    execFileSync("git", ["-C", sourceRoot, "config", "user.email", "test@university.local"]);
    writeFileSync(join(sourceRoot, "README.md"), "# CLI source rebind\n");
    execFileSync("git", ["-C", sourceRoot, "add", "README.md"]);
    execFileSync("git", ["-C", sourceRoot, "commit", "-q", "-m", "Initial"]);
    registerLocalGitSource(studiesRoot, STUDY_ID, sourceRoot);
    createCleanSnapshot(studiesRoot, STUDY_ID);
    const cloneRoot = join(mkdtempSync(join(tmpdir(), "university-local-cli-clone-")), "source");
    execFileSync("git", ["clone", "-q", sourceRoot, cloneRoot]);

    const result = record(
      await executeUniversityLocalCli({
        projectRoot,
        command: {
          kind: "study-source-rebind",
          studyId: STUDY_ID,
          sourceRoot: cloneRoot,
        },
      }),
    );

    expect(result).toMatchObject({
      operation: "study-source-rebind",
      studyId: STUDY_ID,
      verifiedSnapshotCount: 1,
    });
    expect(readSourceRegistration(studiesRoot, STUDY_ID).sourceRoot).toBe(
      realpathSync.native(cloneRoot),
    );
  });

  it("parses airlock promote with the dirty acknowledgement", () => {
    expect(
      parseUniversityLocalCli([
        "airlock",
        "promote",
        "--airlock",
        "/tmp/air",
        "--upstream",
        "/tmp/up",
        "--acknowledge-dirty-excluded",
      ]),
    ).toEqual({
      kind: "airlock-promote",
      airlockRoot: "/tmp/air",
      upstreamRoot: "/tmp/up",
      acknowledgeDirtyExcluded: true,
    });
  });

  it("separates the airlock gate from the airlock report", () => {
    expect(parseUniversityLocalCli(["airlock", "doctor", "--airlock", "/tmp/air"])).toEqual({
      kind: "airlock-doctor",
      airlockRoot: "/tmp/air",
    });
    expect(parseUniversityLocalCli(["airlock", "status", "--airlock", "/tmp/air"])).toEqual({
      kind: "airlock-status",
      airlockRoot: "/tmp/air",
    });
  });

  /**
   * `--study` earns its place on the airlock verbs: it names the shelf whose
   * course clock is being compared against the seal. Options that mean nothing
   * to an airlock still have to be refused rather than ignored.
   */
  it("accepts the study whose courses are being checked, and nothing else", () => {
    expect(
      parseUniversityLocalCli([
        "airlock",
        "doctor",
        "--airlock",
        "/tmp/air",
        "--study",
        "turing-pact",
      ]),
    ).toEqual({ kind: "airlock-doctor", airlockRoot: "/tmp/air", studyId: "turing-pact" });

    expect(() =>
      parseUniversityLocalCli([
        "airlock",
        "status",
        "--airlock",
        "/tmp/air",
        "--course",
        "foundations",
      ]),
    ).toThrow(/--course/);
  });
});
