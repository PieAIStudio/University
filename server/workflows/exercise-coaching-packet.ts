import type { EvidenceSnippet } from "../content/evidence.js";

/**
 * Everything the packet is allowed to say about one exercise.
 *
 * The packet is built on the server, not in the browser, for one reason: the
 * reference answer is withheld until the learner has really tried, and a rule
 * that decides what a learner may see cannot live in code the learner's own
 * page runs. Building it here also means the packet can carry real source
 * lines, which the browser never holds — it fetches evidence one index at a
 * time, on demand.
 */
export interface CoachingPacketExercise {
  readonly id: string;
  readonly kind: "short-answer" | "explain";
  readonly title: string;
  readonly prompt: string;
  readonly contentRevision: number;
}

export interface CoachingPacketEvidence {
  readonly note: string | null;
  readonly snippet: EvidenceSnippet;
}

export interface BuildCoachingPacketInput {
  readonly locator: {
    readonly studyId: string;
    readonly courseId: string;
    readonly unitId: string;
    readonly lessonId: string;
  };
  readonly lessonTitle: string;
  readonly exercise: CoachingPacketExercise;
  readonly learnerAnswer: string;
  readonly submissionCount: number;
  readonly commandId: string;
  readonly evidence: readonly CoachingPacketEvidence[];
  /** Present only when the disclosure rule allows it; see `disclosesReference`. */
  readonly reference:
    | { readonly kind: "short-answer"; readonly expectedAnswer: string }
    | { readonly kind: "explain"; readonly rubric: readonly string[] }
    | null;
  readonly evidenceOmitted: number;
}

/**
 * The reference answer stops being a secret once the learner has demonstrably
 * tried. Handing it over after one wrong guess ends retrieval practice, which
 * is the same defect the exercise endpoint was fixed for on 2026-07-25 — the
 * rule is restated here rather than reinvented.
 *
 * Host grading does not change the rule, but it does change what counts as a
 * try: a host grade is also a row in `exercise_attempt`, so total attempts
 * advance without the learner doing anything. Only learner submissions count.
 */
export function disclosesReference(input: {
  readonly passed: boolean;
  readonly submissionCount: number;
}): boolean {
  return input.passed || input.submissionCount >= 2;
}

