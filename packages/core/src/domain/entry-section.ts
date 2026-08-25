import { z } from "zod";

import { SenseId, StableId } from "./schemas.js";

/**
 * The typed blocks an entry body is made of.
 *
 * This is not one independent feature per ledger row. SPEC-0002 listed them as
 * modules because VibeHub named them that way; SPEC-0004 is the count of
 * *shapes*. `agent-prompt` is C20 and F10 — a pasteable paragraph for an AI
 * agent, on a term page or an anti-pattern page. `related` is C21 and F12 —
 * pointers at other senses, whether the heading says 「接下来学」 or 「相关术语」.
 * `when-not` is F8 and the negative half of C24. Built as separate components,
 * this product would ship two implementations of one thing on day one.
 *
 * C10 (`flow`) is the readable chain: where this entry sits in a path.
 * `demo` is C9 and C11 — one miniature with one state or several — and
 * `style-sample` is a fixed product mockup with a swappable visual skin.
 * `regions` is C12. They arrived later than the text types and that order was
 * right: a demo is only worth building once there is a page for it to sit on.
 *
 * An unknown type degrades instead of taking the page down, which is what lets
 * a type be added here before every shell knows how to draw it.
 */
export const SECTION_TYPES = [
  "colloquial",
  "definition",
  "aliases",
  "prerequisites",
  "anatomy",
  "flow",
  "variants",
  "use-dont",
  "distinction",
  "plain",
  "agent-prompt",
  "related",
  "before-after",
  "when-not",
  "quiz",
  "demo",
  "style-sample",
  "regions",
] as const;

export type EntrySectionType = (typeof SECTION_TYPES)[number];

export const SectionTypeSchema = z.enum(SECTION_TYPES);

export function isEntrySectionType(value: string): value is EntrySectionType {
  return (SECTION_TYPES as readonly string[]).includes(value);
}

/**
 * The heading each type uses in Markdown *and* on the page.
 *
 * One string per type so the clipboard and the renderer cannot drift. The
 * merged types keep one heading on purpose: a second label would be the split
 * this registry exists to prevent.
 */
export const SECTION_HEADING: { readonly [T in EntrySectionType]: string } = {
  colloquial: "你可能会说",
  definition: "定义",
  aliases: "也常被叫作",
  prerequisites: "先知道",
  anatomy: "组成结构",
  flow: "在这条链路里",
  variants: "常见变体",
  "use-dont": "该用 / 不该用",
  distinction: "容易混淆",
  plain: "通俗解释",
  "agent-prompt": "你可以这样告诉 AI Agent",
  related: "相关",
  "before-after": "改前 / 改后",
  "when-not": "什么时候不用",
  quiz: "小测",
  demo: "动手看看",
  "style-sample": "换个风格看看",
  regions: "点一下试试",
};

const ShortName = z.string().trim().min(1).max(80);
const Sentence = z.string().trim().min(1).max(500);
const Paragraph = z.string().trim().min(1).max(2_000);
const Prompt = z.string().trim().min(1).max(4_000);
const SenseIdList = z.array(SenseId).min(1).max(20);

/** C5. One sentence a beginner would actually say, not a gloss restated. */
const ColloquialPayloadSchema = z
  .object({
    text: z.string().trim().min(1).max(300),
  })
  .strict();

/**
 * C6. The page-body definition, including the optional 「它不是」 that the
 * lexicon gloss does not carry.
 *
 * Both fields are optional so a term whose head already has `gloss` can add
 * only the boundary, and an anti-pattern (no lexicon gloss) can still state
 * what the thing is. At least one must be present or the section is empty.
 */
const DefinitionPayloadSchema = z
  .object({
    statement: z.string().trim().min(1).max(500).optional(),
    not: z.string().trim().min(1).max(300).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.statement === undefined && value.not === undefined) {
      context.addIssue({
        code: "custom",
        message: "A definition needs a statement, what it is not, or both.",
      });
    }
  });

