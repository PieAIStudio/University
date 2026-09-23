import { describe, expect, it } from "vitest";

import {
  GAME_ITEM_MAX_WIDTH,
  displayWidth,
  gameRoundsForSegment,
  gameRoundsFromLesson,
  type GameLesson,
} from "./rounds.js";

const why = "原因。";

/** The lesson-level sort shape (first-request-checkpoint). */
const lessonSort: GameLesson = {
  id: "checkpoint",
  title: "第一次请求",
  activities: [
    {
      id: "roles",
      kind: "sort",
      question: "这句要求在任务中负责什么？",
      buckets: [
        { id: "material", label: "使用的材料", note: "依据哪份记录。" },
        { id: "output", label: "要交的成品", note: "给谁做什么。" },
        { id: "check", label: "必须保留的条件", note: "能逐项核对。" },
      ],
      items: [
        { id: "page", label: "使用2024年图书节官方记录", detail: "…", bucketId: "material", why },
        { id: "reader", label: "给朋友写两句回看说明", detail: "…", bucketId: "output", why },
        {
          id: "year",
          label: "保留2024年，不写成当前邀请",
          detail: "…",
          bucketId: "check",
          why,
          tempting: { bucketId: "output", whyNot: "年份不是成品。" },
        },
      ],
    },
  ],
};

/** The PRIMM step shape (ask-about-a-picture), beside steps that are not sorts. */
const primmSteps: GameLesson = {
  id: "picture",
  title: "问照片里的一处",
  activities: [
    {
      id: "v2",
      kind: "primm",
      experienceVersion: 3,
      steps: [
        { kind: "choose", id: "guess", title: "哪句最能问到？", options: [] },
        {
          kind: "sort",
          id: "can-photo-answer",
          title: "光看照片，答得出来吗？",
          buckets: [
            { id: "yes", label: "答得出" },
            { id: "no", label: "答不出" },
          ],
          cards: [
            { id: "colour", text: "杯子是什么颜色？", bucketId: "yes", why },
            { id: "sweet", text: "咖啡甜不甜？", bucketId: "no", why },
            { id: "shop", text: "这是哪家店？", bucketId: "no", why },
          ],
          after: "看得见的，才问得准。",
        },
        { kind: "point", id: "point", title: "点出泡沫", regions: [] },
      ],
    },
  ],
};

/** The PRIMM investigate shape (sound-words-and-meaning). */
const primmInvestigate: GameLesson = {
  id: "sound",
  title: "听写和意思",
  activities: [
    {
      id: "listen",
      kind: "primm",
      experienceVersion: 2,
      investigate: {
        title: "先看文字有没有漏掉要紧的事",
        game: {
          kind: "sort",
          buckets: [
            { id: "all", label: "三个位置都有" },
            { id: "missing", label: "有一项没写全" },
          ],
          cards: [
            {
              id: "complete",
              text: "时间：周六下午三点；地点：图书馆；要带：笔记本。",
              bucketId: "all",
              why,
            },
            { id: "no-item", text: "时间：周六下午三点；地点：图书馆。", bucketId: "missing", why },
          ],
        },
      },
    },
  ],
};

