// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SECTION_TYPES,
  assembleTermEntry,
  getAntiPatternEntry,
  type EntrySection,
  type EntrySectionType,
  type LexiconEntry,
} from "@pieai/university-core";

import { AntiPatternEntryPage, TermEntryPage } from "./EntryPage.js";

const APP: LexiconEntry = {
  senseId: "app.program",
  headword: "app",
  phonetic: "/æp/",
  partOfSpeech: "noun",
  gloss: "应用：用户点开图标就能用的那个成品",
  usage: "App 是 application 的口语缩写。",
  track: "technical",
};

const API: LexiconEntry = {
  senseId: "api.interface",
  headword: "api",
  phonetic: "/ˌeɪpiːˈaɪ/",
  partOfSpeech: "noun",
  gloss: "接口：一个程序对外开放的功能清单",
  usage: "按对方规定的格式提要求。",
  track: "technical",
};

const LEXICON = new Map<string, LexiconEntry>([
  [APP.senseId, APP],
  [API.senseId, API],
]);

const ALL_SECTIONS = {
  colloquial: { id: "say-this", type: "colloquial", payload: { text: "点开图标就能用。" } },
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
        { label: "填写并点击保存", description: "前端读取输入，显示保存中。", current: true },
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
  "style-sample": {
    id: "style-look",
    type: "style-sample",
    payload: {
      alt: "同一张产品页换了另一套外观。",
      caption: "结构不变，皮肤可换。",
      skin: "apple",
      contrastSkin: "brutalism",
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

let container: HTMLDivElement;
let root: Root;
const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  writeText.mockClear();
  vi.stubGlobal("navigator", { clipboard: { writeText } });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("EntryPage", () => {
  it("renders breadcrumb, head, sections in order, and copies the fold", async () => {
    const { entry } = assembleTermEntry(APP, [
      { id: "say-this", type: "colloquial", payload: { text: "点开图标就能用的那个东西。" } },
      { id: "next", type: "related", payload: { senseIds: ["api.interface"] } },
    ]);

    await act(async () => {
      root.render(<TermEntryPage entry={entry} collectionHref="#/terms" lexicon={LEXICON} />);
    });

    const crumb = container.querySelector('[aria-label="面包屑"]');
    expect(crumb?.textContent).toContain("术语图鉴");
    expect(crumb?.textContent).toContain("app");
    expect(container.querySelector("h1")?.textContent).toContain("app");
    expect(container.querySelector(".entry-head__gloss")?.textContent).toContain("应用");

    const sections = [...container.querySelectorAll("[data-section-type]")].map((node) =>
      node.getAttribute("data-section-type"),
    );
    expect(sections).toEqual(["colloquial", "related"]);
    expect(container.textContent).toContain("你可能会说");
    expect(container.textContent).toContain("点开图标就能用的那个东西。");
    expect(container.textContent).toContain("相关");
    expect(container.textContent).toContain("api");

    const copy = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("复制为 Markdown"),
    );
    expect(copy).toBeTruthy();
    await act(async () => {
      copy?.click();
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    const pasted = writeText.mock.calls[0]?.[0] as string;
    expect(pasted).toContain("# app");
    expect(pasted).toContain("## 你可能会说");
    expect(pasted).toContain("## 相关");
  });

  it("renders a zero-section entry as just the head", async () => {
    const { entry } = assembleTermEntry(APP, []);
    await act(async () => {
      root.render(<TermEntryPage entry={entry} />);
    });
    expect(container.querySelectorAll("[data-section-type]")).toHaveLength(0);
    expect(container.querySelector("h1")?.textContent).toContain("app");
    expect(container.querySelector(".entry-page__sections")).toBeNull();
  });

  it("is collection-generic: an anti-pattern uses the same shell", async () => {
    const entry = getAntiPatternEntry("steady-catch");
    expect(entry).toBeTruthy();
    await act(async () => {
      root.render(<AntiPatternEntryPage entry={entry!} collectionHref="#/anti-patterns" />);
    });
    expect(container.querySelector('[aria-label="面包屑"]')?.textContent).toContain("防止 AI 味儿");
    expect(container.querySelector('[aria-label="面包屑"]')?.textContent).toContain("稳稳接住");
    expect(container.querySelector("h1")?.textContent).toContain("稳稳接住");
    expect(container.textContent).toContain("你正常说就行");
    expect(container.querySelector('[data-section-type="when-not"]')?.textContent).toContain(
      "什么时候不用",
    );
    expect(container.querySelector('[data-section-type="plain"]')).not.toBeNull();
    expect(container.querySelector('[data-section-type="before-after"]')).not.toBeNull();
    expect(container.querySelector('[data-section-type="agent-prompt"]')).not.toBeNull();

    const copy = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("复制为 Markdown"),
    );
    await act(async () => {
      copy?.click();
    });
    const pasted = writeText.mock.calls[0]?.[0] as string;
    expect(pasted).toContain("# 稳稳接住");
    expect(pasted).toContain("## 通俗解释");
    expect(pasted).toContain("## 改前 / 改后");
  });

  it("renders every registered section type", async () => {
    const sections = SECTION_TYPES.map((type) => ALL_SECTIONS[type]);
    const { entry } = assembleTermEntry(APP, sections);
    await act(async () => {
      root.render(<TermEntryPage entry={entry} lexicon={LEXICON} />);
    });
    const rendered = [...container.querySelectorAll("[data-section-type]")].map((node) =>
      node.getAttribute("data-section-type"),
    );
    expect(rendered).toEqual([...SECTION_TYPES]);
  });

  it("opens a related sense through the callback rather than inventing a route", async () => {
    const onOpenSense = vi.fn();
    const { entry } = assembleTermEntry(APP, [
      { id: "next", type: "related", payload: { senseIds: ["api.interface"] } },
    ]);
    await act(async () => {
      root.render(<TermEntryPage entry={entry} lexicon={LEXICON} onOpenSense={onOpenSense} />);
    });
    const pointer = container.querySelector(".entry-section__sense");
    await act(async () => {
      (pointer as HTMLButtonElement | null)?.click();
    });
    expect(onOpenSense).toHaveBeenCalledWith("api.interface");
  });

  it("renders a flow as an ordered list and highlights the current step", async () => {
    const { entry } = assembleTermEntry(APP, [ALL_SECTIONS.flow]);
    await act(async () => {
      root.render(<TermEntryPage entry={entry} />);
    });

    const section = container.querySelector('[data-section-type="flow"]');
    expect(section?.querySelector("h2")?.textContent).toBe("在这条链路里");
    expect(section?.textContent).toContain("一次保存经过哪些部分？");
    const list = section?.querySelector("ol");
    expect(list).toBeTruthy();
    expect(list?.tagName).toBe("OL");
    const steps = [...(list?.querySelectorAll("li") ?? [])];
    expect(steps).toHaveLength(2);
    expect(steps[0]?.getAttribute("data-current")).toBe("true");
    expect(steps[0]?.textContent).toContain("本页重点");
    expect(steps[0]?.textContent).toContain("填写并点击保存");
    expect(steps[1]?.getAttribute("data-current")).toBeNull();
    expect(steps[1]?.textContent).not.toContain("本页重点");

    const copy = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("复制为 Markdown"),
    );
    await act(async () => {
      copy?.click();
    });
    const pasted = writeText.mock.calls[0]?.[0] as string;
    expect(pasted).toContain("1. **填写并点击保存** — 前端读取输入，显示保存中。（本页重点）");
    expect(pasted).toContain("2. **写入记录** — 数据库长期保存这次修改。");
    expect(pasted).not.toContain("2. **写入记录** — 数据库长期保存这次修改。（本页重点）");
  });

  it("hides the pronunciation button when speechSynthesis is missing", async () => {
    const { entry } = assembleTermEntry(APP, []);
    await act(async () => {
      root.render(<TermEntryPage entry={entry} />);
    });
    expect(container.querySelector('[aria-label="听 app 的英文发音"]')).toBeNull();
    expect(container.textContent).not.toContain("听发音");
  });

  it("reads the English headword, not the Chinese gloss", async () => {
    const speak = vi.fn();
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        text: string;
        voice: unknown = null;
        lang = "";
        rate = 1;
        constructor(text: string) {
          this.text = text;
        }
      },
    );
    vi.stubGlobal("speechSynthesis", {
      getVoices: () => [
        {
          name: "Samantha",
          lang: "en-US",
          localService: true,
          default: true,
          voiceURI: "Samantha",
        },
      ],
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      cancel: vi.fn(),
      speak,
    });

    const { entry } = assembleTermEntry(APP, []);
    await act(async () => {
      root.render(<TermEntryPage entry={entry} />);
    });

    const button = container.querySelector('[aria-label="听 app 的英文发音"]');
    expect(button).toBeTruthy();
    expect(button?.textContent).toContain("听发音");
    await act(async () => {
      (button as HTMLButtonElement | null)?.click();
    });
    expect(speak).toHaveBeenCalledTimes(1);
    const utterance = speak.mock.calls[0]?.[0] as { text: string };
    expect(utterance.text).toBe("app");
    expect(utterance.text).not.toContain("应用");
  });

  it("does not put a pronunciation button on an anti-pattern head", async () => {
    const entry = getAntiPatternEntry("steady-catch");
    await act(async () => {
      root.render(<AntiPatternEntryPage entry={entry!} />);
    });
    expect(container.querySelector('[aria-label^="听 "]')).toBeNull();
  });

  it("takes neighbours as props and reveals their names, for either collection", async () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    const { entry } = assembleTermEntry(APP, []);
    await act(async () => {
      root.render(
        <TermEntryPage
          entry={entry}
          neighbours={{
            previous: { label: "api", onOpen: onPrevious },
            next: { label: "backend", href: "#/terms/backend", onOpen: onNext },
          }}
        />,
      );
    });

    const nav = container.querySelector('[aria-label="相邻条目"]');
    expect(nav).toBeTruthy();
    const previous = container.querySelector('[data-neighbour="previous"]');
    const next = container.querySelector('[data-neighbour="next"]');
    expect(previous?.getAttribute("aria-label")).toBe("上一个：api");
    expect(previous?.getAttribute("title")).toBe("api");
    expect(previous?.textContent).toContain("api");
    expect(next?.getAttribute("aria-label")).toBe("下一个：backend");
    expect(next?.getAttribute("title")).toBe("backend");
    expect(next?.getAttribute("href")).toBe("#/terms/backend");
    expect(next?.textContent).toContain("backend");

    await act(async () => {
      (previous as HTMLButtonElement | null)?.click();
    });
    expect(onPrevious).toHaveBeenCalledTimes(1);

    await act(async () => {
      (next as HTMLAnchorElement | null)?.click();
    });
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("hides a missing neighbour rather than rendering a dead control", async () => {
    const entry = getAntiPatternEntry("steady-catch");
    await act(async () => {
      root.render(
        <AntiPatternEntryPage
          entry={entry!}
          neighbours={{ next: { label: "热情洋溢", onOpen: () => undefined } }}
        />,
      );
    });
    expect(container.querySelector('[data-neighbour="previous"]')).toBeNull();
    expect(container.querySelector('[data-neighbour="next"]')?.getAttribute("aria-label")).toBe(
      "下一个：热情洋溢",
    );
  });
});