/** C8. Other names for the same sense, so search and the page agree. */
const AliasesPayloadSchema = z
  .object({
    names: z.array(ShortName).min(1).max(20),
  })
  .strict();

/** C7. Typed backward edges. A `[[lesson:]]` link is not a prerequisite. */
const PrerequisitesPayloadSchema = z
  .object({
    senseIds: SenseIdList,
  })
  .strict();

/**
 * C10. Caption under the heading, so the clipboard and the page explain the
 * same highlight. The mark on a current step is 「本页重点」; this sentence is
 * why that mark is there.
 */
export const FLOW_CAPTION = "突出显示的步骤，就是你刚学的这个东西在整条链路里站的位置。";

/**
 * C13. Numbered parts of the thing being named.
 *
 * The number is the index. Storing it would be a second copy of order, and the
 * first edit that reshuffled the list would desync the two.
 */
const AnatomyPayloadSchema = z
  .object({
    parts: z
      .array(
        z
          .object({
            name: ShortName,
            note: Sentence,
          })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict();

/**
 * C10. An ordered path, with this entry's own step marked.
 *
 * The highlight is the whole module. A beginner gets lost not because they
 * cannot read a definition, but because they cannot see where the thing they
 * just learned sits in the work. Steps live on the entry, not in a shared flow
 * catalogue: sharing a path across terms is content reuse, not a second schema
 * — copy the steps and flip the flags. Interactive zone mockups are a later
 * demo type; this is the readable chain those demos would sit on.
 *
 * At least one step must be current. A path with no highlight is a different
 * section, and a weaker one.
 */
const FlowPayloadSchema = z
  .object({
    title: ShortName,
    steps: z
      .array(
        z
          .object({
            label: ShortName,
            description: Sentence,
            current: z.boolean().default(false),
          })
          .strict(),
      )
      .min(2)
      .max(20),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.steps.some((step) => step.current)) {
      context.addIssue({
        code: "custom",
        message:
          "A flow needs at least one current step; the highlight is the point of the section.",
      });
    }
  });

/** C14. A variant and the situation that picks it. Live miniatures come later. */
const VariantsPayloadSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            name: ShortName,
            when: Sentence,
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();

/**
 * C16. Two columns of guidance, not a single "best practice" paragraph.
 *
 * Both sides are required because a list of only "do" or only "don't" is a
 * different section (`when-not` covers the negative-applicability case).
 */
const UseDontPayloadSchema = z
  .object({
    use: z.array(Sentence).min(1).max(20),
    dont: z.array(Sentence).min(1).max(20),
  })
  .strict();

/**
 * C17. X ≠ Y and the one-sentence tell.
 *
 * Names are strings, not sense ids, because a distinction often names something
 * that is not in this lexicon yet. Linking is a renderer concern when a lookup
 * is supplied.
 */
const DistinctionPayloadSchema = z
  .object({
    pairs: z
      .array(
        z
          .object({
            left: ShortName,
            right: ShortName,
            how: Sentence,
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();

/** C18. Several short paragraphs. Cause/fix prose can live here until it earns a type. */
const PlainPayloadSchema = z
  .object({
    paragraphs: z.array(Paragraph).min(1).max(20),
  })
  .strict();

/**
 * C20 and F10. One type: a paragraph the learner can paste to an agent.
 *
 * The page renderer owes this a copy button. VibeHub's version did not have
 * one; that is a free win, not a second section type.
 */
const AgentPromptPayloadSchema = z
  .object({
    text: Prompt,
  })
  .strict();

/**
 * C21 and F12. One type: an ordered list of other senses.
 *
 * "What to learn next" and "related terms" are the same edge with different
 * labels. The heading is 「相关」 for both collections so we do not grow a
 * `kind: "next" | "related"` that splits them again.
 */
const RelatedPayloadSchema = z
  .object({
    senseIds: SenseIdList,
  })
  .strict();

/** F5. One rewrite pair. Visual demos of the same contrast are a later type. */
const BeforeAfterPayloadSchema = z
  .object({
    before: Paragraph,
    after: Paragraph,
  })
  .strict();

/**
 * F8 and C24's "when not to use it". Negative applicability: when the
 * anti-pattern does not count, or when the style is the wrong tool.
 */
const WhenNotPayloadSchema = z
  .object({
    cases: z.array(Sentence).min(1).max(20),
  })
  .strict();

/**
 * An option's id, which is allowed to be one character.
 *
 * `StableId` requires two, and it is right to: it names entities that appear in
 * URLs, filenames and cross-references, where a one-letter id is a collision
 * waiting to happen. An option id is scoped to the three options of a single
 * question, never leaves the payload, and its natural values are `a`, `b`, `c`
 * — the same letters the block puts on screen. Borrowing the entity rule here
 * bought nothing and silently dropped 281 quizzes the first time it was tried.
 */
const OptionId = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "option id must be lowercase kebab");

/**
 * C19. The three-option judgement, embedded in the entry it belongs to.
 *
 * The same shape `ChoiceBlock` already renders and `validateChoiceExercise`
 * already checks, minus everything that ties a stored `ChoiceExercise` to a
 * lesson — course, unit, revision, content hash, evidence. A concept page has
 * none of those and inventing them would be a fake anchor.
 *
 * That overlap is the architecture worth copying rather than a coincidence:
 * the practice bank *is* the per-entry quiz, so a question the learner meets in
 * the stream is the same record as the one on the page, and there is no second
 * corpus to keep in sync.
 */
const QuizPayloadSchema = z
  .object({
    question: Paragraph,
    options: z
      .array(
        z
          .object({
            id: OptionId,
            text: Paragraph,
            explanation: Paragraph,
          })
          .strict(),
      )
      .length(3),
    correctOptionId: OptionId,
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.options.map((option) => option.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: "custom", message: "Option ids must be unique." });
    }
    if (!ids.includes(value.correctOptionId)) {
      context.addIssue({
        code: "custom",
        message: `correctOptionId "${value.correctOptionId}" is not one of the options.`,
      });
    }
  });

/**
 * The vocabulary a miniature demo is built from. Nine leaves and two containers.
 *
 * Deliberately not arbitrary markup. A demo authored as HTML would be a second
 * component library nobody reviews, it would drift from the product's own
 * controls the first time a token changed, and it would put author-supplied
 * markup on a page — three separate problems for one convenience.
 *
 * Every leaf maps onto a control the brand kit already ships, which is the
 * whole reason this is affordable: the demo of 「按钮」 *is* the product's
 * button, so switching the theme re-paints all 281 demos and the reader learns
 * what a design variable does by watching it happen. The kit is also where
 * focus rings, disabled semantics and reduced-motion already live, so a demo
 * cannot be less accessible than the real control.
 *
 * Containers hold leaves and never other containers. Two levels of grouping —
 * a stack of rows — draws every mockup this catalogue needs, and a recursive
 * tree would buy arbitrary depth at the price of an unbounded render.
 */
const DemoLeafSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: Sentence, muted: z.boolean().optional() }).strict(),
  z
    .object({
      kind: z.literal("button"),
      label: ShortName,
      variant: z.enum(["primary", "secondary", "ghost", "danger", "success"]).optional(),
      disabled: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("input"),
      label: ShortName.optional(),
      value: z.string().max(120).optional(),
      placeholder: z.string().max(120).optional(),
      invalid: z.boolean().optional(),
    })
    .strict(),
  z.object({ kind: z.literal("toggle"), label: ShortName, checked: z.boolean() }).strict(),
  z
    .object({
      kind: z.literal("slider"),
      label: ShortName,
      value: z.number(),
      min: z.number().optional(),
      max: z.number().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("badge"),
      label: ShortName,
      tone: z.enum(["neutral", "success", "warning", "danger", "ai"]).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("progress"),
      label: ShortName,
      value: z.number(),
      max: z.number().optional(),
    })
    .strict(),
  /**
   * A real rule. Added because the first authored demo for 「分割线」 drew one
   * out of box-drawing characters — a workaround that renders as literal text,
   * does not follow the theme, and reads as a string of dashes to a screen
   * reader. When authors start faking a primitive, the primitive is missing.
   */
  z.object({ kind: z.literal("divider") }).strict(),
  /** A grey placeholder standing in for content, so a layout demo is about layout. */
  z
    .object({
      kind: z.literal("block"),
      label: ShortName.optional(),
      height: z.enum(["short", "tall"]).optional(),
    })
    .strict(),
]);

