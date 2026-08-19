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
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import { validateEvidence } from "../server/content/evidence.js";
import {
  readCourse,
  readLatestCard,
  readLatestExercise,
  readLatestLesson,
  readUnit,
  updateCourseStatus,
  updateUnitStatus,
  writeCardRevision,
  writeCourse,
  writeExerciseRevision,
  writeLessonRevision,
  writeUnit,
} from "../server/content/repository.js";
import {
  getCoursePaths,
  getLessonPaths,
  getSnapshotPaths,
  getStudyPaths,
  getUaAnalysisPaths,
  getUnitPaths,
} from "../server/studies/paths.js";
import {
  createStudy,
  readStudy,
  registerLocalGitSource,
  setDefaultCourse,
} from "../server/studies/repository.js";
import { createCleanSnapshot } from "../server/studies/snapshots.js";
import { finalizeUaAnalysis, prepareUaAnalysis } from "../server/ua/adapter.js";
import { SnapshotManifestSchema, UaAnalysisManifestSchema } from "../src/domain/schemas.js";
import {
  COURSE_IDS,
  SUPALUV_ANALYSIS_ID,
  buildSupaluvCourseDefinition,
  createSupaluvCourse,
} from "./create-supaluv-course.mjs";

const ANALYSIS_CREATED_AT = new Date("2026-07-20T10:00:00.000Z");
const GENERATED_AT = "2026-07-20T10:01:00.000Z";
const ANALYSIS_COMPLETED_AT = new Date("2026-07-20T10:02:00.000Z");

const REQUIRED_GRAPH_NODES = [
  {
    id: "document:README.md",
    type: "document",
    filePath: "README.md",
  },
  {
    id: "file:apps/web/src/story/inkStoryRunner.ts",
    type: "file",
    filePath: "apps/web/src/story/inkStoryRunner.ts",
  },
  {
    id: "class:apps/web/src/story/inkStoryRunner.ts:InkStoryRunner",
    type: "class",
    filePath: "apps/web/src/story/inkStoryRunner.ts",
  },
  {
    id: "file:apps/web/src/ai/aiBranchTypes.ts",
    type: "file",
    filePath: "apps/web/src/ai/aiBranchTypes.ts",
  },
  {
    id: "file:services/ai-branch/src/branch/mastraBranch.ts",
    type: "file",
    filePath: "services/ai-branch/src/branch/mastraBranch.ts",
  },
  {
    id: "function:services/ai-branch/src/branch/mastraBranch.ts:generateAiBranchWithMastra",
    type: "function",
    filePath: "services/ai-branch/src/branch/mastraBranch.ts",
  },
];

function git(repository: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", repository, ...args], { encoding: "utf8" }).trim();
}

function sourceWithLines(total: number, replacements: Readonly<Record<number, string>>): string {
  const lines = Array.from({ length: total }, (_, index) => `// fixture line ${index + 1}`);
  for (const [line, content] of Object.entries(replacements)) {
    lines[Number(line) - 1] = content;
  }
  return `${lines.join("\n")}\n`;
}

