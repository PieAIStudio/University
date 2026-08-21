import { describe, expect, it } from "vitest";
import {
  SECTION_TYPES,
  assembleTermEntry,
  sectionToMarkdown,
  termEntryToMarkdown,
  type EntrySection,
  type EntrySectionType,
  type LexiconEntry,
} from "@pieai/university-core";

import { DEFAULT_SECTION_RENDERERS } from "./default-renderers.js";
import {
  foldEntryMarkdown,
  getSectionRenderer,
  registerSectionRenderer,
  type SectionRenderer,
} from "./section-registry.js";

const APP: LexiconEntry = {
  senseId: "app.program",
  headword: "app",
  phonetic: "/æp/",
  partOfSpeech: "noun",
  gloss: "应用：用户点开图标就能用的那个成品",
  usage: "App 是 application 的口语缩写。",
  track: "technical",
};

const SAMPLES = {
  colloquial: {
    id: "say-this",
    type: "colloquial",
    payload: { text: "点开图标就能用的那个东西。" },
  },
  definition: {
    id: "one-line",
    type: "definition",
    payload: { statement: "应用是点开图标就能用的成品。", not: "一段源码" },
  },
  aliases: { id: "also-called", type: "aliases", payload: { names: ["应用"] } },
  prerequisites: {
    id: "know-first",
    type: "prerequisites",
    payload: { senseIds: ["api.interface"] },
  },
  anatomy: {
    id: "parts",
    type: "anatomy",
    payload: { parts: [{ name: "图标", note: "用户点的入口。" }] },
  },
  variants: {
    id: "kinds",
    type: "variants",
    payload: { items: [{ name: "网页应用", when: "浏览器里用。" }] },
  },
  "use-dont": {
    id: "usage",
    type: "use-dont",
    payload: { use: ["给真正的成品这个名字。"], dont: ["把一份脚本叫做 app。"] },
  },
  distinction: {
    id: "vs",
    type: "distinction",
    payload: { pairs: [{ left: "应用", right: "接口", how: "应用给人用；接口给程序用。" }] },
  },
  plain: { id: "explain", type: "plain", payload: { paragraphs: ["点开就能用。"] } },
  "agent-prompt": {
    id: "tell-agent",
    type: "agent-prompt",
    payload: { text: "请把这个成品做成点开图标就能用的应用。" },
  },
  related: { id: "next", type: "related", payload: { senseIds: ["api.interface"] } },
  "before-after": {
    id: "rewrite",
    type: "before-after",
    payload: { before: "做一个东西。", after: "做一个点开就能用的应用。" },
  },
  "when-not": {
    id: "exception",
    type: "when-not",
    payload: { cases: ["库和框架不要叫应用。"] },
  },
} satisfies { [T in EntrySectionType]: EntrySection & { type: T } };

describe("section renderer registry", () => {
  it("registers every core section type with toMarkdown", () => {
    expect(DEFAULT_SECTION_RENDERERS.map((renderer) => renderer.type)).toEqual([...SECTION_TYPES]);
    for (const type of SECTION_TYPES) {
      const renderer = getSectionRenderer(type);
      expect(renderer?.type).toBe(type);
      expect(typeof renderer?.toMarkdown).toBe("function");
      expect(typeof renderer?.render).toBe("function");
    }
  });

  it("refuses a renderer that has no toMarkdown", () => {
    expect(() =>
      registerSectionRenderer({
        type: "plain",
        render: () => null,
      } as unknown as SectionRenderer<"plain">),
    ).toThrow(/toMarkdown/);
    expect(typeof getSectionRenderer("plain")?.toMarkdown).toBe("function");
  });

  it("folds with each renderer's toMarkdown, matching the core serialiser", () => {
    const sections = SECTION_TYPES.map((type) => SAMPLES[type]);
    for (const section of sections) {
      expect(getSectionRenderer(section.type)?.toMarkdown(section)).toBe(
        sectionToMarkdown(section),
      );
    }
    const { entry } = assembleTermEntry(APP, sections);
    expect(foldEntryMarkdown(termEntryToMarkdown({ ...entry, sections: [] }), entry.sections)).toBe(
      termEntryToMarkdown(entry),
    );
  });

  it("serialises a zero-section entry to just the head", () => {
    const { entry } = assembleTermEntry(APP, []);
    expect(foldEntryMarkdown(termEntryToMarkdown(entry), entry.sections)).toBe(
      termEntryToMarkdown(entry),
    );
    expect(foldEntryMarkdown(termEntryToMarkdown(entry), entry.sections)).not.toContain("## ");
  });
});
