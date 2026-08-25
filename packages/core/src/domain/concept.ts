import { z } from "zod";

import type { StyleSkinId } from "./entry-section.js";
import { SenseId } from "./schemas.js";
import {
  assembleStructuredEntry,
  entryToMarkdown,
  type AssembledEntry,
  type StructuredEntry,
} from "./structured-entry.js";

/**
 * The seven top-level categories, in chip order.
 *
 * They are the shape of the field a beginner is walking into, not a taxonomy
 * this product invented: 前端 is enormous because that is where someone
 * building their first thing with an AI actually spends their day, and Git is
 * twelve entries because twelve is what you need before you stop being afraid
 * of it. An eighth category would be a claim that there is an eighth kind of
 * confusion.
 */
export const CONCEPT_CATEGORY_IDS = [
  "frontend",
  "backend",
  "product",
  "technology",
  "ai",
  "git",
  "design",
] as const;

export type ConceptCategory = (typeof CONCEPT_CATEGORY_IDS)[number];

export const CONCEPT_CATEGORY_LABEL: { readonly [C in ConceptCategory]: string } = {
  frontend: "前端",
  backend: "后端",
  product: "产品",
  technology: "技术栈",
  ai: "AI",
  git: "Git",
  design: "设计风格",
};

export const ConceptCategorySchema = z.enum(CONCEPT_CATEGORY_IDS);

/**
 * The head of a concept entry. The body is the same typed sections a term and
 * an anti-pattern use; only this record changes per collection.
 *
 * `group` is a free string rather than an enum because the sub-categories are
 * named after what a learner wants to do (「弹窗与提示」, 「鼠标」, 「上线与排错」)
 * rather than after a technical discipline, and that list grows whenever the
 * work grows. Pinning it into a union would turn adding one entry into a schema
 * change, which is the kind of friction that stops people adding entries.
 *
 * `en` is optional and often empty on purpose. 「Vibe Coding」, 「Token」 and
 * 「React」 have no Chinese name anyone uses, so the head carries the name
 * people say, and the second field stays blank rather than inventing a
 * translation nobody would search for.
 */
export const ConceptHeadSchema = z
  .object({
    id: SenseId,
    zh: z.string().trim().min(1).max(40),
    en: z.string().trim().max(60).optional(),
    category: ConceptCategorySchema,
    group: z.string().trim().min(1).max(40),
    /** One line, shown on the index card and above the page body. */
    tagline: z.string().trim().min(1).max(120),
  })
  .strict();

export type ConceptHead = z.infer<typeof ConceptHeadSchema>;

export type ConceptEntry = StructuredEntry<ConceptHead>;

/**
 * The authored source for one concept, before it becomes typed sections.
 *
 * Four fields are required and the rest are not, and the split is a teaching
 * claim rather than a convenience. An entry without `colloquial` cannot be
 * found by someone who has the experience but not the word, which is the entire
 * entry point. An entry without `definition.not` is the dictionary failure this
 * collection exists to fix. An entry without `plain` is a stub. An entry
 * without `prompt` gives a learner nothing to do next.
 *
 * `anatomy` on the other hand is genuinely absent for 「回滚」 and mandatory for
 * 「表单」, so forcing it would produce filler on a third of the catalogue.
 */
