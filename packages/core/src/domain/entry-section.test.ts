import { describe, expect, it } from "vitest";

import {
  FLOW_CAPTION,
  parseEntrySection,
  parseEntrySections,
  SECTION_HEADING,
  SECTION_TYPES,
  sectionToMarkdown,
  sectionsToMarkdown,
  type EntrySection,
  type EntrySectionType,
  type PayloadOf,
} from "./entry-section.js";

const SAMPLES = {
  colloquial: {
    id: "say-this",
    type: "colloquial",
    payload: { text: "帮我加个按钮，点了就能把内容存下来。" },
  },
  definition: {
    id: "one-line",
    type: "definition",
    payload: {
      statement: "按钮是让用户在当前页面执行操作的可点击控件。",
      not: "一段跳走的链接",
    },
  },
  aliases: {
    id: "also-called",
    type: "aliases",
    payload: { names: ["操作按钮", "Button"] },
  },
  prerequisites: {
    id: "know-first",
    type: "prerequisites",
    payload: { senseIds: ["app.program", "api.interface"] },
  },
  anatomy: {
    id: "parts",
    type: "anatomy",
    payload: {
      parts: [
        { name: "按钮本体", note: "可点的那一块，后果必须写在文案里。" },
        { name: "图标", note: "可省略；有的话要和文案说同一件事。" },
      ],
    },
  },
  flow: {
    id: "save-path",
    type: "flow",
    payload: {
      title: "一次保存经过哪些部分？",
      steps: [
        {
          label: "填写并点击保存",
          description: "前端读取输入，显示保存中。",
          current: true,
        },
        {
          label: "发出保存请求",
          description: "前端按 API 约定发送地址、方法和数据。",
          current: true,
        },
        {
          label: "接收、检查并处理",
          description: "后端接收请求，检查输入、身份和权限。",
          current: false,
        },
        {
          label: "写入记录",
          description: "数据库长期保存这次修改。",
          current: false,
        },
      ],
    },
  },
  variants: {
    id: "kinds",
    type: "variants",
    payload: {
      items: [
        { name: "主要按钮", when: "这页真正要完成的那一个动作。" },
        { name: "危险按钮", when: "后果不可逆，而且必须停一下。" },
      ],
    },
  },
  "use-dont": {
    id: "usage",
    type: "use-dont",
    payload: {
      use: ["保存、提交这种留在本页的动作做成按钮。"],
      dont: ["用一个确认按钮承担保存、放弃和删除。"],
    },
  },
  distinction: {
    id: "vs",
    type: "distinction",
    payload: {
      pairs: [
        {
          left: "按钮",
          right: "链接",
          how: "按钮在本页做事；链接带走当前页。",
        },
      ],
    },
  },
  plain: {
    id: "explain",
    type: "plain",
    payload: { paragraphs: ["状态记录的是此刻，不是永远。", "画面跟着状态走，而不是反过来。"] },
  },
  "agent-prompt": {
    id: "tell-agent",
    type: "agent-prompt",
    payload: { text: "请整理账号设置页：保存、放弃、删除分开成按钮，删除前再确认一次。" },
  },
  related: {
    id: "next",
    type: "related",
    payload: { senseIds: ["api.interface"] },
  },
  "before-after": {
    id: "rewrite",
    type: "before-after",
    payload: {
      before: "让我们一起开启这段激动人心的旅程吧！",
      after: "打开设置，改完点保存。",
    },
  },
  "when-not": {
    id: "exception",
    type: "when-not",
    payload: { cases: ["小说、广告或角色台词本来就需要这种非日常表达。"] },
  },
  quiz: {
    id: "check",
    type: "quiz",
    payload: {
      question: "同事说「把这个做成应用」，你手上是一个网页。该先问什么？",
      options: [
        { id: "a", text: "先问要不要上架商店。", explanation: "上架是后面的事。" },
        { id: "b", text: "先问他说的是不是点开图标那种。", explanation: "对。先对齐再动手。" },
        {
          id: "c",
          text: "先按手机应用做，做错再改。",
          explanation: "重做整套壳，代价比问一句大。",
        },
      ],
      correctOptionId: "b",
    },
  },
  demo: {
    id: "look",
    type: "demo",
    payload: {
      alt: "一个「打开应用」按钮，灰掉之后不再有按下去的反馈。",
      states: [
        { id: "idle", label: "平常", nodes: [{ kind: "button", label: "打开应用" }] },
        {
          id: "off",
          label: "不能点",
          nodes: [{ kind: "button", label: "打开应用", disabled: true }],
        },
      ],
    },
  },
  regions: {
    id: "where",
    type: "regions",
    payload: {
      question: "点一下这一页装着「应用」这个词的那一块。",
      regions: [
        { id: "nav", label: "顶部导航栏" },
        { id: "hero", label: "首屏大标题区", height: "tall" },
      ],
      correctRegionId: "hero",
      reveal: "首屏那句话决定别人怎么理解你做的东西。",
    },
  },
} satisfies { [T in EntrySectionType]: EntrySection & { type: T } };

function sample<T extends EntrySectionType>(type: T): EntrySection & { type: T } {
  return SAMPLES[type];
}