// `row` and `stack` are two literal members rather than one member with a
// two-value `kind`. Only literals make this a discriminated union, and only a
// discriminated union lets a renderer narrow "not a container" by elimination
// instead of re-listing all nine leaves every time a new one is added.
const DemoContainerChildren = z.array(DemoLeafSchema).min(1).max(12);

const DemoNodeSchema = z.discriminatedUnion("kind", [
  ...DemoLeafSchema.options,
  z.object({ kind: z.literal("row"), children: DemoContainerChildren }).strict(),
  z.object({ kind: z.literal("stack"), children: DemoContainerChildren }).strict(),
]);

/**
 * C9 and C11. One type, because they are one thing with a different number of
 * states: a single state is the static miniature in the hero, and two or more
 * is the state switch. Splitting them would ship two renderers that draw the
 * same nodes.
 *
 * `alt` is required and is not decoration. This section is the one place in the
 * catalogue where the meaning is carried by arrangement rather than by
 * sentences, so a reader who cannot see the arrangement gets a sentence that
 * says what it shows.
 */
const DemoPayloadSchema = z
  .object({
    alt: Sentence,
    caption: Sentence.optional(),
    states: z
      .array(
        z
          .object({
            id: StableId,
            label: ShortName,
            note: Sentence.optional(),
            nodes: z.array(DemoNodeSchema).min(1).max(12),
          })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.states.map((state) => state.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: "custom", message: "State ids must be unique." });
    }
  });

