import { describe, expect, it } from "vitest";

import {
  CardContentSchema,
  ChoiceExerciseSchema,
  CourseManifestSchema,
  EvidenceReferenceSchema,
  ExerciseSchema,
  KnowledgeNoteSchema,
  LessonActivityKindSchema,
  LessonActivitySchema,
  SnapshotManifestSchema,
  UaAnalysisManifestSchema,
  UaEngineProvenanceSchema,
} from "./schemas.js";

const commit = "a".repeat(40);
const tree = "b".repeat(40);
const hash = `sha256:${"c".repeat(64)}`;
const now = "2026-07-20T10:00:00.000Z";
const evidence = {
  kind: "fact",
  snapshotId: "git-aaaaaaaaaaaa",
  sourceCommit: commit,
  sourcePath: "src/auth.ts",
  lineStart: 10,
  lineEnd: 20,
  analysisId: "ua-aaaaaaaaaaaa-294-zh",
  graphHash: hash,
  nodeIds: ["auth-service"],
};

describe("study domain schemas", () => {
  it("accepts only clean snapshots and records source-boundary exclusions", () => {
    expect(
      SnapshotManifestSchema.parse({
        schemaVersion: 1,
        id: "git-aaaaaaaaaaaa",
        mode: "clean",
        sourceCommit: commit,
        sourceTree: tree,
        createdAt: now,
        status: "ready",
        toolVersion: "0.1.0",
        excludedPaths: ["docs/external.md"],
        submodulePaths: [],
        lfsPaths: [],
      }).mode,
    ).toBe("clean");
    expect(() =>
      SnapshotManifestSchema.parse({
        schemaVersion: 1,
        id: "working-aaaaaaaaaaaa-deadbeef",
        mode: "working-tree",
        sourceCommit: commit,
        sourceTree: tree,
        trackedDiffHash: hash,
        untrackedManifestHash: hash,
        fingerprint: hash,
        createdAt: now,
        status: "ready",
        toolVersion: "0.1.0",
      }),
    ).toThrow();
  });

  it("binds UA evidence to an immutable graph hash", () => {
    expect(EvidenceReferenceSchema.parse(evidence).analysisId).toBe("ua-aaaaaaaaaaaa-294-zh");
    expect(() => EvidenceReferenceSchema.parse({ ...evidence, graphHash: undefined })).toThrow(
      /supplied together/,
    );
    expect(() =>
      EvidenceReferenceSchema.parse({
        ...evidence,
        analysisId: undefined,
        graphHash: undefined,
      }),
    ).toThrow(/nodeIds require/);
  });

  it("keeps UA analyses independent from source commits", () => {
    const analysis = UaAnalysisManifestSchema.parse({
      schemaVersion: 1,
      id: "ua-aaaaaaaaaaaa-294-zh",
      engine: "understand-anything",
      engineVersion: "2.9.4",
      snapshotId: "git-aaaaaaaaaaaa",
      sourceCommit: commit,
      outputLanguage: "zh",
      configHash: hash,
      graphHash: hash,
      nodeCount: 1453,
      edgeCount: 3256,
      status: "ready",
      createdAt: now,
      completedAt: now,
    });
    expect(analysis.id).not.toBe(analysis.snapshotId);
    expect(analysis.engineProvenance).toBeUndefined();
    expect(
      UaEngineProvenanceSchema.parse({
        source: "user-skill-local-git",
        revision: commit,
        contentHash: hash,
        dirty: false,
        entryPath: "plugin/skills/understand",
      }),
    ).toMatchObject({ revision: commit, dirty: false });
    expect(() =>
      UaEngineProvenanceSchema.parse({
        source: "user-skill-local-git",
        revision: "short",
        contentHash: hash,
        dirty: false,
        entryPath: "/absolute/path",
      }),
    ).toThrow();
  });

  it("keeps the first course contract deliberately small", () => {
    expect(
      CourseManifestSchema.parse({
        schemaVersion: 1,
        id: "founder-engineer",
        title: "Founder Engineer",
        description: "",
        audience: "The owner",
        objectives: ["Understand the system"],
        unitIds: ["system-map"],
        status: "draft",
        createdAt: now,
        updatedAt: now,
      }).id,
    ).toBe("founder-engineer");
    expect(
      ExerciseSchema.parse({
        schemaVersion: 1,
        id: "auth-explanation",
        kind: "short-answer",
        title: "Auth owner",
        courseId: "founder-engineer",
        unitId: "system-map",
        lessonId: "auth-owner",
        prompt: "Which module owns auth?",
        expectedAnswer: "The auth service.",
        contentRevision: 1,
        contentHash: hash,
        status: "draft",
        evidence: [evidence],
      }).kind,
    ).toBe("short-answer");
    expect(
      ChoiceExerciseSchema.parse({
        schemaVersion: 1,
        id: "setting-buttons",
        kind: "choice",
        title: "设置页的按钮",
        courseId: "founder-engineer",
        unitId: "system-map",
        lessonId: "auth-owner",
        prompt: "账号设置页有保存资料、放弃本次修改、删除账号。怎样安排更合适？",
        contentRevision: 1,
        contentHash: hash,
        status: "draft",
        evidence: [evidence],
        correctOptionId: "separate-buttons",
        options: [
          {
            id: "separate-buttons",
            text: "保存、放弃和删除各用一个按钮，删除前再确认。",
            explanation: "三个动作后果不同，各自用明确的按钮。",
          },
          {
            id: "one-confirm",
            text: "用一个确认按钮处理全部操作，点了再猜用户想做什么。",
            explanation: "一个按钮承担三种后果，设置页会变得不可预测。",
          },
          {
            id: "all-links",
            text: "三项都做成链接，点了再跳到别的页去完成。",
            explanation: "链接带走当前页；保存和放弃是留在本页的动作。",
          },
        ],
      }).kind,
    ).toBe("choice");
  });

  it("requires cards to keep content revision separate from learner state", () => {
    const card = CardContentSchema.parse({
      schemaVersion: 1,
      id: "auth-owner",
      kind: "basic",
      courseId: "founder-engineer",
      unitId: "system-map",
      lessonId: "auth-owner",
      front: "Who owns authentication?",
      back: "The auth service.",
      contentRevision: 1,
      contentHash: hash,
      status: "active",
      tags: ["auth"],
      evidence: [evidence],
    });
    expect(card).not.toHaveProperty("due");
    expect(card).not.toHaveProperty("stability");
  });

  it("keeps version-1 knowledge notes with any historical card count readable", () => {
    const knowledgeCard = (id: string) => ({
      id,
      kind: "basic" as const,
      front: `Question ${id}`,
      back: `Answer ${id}`,
      tags: [],
    });
    const note = {
      schemaVersion: 1,
      id: "auth-boundary",
      title: "Authentication boundary",
      question: "Which boundary owns authentication?",
      summary: "Authentication belongs to the session boundary.",
      claimType: "personal-understanding",
      status: "active",
      contentRevision: 1,
      contentHash: hash,
      tags: ["auth"],
      evidence: [],
      origin: {
        kind: "ai-conversation",
        host: "Grok",
        capturedAt: now,
        captureId: "capture-auth-boundary",
      },
      createdAt: now,
      updatedAt: now,
    };

    expect(KnowledgeNoteSchema.parse({ ...note, cards: [] }).cards).toEqual([]);
    expect(
      KnowledgeNoteSchema.parse({
        ...note,
        cards: [knowledgeCard("card-one"), knowledgeCard("card-two"), knowledgeCard("card-three")],
      }).cards,
    ).toHaveLength(3);
    expect(
      KnowledgeNoteSchema.parse({
        ...note,
        cards: [
          knowledgeCard("card-one"),
          knowledgeCard("card-two"),
          knowledgeCard("card-three"),
          knowledgeCard("card-four"),
        ],
      }).cards,
    ).toHaveLength(4);
  });
});