export interface ConceptBody {
  readonly colloquial: string;
  /** C9 and C11. One state is a static miniature; two or more is a state switch. */
  readonly demo?: {
    readonly alt: string;
    readonly caption?: string;
    readonly states: readonly {
      readonly id: string;
      readonly label: string;
      readonly note?: string;
      readonly nodes: readonly unknown[];
    }[];
  };
  /** A fixed product mockup whose visual skin can be compared with another. */
  readonly styleSample?: {
    readonly alt: string;
    readonly caption?: string;
    readonly skin: StyleSkinId;
    readonly contrastSkin?: StyleSkinId;
  };
  /** C12. Click the part of the mockup being named. */
  readonly regions?: {
    readonly question: string;
    readonly regions: readonly {
      readonly id: string;
      readonly label: string;
      readonly span?: "full" | "half";
      readonly height?: "short" | "tall";
    }[];
    readonly correctRegionId: string;
    readonly reveal: string;
  };
  readonly definition: { readonly statement: string; readonly not?: string };
  readonly aliases?: readonly string[];
  readonly prerequisites?: readonly string[];
  readonly anatomy?: readonly { readonly name: string; readonly note: string }[];
  readonly flow?: {
    readonly title: string;
    readonly steps: readonly {
      readonly label: string;
      readonly description: string;
      readonly current?: boolean;
    }[];
  };
  readonly variants?: readonly { readonly name: string; readonly when: string }[];
  readonly useDont?: { readonly use: readonly string[]; readonly dont: readonly string[] };
  readonly distinction?: readonly {
    readonly left: string;
    readonly right: string;
    readonly how: string;
  }[];
  readonly plain: readonly string[];
  readonly whenNot?: readonly string[];
  readonly prompt: string;
  readonly related?: readonly string[];
  readonly quiz?: {
    readonly question: string;
    readonly options: readonly {
      readonly id: string;
      readonly text: string;
      readonly explanation: string;
    }[];
    readonly correctOptionId: string;
  };
}

/**
 * One authored record as it sits in the catalogue source: the head fields
 * inline, the body nested. Head fields are typed loosely here and validated by
 * `loadConcept`, so a generated data file with a bad `category` reports as a
 * problem rather than failing to compile in a way nobody can read.
 */
export interface RawConcept {
  readonly id: string;
  readonly zh: string;
  readonly en?: string;
  readonly category: string;
  readonly group: string;
  readonly tagline: string;
  readonly body: ConceptBody;
}

/**
 * The order sections appear on the page, and it is the order the site we took
 * this catalogue from uses, because it is the order a confused person needs.
 *
 * You arrive with a sentence you would say, not a word. So: your own words
 * first, then the word, then what it is not, then what it is made of, then when
 * to reach for it, then the judgement question. Definitions first is how
 * reference books are written and it is why people bounce off them.
 */
function conceptBodySections(body: ConceptBody): unknown[] {
  const sections: unknown[] = [
    { id: "colloquial", type: "colloquial", payload: { text: body.colloquial } },
  ];
  // The miniature goes above the definition, not below it, and that ordering is
  // the one thing their hero gets unarguably right: for anything you could
  // point at, seeing it settles the question that the paragraph then explains.
  if (body.demo) {
    sections.push({ id: "demo", type: "demo", payload: { ...body.demo } });
  }
  if (body.styleSample) {
    sections.push({
      id: "style-sample",
      type: "style-sample",
      payload: { ...body.styleSample },
    });
  }
  sections.push({
    id: "definition",
    type: "definition",
    payload: {
      statement: body.definition.statement,
      ...(body.definition.not === undefined ? {} : { not: body.definition.not }),
    },
  });
  if (body.aliases?.length) {
    sections.push({ id: "aliases", type: "aliases", payload: { names: [...body.aliases] } });
  }
  if (body.prerequisites?.length) {
    sections.push({
      id: "prerequisites",
      type: "prerequisites",
      payload: { senseIds: [...body.prerequisites] },
    });
  }
  if (body.anatomy?.length) {
    sections.push({
      id: "anatomy",
      type: "anatomy",
      payload: { parts: body.anatomy.map((part) => ({ ...part })) },
    });
  }
  if (body.flow) {
    sections.push({
      id: "flow",
      type: "flow",
      payload: {
        title: body.flow.title,
        steps: body.flow.steps.map((step) => ({
          label: step.label,
          description: step.description,
          current: step.current ?? false,
        })),
      },
    });
  }
  if (body.variants?.length) {
    sections.push({
      id: "variants",
      type: "variants",
      payload: { items: body.variants.map((item) => ({ ...item })) },
    });
  }
  if (body.useDont) {
    sections.push({
      id: "use-dont",
      type: "use-dont",
      payload: { use: [...body.useDont.use], dont: [...body.useDont.dont] },
    });
  }
  if (body.distinction?.length) {
    sections.push({
      id: "distinction",
      type: "distinction",
      payload: { pairs: body.distinction.map((pair) => ({ ...pair })) },
    });
  }
  sections.push({ id: "plain", type: "plain", payload: { paragraphs: [...body.plain] } });
  if (body.whenNot?.length) {
    sections.push({ id: "when-not", type: "when-not", payload: { cases: [...body.whenNot] } });
  }
  if (body.regions) {
    sections.push({ id: "regions", type: "regions", payload: { ...body.regions } });
  }
  if (body.quiz) {
    sections.push({
      id: "quiz",
      type: "quiz",
      payload: {
        question: body.quiz.question,
        options: body.quiz.options.map((option) => ({ ...option })),
        correctOptionId: body.quiz.correctOptionId,
      },
    });
  }
  sections.push({ id: "tell-agent", type: "agent-prompt", payload: { text: body.prompt } });
  if (body.related?.length) {
    sections.push({ id: "related", type: "related", payload: { senseIds: [...body.related] } });
  }
  return sections;
}

