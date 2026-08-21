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
});
