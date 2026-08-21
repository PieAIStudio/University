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
  flow: {
    id: "save-path",
    type: "flow",
    payload: {
      title: "一次保存经过哪些部分？",
      steps: [
        { label: "填写并点击保存", description: "前端读取输入。", current: true },
        { label: "写入记录", description: "数据库长期保存这次修改。", current: false },
      ],
    },
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
  quiz: {
    id: "check",
    type: "quiz",
    payload: {
      question: "同事说「把这个做成应用」，你手上是一个网页。该先问什么？",
      options: [
        {
          id: "a",
          text: "先问要不要上架商店。",
          explanation: "上架是后面的事。先问它是不是同一个东西，再问它去哪。",
        },
        {
          id: "b",
          text: "先问他说的应用是点开图标就能用的那种，还是网页也算。",
          explanation: "对。这个词两边理解不一样，先对齐再动手。",
        },
        {
          id: "c",
          text: "先按手机应用做，做错再改。",
          explanation: "做错再改要重做整套壳，代价比问一句大得多。",
        },
      ],
      correctOptionId: "b",
    },
  },
  demo: {
    id: "look",
    type: "demo",
    payload: {
      alt: "一个「打开应用」按钮，旁边是同一句话做成的链接。",
      caption: "两个都能点，但只有一个会把你带走。",
      states: [
        {
          id: "idle",
          label: "平常",
          nodes: [
            {
              kind: "row",
              children: [
                { kind: "button", label: "打开应用", variant: "primary" },
                { kind: "text", text: "或者 打开网页版", muted: true },
              ],
            },
          ],
        },
        {
          id: "disabled",
          label: "不能点的时候",
          note: "灰掉的按钮不会有按下去的反馈，这就是它在告诉你现在没法点。",
          nodes: [{ kind: "button", label: "打开应用", variant: "primary", disabled: true }],
        },
      ],
    },
  },
  regions: {
    id: "where",
    type: "regions",
    payload: {
      question: "点一下这一页里，装着「应用」这个词的那一块。",
      regions: [
        { id: "nav", label: "顶部导航栏", height: "short" },
        { id: "hero", label: "首屏大标题区", height: "tall" },
        { id: "footer", label: "页脚", height: "short" },
      ],
      correctRegionId: "hero",
      reveal: "首屏那一句话决定别人怎么理解你做的东西，所以「应用」这个词出现在这里最费思量。",
    },
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