/**
 * A single fixed mockup with swappable CSS skins. This is the catalogue's
 * version of CSS Zen Garden (2003): one HTML structure, many stylesheets. The
 * product copy and DOM stay constant so the learner can see what the skin
 * changes instead of confusing a new product with a new visual language.
 */
export const STYLE_SKIN_IDS = [
  "apple",
  "brutalism",
  "minimal",
  "memphis",
  "notion",
  "art-deco",
  "bento",
  "editorial",
  "glass",
  "flat",
  "swiss",
  "playful",
  "skeuomorphism",
  "material",
  "neumorphism",
  "terminal",
  "saas",
  "y2k",
  "enterprise",
  "organic",
  "commerce",
  "wabisabi",
  "dark-tech",
  "bauhaus",
] as const;
export const StyleSkinIdSchema = z.enum(STYLE_SKIN_IDS);
export type StyleSkinId = z.infer<typeof StyleSkinIdSchema>;

/**
 * What to call each skin on the compare switch.
 *
 * Beside the id list rather than in the renderer, and `satisfies` rather than
 * a test, so **a skin cannot be added without a name**: the map is checked
 * against `StyleSkinId` at compile time and a missing key is a type error.
 *
 * It shipped the other way first. The renderer kept its own two-entry map and
 * fell back to the raw id, so when 22 skins arrived the switch offered
 * 「wabisabi」 and 「dark-tech」 to a Chinese-reading beginner and nothing failed.
 * These match the entry names in `concepts/data/design.ts`; the entry titles a
 * page, this labels a button, and neither can quietly lose the other.
 */
export const STYLE_SKIN_LABELS = {
  apple: "苹果风",
  brutalism: "新粗野",
  minimal: "现代简约",
  memphis: "孟菲斯",
  notion: "Notion 风",
  "art-deco": "装饰艺术",
  bento: "Bento 便当格",
  editorial: "杂志编辑风",
  glass: "玻璃拟态",
  flat: "扁平化",
  swiss: "瑞士排版",
  playful: "趣味插画",
  skeuomorphism: "拟物化",
  material: "材料设计",
  neumorphism: "新拟态",
  terminal: "终端极客风",
  saas: "SaaS 产品官网",
  y2k: "Y2K",
  enterprise: "B2B 企业官网",
  organic: "有机设计",
  commerce: "DTC 品牌电商",
  wabisabi: "日式侘寂",
  "dark-tech": "深色界面",
  bauhaus: "包豪斯",
} as const satisfies Record<StyleSkinId, string>;

