import { describe, expect, it } from "vitest";

import { sectionsToMarkdown } from "./entry-section.js";
import {
  assembleStructuredEntry,
  assembleTermEntry,
  entryToMarkdown,
  termEntryToMarkdown,
  termHeadToMarkdown,
} from "./structured-entry.js";
import type { LexiconEntry } from "./schemas.js";

const APP: LexiconEntry = {
  senseId: "app.program",
  headword: "app",
  phonetic: "/æp/",
  partOfSpeech: "noun",
  gloss: "应用：用户点开图标就能用的那个成品",
  usage: "App 是 application 的口语缩写。拆开看，它其实是一堆文件加一个运行环境。",
  track: "technical",
};

const COLLOQUIAL = {
  id: "say-this",
  type: "colloquial",
  payload: { text: "点开图标就能用的那个东西。" },
};

describe("assembleStructuredEntry", () => {
  it("accepts a term with zero sections and serialises to just the head", () => {
    const { entry, problems } = assembleTermEntry(APP, []);
    expect(problems).toEqual([]);
    expect(entry.collection).toBe("terms");
    expect(entry.head).toBe(APP);
    expect(entry.sections).toEqual([]);
    expect(termEntryToMarkdown(entry)).toBe(termHeadToMarkdown(APP));
    expect(termHeadToMarkdown(APP)).toContain("# app");
    expect(termHeadToMarkdown(APP)).toContain(APP.gloss);
    expect(termHeadToMarkdown(APP)).toContain(APP.usage);
    expect(termHeadToMarkdown(APP)).not.toContain("## ");
  });

  it("treats omitted sections as the zero-section case", () => {
    const { entry, problems } = assembleTermEntry(APP);
    expect(entry.sections).toEqual([]);
    expect(problems).toEqual([]);
  });

  it("includes a lexicon colloquial line on the head when the field is present", () => {
    const withSpoken: LexiconEntry = { ...APP, colloquial: "点开图标就能用。" };
    expect(termHeadToMarkdown(withSpoken)).toContain("> **你可能会说**");
    expect(termHeadToMarkdown(withSpoken)).toContain("点开图标就能用。");
  });

  it("drops a bad section, keeps the rest, and never throws", () => {
    const { entry, problems } = assembleTermEntry(APP, [
      COLLOQUIAL,
      { id: "nope", type: "plain", payload: { paragraphs: [] } },
      { id: "also-called", type: "aliases", payload: { names: ["应用"] } },
    ]);
    expect(entry.sections.map((section) => section.type)).toEqual(["colloquial", "aliases"]);
    expect(problems).toEqual([expect.objectContaining({ code: "invalid-payload", id: "nope" })]);
    const markdown = termEntryToMarkdown(entry);
    expect(markdown.startsWith("# app")).toBe(true);
    expect(markdown).toContain("你可能会说");
    expect(markdown).toContain("也常被叫作");
    expect(markdown).not.toContain("nope");
  });

  it("does not throw on garbage input", () => {
    const garbage = [null, 1, "sections", { foo: 1 }, [null, 42, { type: "plain" }]];
    for (const sections of garbage) {
      expect(() => assembleTermEntry(APP, sections)).not.toThrow();
      const { entry } = assembleTermEntry(APP, sections);
      expect(entry.head).toBe(APP);
    }
  });

  it("uses the same section fold an anti-pattern head would reuse", () => {
    const { entry } = assembleStructuredEntry({
      collection: "anti-patterns",
      head: { title: "稳稳接住" },
      sections: [
        {
          id: "exception",
          type: "when-not",
          payload: { cases: ["小说、广告或角色台词本来就需要这种非日常表达。"] },
        },
      ],
    });
    expect(entry.collection).toBe("anti-patterns");
    const markdown = entryToMarkdown(entry, (head) => `# ${head.title}`);
    expect(markdown).toContain("# 稳稳接住");
    expect(markdown).toContain("什么时候不用");
    expect(markdown).toBe(joinExpected("# 稳稳接住", sectionsToMarkdown(entry.sections)));
  });
});

function joinExpected(head: string, body: string): string {
  return `${head}\n\n${body}`;
}
