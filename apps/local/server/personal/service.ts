import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

import {
  isUrlEvidence,
  localizeActivity,
  localizeLearnerContent,
  type LessonRef,
  type PrimmExecutionRequest,
  type PrimmActivity,
  PERSONAL_STUDY_ID as PRIVATE_STUDY_ID,
  PERSONAL_UNIT_ID as PRIVATE_UNIT_ID,
  PERSONAL_LESSON_ID as PRIVATE_LESSON_ID,
  PERSONAL_CARD_ID as PRIVATE_CARD_ID,
  PERSONAL_EXERCISE_ID as PRIVATE_EXERCISE_ID,
  personalCourseId as courseIdOf,
} from "@pieai/university-core";
import {
  LessonActivitySchema,
  type EvidenceReference,
  type Exercise,
} from "@pieai/university-core/domain/schemas.js";
import { readLatestCard, readLatestExercise, readLatestLesson } from "../content/repository.js";
import { buildLessonView } from "../http/views.js";
import { createCourse } from "../workflows/create-course.js";
import { createStudyWithSource } from "../workflows/create-study.js";
import {
  PersonalCreateRequestSchema,
  PersonalDraftSchema,
  type PersonalCreateRequest,
  type PersonalDraft,
} from "./contracts.js";

const MAX_EXCERPT = 4_000;

export interface PersonalCorpusEntry {
  readonly scopeLessonId: string;
  readonly title: string;
  readonly excerpt: string;
  readonly evidence: EvidenceReference;
}

export interface PersonalLessonGeneratorInput {
  readonly goal: string;
  readonly locale: "zh-CN" | "en";
  readonly corpus: readonly PersonalCorpusEntry[];
  readonly signal: AbortSignal;
  readonly onStage?: (stage: string) => void;
}

export interface PersonalGeneration {
  readonly draft: unknown;
  readonly review: {
    readonly writer: string;
    readonly detector: string;
    readonly polisher: string;
    readonly passed: true;
  };
}

export interface PersonalLessonServiceOptions {
  readonly corpusRoot: string;
  readonly scratchRoot: string;
  readonly projectRoot: string;
  readonly generate: (input: PersonalLessonGeneratorInput) => Promise<PersonalGeneration>;
  readonly now?: () => Date;
}

export interface PersonalLessonRecord {
  readonly contentId: string;
  readonly accountHash: string;
  readonly root: string;
  readonly goal: string;
  readonly title: string;
  readonly createdAt: string;
  readonly scope: PersonalCreateRequest["scope"];
  readonly locator: LessonRef;
  readonly unitObjective: string;
  readonly cardIds: readonly string[];
  readonly review: {
    readonly writer: string;
    readonly detector: string;
    readonly polisher: string;
    readonly passed: true;
    readonly structural: "passed";
    readonly reason: string;
  };
}

interface StoredMeta extends PersonalLessonRecord {
  readonly commandId: string;
  readonly createdAt: string;
  readonly sourceLessons: readonly string[];
  readonly originalGoal: string;
  readonly reviewResult: PersonalLessonRecord["review"];
  readonly completedCommands: readonly string[];
  readonly inputFingerprint: string;
  readonly passedMake?: { readonly commandId: string; readonly contentRevision: number };
}