function writeSourceFile(sourceRoot: string, path: string, content: string): void {
  const target = join(sourceRoot, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function createEvidenceSource(sourceRoot: string): void {
  writeSourceFile(
    sourceRoot,
    "README.md",
    sourceWithLines(30, {
      3: "SupaLuv 是一款独立的 AI 互动电影。",
      18: "- React + Vite + TypeScript：Web 应用与界面",
      19: "- Ink / InkJS：作者主线剧情",
      20: "- Mastra + SwimmerAIKit：受约束 AI 剧情与生成能力",
      26: "表现层以立绘、场景、镜头运动、音频和文字节奏为主。",
    }),
  );
  writeSourceFile(
    sourceRoot,
    "apps/web/src/story/inkStoryRunner.ts",
    sourceWithLines(224, {
      123: "export class InkStoryRunner {",
      124: "  private readonly story: Story;",
      193: "   * Force-jump into an authored Ink path (knot / gather).",
      194: "   * Used after a constrained AI side branch rejoins the spine.",
      196: "  jumpTo(path: string): InkStorySnapshot {",
      197: "    this.story.ChoosePathString(path);",
      201: "}",
      208: "export async function createInkStoryRunnerForId(",
      219: "  return runner;",
    }),
  );
  writeSourceFile(
    sourceRoot,
    "apps/web/src/ai/aiBranchTypes.ts",
    sourceWithLines(44, {
      12: "/** Structured AI branch payload. */",
      16: "export interface AiBranchResult {",
      18: "  readonly beats: readonly AiBranchBeat[];",
      19: "  readonly rejoinSceneId: string;",
      40: "}",
    }),
  );
  writeSourceFile(
    sourceRoot,
    "services/ai-branch/src/branch/mastraBranch.ts",
    sourceWithLines(165, {
      15: "const branchSchema = z.object({",
      17: "  beats: z.array(beatSchema).min(1).max(4),",
      18: "  rejoinSceneId: z.string().min(1),",
      19: "});",
      42: "/** Product Mastra agent for constrained side branches.",
      44: " * Model transport stays OpenRouter via SwimmerAIKit model config.",
      50: "export async function generateAiBranchWithMastra(",
      59: "  const maxAiBeats = Math.max(1, Math.min(4, body.config.maxAiBeats ?? 2));",
      63: "  const rejoinSceneId = body.config.rejoinSceneId;",
      146: "  const parsed = branchSchema.parse(parseModelJson(text));",
      147: "  const beats = parsed.beats.slice(0, maxAiBeats).map((beat) => ({",
      159: "  return {",
      162: "    rejoinSceneId,",
      164: "  };",
    }),
  );
}

interface Fixture {
  readonly container: string;
  readonly studiesRoot: string;
  readonly readyGraphHash: string | null;
}

function setupFixture(ready: boolean, graphNodes = REQUIRED_GRAPH_NODES): Fixture {
  const container = mkdtempSync(join(tmpdir(), "university-local-supaluv-course-"));
  const studiesRoot = join(container, "studies");
  const sourceRoot = join(container, "source");
  execFileSync("git", ["init", "-q", sourceRoot]);
  git(sourceRoot, ["config", "user.name", "UniversityLocal Test"]);
  git(sourceRoot, ["config", "user.email", "test@university.local"]);
  createEvidenceSource(sourceRoot);
  git(sourceRoot, ["add", "."]);
  git(sourceRoot, ["commit", "-q", "-m", "Evidence fixture"]);

  createStudy(studiesRoot, {
    id: "supaluv",
    title: "SupaLuv",
    now: new Date("2026-07-20T09:00:00.000Z"),
  });
  registerLocalGitSource(studiesRoot, "supaluv", sourceRoot);
  const snapshot = createCleanSnapshot(studiesRoot, "supaluv");
  const invocation = prepareUaAnalysis({
    studiesRoot,
    studyId: "supaluv",
    snapshotId: snapshot.id,
    analysisId: SUPALUV_ANALYSIS_ID,
    engineVersion: "2.9.4",
    outputLanguage: "zh",
    now: ANALYSIS_CREATED_AT,
  });
  if (!ready) return { container, studiesRoot, readyGraphHash: null };

  writeFileSync(
    join(invocation.dataDirectory, "knowledge-graph.json"),
    JSON.stringify({
      project: { gitCommitHash: snapshot.sourceCommit, analyzedAt: GENERATED_AT },
      nodes: graphNodes,
      edges: [],
      layers: [
        {
          id: "narrative-runtime",
          name: "Narrative runtime",
          description: "Authored and generated narrative boundaries",
          nodeIds: graphNodes.map((node) => node.id),
        },
      ],
      tour: [
        {
          order: 1,
          title: "Narrative authority",
          description: "Follow the authored spine and constrained branch",
          nodeIds: graphNodes.map((node) => node.id),
        },
      ],
    }),
  );
  writeFileSync(
    join(invocation.dataDirectory, "meta.json"),
    JSON.stringify({ gitCommitHash: snapshot.sourceCommit, lastAnalyzedAt: GENERATED_AT }),
  );
  const fingerprintFiles = Object.fromEntries(
    graphNodes
      .filter(
        (node) =>
          typeof node.type === "string" &&
          typeof node.filePath === "string" &&
          node.id === `${node.type}:${node.filePath}`,
      )
      .map((node) => [node.filePath, { contentHash: "fixture" }]),
  );
  writeFileSync(
    join(invocation.dataDirectory, "fingerprints.json"),
    JSON.stringify({
      gitCommitHash: snapshot.sourceCommit,
      generatedAt: GENERATED_AT,
      files: fingerprintFiles,
    }),
  );
  const analysis = finalizeUaAnalysis(
    studiesRoot,
    "supaluv",
    SUPALUV_ANALYSIS_ID,
    ANALYSIS_COMPLETED_AT,
  );
  if (analysis.status !== "ready") throw new Error("Expected ready fixture analysis");
  return { container, studiesRoot, readyGraphHash: analysis.graphHash };
}

function recordingRuntime(operations: string[]) {
  return {
    UaAnalysisManifestSchema,
    SnapshotManifestSchema,
    getStudyPaths,
    getSnapshotPaths,
    getUaAnalysisPaths,
    getCoursePaths,
    getUnitPaths,
    getLessonPaths,
    readStudy,
    readCourse,
    readUnit,
    readLatestLesson,
    readLatestCard,
    readLatestExercise,
    validateEvidence,
    writeCourse: (...args: Parameters<typeof writeCourse>) => {
      operations.push("writeCourse");
      return writeCourse(...args);
    },
    writeUnit: (...args: Parameters<typeof writeUnit>) => {
      operations.push("writeUnit");
      return writeUnit(...args);
    },
    writeLessonRevision: (...args: Parameters<typeof writeLessonRevision>) => {
      operations.push("writeLessonRevision");
      return writeLessonRevision(...args);
    },
    writeCardRevision: (...args: Parameters<typeof writeCardRevision>) => {
      operations.push(`writeCardRevision:${args[2].id}`);
      return writeCardRevision(...args);
    },
    writeExerciseRevision: (...args: Parameters<typeof writeExerciseRevision>) => {
      operations.push(`writeExerciseRevision:${args[2].id}`);
      return writeExerciseRevision(...args);
    },
    updateUnitStatus: (...args: Parameters<typeof updateUnitStatus>) => {
      operations.push("updateUnitStatus");
      return updateUnitStatus(...args);
    },
    updateCourseStatus: (...args: Parameters<typeof updateCourseStatus>) => {
      operations.push("updateCourseStatus");
      return updateCourseStatus(...args);
    },
    setDefaultCourse: (...args: Parameters<typeof setDefaultCourse>) => {
      operations.push("setDefaultCourse");
      return setDefaultCourse(...args);
    },
  };
}

function expectedFirstRunOperations(): string[] {
  return [
    "writeCourse",
    "writeUnit",
    "writeLessonRevision",
    ...COURSE_IDS.cardIds.map((id) => `writeCardRevision:${id}`),
    `writeExerciseRevision:${COURSE_IDS.exerciseId}`,
    "updateUnitStatus",
    "updateCourseStatus",
    "setDefaultCourse",
  ];
}

describe("repeatable SupaLuv course generator", () => {
  it("writes the evidence-bound course in dependency order and never creates revision 2", () => {
    const fixture = setupFixture(true);
    const operations: string[] = [];
    const runtime = recordingRuntime(operations);
    try {
      const first = createSupaluvCourse({ studiesRoot: fixture.studiesRoot, runtime });
      expect(first.graphHash).toBe(fixture.readyGraphHash);
      expect(first.stableTimestamp).toBe(ANALYSIS_COMPLETED_AT.toISOString());
      expect(operations).toEqual(expectedFirstRunOperations());

      expect(readStudy(fixture.studiesRoot, "supaluv").defaultCourseId).toBe(COURSE_IDS.courseId);
      expect(readCourse(fixture.studiesRoot, "supaluv", COURSE_IDS.courseId).status).toBe("active");
      expect(
        readUnit(fixture.studiesRoot, "supaluv", COURSE_IDS.courseId, COURSE_IDS.unitId).status,
      ).toBe("active");
      const lesson = readLatestLesson(
        fixture.studiesRoot,
        "supaluv",
        COURSE_IDS.courseId,
        COURSE_IDS.unitId,
        COURSE_IDS.lessonId,
      );
      expect(lesson.manifest.contentRevision).toBe(1);
      expect(lesson.manifest.status).toBe("active");
      expect(lesson.content).toContain("方向权属于作者态");
      expect(lesson.content).toContain(fixture.readyGraphHash);

      const cards = COURSE_IDS.cardIds.map((cardId) =>
        readLatestCard(
          fixture.studiesRoot,
          "supaluv",
          COURSE_IDS.courseId,
          COURSE_IDS.unitId,
          COURSE_IDS.lessonId,
          cardId,
        ),
      );
      expect(cards.map((card) => card.contentRevision)).toEqual([1, 1, 1, 1]);
      expect(cards[1]?.back).toContain("rejoinSceneId");
      expect(cards[1]?.back).toContain("最多 4 个");
      expect(cards[2]?.back).toContain("交互界面外壳");
      expect(cards[3]?.back).toContain("Mastra");
      expect(cards[3]?.back).toContain("SwimmerAIKit");

      const exercise = readLatestExercise(
        fixture.studiesRoot,
        "supaluv",
        COURSE_IDS.courseId,
        COURSE_IDS.unitId,
        COURSE_IDS.lessonId,
        COURSE_IDS.exerciseId,
      );
      expect(exercise.kind).toBe("short-answer");
      if (exercise.kind !== "short-answer") throw new Error("Expected short-answer exercise");
      expect(exercise.expectedAnswer).toBe("ink");

      const lessonPaths = getLessonPaths(
        fixture.studiesRoot,
        "supaluv",
        COURSE_IDS.courseId,
        COURSE_IDS.unitId,
        COURSE_IDS.lessonId,
      );
      const firstOperationCount = operations.length;
      const second = createSupaluvCourse({ studiesRoot: fixture.studiesRoot, runtime });
      expect(second).toEqual(first);
      expect(operations.slice(firstOperationCount)).toEqual([]);
      expect(existsSync(getStudyPaths(fixture.studiesRoot, "supaluv").learner.database)).toBe(
        false,
      );
      expect(readdirSync(lessonPaths.revisions)).toEqual(["1"]);
      for (const cardId of COURSE_IDS.cardIds) {
        expect(readdirSync(join(lessonPaths.cards, cardId, "revisions"))).toEqual(["1"]);
      }
      expect(readdirSync(join(lessonPaths.exercises, COURSE_IDS.exerciseId, "revisions"))).toEqual([
        "1",
      ]);
    } finally {
      rmSync(fixture.container, { recursive: true, force: true });
    }
  });

  it("fails on a preparing exact analysis before any course or learner write", () => {
    const fixture = setupFixture(false);
    const operations: string[] = [];
    try {
      expect(() =>
        createSupaluvCourse({
          studiesRoot: fixture.studiesRoot,
          runtime: recordingRuntime(operations),
        }),
      ).toThrow(/must be ready before course writes; current status: preparing/);
      expect(operations).toEqual([]);
      expect(
        existsSync(getCoursePaths(fixture.studiesRoot, "supaluv", COURSE_IDS.courseId).manifest),
      ).toBe(false);
      expect(existsSync(getStudyPaths(fixture.studiesRoot, "supaluv").learner.database)).toBe(
        false,
      );
    } finally {
      rmSync(fixture.container, { recursive: true, force: true });
    }
  });

  it("rejects a ready graph missing a required real node before content writes", () => {
    const fixture = setupFixture(
      true,
      REQUIRED_GRAPH_NODES.filter(
        (node) =>
          node.id !==
          "function:services/ai-branch/src/branch/mastraBranch.ts:generateAiBranchWithMastra",
      ),
    );
    const operations: string[] = [];
    try {
      expect(() =>
        createSupaluvCourse({
          studiesRoot: fixture.studiesRoot,
          runtime: recordingRuntime(operations),
        }),
      ).toThrow(/missing required node.*generateAiBranchWithMastra/);
      expect(operations).toEqual([]);
      expect(
        existsSync(getCoursePaths(fixture.studiesRoot, "supaluv", COURSE_IDS.courseId).manifest),
      ).toBe(false);
    } finally {
      rmSync(fixture.container, { recursive: true, force: true });
    }
  });

  it("rejects an externally damaged active course before trying to recreate its unit", () => {
    const fixture = setupFixture(true);
    const analysisPaths = getUaAnalysisPaths(fixture.studiesRoot, "supaluv", SUPALUV_ANALYSIS_ID);
    const analysis = UaAnalysisManifestSchema.parse(
      JSON.parse(readFileSync(analysisPaths.manifest, "utf8")),
    );
    if (analysis.status !== "ready") throw new Error("Expected ready fixture analysis");
    const definition = buildSupaluvCourseDefinition(analysis);
    writeCourse(fixture.studiesRoot, "supaluv", definition.course);
    const coursePaths = getCoursePaths(fixture.studiesRoot, "supaluv", COURSE_IDS.courseId);
    writeFileSync(
      coursePaths.manifest,
      `${JSON.stringify({ ...definition.course, status: "active" }, null, 2)}\n`,
    );
    const operations: string[] = [];
    try {
      expect(() =>
        createSupaluvCourse({
          studiesRoot: fixture.studiesRoot,
          runtime: recordingRuntime(operations),
        }),
      ).toThrow(/Active SupaLuv course has an incomplete or inactive unit tree/);
      expect(operations).toEqual([]);
      expect(
        existsSync(
          getUnitPaths(fixture.studiesRoot, "supaluv", COURSE_IDS.courseId, COURSE_IDS.unitId)
            .manifest,
        ),
      ).toBe(false);
    } finally {
      rmSync(fixture.container, { recursive: true, force: true });
    }
  });
});
