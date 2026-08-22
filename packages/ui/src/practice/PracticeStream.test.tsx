// @vitest-environment jsdom

import {
  assemblePracticeQuestion,
  assembleTermEntry,
  type LexiconEntry,
  type PracticeQuestion,
  type PracticeRecentState,
} from "@pieai/university-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const playSound = vi.hoisted(() => vi.fn());

vi.mock("../sound/index.js", () => ({
  playSound,
}));

import { TermEntryPage } from "../entry/EntryPage.js";
import { CHOICE_NEXT_LABEL, CHOICE_SUBMIT_LABEL } from "../review/ChoiceBlock.js";
import {
  PRACTICE_EMPTY_ACTION,
  PRACTICE_EMPTY_DESCRIPTION,
  PRACTICE_EMPTY_TITLE,
  PRACTICE_INTRO_ACTION,
  PRACTICE_INTRO_DESCRIPTION,
  PRACTICE_INTRO_TITLE,
  PracticeStream,
  practiceSolvedLabel,
  sittingSolvedCount,
} from "./PracticeStream.js";
import { PRACTICE_UNLOCK_HINT } from "./PracticeRewardPanel.js";
import type { PracticeRecentStore } from "./storage.js";

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

const APP_PROMPT = "交付物已经能点开就用。怎样称呼它更合适？";
const API_PROMPT = "另一个程序要来调用功能。怎样交接更合适？";
const APP_CORRECT = "把能点开就用的成品单独当作一种交付物。";
const APP_WRONG = "先清缓存再刷新，页面就会自己变对。";
const API_CORRECT = "按对方规定的格式提要求，只公开约定好的入口。";

function questionFor(
  entry: LexiconEntry,
  prompt: string,
  correctText: string,
  extraWrong: string,
): PracticeQuestion<LexiconEntry> {
  const assembled = assemblePracticeQuestion(
    assembleTermEntry(entry).entry,
    {
      prompt,
      options: [
        { id: "keep", text: correctText, explanation: "这是对的判据。" },
        { id: "wrong-a", text: extraWrong, explanation: "省事并不等于成立。" },
        {
          id: "wrong-b",
          text: "用一个确认处理所有后果，点了再猜。",
          explanation: "这不是这道题在问的事。",
        },
      ],
      correctOptionId: "keep",
    },
    { category: entry.track, id: entry.senseId },
  );
  if (!assembled.ok) throw new Error(assembled.errors.map((issue) => issue.code).join(","));
  return assembled.question;
}

const QUESTIONS = [
  questionFor(APP, APP_PROMPT, APP_CORRECT, APP_WRONG),
  questionFor(API, API_PROMPT, API_CORRECT, "把所有内部函数都对外公开。"),
] as const;

