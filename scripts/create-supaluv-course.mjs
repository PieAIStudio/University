import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SUPALUV_STUDY_ID = "supaluv";
export const SUPALUV_ANALYSIS_ID = "ua-feeb848f-v294-zh-full";

export const COURSE_IDS = Object.freeze({
  courseId: "founder-engineer",
  unitId: "narrative-authority",
  lessonId: "story-direction",
  exerciseId: "story-authority-recall",
  cardIds: Object.freeze([
    "ink-authority",
    "ai-branch-rejoin",
    "react-interaction-shell",
    "constrained-ai-generation",
  ]),
});

const REQUIRED_NODES = Object.freeze([
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
]);

const SOURCE_CLAIMS = Object.freeze([
  {
    sourcePath: "README.md",
    lineStart: 3,
    lineEnd: 26,
    tokens: [
      "React + Vite + TypeScript",
      "Ink / InkJS",
      "Mastra + SwimmerAIKit",
      "受约束 AI 剧情与生成能力",
    ],
  },
  {
    sourcePath: "apps/web/src/story/inkStoryRunner.ts",
    lineStart: 123,
    lineEnd: 219,
    tokens: [
      "export class InkStoryRunner",
      "constrained AI side branch rejoins the spine",
      "jumpTo(path: string)",
      "createInkStoryRunnerForId",
    ],
  },
  {
    sourcePath: "apps/web/src/ai/aiBranchTypes.ts",
    lineStart: 12,
    lineEnd: 40,
    tokens: ["interface AiBranchResult", "beats", "rejoinSceneId"],
  },
  {
    sourcePath: "services/ai-branch/src/branch/mastraBranch.ts",
    lineStart: 15,
    lineEnd: 19,
    tokens: ["beats:", ".max(4)", "rejoinSceneId"],
  },
  {
    sourcePath: "services/ai-branch/src/branch/mastraBranch.ts",
    lineStart: 42,
    lineEnd: 64,
    tokens: ["SwimmerAIKit", "generateAiBranchWithMastra", "Math.min(4", "rejoinSceneId"],
  },
  {
    sourcePath: "services/ai-branch/src/branch/mastraBranch.ts",
    lineStart: 146,
    lineEnd: 164,
    tokens: ["branchSchema.parse", "slice(0, maxAiBeats)", "rejoinSceneId"],
  },
]);

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function assertIdentity(actual, expected, label) {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error(`${label} conflicts with the stable SupaLuv course definition`);
  }
}

