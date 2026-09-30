import { describe, expect, it } from "vitest";

import { choiceRoundsFromLesson } from "./choices.js";
import type { GameLesson } from "./rounds.js";
import { spotRoundsFromLesson } from "./spots.js";

const weigh = {
  id: "start-reading",
  kind: "weigh",
  title: "怎么开始读？",
  question: "这一种项目情况，哪种起手方式最值得付出时间？",
  options: [
    { id: "whole", label: "从头读完", note: "…" },
    { id: "assembly", label: "先看拼装关系", note: "…" },
  ],
  situations: [
    {
      id: "small",
      label: "四个文件、一百行",
      detail: "全貌已经在眼前。",
      bestOptionId: "whole",
      why: "它是一整块东西。",
      costOfOther: { assembly: "先找拼装关系会多绕一层。" },
    },
    {
      id: "broken",
      label: "少了代价的一条",
      bestOptionId: "assembly",
      why: "…",
      costOfOther: {},
    },
  ],
};

const path = {
  id: "claim",
  kind: "interaction-path",
  title: "一个链接能支持整段话吗？",
  steps: [
    {
      id: "r1",
      kind: "decision",
      question: "整段都有记录支撑吗？",
      explanation: "先判断整段能不能站得住。",
      options: [
        { id: "yes", label: "能", explanation: "机构名字不能代替按句核对。" },
        { id: "no", label: "不能", explanation: "有链接也不等于整段都成立。" },
      ],
      correctOptionId: "no",
    },
    {
      id: "r2",
      kind: "evidence",
      question: "点出这份记录没有支撑的那一句。",
      task: "unsupported",
      material: {
        label: "草稿",
        note: "…",
        reference: { label: "NASA", text: "安德斯于1968年12月24日拍摄。" },
        sentences: [
          { id: "date", label: "他在1968年12月24日拍下这张图。", explanation: "对得上。" },
          { id: "orbit", label: "这是绕月时拍的。", explanation: "对得上。" },
          { id: "quote", label: "他说自己激动得说不出话。", explanation: "记录没有这句原话。" },
        ],
      },
      correctSentenceId: "quote",
    },
  ],
};

const lesson: GameLesson = { id: "l", title: "课", activities: [weigh, path] };

describe("三岔路 rounds", () => {
  it("projects a weigh board, dropping a situation whose costs are not all written", () => {
    const [round] = choiceRoundsFromLesson(lesson);
    expect(round?.question).toBe("这一种项目情况，哪种起手方式最值得付出时间？");
    expect(round?.items).toEqual([
      {
        id: "small",
        text: "四个文件、一百行",
        detail: "全貌已经在眼前。",
        options: [
          { id: "whole", label: "从头读完" },
          { id: "assembly", label: "先看拼装关系" },
        ],
        bestId: "whole",
        why: "它是一整块东西。",
        whyNot: { assembly: "先找拼装关系会多绕一层。" },
      },
    ]);
  });

  it("turns an interaction path's decision steps into one round, each option explained", () => {
    const round = choiceRoundsFromLesson(lesson)[1];
    expect(round?.question).toBe("一个链接能支持整段话吗？");
    expect(round?.items[0]).toMatchObject({
      id: "r1",
      text: "整段都有记录支撑吗？",
      bestId: "no",
      why: "有链接也不等于整段都成立。",
      whyNot: { yes: "机构名字不能代替按句核对。" },
    });
  });
});

describe("打地鼠 rounds", () => {
  it("projects an evidence step: the source, every sentence with its reason, one target", () => {
    expect(spotRoundsFromLesson(lesson)).toEqual([
      {
        id: "l/claim/r2",
        lessonId: "l",
        lessonTitle: "课",
        question: "点出这份记录没有支撑的那一句。",
        source: "安德斯于1968年12月24日拍摄。",
        items: [
          { id: "date", text: "他在1968年12月24日拍下这张图。", target: false, why: "对得上。" },
          { id: "orbit", text: "这是绕月时拍的。", target: false, why: "对得上。" },
          {
            id: "quote",
            text: "他说自己激动得说不出话。",
            target: true,
            why: "记录没有这句原话。",
          },
        ],
      },
    ]);
  });
});