describe("LessonActivitySchema", () => {
  const base = {
    id: "vector-boundary-sort",
    role: "apply",
    title: "别把这三种“变少”混在一起",
    brief: "b",
    goal: "g",
    takeaway: "t",
    hint: "h",
  } as const;

  /**
   * The enum is the wire half of the `Activity` union, and the halves are one
   * list. When they were not, the effect was invisible from either side: the
   * engine, the renderer and the activities gate all knew `sort`, while every
   * attempt to store one came back as a typo. Nothing that already worked
   * broke, so nothing reported it.
   *
   * The halves are held together by `ActivityKindsAgree` in `schemas.ts`,
   * which tsc checks; this only pins the kind the omission cost.
   */
  it("names the eleventh game", () => {
    expect(LessonActivityKindSchema.options).toContain("sort");
  });

  it("stores an activity that cites a place in the studied repository", () => {
    const parsed = LessonActivitySchema.parse({
      ...base,
      kind: "sort",
      source: {
        label: "把一句话收成固定长度的那一行",
        path: "semantic-image-search-web/src/worker.js",
        line: 8,
        commit,
      },
    });
    expect(parsed.source).toMatchObject({ line: 8, commit });
  });

  /**
   * `git-7bdf9a52bbf8` is a snapshot id and `7bdf9a52…` is the commit it pins.
   * Gluing the prefix onto the commit produced a value that read as either one
   * at a glance and rendered in the learner's receipt as `@git-7bdf`.
   */
  it("rejects a snapshot id where the commit belongs", () => {
    const result = LessonActivitySchema.safeParse({
      ...base,
      kind: "sort",
      source: { label: "l", path: "src/worker.js", commit: `git-${commit}` },
    });
    expect(result.success).toBe(false);
  });

  it("still stores a citation that is a page", () => {
    const parsed = LessonActivitySchema.parse({
      ...base,
      kind: "connect",
      source: { label: "l", url: "https://example.com/a" },
    });
    expect(parsed.source).toMatchObject({ url: "https://example.com/a" });
  });
});