describe("section payloads", () => {
  it("accepts every registered type", () => {
    for (const type of SECTION_TYPES) {
      const parsed = parseEntrySection(sample(type), 0);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;
      expect(parsed.section.type).toBe(type);
      expect(parsed.section.payload).toEqual(SAMPLES[type].payload);
    }
  });

  it("serialises every type under its shared heading", () => {
    for (const type of SECTION_TYPES) {
      const markdown = sectionToMarkdown(sample(type));
      expect(markdown.startsWith(`## ${SECTION_HEADING[type]}\n\n`)).toBe(true);
    }
  });

  it("keeps merged types as one heading, not a fork", () => {
    expect(SECTION_HEADING["agent-prompt"]).toBe("你可以这样告诉 AI Agent");
    expect(SECTION_HEADING.related).toBe("相关");
    expect(sectionToMarkdown(sample("agent-prompt"))).toContain("请整理账号设置页");
    expect(sectionToMarkdown(sample("related"))).toContain("`api.interface`");
    expect(sectionToMarkdown(sample("when-not"))).toContain("非日常表达");
  });

  it("lets a definition carry only the boundary", () => {
    const parsed = parseEntrySection(
      { id: "not-only", type: "definition", payload: { not: "一段跳走的链接" } },
      0,
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(sectionToMarkdown(parsed.section)).toContain("它不是：一段跳走的链接");
    expect(sectionToMarkdown(parsed.section)).not.toContain("**");
  });

  it("numbers anatomy from order rather than a stored index", () => {
    const markdown = sectionToMarkdown(sample("anatomy"));
    expect(markdown).toContain("1. **按钮本体**");
    expect(markdown).toContain("2. **图标**");
  });

  it("serialises a flow as an ordered list and marks the current steps", () => {
    const markdown = sectionToMarkdown(sample("flow"));
    expect(markdown).toContain("## 在这条链路里");
    expect(markdown).toContain("一次保存经过哪些部分？");
    expect(markdown).toContain("1. **填写并点击保存** — 前端读取输入，显示保存中。（本页重点）");
    expect(markdown).toContain(
      "2. **发出保存请求** — 前端按 API 约定发送地址、方法和数据。（本页重点）",
    );
    expect(markdown).toContain("3. **接收、检查并处理** — 后端接收请求，检查输入、身份和权限。");
    expect(markdown).not.toContain(
      "3. **接收、检查并处理** — 后端接收请求，检查输入、身份和权限。（本页重点）",
    );
    expect(markdown).toContain(FLOW_CAPTION);
  });

  it("drops a flow with no current step, because the highlight is the point", () => {
    const parsed = parseEntrySection(
      {
        id: "no-focus",
        type: "flow",
        payload: {
          title: "一次保存经过哪些部分？",
          steps: [
            { label: "前端", description: "点保存。" },
            { label: "后端", description: "写入。" },
          ],
        },
      },
      0,
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.problem.code).toBe("invalid-payload");
  });

  it("drops a single-step flow: a chain of one does not show a place in a path", () => {
    const parsed = parseEntrySection(
      {
        id: "one-step",
        type: "flow",
        payload: {
          title: "只有一步？",
          steps: [{ label: "保存", description: "点一下。", current: true }],
        },
      },
      0,
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.problem.code).toBe("invalid-payload");
  });
});

describe("section validation degrades", () => {
  it("drops an unknown type such as a future demo rather than throwing", () => {
    const parsed = parseEntrySection(
      { id: "live-demo", type: "header-demo", payload: { src: "button" } },
      3,
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.problem).toMatchObject({
      code: "unknown-type",
      type: "header-demo",
      id: "live-demo",
      index: 3,
    });
  });

  it("drops a bad payload for every type and never throws", () => {
    for (const type of SECTION_TYPES) {
      expect(() => parseEntrySection({ id: "bad-section", type, payload: {} }, 0)).not.toThrow();
      const parsed = parseEntrySection({ id: "bad-section", type, payload: {} }, 0);
      expect(parsed.ok).toBe(false);
      if (parsed.ok) continue;
      expect(parsed.problem.code).toBe("invalid-payload");
      expect(parsed.problem.type).toBe(type);
    }
  });

  it("drops a section whose id is not a stable kebab id", () => {
    const parsed = parseEntrySection(
      { id: "App.Program", type: "plain", payload: { paragraphs: ["还行。"] } },
      0,
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.problem.code).toBe("invalid-id");
  });

  it("drops a non-object item", () => {
    const parsed = parseEntrySection("plain text", 1);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.problem.code).toBe("not-an-object");
    expect(parsed.problem.index).toBe(1);
  });

  it("treats a missing sections field as an empty body with no problems", () => {
    expect(parseEntrySections(undefined)).toEqual({ sections: [], problems: [] });
  });

  it("treats a non-array body as empty and reports it", () => {
    const parsed = parseEntrySections({ type: "plain" });
    expect(parsed.sections).toEqual([]);
    expect(parsed.problems).toEqual([expect.objectContaining({ code: "not-a-list", index: -1 })]);
  });

  it("keeps neighbours when the middle section is bad", () => {
    const parsed = parseEntrySections([
      sample("colloquial"),
      { id: "broken", type: "plain", payload: { paragraphs: [] } },
      sample("related"),
    ]);
    expect(parsed.sections.map((section) => section.type)).toEqual(["colloquial", "related"]);
    expect(parsed.problems).toEqual([
      expect.objectContaining({ code: "invalid-payload", index: 1 }),
    ]);
  });

  it("folds surviving sections and ignores dropped ones", () => {
    const parsed = parseEntrySections([sample("aliases"), { type: "nope" }, sample("when-not")]);
    const markdown = sectionsToMarkdown(parsed.sections);
    expect(markdown).toContain("也常被叫作");
    expect(markdown).toContain("什么时候不用");
    expect(markdown).not.toContain("nope");
  });
});

describe("payload typing smoke", () => {
  it("keeps the sample table honest against PayloadOf", () => {
    const related: PayloadOf<"related"> = SAMPLES.related.payload;
    const prompt: PayloadOf<"agent-prompt"> = SAMPLES["agent-prompt"].payload;
    expect(related.senseIds).toEqual(["api.interface"]);
    expect(prompt.text.length).toBeGreaterThan(0);
  });
});