function memoryStore(initial?: PracticeRecentState): PracticeRecentStore {
  let state: PracticeRecentState = initial ?? { version: 1, ids: [] };
  return {
    read: () => state,
    write: (next) => {
      state = next;
    },
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  playSound.mockClear();
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function termReward(question: PracticeQuestion<LexiconEntry>) {
  return <TermEntryPage entry={question.entry} />;
}

async function renderStream(
  props: Partial<Parameters<typeof PracticeStream<LexiconEntry>>[0]> & {
    readonly store?: PracticeRecentStore;
  } = {},
) {
  const store = props.store ?? memoryStore();
  await act(async () => {
    root.render(
      <PracticeStream questions={QUESTIONS} store={store} renderReward={termReward} {...props} />,
    );
  });
  return store;
}

function buttonWith(text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find((button) =>
    button.textContent?.includes(text),
  );
}

function submitControl(): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find(
    (button) => button.textContent === CHOICE_SUBMIT_LABEL,
  );
}

async function startSitting() {
  await act(async () => {
    buttonWith(PRACTICE_INTRO_ACTION)?.click();
  });
}

async function submitOption(text: string) {
  await act(async () => {
    buttonWith(text)?.click();
  });
  await act(async () => {
    submitControl()?.click();
  });
}

describe("practiceSolvedLabel", () => {
  it("names how many this sitting got right, and does not invent a total", () => {
    expect(practiceSolvedLabel(0)).toBe("本次已答对 0");
    expect(practiceSolvedLabel(12)).toBe("本次已答对 12");
    expect(practiceSolvedLabel(12)).not.toContain("/");
    expect(practiceSolvedLabel(1)).not.toContain("第");
  });

  it("counts an unlocked question as solved, and a locked one as not yet", () => {
    expect(sittingSolvedCount({ ordinal: 1, currentId: "a", unlocked: false })).toBe(0);
    expect(sittingSolvedCount({ ordinal: 1, currentId: "a", unlocked: true })).toBe(1);
    expect(sittingSolvedCount({ ordinal: 2, currentId: "b", unlocked: false })).toBe(1);
  });
});

describe("PracticeStream", () => {
  it("shows the empty state when the bank has no term quizzes", async () => {
    const onBrowse = vi.fn();
    await renderStream({ questions: [], onBrowse });
    expect(container.textContent).toContain(PRACTICE_EMPTY_TITLE);
    expect(container.textContent).toContain(PRACTICE_EMPTY_DESCRIPTION);
    const browse = buttonWith(PRACTICE_EMPTY_ACTION);
    expect(browse).toBeTruthy();
    await act(async () => {
      browse?.click();
    });
    expect(onBrowse).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[role='progressbar']")).toBeNull();
  });

  it("opens on a recommendation card rather than the first question", async () => {
    await renderStream();
    expect(container.textContent).toContain(PRACTICE_INTRO_TITLE);
    expect(container.textContent).toContain(PRACTICE_INTRO_DESCRIPTION);
    expect(buttonWith(PRACTICE_INTRO_ACTION)).toBeTruthy();
    expect(container.textContent).not.toContain(APP_PROMPT);
    expect(container.querySelector(".practice-stream__ordinal")).toBeNull();
  });

  it("starts at 本次已答对 0 with the term panel locked and no scoreboard", async () => {
    await renderStream();
    await startSitting();
    expect(container.querySelector(".practice-stream__ordinal")?.textContent).toBe("本次已答对 0");
    expect(container.textContent).toContain(APP_PROMPT);
    expect(container.textContent).toContain(PRACTICE_UNLOCK_HINT);
    expect(container.querySelector(".practice-reward-panel")?.className).toContain("is-locked");
    expect(container.textContent).not.toContain(APP.gloss);
    expect(container.querySelector("[role='progressbar']")).toBeNull();
    expect(container.textContent).not.toMatch(/共\s*\d+\s*题/);
    expect(container.textContent).not.toContain("正确率");
    expect(container.textContent).not.toContain("第 1 题");
    expect(container.querySelector(".term-index__chips")).toBeNull();
  });

  it("keeps the term page masked after a wrong submit and plays answer.wrong", async () => {
    await renderStream();
    await startSitting();
    expect(buttonWith(APP_WRONG)).toBeTruthy();
    await submitOption(APP_WRONG);
    expect(container.textContent).toContain("还不对");
    expect(container.textContent).toContain("省事并不等于成立。");
    expect(container.textContent).toContain(PRACTICE_UNLOCK_HINT);
    expect(container.textContent).not.toContain(APP.gloss);
    expect(buttonWith(CHOICE_NEXT_LABEL)).toBeUndefined();
    expect(playSound).toHaveBeenCalledWith("answer.wrong");
  });

  it("unlocks the existing term page in place after a correct submit", async () => {
    await renderStream();
    await startSitting();
    expect(buttonWith(APP_CORRECT)).toBeTruthy();
    await submitOption(APP_CORRECT);
    expect(container.textContent).toContain("答对了");
    expect(container.textContent).toContain("这是对的判据。");
    expect(container.textContent).not.toContain(PRACTICE_UNLOCK_HINT);
    expect(container.querySelector(".practice-reward-panel")?.className).not.toContain("is-locked");
    expect(container.querySelector(".entry-page")).not.toBeNull();
    expect(container.querySelector("h1")?.textContent).toContain("app");
    expect(container.textContent).toContain(APP.gloss);
    expect(container.textContent).toContain("术语图鉴");
    expect(playSound).toHaveBeenCalledWith("answer.correct");
    expect(buttonWith(CHOICE_NEXT_LABEL)).toBeTruthy();
    expect(container.querySelector(".practice-stream__ordinal")?.textContent).toBe("本次已答对 1");
  });

  it("advances the sitting, remembers the derived id, and locks the next term", async () => {
    const store = memoryStore();
    await renderStream({ store });
    await startSitting();
    await submitOption(APP_CORRECT);
    await act(async () => {
      buttonWith(CHOICE_NEXT_LABEL)?.click();
    });
    expect(container.querySelector(".practice-stream__ordinal")?.textContent).toBe("本次已答对 1");
    expect(container.textContent).toContain(API_PROMPT);
    expect(container.textContent).toContain(PRACTICE_UNLOCK_HINT);
    expect(container.textContent).not.toContain(APP.gloss);
    expect(container.textContent).not.toContain(API.gloss);
    expect(store.read().ids).toEqual(["technical-app.program"]);
  });
});