function parseJsonFile(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot read ${label}: ${detail}`);
  }
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function readCommittedSource(repository, sourceCommit, sourcePath) {
  try {
    return execFileSync("git", ["--git-dir", repository, "show", `${sourceCommit}:${sourcePath}`], {
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_OPTIONAL_LOCKS: "0",
        GIT_TERMINAL_PROMPT: "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    throw new Error(`Cannot read evidence source from the study repository: ${sourcePath}`);
  }
}

function assertSourceClaims(repository, sourceCommit) {
  const sourceCache = new Map();
  for (const claim of SOURCE_CLAIMS) {
    let source = sourceCache.get(claim.sourcePath);
    if (source === undefined) {
      source = readCommittedSource(repository, sourceCommit, claim.sourcePath);
      sourceCache.set(claim.sourcePath, source);
    }
    const lines = source.split(/\r?\n/);
    if (lines.length < claim.lineEnd) {
      throw new Error(
        `Evidence range exceeds ${claim.sourcePath}: ${claim.lineStart}-${claim.lineEnd}`,
      );
    }
    const excerpt = lines.slice(claim.lineStart - 1, claim.lineEnd).join("\n");
    for (const token of claim.tokens) {
      if (!excerpt.includes(token)) {
        throw new Error(
          `Evidence claim token is absent from ${claim.sourcePath}:${claim.lineStart}-${claim.lineEnd}: ${token}`,
        );
      }
    }
  }
}

function validateGraph(bytes, analysis) {
  const actualHash = sha256(bytes);
  if (actualHash !== analysis.graphHash) {
    throw new Error("SupaLuv UA graph bytes do not match the ready manifest graphHash");
  }

  let graph;
  try {
    graph = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`SupaLuv UA graph is not valid JSON: ${detail}`);
  }
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error("SupaLuv UA graph must contain nodes and edges arrays");
  }
  if (graph.nodes.length !== analysis.nodeCount || graph.edges.length !== analysis.edgeCount) {
    throw new Error("SupaLuv UA graph counts do not match the ready manifest");
  }
  if (graph.project?.gitCommitHash !== analysis.sourceCommit) {
    throw new Error("SupaLuv UA graph project commit does not match its ready manifest");
  }

  const nodes = new Map();
  for (const node of graph.nodes) {
    if (node === null || typeof node !== "object" || typeof node.id !== "string") continue;
    if (nodes.has(node.id)) throw new Error(`SupaLuv UA graph contains duplicate node: ${node.id}`);
    nodes.set(node.id, node);
  }
  for (const expected of REQUIRED_NODES) {
    const node = nodes.get(expected.id);
    if (!node) throw new Error(`SupaLuv UA graph is missing required node: ${expected.id}`);
    if (node.type !== expected.type || node.filePath !== expected.filePath) {
      throw new Error(`SupaLuv UA node identity changed: ${expected.id}`);
    }
  }
  return graph;
}

function buildEvidence(analysis) {
  const base = {
    kind: "fact",
    snapshotId: analysis.snapshotId,
    sourceCommit: analysis.sourceCommit,
    analysisId: analysis.id,
    graphHash: analysis.graphHash,
  };
  return Object.freeze({
    readme: {
      ...base,
      sourcePath: "README.md",
      lineStart: 3,
      lineEnd: 26,
      nodeIds: ["document:README.md"],
      note: "产品边界与 React、Ink、Mastra、SwimmerAIKit 技术基线。",
    },
    inkRunner: {
      ...base,
      sourcePath: "apps/web/src/story/inkStoryRunner.ts",
      lineStart: 123,
      lineEnd: 219,
      nodeIds: [
        "file:apps/web/src/story/inkStoryRunner.ts",
        "class:apps/web/src/story/inkStoryRunner.ts:InkStoryRunner",
      ],
      note: "Ink 运行器保存作者态，并在受约束 AI 支线结束后跳回作者路径。",
    },
    branchContract: {
      ...base,
      sourcePath: "apps/web/src/ai/aiBranchTypes.ts",
      lineStart: 12,
      lineEnd: 40,
      nodeIds: ["file:apps/web/src/ai/aiBranchTypes.ts"],
      note: "AI 支线结果契约同时包含 beats 与 rejoinSceneId。",
    },
    branchSchema: {
      ...base,
      sourcePath: "services/ai-branch/src/branch/mastraBranch.ts",
      lineStart: 15,
      lineEnd: 19,
      nodeIds: ["file:services/ai-branch/src/branch/mastraBranch.ts"],
      note: "结构化输出 schema 把 beats 限制为 1 到 4 个并要求回归点。",
    },
    mastraGeneration: {
      ...base,
      sourcePath: "services/ai-branch/src/branch/mastraBranch.ts",
      lineStart: 42,
      lineEnd: 64,
      nodeIds: [
        "file:services/ai-branch/src/branch/mastraBranch.ts",
        "function:services/ai-branch/src/branch/mastraBranch.ts:generateAiBranchWithMastra",
      ],
      note: "Mastra 生成函数使用 SwimmerAIKit 模型配置并夹紧支线节拍上限。",
    },
    constrainedReturn: {
      ...base,
      sourcePath: "services/ai-branch/src/branch/mastraBranch.ts",
      lineStart: 146,
      lineEnd: 164,
      nodeIds: [
        "file:services/ai-branch/src/branch/mastraBranch.ts",
        "function:services/ai-branch/src/branch/mastraBranch.ts:generateAiBranchWithMastra",
      ],
      note: "服务解析、裁剪输出，并返回由作者配置提供的 rejoinSceneId。",
    },
  });
}

export function buildSupaluvCourseDefinition(analysis) {
  const timestamp = analysis.completedAt;
  const evidence = buildEvidence(analysis);
  const lessonEvidence = [
    evidence.readme,
    evidence.inkRunner,
    evidence.branchContract,
    evidence.branchSchema,
    evidence.mastraGeneration,
    evidence.constrainedReturn,
  ];
  const lessonContent = `# 谁控制 SupaLuv 的故事方向？

## 学习目标

完成本课后，你应能解释 SupaLuv 如何把作者主线与受约束 AI 支线组合起来，并指出 React、Ink、Mastra 与 SwimmerAIKit 各自承担的边界。

前置知识：理解前端界面、剧情运行时与生成式模型服务是不同层次即可。

## 先给结论

- **事实：Ink 拥有作者主线。** README 把 Ink / InkJS 定义为“作者主线剧情”；\`InkStoryRunner\` 保存和推进 Ink 状态，并可在 AI 支线结束后用 \`jumpTo\` 回到作者路径。
- **事实：AI 只生成有限支线。** 浏览器契约要求结果同时带有 \`beats\` 和 \`rejoinSceneId\`；服务端 schema 把 beats 限制在 1–4 个，返回时仍使用作者配置的回归点。
- **事实：React 是交互外壳。** README 把 React + Vite + TypeScript 定义为 Web 应用与界面，而不是剧情权威来源。
- **事实：Mastra + SwimmerAIKit 承担受约束生成。** Mastra Agent 组织生成流程，模型传输由 SwimmerAIKit 模型配置承接，结果再经 schema、长度与素材池约束。
- **推论：方向权属于作者态，而不属于模型。** 这是由上述代码边界推出的架构结论：AI 可以扩写局部体验，但不能任意改写主线拓扑。

## 一个类比

把故事想成一条有调度中心的铁路：Ink 是铺好的主线轨道，React 是乘客看到的车厢与站台，Mastra + SwimmerAIKit 可以安排一段观光支线；\`rejoinSceneId\` 是预先批准的并轨站，最多 4 个 beats 是支线里程上限。列车可以绕行，但不能自行改写终点。

## 工作示例

1. 玩家在 React 界面选择一个 AI 选项。
2. 请求带上作者配置的 \`rejoinSceneId\` 与 \`maxAiBeats\`。
3. Mastra 调用由 SwimmerAIKit 模型配置承接的模型通道。
4. 服务把输出解析为结构化结果，将 beats 限制为最多 4 个，并保留作者指定的回归点。
5. 支线播放完毕后，\`InkStoryRunner.jumpTo(rejoinSceneId)\` 回到作者主线。

## 自检

如果模型返回 7 个 beats 并建议一个新的结局，系统应接受什么？

答案：只接受约束后的最多 4 个 beats；回归点仍来自作者配置，不能让模型自行发明主线方向。

## 证据账本

- 快照：\`${analysis.snapshotId}\`
- 源提交：\`${analysis.sourceCommit}\`
- UA 分析：\`${analysis.id}\`
- 图哈希：\`${analysis.graphHash}\`
- \`README.md:3-26\`
- \`apps/web/src/story/inkStoryRunner.ts:123-219\`
- \`apps/web/src/ai/aiBranchTypes.ts:12-40\`
- \`services/ai-branch/src/branch/mastraBranch.ts:15-19,42-64,146-164\`
`;

  return Object.freeze({
    course: {
      schemaVersion: 1,
      id: COURSE_IDS.courseId,
      title: "创始人工程师：SupaLuv",
      description: "从可核验源码证据理解 SupaLuv 的产品与技术权威边界。",
      audience: "需要以创始人兼工程维护者视角理解和维护 SupaLuv 的学习者",
      objectives: [
        "解释作者主线与受约束 AI 支线的权威边界",
        "从源码证据判断 React、Ink、Mastra 与 SwimmerAIKit 的职责",
      ],
      unitIds: [COURSE_IDS.unitId],
      status: "draft",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    unit: {
      schemaVersion: 1,
      id: COURSE_IDS.unitId,
      title: "叙事权威边界",
      objective: "解释作者主线如何容纳可回归、有限长度的 AI 支线。",
      prerequisiteUnitIds: [],
      lessonIds: [COURSE_IDS.lessonId],
      status: "draft",
    },
    lesson: {
      manifest: {
        schemaVersion: 1,
        id: COURSE_IDS.lessonId,
        title: "谁控制故事方向？",
        courseId: COURSE_IDS.courseId,
        unitId: COURSE_IDS.unitId,
        exerciseIds: [COURSE_IDS.exerciseId],
        cardIds: [...COURSE_IDS.cardIds],
        contentRevision: 1,
        status: "active",
        evidence: lessonEvidence,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      content: lessonContent,
    },
    cards: [
      {
        schemaVersion: 1,
        id: COURSE_IDS.cardIds[0],
        kind: "basic",
        courseId: COURSE_IDS.courseId,
        unitId: COURSE_IDS.unitId,
        lessonId: COURSE_IDS.lessonId,
        front: "SupaLuv 的作者主线由什么技术持有？",
        back: "Ink / InkJS。InkStoryRunner 保存并推进作者态，受约束 AI 支线结束后通过 jumpTo 回到作者路径。",
        contentRevision: 1,
        status: "active",
        tags: ["narrative", "ink"],
        evidence: [evidence.readme, evidence.inkRunner],
      },
      {
        schemaVersion: 1,
        id: COURSE_IDS.cardIds[1],
        kind: "basic",
        courseId: COURSE_IDS.courseId,
        unitId: COURSE_IDS.unitId,
        lessonId: COURSE_IDS.lessonId,
        front: "AI 支线靠哪两个约束回到作者主线？",
        back: "结果必须携带作者配置的 rejoinSceneId，beats 最多 4 个；服务解析并裁剪后仍返回该回归点。",
        contentRevision: 1,
        status: "active",
        tags: ["narrative", "ai-branch"],
        evidence: [
          evidence.branchContract,
          evidence.branchSchema,
          evidence.mastraGeneration,
          evidence.constrainedReturn,
        ],
      },
      {
        schemaVersion: 1,
        id: COURSE_IDS.cardIds[2],
        kind: "basic",
        courseId: COURSE_IDS.courseId,
        unitId: COURSE_IDS.unitId,
        lessonId: COURSE_IDS.lessonId,
        front: "React 在 SupaLuv 叙事架构中的职责是什么？",
        back: "React + Vite + TypeScript 是 Web 应用与交互界面外壳；作者主线权威属于 Ink，而不是 React。",
        contentRevision: 1,
        status: "active",
        tags: ["architecture", "react"],
        evidence: [evidence.readme],
      },
      {
        schemaVersion: 1,
        id: COURSE_IDS.cardIds[3],
        kind: "basic",
        courseId: COURSE_IDS.courseId,
        unitId: COURSE_IDS.unitId,
        lessonId: COURSE_IDS.lessonId,
        front: "Mastra + SwimmerAIKit 在 AI 支线中承担什么职责？",
        back: "Mastra 组织受约束生成，SwimmerAIKit 模型配置承接模型传输；输出还要经过 schema、最多 4 beats、素材池和 rejoinSceneId 约束。",
        contentRevision: 1,
        status: "active",
        tags: ["architecture", "mastra"],
        evidence: [
          evidence.readme,
          evidence.branchSchema,
          evidence.mastraGeneration,
          evidence.constrainedReturn,
        ],
      },
    ],
    exercise: {
      schemaVersion: 1,
      id: COURSE_IDS.exerciseId,
      kind: "short-answer",
      title: "回忆作者主线引擎",
      courseId: COURSE_IDS.courseId,
      unitId: COURSE_IDS.unitId,
      lessonId: COURSE_IDS.lessonId,
      prompt: "填写一个小写英文单词：SupaLuv 中拥有作者主线权威的剧情技术是什么？",
      expectedAnswer: "ink",
      contentRevision: 1,
      status: "active",
      evidence: [evidence.readme, evidence.inkRunner],
    },
    evidence: lessonEvidence,
  });
}

function stripContentHash(value) {
  const { contentHash: _contentHash, ...withoutHash } = value;
  return withoutHash;
}

function assertExistingCourse(runtime, studiesRoot, definition) {
  const paths = runtime.getCoursePaths(studiesRoot, SUPALUV_STUDY_ID, COURSE_IDS.courseId);
  if (!existsSync(paths.manifest)) return null;
  const course = runtime.readCourse(studiesRoot, SUPALUV_STUDY_ID, COURSE_IDS.courseId);
  if (course.status !== "draft" && course.status !== "active") {
    throw new Error(`Existing SupaLuv course cannot be resumed from status: ${course.status}`);
  }
  assertIdentity(course, { ...definition.course, status: course.status }, "Existing course");
  return course;
}

function assertExistingUnit(runtime, studiesRoot, definition, courseExists) {
  if (!courseExists) return null;
  const paths = runtime.getUnitPaths(
    studiesRoot,
    SUPALUV_STUDY_ID,
    COURSE_IDS.courseId,
    COURSE_IDS.unitId,
  );
  if (!existsSync(paths.manifest)) return null;
  const unit = runtime.readUnit(
    studiesRoot,
    SUPALUV_STUDY_ID,
    COURSE_IDS.courseId,
    COURSE_IDS.unitId,
  );
  if (unit.status !== "draft" && unit.status !== "active") {
    throw new Error(`Existing SupaLuv unit cannot be resumed from status: ${unit.status}`);
  }
  assertIdentity(unit, { ...definition.unit, status: unit.status }, "Existing unit");
  return unit;
}

function inspectExistingRevisions(runtime, studiesRoot, definition, unitExists) {
  const state = { lesson: false, cardIds: new Set(), exercise: false };
  if (!unitExists) return state;
  const lessonPaths = runtime.getLessonPaths(
    studiesRoot,
    SUPALUV_STUDY_ID,
    COURSE_IDS.courseId,
    COURSE_IDS.unitId,
    COURSE_IDS.lessonId,
  );
  if (!existsSync(lessonPaths.latest)) return state;

  const lesson = runtime.readLatestLesson(
    studiesRoot,
    SUPALUV_STUDY_ID,
    COURSE_IDS.courseId,
    COURSE_IDS.unitId,
    COURSE_IDS.lessonId,
  );
  assertIdentity(stripContentHash(lesson.manifest), definition.lesson.manifest, "Existing lesson");
  if (lesson.content !== definition.lesson.content) {
    throw new Error("Existing lesson conflicts with the stable SupaLuv lesson content");
  }
  state.lesson = true;

  for (const candidate of definition.cards) {
    const latest = join(lessonPaths.cards, candidate.id, "latest.json");
    if (!existsSync(latest)) continue;
    const card = runtime.readLatestCard(
      studiesRoot,
      SUPALUV_STUDY_ID,
      COURSE_IDS.courseId,
      COURSE_IDS.unitId,
      COURSE_IDS.lessonId,
      candidate.id,
    );
    assertIdentity(stripContentHash(card), candidate, `Existing card ${candidate.id}`);
    state.cardIds.add(candidate.id);
  }

  const exerciseLatest = join(lessonPaths.exercises, definition.exercise.id, "latest.json");
  if (existsSync(exerciseLatest)) {
    const exercise = runtime.readLatestExercise(
      studiesRoot,
      SUPALUV_STUDY_ID,
      COURSE_IDS.courseId,
      COURSE_IDS.unitId,
      COURSE_IDS.lessonId,
      definition.exercise.id,
    );
    assertIdentity(
      stripContentHash(exercise),
      definition.exercise,
      `Existing exercise ${definition.exercise.id}`,
    );
    state.exercise = true;
  }
  return state;
}

function preflight(studiesRoot, runtime) {
  const analysisPaths = runtime.getUaAnalysisPaths(
    studiesRoot,
    SUPALUV_STUDY_ID,
    SUPALUV_ANALYSIS_ID,
  );
  const analysis = runtime.UaAnalysisManifestSchema.parse(
    parseJsonFile(analysisPaths.manifest, `UA analysis ${SUPALUV_ANALYSIS_ID}`),
  );
  if (analysis.id !== SUPALUV_ANALYSIS_ID) {
    throw new Error("SupaLuv UA manifest ID does not match its exact analysis directory");
  }
  if (analysis.status !== "ready") {
    throw new Error(
      `SupaLuv UA analysis ${SUPALUV_ANALYSIS_ID} must be ready before course writes; current status: ${analysis.status}`,
    );
  }

  const snapshot = runtime.SnapshotManifestSchema.parse(
    parseJsonFile(
      runtime.getSnapshotPaths(studiesRoot, SUPALUV_STUDY_ID, analysis.snapshotId).manifest,
      `snapshot ${analysis.snapshotId}`,
    ),
  );
  if (snapshot.sourceCommit !== analysis.sourceCommit) {
    throw new Error("SupaLuv UA analysis does not match its immutable snapshot commit");
  }

  const graphBytes = readFileSync(join(analysisPaths.data, "knowledge-graph.json"));
  validateGraph(graphBytes, analysis);
  assertSourceClaims(
    runtime.getStudyPaths(studiesRoot, SUPALUV_STUDY_ID).source.repository,
    analysis.sourceCommit,
  );

  const definition = buildSupaluvCourseDefinition(analysis);
  for (const evidence of definition.evidence) {
    runtime.validateEvidence(studiesRoot, SUPALUV_STUDY_ID, evidence);
  }

  const study = runtime.readStudy(studiesRoot, SUPALUV_STUDY_ID);
  if (study.status !== "active") throw new Error("SupaLuv study must be active");
  if (study.defaultCourseId !== null && study.defaultCourseId !== COURSE_IDS.courseId) {
    throw new Error(
      `SupaLuv already has a different default course: ${study.defaultCourseId}; refusing to overwrite it`,
    );
  }

  const course = assertExistingCourse(runtime, studiesRoot, definition);
  const unit = assertExistingUnit(runtime, studiesRoot, definition, course !== null);
  const revisions = inspectExistingRevisions(runtime, studiesRoot, definition, unit !== null);
  const revisionTreeComplete =
    revisions.lesson &&
    revisions.exercise &&
    definition.cards.every((card) => revisions.cardIds.has(card.id));
  if (course?.status === "active" && unit?.status !== "active") {
    throw new Error("Active SupaLuv course has an incomplete or inactive unit tree");
  }
  if (unit?.status === "active" && !revisionTreeComplete) {
    throw new Error("Active SupaLuv unit has an incomplete lesson, card, or exercise tree");
  }
  return { analysis, definition, study, existing: { course, unit } };
}

function ensureLesson(runtime, studiesRoot, definition) {
  const paths = runtime.getLessonPaths(
    studiesRoot,
    SUPALUV_STUDY_ID,
    COURSE_IDS.courseId,
    COURSE_IDS.unitId,
    COURSE_IDS.lessonId,
  );
  if (!existsSync(paths.latest)) {
    runtime.writeLessonRevision(studiesRoot, SUPALUV_STUDY_ID, definition.lesson);
  }
}

function ensureCardsAndExercise(runtime, studiesRoot, definition) {
  const paths = runtime.getLessonPaths(
    studiesRoot,
    SUPALUV_STUDY_ID,
    COURSE_IDS.courseId,
    COURSE_IDS.unitId,
    COURSE_IDS.lessonId,
  );
  for (const card of definition.cards) {
    if (!existsSync(join(paths.cards, card.id, "latest.json"))) {
      runtime.writeCardRevision(studiesRoot, SUPALUV_STUDY_ID, card);
    }
  }
  if (!existsSync(join(paths.exercises, definition.exercise.id, "latest.json"))) {
    runtime.writeExerciseRevision(studiesRoot, SUPALUV_STUDY_ID, definition.exercise);
  }
}

export function createSupaluvCourse({ studiesRoot, runtime }) {
  const { analysis, definition, study, existing } = preflight(studiesRoot, runtime);
  const stableNow = new Date(analysis.completedAt);

  let course = existing.course;
  if (course === null) {
    course = runtime.writeCourse(studiesRoot, SUPALUV_STUDY_ID, definition.course);
  }
  let unit = existing.unit;
  if (unit === null) {
    unit = runtime.writeUnit(studiesRoot, SUPALUV_STUDY_ID, COURSE_IDS.courseId, definition.unit);
  }

  ensureLesson(runtime, studiesRoot, definition);
  ensureCardsAndExercise(runtime, studiesRoot, definition);

  if (unit.status === "draft") {
    unit = runtime.updateUnitStatus(
      studiesRoot,
      SUPALUV_STUDY_ID,
      COURSE_IDS.courseId,
      COURSE_IDS.unitId,
      "active",
    );
  }
  if (course.status === "draft") {
    course = runtime.updateCourseStatus(
      studiesRoot,
      SUPALUV_STUDY_ID,
      COURSE_IDS.courseId,
      "active",
      stableNow,
    );
  }
  if (study.defaultCourseId === null) {
    runtime.setDefaultCourse(studiesRoot, SUPALUV_STUDY_ID, COURSE_IDS.courseId, stableNow);
  }

  return {
    studyId: SUPALUV_STUDY_ID,
    analysisId: analysis.id,
    graphHash: analysis.graphHash,
    courseId: course.id,
    unitId: unit.id,
    lessonId: COURSE_IDS.lessonId,
    cardIds: definition.cards.map((card) => card.id),
    exerciseId: definition.exercise.id,
    contentRevision: 1,
    stableTimestamp: analysis.completedAt,
  };
}

async function loadRuntime() {
  const [config, schemas, paths, studies, content, evidence] = await Promise.all([
    import("../.university-local-build/server/config/load-config.js"),
    import("../.university-local-build/src/domain/schemas.js"),
    import("../.university-local-build/server/studies/paths.js"),
    import("../.university-local-build/server/studies/repository.js"),
    import("../.university-local-build/server/content/repository.js"),
    import("../.university-local-build/server/content/evidence.js"),
  ]);
  return {
    loadUniversityLocalConfig: config.loadUniversityLocalConfig,
    UaAnalysisManifestSchema: schemas.UaAnalysisManifestSchema,
    SnapshotManifestSchema: schemas.SnapshotManifestSchema,
    getStudyPaths: paths.getStudyPaths,
    getSnapshotPaths: paths.getSnapshotPaths,
    getUaAnalysisPaths: paths.getUaAnalysisPaths,
    getCoursePaths: paths.getCoursePaths,
    getUnitPaths: paths.getUnitPaths,
    getLessonPaths: paths.getLessonPaths,
    readStudy: studies.readStudy,
    setDefaultCourse: studies.setDefaultCourse,
    readCourse: content.readCourse,
    writeCourse: content.writeCourse,
    readUnit: content.readUnit,
    writeUnit: content.writeUnit,
    readLatestLesson: content.readLatestLesson,
    writeLessonRevision: content.writeLessonRevision,
    readLatestCard: content.readLatestCard,
    writeCardRevision: content.writeCardRevision,
    readLatestExercise: content.readLatestExercise,
    writeExerciseRevision: content.writeExerciseRevision,
    updateUnitStatus: content.updateUnitStatus,
    updateCourseStatus: content.updateCourseStatus,
    validateEvidence: evidence.validateEvidence,
  };
}

async function main() {
  const projectRoot = resolve(import.meta.dirname, "..");
  const runtime = await loadRuntime();
  const config = runtime.loadUniversityLocalConfig({ projectRoot });
  const result = createSupaluvCourse({ studiesRoot: config.studiesRoot, runtime });
  console.log(JSON.stringify(result, null, 2));
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
