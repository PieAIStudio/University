import { describe, expect, it } from "vitest";

import { sectionsToMarkdown } from "./entry-section.js";
import { assembleStructuredEntry, entryToMarkdown } from "./structured-entry.js";
import {
  ANTI_PATTERN_NOTICE,
  AntiPatternHeadSchema,
  antiPatternEntryToMarkdown,
  antiPatternHeadToMarkdown,
  assembleAntiPatternEntry,
  loadAntiPattern,
} from "./anti-pattern.js";

const HEAD = {
  id: "steady-catch",
  name: "稳稳接住",
  category: "verbal" as const,
  complaint: "你正常说就行，别再说什么「稳稳接住你」。",
};

describe("anti-pattern head", () => {
  it("accepts the four fields and rejects a severity score", () => {
    expect(AntiPatternHeadSchema.parse(HEAD)).toEqual(HEAD);
    expect(() => AntiPatternHeadSchema.parse({ ...HEAD, severity: "high" })).toThrow();
  });

  it("serialises like termHeadToMarkdown: title, meta, spoken lead", () => {
    const markdown = antiPatternHeadToMarkdown(HEAD);
    expect(markdown).toContain("# 稳稳接住");
    expect(markdown).toContain("中文口癖");
    expect(markdown).toContain("> **你正常说就行**");
    expect(markdown).toContain(HEAD.complaint);
    expect(markdown).not.toContain("## ");
  });
});

describe("assembleAntiPatternEntry", () => {
  it("is assembleStructuredEntry with collection filled in, not a second parser", () => {
    const sections = [
      {
        id: "when-not",
        type: "when-not",
        payload: { cases: ["小说、歌词里故意用非日常说法时，这不算。"] },
      },
    ];
    const wrapped = assembleAntiPatternEntry(HEAD, sections);
    const generic = assembleStructuredEntry({
      collection: "anti-patterns",
      head: HEAD,
      sections,
    });
    expect(wrapped).toEqual(generic);
    expect(wrapped.entry.collection).toBe("anti-patterns");
    expect(wrapped.problems).toEqual([]);
  });

  it("reuses the section fold for Markdown", () => {
    const { entry } = assembleAntiPatternEntry(HEAD, [
      {
        id: "when-not",
        type: "when-not",
        payload: { cases: ["小说、歌词里故意用非日常说法时，这不算。"] },
      },
    ]);
    const markdown = antiPatternEntryToMarkdown(entry);
    expect(markdown).toBe(
      [antiPatternHeadToMarkdown(HEAD), sectionsToMarkdown(entry.sections)].join("\n\n"),
    );
    expect(markdown).toBe(entryToMarkdown(entry, antiPatternHeadToMarkdown));
    expect(markdown).toContain("什么时候不用");
  });

  it("drops a bad section and keeps the head, the way a term does", () => {
    const { entry, problems } = assembleAntiPatternEntry(HEAD, [
      { id: "why", type: "plain", payload: { paragraphs: ["机制写在这里。"] } },
      { id: "nope", type: "plain", payload: { paragraphs: [] } },
    ]);
    expect(entry.sections.map((section) => section.type)).toEqual(["plain"]);
    expect(problems).toEqual([expect.objectContaining({ code: "invalid-payload", id: "nope" })]);
  });
});

describe("loadAntiPattern", () => {
  it("refuses to export authored source that dropped a required block", () => {
    expect(() =>
      loadAntiPattern(HEAD, {
        why: [],
        before: "改前",
        after: "改后",
        whenNot: ["小说里不算。"],
        prompt: "不要用接住。",
      }),
    ).toThrow(/cannot degrade silently/);
  });

  it("does not put the epistemic notice into an entry", () => {
    const entry = loadAntiPattern(HEAD, {
      why: ["模型在补安慰的高频说法，不是在判断你需不需要被抱一下。"],
      before: "我会稳稳接住你的疑问。",
      after: "你卡住的是这一句。",
      whenNot: ["小说、歌词里故意用身体感的安慰时，不算。"],
      prompt: "不要用接住、不躲不藏。直接写读者卡在哪一句。",
    });
    expect(antiPatternEntryToMarkdown(entry)).not.toContain(ANTI_PATTERN_NOTICE);
  });
});