export const STYLE_SAMPLE_PAGE = {
  brand: "MOKO",
  navLinks: ["产品", "价格", "文档"],
  navAction: "登录",
  headline: "把想法做成能打开的东西",
  sub: "选个模板，改几行字，两分钟后你有一条能发给别人的链接。",
  primary: "免费开始",
  secondary: "先看示例",
  cards: [
    { title: "现成模板", note: "挑一个，改文字就行。" },
    { title: "边改边看", note: "改完立刻出现，不用刷新。" },
    { title: "一键发布", note: "生成一条链接，谁都能打开。" },
  ],
  footnote: "MOKO 是示意用的虚构产品，不是真实网站。",
} as const;

export const StyleSamplePayloadSchema = z
  .object({
    alt: Sentence,
    caption: Sentence.optional(),
    skin: StyleSkinIdSchema,
    contrastSkin: StyleSkinIdSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.contrastSkin !== undefined && value.contrastSkin === value.skin) {
      context.addIssue({
        code: "custom",
        path: ["contrastSkin"],
        message: "contrastSkin must differ from skin.",
      });
    }
  });

/**
 * C12. Click the part of the mockup being named.
 *
 * Their most distinctive exercise, and the reason is worth stating: a learner
 * can pass a multiple-choice question about 「首屏」 by recognising the word,
 * and can only pass this by finding the thing. Labels stay hidden until the
 * right region is clicked, or the question answers itself.
 *
 * A keyboard user gets the same exercise because the regions are buttons.
 */
const RegionsPayloadSchema = z
  .object({
    question: Sentence,
    regions: z
      .array(
        z
          .object({
            id: StableId,
            label: ShortName,
            /** Rendered width, so the mockup looks like the page it is imitating. */
            span: z.enum(["full", "half"]).optional(),
            height: z.enum(["short", "tall"]).optional(),
          })
          .strict(),
      )
      .min(2)
      .max(10),
    correctRegionId: StableId,
    /** One sentence, shown once the right region is found. */
    reveal: Sentence,
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.regions.map((region) => region.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: "custom", message: "Region ids must be unique." });
    }
    if (!ids.includes(value.correctRegionId)) {
      context.addIssue({
        code: "custom",
        message: `correctRegionId "${value.correctRegionId}" is not one of the regions.`,
      });
    }
  });

export type DemoNode = z.infer<typeof DemoNodeSchema>;

export const SECTION_PAYLOAD_SCHEMAS = {
  colloquial: ColloquialPayloadSchema,
  definition: DefinitionPayloadSchema,
  aliases: AliasesPayloadSchema,
  prerequisites: PrerequisitesPayloadSchema,
  anatomy: AnatomyPayloadSchema,
  flow: FlowPayloadSchema,
  variants: VariantsPayloadSchema,
  "use-dont": UseDontPayloadSchema,
  distinction: DistinctionPayloadSchema,
  plain: PlainPayloadSchema,
  "agent-prompt": AgentPromptPayloadSchema,
  related: RelatedPayloadSchema,
  "before-after": BeforeAfterPayloadSchema,
  "when-not": WhenNotPayloadSchema,
  quiz: QuizPayloadSchema,
  demo: DemoPayloadSchema,
  "style-sample": StyleSamplePayloadSchema,
  regions: RegionsPayloadSchema,
} as const;

export type PayloadOf<T extends EntrySectionType> = z.infer<(typeof SECTION_PAYLOAD_SCHEMAS)[T]>;

export type EntrySection = {
  [T in EntrySectionType]: {
    readonly id: string;
    readonly type: T;
    readonly payload: PayloadOf<T>;
  };
}[EntrySectionType];