describe("game rounds from lessons", () => {
  it("projects a lesson sort unchanged, including bin notes and tempting bins", () => {
    const [round] = gameRoundsFromLesson(lessonSort);
    expect(round).toMatchObject({
      id: "checkpoint/roles",
      lessonId: "checkpoint",
      lessonTitle: "第一次请求",
      question: "这句要求在任务中负责什么？",
    });
    expect(round!.bins.map((bin) => bin.label)).toEqual([
      "使用的材料",
      "要交的成品",
      "必须保留的条件",
    ]);
    expect(round!.bins[0]!.note).toBe("依据哪份记录。");
    expect(round!.items.find((item) => item.id === "year")).toEqual({
      id: "year",
      text: "保留2024年，不写成当前邀请",
      binId: "check",
      why,
      tempting: { binId: "output", whyNot: "年份不是成品。" },
    });
  });

  it("takes only the sort steps of a PRIMM v3 activity", () => {
    const rounds = gameRoundsFromLesson(primmSteps);
    expect(rounds.map((round) => round.id)).toEqual(["picture/v2/can-photo-answer"]);
    expect(rounds[0]!.question).toBe("光看照片，答得出来吗？");
    expect(rounds[0]!.items.map((item) => item.text)).toContain("咖啡甜不甜？");
  });

  it("uses the investigate title as the question of a PRIMM v2 sort", () => {
    const [round] = gameRoundsFromLesson(primmInvestigate);
    expect(round!.id).toBe("sound/listen/investigate");
    expect(round!.question).toBe("先看文字有没有漏掉要紧的事");
    expect(round!.bins).toEqual([
      { id: "all", label: "三个位置都有" },
      { id: "missing", label: "有一项没写全" },
    ]);
  });

  it("drops items too long to read in motion, and the round if a bin empties", () => {
    const long = "字".repeat(GAME_ITEM_MAX_WIDTH / 2 + 1);
    const withLong = structuredClone(primmSteps) as {
      activities: { steps: { cards?: { text: string }[] }[] }[];
    };
    withLong.activities[0]!.steps[1]!.cards![2]!.text = long;
    const [kept] = gameRoundsFromLesson(withLong as unknown as GameLesson);
    expect(kept!.items.map((item) => item.id)).toEqual(["colour", "sweet"]);

    withLong.activities[0]!.steps[1]!.cards![1]!.text = long;
    expect(gameRoundsFromLesson(withLong as unknown as GameLesson)).toEqual([]);
  });

  it("skips what it cannot project instead of rewriting it", () => {
    const fourBins = structuredClone(lessonSort) as { activities: { buckets: unknown[] }[] };
    fourBins.activities[0]!.buckets.push({ id: "extra", label: "其他" });
    expect(gameRoundsFromLesson(fourBins as unknown as GameLesson)).toEqual([]);

    const longBin = structuredClone(primmInvestigate) as {
      activities: { investigate: { game: { buckets: { label: string }[] } } }[];
    };
    longBin.activities[0]!.investigate.game.buckets[0]!.label =
      "这个分类的名字实在是长得放不进一个按钮";
    expect(gameRoundsFromLesson(longBin as unknown as GameLesson)).toEqual([]);

    const checkResult: GameLesson = {
      id: "result",
      title: "核对结果",
      activities: [
        {
          id: "a",
          kind: "primm",
          experienceVersion: 2,
          investigate: { title: "对照", game: { kind: "check-result", items: [] } },
        },
      ],
    };
    expect(gameRoundsFromLesson(checkResult)).toEqual([]);
    expect(
      gameRoundsFromLesson({ id: "none", title: "无", activities: [null, "x", { kind: "sort" }] }),
    ).toEqual([]);
  });

  it("measures reading room, not characters, so English rounds are not dropped", () => {
    expect(displayWidth("答不出")).toBe(6);
    expect(displayWidth("Can't answer")).toBe(12);
    expect(displayWidth("9 月 27 日")).toBe(10);
    const english = structuredClone(primmInvestigate) as {
      activities: {
        investigate: { game: { buckets: { label: string }[]; cards: { text: string }[] } };
      }[];
    };
    const game = english.activities[0]!.investigate.game;
    game.buckets[0]!.label = "All three are there";
    game.buckets[1]!.label = "One item is missing";
    game.cards[0]!.text = "Time: Saturday 3 p.m.; place: the library; bring: a notebook.";
    game.cards[1]!.text = "Time: Saturday 3 p.m.; place: the library.";
    expect(gameRoundsFromLesson(english as unknown as GameLesson)[0]!.items).toHaveLength(2);
  });

  it("orders a segment's own lessons first, then earlier ones from the nearest", () => {
    const rounds = gameRoundsForSegment([primmSteps, primmInvestigate, lessonSort], ["checkpoint"]);
    expect(rounds.map((round) => round.lessonId)).toEqual(["checkpoint", "sound", "picture"]);
  });
});