/**
 * Fills `collection: "concepts"` and reuses the one assembler. A third page
 * component, a third parser or a third Markdown fold would each be SPEC-0004
 * failing at the first opportunity it was given to fail.
 */
export function assembleConceptEntry(
  head: ConceptHead,
  sections?: unknown,
): AssembledEntry<ConceptHead> {
  return assembleStructuredEntry({ collection: "concepts", head, sections });
}

/**
 * Head serialiser. Same shape as `termHeadToMarkdown` and
 * `antiPatternHeadToMarkdown`: title, one meta line, then the lead.
 */
export function conceptHeadToMarkdown(head: ConceptHead): string {
  const title = head.en ? `# ${head.zh} ${head.en}` : `# ${head.zh}`;
  return [
    title,
    `${CONCEPT_CATEGORY_LABEL[head.category]} · ${head.group}`,
    `**${head.tagline}**`,
  ].join("\n\n");
}

export function conceptEntryToMarkdown(entry: ConceptEntry): string {
  return entryToMarkdown(entry, conceptHeadToMarkdown);
}

export interface ConceptLoadProblem {
  readonly id: string;
  readonly message: string;
}

/**
 * Turns one authored record into an entry, reporting rather than throwing.
 *
 * This differs from `loadAntiPattern` on purpose. Twenty-five anti-patterns are
 * hand-written in a TypeScript file, so a bad one is a compile-time mistake and
 * throwing is the fastest way to see it. Two hundred and eighty-one concepts
 * arrive as bulk JSON written in batches, and one malformed record out of 281
 * must not take the other 280 off the shelf. The caller collects the problems
 * and a test fails on them, which is the same guarantee without the outage.
 */
export function loadConcept(
  head: unknown,
  body: ConceptBody,
): { readonly entry?: ConceptEntry; readonly problems: readonly ConceptLoadProblem[] } {
  const parsedHead = ConceptHeadSchema.safeParse(head);
  if (!parsedHead.success) {
    const id =
      typeof head === "object" && head !== null && "id" in head ? String(head.id) : "(no id)";
    return {
      problems: [
        {
          id,
          message: parsedHead.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; "),
        },
      ],
    };
  }
  const { entry, problems } = assembleConceptEntry(parsedHead.data, conceptBodySections(body));
  return {
    entry,
    problems: problems.map((problem) => ({
      id: parsedHead.data.id,
      message: `${problem.type ?? problem.id ?? "section"}: ${problem.message}`,
    })),
  };
}