export type SectionProblemCode =
  | "not-a-list"
  | "not-an-object"
  | "unknown-type"
  | "invalid-id"
  | "invalid-payload";

/**
 * Why one section was dropped. Data, never an exception — the same contract as
 * a `[[term:]]` that does not resolve. The page stays up; the caller decides
 * how loud to be.
 */
export interface SectionProblem {
  readonly code: SectionProblemCode;
  readonly index: number;
  readonly id?: string;
  readonly type?: string;
  readonly message: string;
}

export interface ParsedEntrySections {
  readonly sections: readonly EntrySection[];
  readonly problems: readonly SectionProblem[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${path}${issue.message}`;
    })
    .join("; ");
}

function problem(
  index: number,
  code: SectionProblemCode,
  message: string,
  extra: { readonly id?: string; readonly type?: string } = {},
): SectionProblem {
  return { code, index, message, ...extra };
}

/**
 * Validates one raw section. Never throws.
 *
 * An unknown `type` is a dropped section, not a hard failure, so a future demo
 * type can land in stored entries before every reader has learned it.
 */
export function parseEntrySection(
  raw: unknown,
  index: number,
): { ok: true; section: EntrySection } | { ok: false; problem: SectionProblem } {
  if (!isRecord(raw)) {
    return {
      ok: false,
      problem: problem(
        index,
        "not-an-object",
        "A section must be an object with id, type and payload.",
      ),
    };
  }

  const typeValue = raw.type;
  if (typeof typeValue !== "string" || !isEntrySectionType(typeValue)) {
    return {
      ok: false,
      problem: problem(
        index,
        "unknown-type",
        typeof typeValue === "string"
          ? `Unknown section type "${typeValue}" was dropped.`
          : "A section must name a registered type.",
        {
          type: typeof typeValue === "string" ? typeValue : undefined,
          id: typeof raw.id === "string" ? raw.id : undefined,
        },
      ),
    };
  }

  const idResult = StableId.safeParse(raw.id);
  if (!idResult.success) {
    return {
      ok: false,
      problem: problem(
        index,
        "invalid-id",
        `Section id is not a stable kebab id: ${formatZodError(idResult.error)}`,
        { type: typeValue, id: typeof raw.id === "string" ? raw.id : undefined },
      ),
    };
  }

  const payloadResult = SECTION_PAYLOAD_SCHEMAS[typeValue].safeParse(raw.payload);
  if (!payloadResult.success) {
    return {
      ok: false,
      problem: problem(
        index,
        "invalid-payload",
        `Section "${idResult.data}" (${typeValue}) payload was dropped: ${formatZodError(payloadResult.error)}`,
        { type: typeValue, id: idResult.data },
      ),
    };
  }

  return {
    ok: true,
    section: {
      id: idResult.data,
      type: typeValue,
      payload: payloadResult.data,
    } as EntrySection,
  };
}

/**
 * Validates an ordered list of sections, dropping any that fail and keeping the
 * rest, in order. `undefined` is the zero-section case — valid, no problems.
 * Anything else that is not an array is reported and treated as empty.
 */
export function parseEntrySections(raw: unknown): ParsedEntrySections {
  if (raw === undefined) {
    return { sections: [], problems: [] };
  }
  if (!Array.isArray(raw)) {
    return {
      sections: [],
      problems: [
        problem(
          -1,
          "not-a-list",
          "Entry sections must be an array; the body was dropped and the head kept.",
        ),
      ],
    };
  }

  const sections: EntrySection[] = [];
  const problems: SectionProblem[] = [];
  for (const [index, item] of raw.entries()) {
    const parsed = parseEntrySection(item, index);
    if (parsed.ok) sections.push(parsed.section);
    else problems.push(parsed.problem);
  }
  return { sections, problems };
}

function headingBlock(type: EntrySectionType, body: string): string {
  return `## ${SECTION_HEADING[type]}\n\n${body}`;
}

function bullets(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function sectionBody(section: EntrySection): string {
  switch (section.type) {
    case "colloquial":
      return section.payload.text;
    case "definition": {
      const parts: string[] = [];
      if (section.payload.statement) parts.push(`**${section.payload.statement}**`);
      if (section.payload.not) parts.push(`它不是：${section.payload.not}`);
      return parts.join("\n\n");
    }
    case "aliases":
      return bullets(section.payload.names);
    case "prerequisites":
      return bullets(section.payload.senseIds.map((id) => `\`${id}\``));
    case "anatomy":
      return section.payload.parts
        .map((part, index) => `${index + 1}. **${part.name}** — ${part.note}`)
        .join("\n");
    case "flow": {
      const steps = section.payload.steps
        .map((step, index) => {
          const mark = step.current ? "（本页重点）" : "";
          return `${index + 1}. **${step.label}** — ${step.description}${mark}`;
        })
        .join("\n");
      return `**${section.payload.title}**\n\n${FLOW_CAPTION}\n\n${steps}`;
    }
    case "variants":
      return section.payload.items
        .map((item) => `### ${item.name}\n\n什么时候用它：${item.when}`)
        .join("\n\n");
    case "use-dont":
      return `### 该用\n\n${bullets(section.payload.use)}\n\n### 不该用\n\n${bullets(section.payload.dont)}`;
    case "distinction":
      return section.payload.pairs
        .map((pair) => `**${pair.left}** ≠ **${pair.right}**\n\n${pair.how}`)
        .join("\n\n");
    case "plain":
      return section.payload.paragraphs.join("\n\n");
    case "agent-prompt":
      return `> ${section.payload.text}`;
    case "related":
      return bullets(section.payload.senseIds.map((id) => `\`${id}\``));
    case "before-after":
      return `### 改前\n\n${section.payload.before}\n\n### 改后\n\n${section.payload.after}`;
    case "when-not":
      return bullets(section.payload.cases);
    case "quiz": {
      // The answer is deliberately absent. This clipboard exists so a learner
      // can paste an entry into an AI chat as context, and an agent handed the
      // answer key will recite it instead of reasoning about the situation.
      const options = section.payload.options
        .map((option, index) => `${["A", "B", "C"][index] ?? index + 1}. ${option.text}`)
        .join("\n");
      return `${section.payload.question}\n\n${options}`;
    }
    case "demo": {
      // The clipboard gets the sentence, not the arrangement. A paste target is
      // either an AI chat or a text note, and neither can do anything with a
      // list of node kinds — while `alt` is already the one-sentence account of
      // what the demo shows, written for exactly this situation.
      const states =
        section.payload.states.length > 1
          ? `\n\n可切换的状态：${section.payload.states.map((state) => state.label).join(" / ")}`
          : "";
      const caption = section.payload.caption ? `\n\n${section.payload.caption}` : "";
      return `${section.payload.alt}${states}${caption}`;
    }
    case "style-sample": {
      // CSS cannot travel in the clipboard. Keep the shared heading, alt text
      // and optional caption; the visual comparison only exists in the page.
      const caption = section.payload.caption ? `\n\n${section.payload.caption}` : "";
      return `${section.payload.alt}${caption}`;
    }
    case "regions":
      // The answer is left out for the same reason the quiz answer is.
      return `${section.payload.question}\n\n${bullets(
        section.payload.regions.map((region) => region.label),
      )}`;
    default: {
      const _never: never = section;
      return _never;
    }
  }
}

/**
 * One section as Markdown. The clipboard fold calls this per type so adding a
 * type without a serialiser is a compile error here, not a silent omission in
 * a learner's paste.
 */
export function sectionToMarkdown(section: EntrySection): string {
  return headingBlock(section.type, sectionBody(section));
}

/** Fold over an entry's body. An empty list is the empty string, not a heading. */
export function sectionsToMarkdown(sections: readonly EntrySection[]): string {
  return sections
    .map((section) => sectionToMarkdown(section).trim())
    .filter((text) => text.length > 0)
    .join("\n\n");
}