function fence(language: string, body: string): readonly string[] {
  // A snippet that itself contains a fence would end the block early and turn
  // the rest of the packet into prose the AI reads as instructions.
  const longest = [...body.matchAll(/^`{3,}/gm)].reduce(
    (widest, match) => Math.max(widest, match[0].length),
    2,
  );
  const marker = "`".repeat(Math.max(3, longest + 1));
  return [`${marker}${language}`, body, marker];
}

function evidenceHeading(index: number, evidence: CoachingPacketEvidence): string {
  const { snippet } = evidence;
  const range =
    snippet.highlightStartLine === null
      ? `${snippet.startLine}-${snippet.endLine}`
      : `${snippet.highlightStartLine}-${snippet.highlightEndLine ?? snippet.highlightStartLine}`;
  return `### 证据 ${index + 1} · \`${snippet.sourcePath}:${range}\`（commit ${snippet.sourceCommit.slice(0, 12)}）`;
}

function referenceSection(input: BuildCoachingPacketInput): readonly string[] {
  if (input.reference === null) {
    return [
      "## 参考答案",
      "",
      "**本次不提供参考答案。** 学习者还在第一次尝试，提前给出答案会让这道题失去回忆练习的意义。",
      "请**只依据上面的证据**判断学习者的答案是否达到题目要求。",
      "如果证据不足以判断对错，就在 `evaluation` 里明说你无法确定、缺什么信息，并把 `passed` 留成 `false`。**不要猜。**",
      "",
    ];
  }
  if (input.reference.kind === "short-answer") {
    return [
      "## 参考答案（学习者已多次尝试，可以揭晓）",
      "",
      ...fence("text", input.reference.expectedAnswer),
      "",
      "这是**参考**答案，不是唯一正确写法。表述不同但意思对、或者写得比参考答案更详细，都算通过。",
      "",
    ];
  }
  return [
    "## 评分要点（学习者已多次尝试，可以揭晓）",
    "",
    ...input.reference.rubric.map((point, index) => `${index + 1}. ${point}`),
    "",
    "逐条对照学习者的回答。**全部覆盖**才算 `passed: true`；覆盖不全时指出漏了哪几条。",
    "",
  ];
}

export function buildExerciseCoachingPacket(input: BuildCoachingPacketInput): string {
  const { locator, exercise } = input;
  const writeBack = {
    schemaVersion: 1,
    commandId: input.commandId,
    contentRevision: exercise.contentRevision,
    // Fails closed: an assistant that forgets to edit this field cannot hand
    // the learner a pass it never decided to give.
    passed: false,
    evaluation: "（在此写对学习者的评估：对错原因 + 讲解，中文）",
    extensions: ["（引申知识点 1）", "（引申知识点 2）"],
    learnerAnswer: input.learnerAnswer,
    host: "ai-host",
    courseId: locator.courseId,
    unitId: locator.unitId,
    lessonId: locator.lessonId,
    exerciseId: exercise.id,
  };

  const evidenceLines =
    input.evidence.length === 0
      ? [
          "## 判分依据",
          "",
          "本题没有可展示的证据片段（可能引用的是配置文件或已超出展示限制）。请依据题干判断，无法确定时说明原因。",
          "",
        ]
      : [
          "## 判分依据：本课引用的真实源码",
          "",
          "下面是这道题所引用的代码，逐字取自被学项目在该 commit 的内容。**判分请以这些代码为准，不要凭印象。**",
          "",
          ...input.evidence.flatMap((evidence, index) => [
            evidenceHeading(index, evidence),
            ...(evidence.note ? ["", `> ${evidence.note}`] : []),
            "",
            ...fence(evidence.snippet.language, evidence.snippet.code),
            "",
          ]),
          ...(input.evidenceOmitted > 0
            ? [`（另有 ${input.evidenceOmitted} 条证据未附上，以控制粘贴长度。）`, ""]
            : []),
        ];

  return [
    "# UniversityLocal 练习答疑包（AI 判分 + 写回）",
    "",
    "## 给 AI 助手的任务（请直接执行）",
    "",
    "你是本地学习教练。网页**不会**用字符串比对判对错，判定完全由你负责。",
    "",
    "1. **判定**学习者答案是否达到题目要求（允许合理表述差异，勿因多写解释就判错）。",
    "2. **讲解**：对错原因、易混点，用白话。",
    "3. **引申** 1～3 个相关知识点。",
    "4. **写回** UniversityLocal（见文末命令），否则 Web 不会显示你的评估、课也不会完成。",
    "",
    "不要假设你是某一个品牌的 IDE，也不要假设你能打开学习者的代码库——判分需要的代码已经附在下面。",
    "",
    "## 题目上下文",
    "",
    `- studyId: \`${locator.studyId}\``,
    `- courseId: \`${locator.courseId}\``,
    `- unitId: \`${locator.unitId}\``,
    `- lessonId: \`${locator.lessonId}\`（${input.lessonTitle}）`,
    `- exerciseId: \`${exercise.id}\``,
    `- contentRevision: \`${exercise.contentRevision}\``,
    `- exerciseTitle: ${exercise.title}`,
    `- kind: \`${exercise.kind}\``,
    "",
    "### 题目",
    "",
    ...fence("text", exercise.prompt),
    "",
    "### 学习者的答案",
    "",
    ...fence("text", input.learnerAnswer === "" ? "（学习者提交了空答案）" : input.learnerAnswer),
    "",
    `本题学习者已提交 ${input.submissionCount} 次。`,
    "",
    ...evidenceLines,
    ...referenceSection(input),
    "## 写回步骤（必做，否则 Web 无评估）",
    "",
    "1. 在**任意位置**新建一个文件，例如 `/tmp/ul-host-grade.json`",
    "2. 写入下面的 JSON。**必须自己判断后改写 `passed`**；模板里是 `false`，照抄等于判不通过。",
    "   保留 `commandId` 与 `contentRevision` 不要动。",
    "3. 在 **UniversityLocal 项目根目录**执行：",
    "",
    ...fence(
      "bash",
      `pnpm university exercise host-grade --study ${locator.studyId} --input /tmp/ul-host-grade.json`,
    ),
    "",
    "4. 告诉学习者：回到浏览器，本课的评估会自动出现。",
    "",
    "### 写回 JSON 模板",
    "",
    ...fence("json", JSON.stringify(writeBack, null, 2)),
    "",
    "## 人类可读摘要",
    "",
    "我在 UniversityLocal 做练习。请按上面的任务判分、讲解、引申，并按 CLI 写回。",
    "",
  ].join("\n");
}