export class PersonalLessonError extends Error {
  constructor(
    readonly code: "invalid" | "unsupported" | "unavailable" | "busy" | "cancelled" | "not-found",
    message: string,
  ) {
    super(message);
    this.name = "PersonalLessonError";
  }
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeAccountHash(accountScope: string): string {
  return hash(accountScope).slice(0, 32);
}

function contentIdOf(accountHash: string, commandId: string): string {
  return `${accountHash.slice(0, 12)}-${commandId.replaceAll("-", "").slice(0, 20)}`;
}

function assertPrivateRoot(options: PersonalLessonServiceOptions): void {
  const scratchRoot = resolve(options.scratchRoot);
  const expectedPrefix = `${resolve(options.projectRoot)}/.scratch/`;
  if (!scratchRoot.startsWith(expectedPrefix))
    throw new Error("Personal studies must stay under this worktree's .scratch directory");
  if (existsSync(scratchRoot) && lstatSync(scratchRoot).isSymbolicLink())
    throw new Error("Personal studies root must not be a symlink");
  mkdirSync(scratchRoot, { recursive: true, mode: 0o700 });
  if (!realpathSync(scratchRoot).startsWith(`${realpathSync(options.projectRoot)}/.scratch/`))
    throw new Error("Personal studies root resolves outside the isolated worktree");
}

function readMeta(root: string): StoredMeta {
  return JSON.parse(readFileSync(join(root, "personal-meta.json"), "utf8")) as StoredMeta;
}

function writeMeta(root: string, meta: StoredMeta): void {
  writeFileSync(join(root, "personal-meta.json"), `${JSON.stringify(meta, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
}

function createLocaleMap(
  zh: ReturnType<typeof expandLocale>,
  en: ReturnType<typeof expandLocale>,
): Record<string, string> {
  const strings: Record<string, string> = {};
  const add = (from: string | undefined, to: string | undefined) => {
    if (from && to) strings[from] = to;
  };
  for (const key of [
    "title",
    "connection",
    "situation",
    "need",
    "prompt",
    "predictQuestion",
    "runTitle",
    "runNote",
    "investigateTitle",
    "investigateBrief",
    "investigateExplanation",
    "modifyTitle",
    "modifyBrief",
    "modifyGoal",
    "makeTitle",
    "makeScenario",
    "makeGoal",
    "makePlaceholder",
    "finishTitle",
    "finishNote",
  ] as const)
    add(zh[key], en[key]);
  for (const [value, index] of (zh.predictOptions ?? []).map(
    (value, index) => [value, index] as const,
  ))
    add(value, en.predictOptions?.[index]);
  for (const [value, index] of zh.checklist.map((value, index) => [value, index] as const))
    add(value, en.checklist[index]);
  for (const [card, index] of (zh.investigateCards ?? []).map(
    (value, index) => [value, index] as const,
  )) {
    add(card.text, en.investigateCards?.[index]?.text);
    add(card.why, en.investigateCards?.[index]?.why);
  }
  for (const [piece, index] of (zh.modifyPieces ?? []).map(
    (value, index) => [value, index] as const,
  )) {
    add(piece.label, en.modifyPieces?.[index]?.label);
    add(piece.text, en.modifyPieces?.[index]?.text);
  }
  return strings;
}

function expandLocale(seed: PersonalDraft["zh"], english: boolean) {
  return {
    ...seed,
    predictQuestion:
      seed.predictQuestion ??
      (english ? "What do you expect this request to produce?" : "你预想这次请求会产出什么？"),
    predictOptions:
      seed.predictOptions ??
      (english
        ? ["A useful answer tied to the material.", "A claim the material cannot support."]
        : ["一份贴着材料的有用回答。", "材料无法支持的额外断言。"]),
    runTitle: seed.runTitle ?? (english ? "Run the prepared request" : "运行准备好的请求"),
    runNote:
      seed.runNote ??
      (english
        ? "Send the prepared request with the supplied material. Notice what the live result says and what it does not say."
        : "把准备好的请求和材料一起发出去。留意当前结果说了什么，也留意它没有说什么。"),
    investigateTitle:
      seed.investigateTitle ?? (english ? "Sort what the source supports" : "分清来源支持什么"),
    investigateBrief:
      seed.investigateBrief ??
      (english
        ? "Sort the statements, then read why each choice matters before you change the request."
        : "把这些说法分开，再读每个选择为什么重要，然后修改请求。"),
    modifyTitle: seed.modifyTitle ?? (english ? "Make the request more useful" : "让请求更有用"),
    modifyBrief:
      seed.modifyBrief ??
      (english
        ? "Add a purpose and a boundary to the original request, then compare the new result with the first one."
        : "给原请求补上目的和边界，再把新结果和第一次的结果放在一起看。"),
    modifyPieces:
      seed.modifyPieces ??
      (english
        ? [
            {
              label: "State the purpose",
              text: "Say who the result is for and what decision it should support.",
            },
            {
              label: "Keep the source boundary",
              text: "Ask the response to separate supported facts from open questions.",
            },
          ]
        : [
            { label: "说清目的", text: "说清这份结果给谁看、要帮助什么决定。" },
            { label: "保留来源边界", text: "要求回答把来源支持的事实和未解决的问题分开。" },
          ]),
    makeTitle:
      seed.makeTitle ?? (english ? "Use the method for your need" : "把方法用到你的需要上"),
    makePlaceholder:
      seed.makePlaceholder ??
      (english
        ? "What do you need the sourced result to help you do?"
        : "你需要这份有来源的结果帮你做什么？"),
    finishTitle: seed.finishTitle ?? (english ? "Keep the useful method" : "带走这条有用的方法"),
    finishNote:
      seed.finishNote ??
      (english
        ? "Give the AI a real material, name the purpose, and keep a visible boundary around what the source supports."
        : "给 AI 一份真实材料，说清目的，并把来源支持的范围留在明面上。"),
  };
}

function sourceFor(entry: PersonalCorpusEntry): { label: string; url: string } {
  if (!isUrlEvidence(entry.evidence))
    throw new PersonalLessonError("unsupported", "没有可安全复用的网页来源");
  return { label: entry.evidence.sourceTitle, url: entry.evidence.sourceUrl };
}

type ExpandedDraft = Omit<PersonalDraft, "zh" | "en"> & {
  zh: ReturnType<typeof expandLocale>;
  en: ReturnType<typeof expandLocale>;
};

function buildActivity(draft: ExpandedDraft, source: PersonalCorpusEntry) {
  const sourceReference = sourceFor(source);
  const cardIds = draft.zh.investigateCards.map(
    (_card: unknown, index: number) => `investigate-${index + 1}`,
  );
  const buckets = [
    { id: "grounded", label: "材料里确实有" },
    { id: "check", label: "还需要确认" },
  ];
  const activity = {
    id: "personal-primm",
    kind: "primm" as const,
    role: "apply" as const,
    difficulty: "intro" as const,
    title: draft.zh.title,
    brief: draft.zh.need,
    goal: draft.zh.makeGoal,
    takeaway: draft.zh.finishNote,
    hint: draft.zh.investigateExplanation,
    source: sourceReference,
    method: "PRIMM" as const,
    experienceVersion: 2 as const,
    intro: {
      connection: draft.zh.connection,
      situation: draft.zh.situation,
      need: draft.zh.need,
      sourceIds: ["source-1"],
    },
    sources: [
      {
        id: "source-1",
        reference: sourceReference,
        note: `复用已安装课程中的已核实来源：${source.title}`,
        summary: source.excerpt.slice(0, 1_000),
        limitation: "这条来源支持材料中的明确事实，不自动支持个人案例或模型输出的每个细节。",
      },
    ],
    materials: [
      {
        id: "source-material",
        sourceId: "source-1",
        label: "已核实的来源摘要",
        text: source.excerpt.slice(0, 2_000),
        kind: "source-summary" as const,
      },
      {
        id: "practice-material",
        label: "这次的练习材料（教学示例）",
        text: draft.zh.practiceText,
        kind: "practice" as const,
      },
      {
        id: "make-material",
        label: "换个情况，你来处理（教学示例）",
        text: draft.zh.makeText,
        kind: "practice" as const,
      },
    ],
    starter: {
      prompt: draft.zh.prompt,
      operation: "text" as const,
      materialIds: ["practice-material"],
      assetIds: [],
    },
    predict: {
      question: draft.zh.predictQuestion,
      options: draft.zh.predictOptions.map((label: string, index: number) => ({
        id: `option-${index + 1}`,
        label,
      })),
    },
    run: {
      title: draft.zh.runTitle,
      note: draft.zh.runNote,
      attachmentLabel: "把练习材料放进对话",
    },
    investigate: {
      title: draft.zh.investigateTitle,
      brief: draft.zh.investigateBrief,
      explanation: draft.zh.investigateExplanation,
      game: {
        kind: "sort" as const,
        buckets,
        cards: draft.zh.investigateCards.map(
          (card: { text: string; bucket: "grounded" | "check"; why: string }, index: number) => ({
            id: cardIds[index]!,
            text: card.text,
            bucketId: card.bucket,
            why: card.why,
          }),
        ),
      },
    },
    modify: {
      title: draft.zh.modifyTitle,
      brief: draft.zh.modifyBrief,
      goal: draft.zh.modifyGoal,
      workbench: {
        instruction: draft.zh.modifyBrief,
        carryObservation: true,
        pieces: draft.zh.modifyPieces.map(
          (piece: { label: string; text: string }, index: number) => ({
            id: `piece-${index + 1}`,
            label: piece.label,
            text: piece.text,
          }),
        ),
      },
    },
    make: {
      title: draft.zh.makeTitle,
      scenario: draft.zh.makeScenario,
      goal: draft.zh.makeGoal,
      operation: "text" as const,
      materialIds: ["make-material"],
      assetIds: [],
      promptPlaceholder: draft.zh.makePlaceholder,
      checklist: draft.zh.checklist,
      exerciseId: PRIVATE_EXERCISE_ID,
      artifactLabel: "这次做出来的结果",
    },
    finish: { title: draft.zh.finishTitle, note: draft.zh.finishNote },
  };
  const strings = createLocaleMap(draft.zh, draft.en);
  strings[draft.zh.practiceText] = draft.en.practiceText;
  strings[draft.zh.makeText] = draft.en.makeText;
  Object.assign(strings, {
    材料里确实有: "Present in the material",
    还需要确认: "Needs confirmation",
    把练习材料放进对话: "Add the practice material to the conversation",
    [sourceReference.label]: sourceReference.label,
    [source.excerpt.slice(0, 1_000)]: source.excerpt.slice(0, 1_000),
    [source.excerpt.slice(0, 2_000)]: source.excerpt.slice(0, 2_000),
    已核实的来源摘要: "Verified source summary",
    "这次的练习材料（教学示例）": "Practice material (teaching example)",
    "换个情况，你来处理（教学示例）": "Try another situation (teaching example)",
    这次做出来的结果: "Your result",
    [`复用已安装课程中的已核实来源：${source.title}`]: `Verified reference from the installed lesson: ${source.title}`,
    "这条来源支持材料中的明确事实，不自动支持个人案例或模型输出的每个细节。":
      "This reference supports the described method, not every detail of the practice story or AI output.",
  });
  return {
    ...activity,
    locales: {
      en: {
        title: draft.en.title,
        brief: draft.en.need,
        goal: draft.en.makeGoal,
        takeaway: draft.en.finishNote,
        hint: draft.en.investigateExplanation,
        sourceLabel: sourceReference.label,
        strings,
      },
    },
  };
}

function buildContent(
  locale: PersonalDraft["zh"] | PersonalDraft["en"],
  source: PersonalCorpusEntry,
  activityId: string,
  english: boolean,
): string {
  const labels = english
    ? ["Predict and observe", "The source used here", "Keep the boundary clear"]
    : ["先猜，再观察", "这节课使用的来源", "记住边界"];
  const sourceIntro = english
    ? `This is not a fresh web search. It is verified material matched from the scope you selected: **${source.title}**. Keep source facts separate from the current AI output.`
    : `这不是新搜索结果，而是从你选定范围中匹配到的已核实材料：**${source.title}**。请把来源中的事实和后面 AI 的当前输出分开看。`;
  const boundary = english
    ? "This private lesson keeps only what the source can support. If the source cannot cover your need, generation stops instead of inventing a case or citation. After Make, the card enters the existing FSRS review queue."
    : "这节个人课只保留来源能支持的事实；如果来源覆盖不了你的需要，系统会停止生成，不会补写案例或引用。完成 Make 后，卡片会进入已有 FSRS 复习队列。";
  return `# ${locale.title}\n\n${locale.connection}\n\n${locale.situation}\n\n${locale.need}\n\n## ${labels[0]}\n\n${locale.predictQuestion}\n\n## ${labels[1]}\n\n${sourceIntro}\n\n[${english ? "Open the source" : "打开来源"}](${sourceFor(source).url})\n\n::play{#${activityId}}\n\n## ${labels[2]}\n\n${boundary}`;
}

export class PersonalLessonService {
  private readonly options: PersonalLessonServiceOptions;
  private active = false;
  private used = 0;

  constructor(options: PersonalLessonServiceOptions) {
    assertPrivateRoot(options);
    this.options = options;
  }

  private corpusFor(scope: PersonalCreateRequest["scope"]): readonly PersonalCorpusEntry[] {
    return scope.lessonIds.flatMap((lessonId) => {
      const lesson = readLatestLesson(
        this.options.corpusRoot,
        scope.studyId,
        scope.courseId,
        scope.unitId,
        lessonId,
      );
      const evidence = lesson.manifest.evidence.find(isUrlEvidence);
      return evidence
        ? [
            {
              scopeLessonId: lessonId,
              title: lesson.manifest.title,
              excerpt: evidence.provenance
                ? `${evidence.provenance.supports}\n${evidence.provenance.limitations}`.slice(
                    0,
                    MAX_EXCERPT,
                  )
                : lesson.content.replace(/::play\{[^}]*\}/g, "").slice(0, MAX_EXCERPT),
              evidence,
            },
          ]
        : [];
    });
  }

  async create(
    raw: unknown,
    signal: AbortSignal,
    onStage?: (stage: string) => void,
  ): Promise<PersonalLessonRecord> {
    const input = PersonalCreateRequestSchema.parse(raw);
    const accountHash = safeAccountHash(input.accountScope);
    const contentId = contentIdOf(accountHash, input.commandId);
    const courseId = courseIdOf(contentId);
    const inputFingerprint = hash(JSON.stringify(input));
    const existingRoot = join(this.options.scratchRoot, "accounts", accountHash, contentId);
    if (existsSync(join(existingRoot, "personal-meta.json"))) {
      const existing = readMeta(existingRoot);
      if (existing.inputFingerprint !== inputFingerprint)
        throw new PersonalLessonError("invalid", "同一个 command ID 不能改写原始需要");
      return existing;
    }
    if (this.active) throw new PersonalLessonError("busy", "已有一条个人课正在生成，请稍后重试");
    if (this.used >= 12)
      throw new PersonalLessonError(
        "unavailable",
        "本次本机试验的生成额度已用完，已有课程仍可继续学",
      );
    if (signal.aborted) throw new PersonalLessonError("cancelled", "个人课生成已取消");
    this.active = true;
    this.used += 1;
    try {
      const corpus = this.corpusFor(input.scope);
      if (!corpus.length)
        throw new PersonalLessonError(
          "unsupported",
          "选定范围没有可复用的已核实网页来源，暂时不能安全生成个人课",
        );
      const generatedResult = await this.options.generate({
        goal: input.goal,
        locale: input.locale,
        corpus,
        signal,
        onStage,
      });
      if (signal.aborted) throw new PersonalLessonError("cancelled", "个人课生成已取消");
      if (
        generatedResult.review.passed !== true ||
        !generatedResult.review.writer ||
        !generatedResult.review.detector ||
        !generatedResult.review.polisher
      )
        throw new PersonalLessonError(
          "unavailable",
          "课程还没有完成独立审查和润色，不能作为可学的新课提供",
        );
      const draft = PersonalDraftSchema.parse(generatedResult.draft);
      if (!draft.covered)
        throw new PersonalLessonError(
          "unsupported",
          draft.unsupportedReason ?? "现有来源无法覆盖这个需要",
        );
      if (draft.sourceIndex >= corpus.length)
        throw new PersonalLessonError("unsupported", "模型选择的来源不在已核实材料范围内");
      const source = corpus[draft.sourceIndex]!;
      const generated: ExpandedDraft = {
        ...draft,
        zh: expandLocale(draft.zh, false),
        en: expandLocale(draft.en, true),
      };
      // Both languages must teach the same task and judge the same choices.
      for (const key of [
        "predictOptions",
        "investigateCards",
        "modifyPieces",
        "checklist",
        "rubric",
      ] as const) {
        if (generated.zh[key].length !== generated.en[key].length)
          throw new PersonalLessonError("invalid", "中英文练习没有一一对应，这节课还需要修改。");
      }
      if (
        generated.zh.investigateCards.some(
          (card, index) => card.bucket !== generated.en.investigateCards[index]?.bucket,
        )
      )
        throw new PersonalLessonError("invalid", "中英文练习的判断不一致，这节课还需要修改。");
      const activity = LessonActivitySchema.parse(buildActivity(generated, source));
      // A failed native write must not poison a retry with a half-created study.
      // Failed staging stays private for diagnosis; only atomic promotion is ready.
      const root = join(this.options.scratchRoot, ".pending", randomUUID());
      mkdirSync(root, { recursive: true, mode: 0o700 });
      createStudyWithSource({
        studiesRoot: root,
        id: PRIVATE_STUDY_ID,
        title: "个人需要（本地私有）",
        description: "只服务当前账号的本地个人课，不进入公共书架。",
        goals: [input.goal],
      });
      const now = (this.options.now?.() ?? new Date()).toISOString();
      const proposal = {
        schemaVersion: 1,
        proposalId: `personal-${contentId}`,
        course: {
          id: courseId,
          title: draft.zh.title,
          description: "根据一次真实个人需要，从已核实课程材料匹配出的私有小课。",
          audience: "提出这个具体需要的学习者",
          objectives: [draft.zh.makeGoal],
          locales: {
            en: {
              title: draft.en.title,
              description: "A private lesson matched from verified installed course material.",
              audience: "The learner who raised this need.",
              objectives: [draft.en.makeGoal],
            },
          },
          units: [
            {
              id: PRIVATE_UNIT_ID,
              title: "这次个人需要",
              objective: draft.zh.makeGoal,
              locales: { en: { title: "This personal need", objective: draft.en.makeGoal } },
              lessons: [
                {
                  id: PRIVATE_LESSON_ID,
                  title: draft.zh.title,
                  content: buildContent(generated.zh, source, activity.id, false),
                  locales: {
                    en: {
                      title: generated.en.title,
                      content: buildContent(generated.en, source, activity.id, true),
                    },
                  },
                  variant: "决策",
                  activities: [activity],
                  evidence: [source.evidence],
                  cards: [
                    {
                      id: PRIVATE_CARD_ID,
                      front: draft.zh.cardFront,
                      back: draft.zh.cardBack,
                      evidence: [source.evidence],
                      locales: { en: { front: draft.en.cardFront, back: draft.en.cardBack } },
                    },
                  ],
                  exercises: [
                    {
                      id: PRIVATE_EXERCISE_ID,
                      kind: "explain",
                      title: draft.zh.exerciseTitle,
                      prompt: draft.zh.exercisePrompt,
                      rubric: draft.zh.rubric,
                      evidence: [source.evidence],
                      locales: {
                        en: {
                          title: draft.en.exerciseTitle,
                          prompt: draft.en.exercisePrompt,
                          rubric: draft.en.rubric,
                        },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      };
      createCourse({
        studiesRoot: root,
        studyId: PRIVATE_STUDY_ID,
        proposal,
        now: this.options.now?.(),
      });
      const meta: StoredMeta = {
        contentId,
        accountHash: safeAccountHash(input.accountScope),
        root: existingRoot,
        goal: input.goal,
        originalGoal: input.goal,
        scope: input.scope,
        title: draft.zh.title,
        locator: {
          studyId: PRIVATE_STUDY_ID,
          courseId,
          unitId: PRIVATE_UNIT_ID,
          lessonId: PRIVATE_LESSON_ID,
        },
        unitObjective: generated.zh.makeGoal,
        cardIds: [PRIVATE_CARD_ID],
        commandId: input.commandId,
        createdAt: now,
        sourceLessons: corpus.map((entry) => entry.scopeLessonId),
        reviewResult: {
          ...generatedResult.review,
          structural: "passed",
          reason: "原生课程校验、独立教学审查与最终润色均已完成。",
        },
        review: {
          ...generatedResult.review,
          structural: "passed",
          reason: "原生课程校验、独立教学审查与最终润色均已完成。",
        },
        completedCommands: [],
        inputFingerprint,
      };
      if (signal.aborted) throw new PersonalLessonError("cancelled", "个人课生成已取消");
      writeMeta(root, meta);
      mkdirSync(join(this.options.scratchRoot, "accounts", accountHash), {
        recursive: true,
        mode: 0o700,
      });
      renameSync(root, existingRoot);
      return meta;
    } finally {
      this.active = false;
    }
  }

  get(contentId: string, accountScope: string): PersonalLessonRecord {
    courseIdOf(contentId);
    const root = join(
      this.options.scratchRoot,
      "accounts",
      safeAccountHash(accountScope),
      contentId,
    );
    try {
      const meta = readMeta(root);
      if (meta.contentId !== contentId || meta.accountHash !== safeAccountHash(accountScope))
        throw new Error();
      return meta;
    } catch {
      throw new PersonalLessonError("not-found", "个人课不存在，或不属于当前账号");
    }
  }

  list(accountScope: string): readonly PersonalLessonRecord[] {
    const folder = join(this.options.scratchRoot, "accounts", safeAccountHash(accountScope));
    if (!existsSync(folder)) return [];
    return readdirSync(folder)
      .flatMap((id) => {
        try {
          return [this.get(id, accountScope)];
        } catch {
          return [];
        }
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50);
  }

  lessonView(contentId: string, accountScope: string): unknown {
    const meta = this.get(contentId, accountScope);
    const view = buildLessonView(meta.root, meta.locator, null, []);
    return view;
  }

  card(
    contentId: string,
    accountScope: string,
  ): { front: string; back: string; contentRevision: number } {
    const meta = this.get(contentId, accountScope);
    const card = readLatestCard(
      meta.root,
      meta.locator.studyId,
      meta.locator.courseId,
      meta.locator.unitId,
      meta.locator.lessonId,
      PRIVATE_CARD_ID,
    );
    return card;
  }

  recordPassedMake(
    contentId: string,
    accountScope: string,
    commandId: string,
    contentRevision: number,
  ) {
    const meta = this.get(contentId, accountScope) as StoredMeta;
    const next = { ...meta, passedMake: { commandId, contentRevision } };
    this.replaceMeta(next);
  }

  private replaceMeta(meta: StoredMeta) {
    const staged = join(meta.root, "personal-meta.next.json");
    writeFileSync(staged, `${JSON.stringify(meta, null, 2)}\n`, { mode: 0o600 });
    renameSync(staged, join(meta.root, "personal-meta.json"));
  }

  complete(contentId: string, accountScope: string, commandId: string): PersonalLessonRecord {
    const meta = this.get(contentId, accountScope) as StoredMeta;
    if (!/^[a-f0-9-]{36}$/i.test(commandId) || !meta.passedMake)
      throw new PersonalLessonError("invalid", "先完成这节课的独立任务，再保存学习结果");
    const current = readLatestLesson(
      meta.root,
      meta.locator.studyId,
      meta.locator.courseId,
      meta.locator.unitId,
      meta.locator.lessonId,
    );
    if (current.manifest.contentRevision !== meta.passedMake.contentRevision)
      throw new PersonalLessonError("invalid", "这节课已更新，请先完成当前版本的独立任务。");
    if (!meta.completedCommands.includes(commandId)) {
      const next = {
        ...meta,
        completedCommands: [...meta.completedCommands, commandId].slice(-10),
      };
      this.replaceMeta(next);
      return next;
    }
    return meta;
  }

  async canonical(contentId: string, accountScope: string, input: PrimmExecutionRequest) {
    const meta = this.get(contentId, accountScope);
    const stored = readLatestLesson(
      meta.root,
      meta.locator.studyId,
      meta.locator.courseId,
      meta.locator.unitId,
      meta.locator.lessonId,
    );
    const raw = stored.manifest.activities.find((activity) => activity.kind === "primm");
    if (!raw) throw new PersonalLessonError("not-found", "个人课的 PRIMM 活动不存在");
    const activity = localizeActivity(
      LessonActivitySchema.parse(raw) as unknown as PrimmActivity,
      input.locale,
    );
    const exercise = localizeLearnerContent(
      readLatestExercise(
        meta.root,
        meta.locator.studyId,
        meta.locator.courseId,
        meta.locator.unitId,
        meta.locator.lessonId,
        PRIVATE_EXERCISE_ID,
      ),
      input.locale,
    ) as Exercise;
    if (
      input.contentRevision !== stored.manifest.contentRevision ||
      input.lessonRef.studyId !== meta.locator.studyId ||
      input.lessonRef.courseId !== meta.locator.courseId ||
      input.lessonRef.unitId !== meta.locator.unitId ||
      input.lessonRef.lessonId !== meta.locator.lessonId
    )
      throw new PersonalLessonError("not-found", "个人课版本已变化，请重新生成");
    return {
      activity,
      contentRevision: stored.manifest.contentRevision,
      exercise: {
        id: exercise.id,
        prompt: exercise.prompt,
        rubric: exercise.kind === "explain" ? exercise.rubric : [],
      },
      exerciseRevision: exercise.contentRevision,
      assets: [],
      fingerprint: hash(JSON.stringify(stored)),
    };
  }
}

export {
  PRIVATE_CARD_ID,
  PRIVATE_EXERCISE_ID,
  PRIVATE_LESSON_ID,
  PRIVATE_STUDY_ID,
  PRIVATE_UNIT_ID,
  courseIdOf,
};
