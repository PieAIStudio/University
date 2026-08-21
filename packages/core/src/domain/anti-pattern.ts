import { z } from "zod";

import { StableId } from "./schemas.js";
import {
  assembleStructuredEntry,
  entryToMarkdown,
  type AssembledEntry,
  type StructuredEntry,
} from "./structured-entry.js";

/**
 * The three F-group catalogues. A fourth would be a new teaching claim, not a
 * convenience bucket — "other" would hide the thing we cannot yet name.
 */
export const ANTI_PATTERN_CATEGORY_IDS = ["verbal", "template", "interaction"] as const;

export type AntiPatternCategory = (typeof ANTI_PATTERN_CATEGORY_IDS)[number];

export const ANTI_PATTERN_CATEGORY_LABEL: {
  readonly [C in AntiPatternCategory]: string;
} = {
  verbal: "中文口癖",
  template: "页面模板感",
  interaction: "不好用的交互",
};

/**
 * F2. Lives on the collection index, never inside a single entry.
 *
 * Ranking one tell as proof of authorship would turn this page into a lie
 * detector, which is the failure the notice exists to prevent. Severity is
 * omitted for the same reason: a score on an isolated item is a verdict.
 */
export const ANTI_PATTERN_NOTICE_HEADING = "这不是测谎仪";

export const ANTI_PATTERN_NOTICE =
  "一条口癖、一块版式、一个点了没反应的按钮，单独拿出来都不能证明这段是 AI 写的。人也会说套话，也会抄模板。要看的是：这些默认选择有没有成组出现。";

export const AntiPatternCategorySchema = z.enum(ANTI_PATTERN_CATEGORY_IDS);

/**
 * The head of an anti-pattern entry. The body is the same typed sections a
 * term uses; only this record changes when the collection is not the lexicon.
 */
export const AntiPatternHeadSchema = z
  .object({
    id: StableId,
    name: z.string().trim().min(1).max(40),
    category: AntiPatternCategorySchema,
    /** The spoken complaint a beginner would actually make, not a gloss. */
    complaint: z.string().trim().min(1).max(160),
  })
  .strict();

export type AntiPatternHead = z.infer<typeof AntiPatternHeadSchema>;

export type AntiPatternEntry = StructuredEntry<AntiPatternHead>;

/**
 * The four blocks every anti-pattern must carry. `related` is optional because
 * the lexicon does not yet name every UI widget these entries talk about, and
 * a forced pointer would be a fake edge.
 */
export interface AntiPatternBody {
  readonly why: readonly string[];
  readonly before: string;
  readonly after: string;
  readonly whenNot: readonly string[];
  readonly prompt: string;
  readonly related?: readonly string[];
}

/**
 * Head serialiser matching `termHeadToMarkdown`'s shape: title, one meta line,
 * then the spoken lead as a blockquote so the clipboard still works when no
 * sections were authored.
 */
export function antiPatternHeadToMarkdown(head: AntiPatternHead): string {
  return [
    `# ${head.name}`,
    ANTI_PATTERN_CATEGORY_LABEL[head.category],
    `> **你正常说就行**\n> ${head.complaint}`,
  ].join("\n\n");
}

export function antiPatternEntryToMarkdown(entry: AntiPatternEntry): string {
  return entryToMarkdown(entry, antiPatternHeadToMarkdown);
}

/**
 * Fills `collection: "anti-patterns"` and reuses the one assembler. A second
 * function that parsed sections itself would be the parallel assembler
 * SPEC-0004 forbids.
 */
export function assembleAntiPatternEntry(
  head: AntiPatternHead,
  sections?: unknown,
): AssembledEntry<AntiPatternHead> {
  return assembleStructuredEntry({ collection: "anti-patterns", head, sections });
}

function antiPatternBodySections(body: AntiPatternBody): unknown[] {
  const sections: unknown[] = [
    { id: "why", type: "plain", payload: { paragraphs: [...body.why] } },
    {
      id: "rewrite",
      type: "before-after",
      payload: { before: body.before, after: body.after },
    },
    { id: "when-not", type: "when-not", payload: { cases: [...body.whenNot] } },
    { id: "tell-agent", type: "agent-prompt", payload: { text: body.prompt } },
  ];
  if (body.related && body.related.length > 0) {
    sections.push({
      id: "related",
      type: "related",
      payload: { senseIds: [...body.related] },
    });
  }
  return sections;
}

/**
 * Authoring helper for the 25 catalog entries. `assembleStructuredEntry` still
 * absorbs a bad section rather than throwing; this wrapper refuses to export
 * one, because authored source that silently dropped 「什么时候不用」 would
 * ship the page as a hammer with no handle.
 */
export function loadAntiPattern(head: AntiPatternHead, body: AntiPatternBody): AntiPatternEntry {
  const parsed = AntiPatternHeadSchema.parse(head);
  const { entry, problems } = assembleAntiPatternEntry(parsed, antiPatternBodySections(body));
  if (problems.length > 0) {
    throw new Error(
      `Anti-pattern "${parsed.id}" is authored source and cannot degrade silently: ${problems
        .map((problem) => problem.message)
        .join("; ")}`,
    );
  }
  return entry;
}
