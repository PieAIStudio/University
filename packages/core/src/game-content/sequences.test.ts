import { describe, expect, it } from "vitest";

import type { GameLesson } from "./rounds.js";
import { SEQUENCE_MAX_PIECES, sequenceRoundsFromLesson } from "./sequences.js";

const build = {
  kind: "build",
  id: "build-ask",
  phase: "modify",
  title: "拼一句只问这一处",
  context: "原来那句：说说这张照片里有什么。",
  pieces: [
    { id: "look", text: "看这张照片，" },
    { id: "cup", text: "杯子里" },
    { id: "foam", text: "有没有泡沫？" },
    { id: "all", text: "说说整张照片", why: "这块又变成问整张图了。" },
  ],
  answers: [
    ["look", "cup", "foam"],
    ["cup", "foam"],
  ],
  after: "这次只问一处。",
};

const picture: GameLesson = {
  id: "picture",
  title: "问照片里的一处",
  activities: [
    {
      id: "v3",
      kind: "primm",
      experienceVersion: 3,
      steps: [{ kind: "choose", id: "guess", title: "…", options: [] }, build],
    },
  ],
};

const route: GameLesson = {
  id: "names",
  title: "顺着名字找文件",
  activities: [
    {
      id: "route",
      kind: "connect",
      title: "两个目标，同一条路线",
      nodes: [
        { id: "screen", label: "屏幕上的搜索框" },
        { id: "layout", label: "摆放处" },
        { id: "head", label: "开头几行" },
        { id: "file", label: "SearchBar 文件" },
        { id: "grid", label: "图片网格" },
      ],
      edges: [
        { from: "screen", to: "layout", why: "看见的那块一定在摆放处" },
        { from: "layout", to: "head", why: "名字对应哪个文件，回开头几行看" },
        { from: "head", to: "file", why: "路径指向它" },
        { from: "grid", to: "layout", why: "换个目标，第一站还是同一处" },
      ],
      probes: [{ label: "想改搜索框", path: ["screen", "layout", "head", "file"] }],
    },
  ],
};

describe("贪吃蛇 rounds", () => {
  it("projects a build step unchanged: pieces, the distractor's reason, every order that counts", () => {
    const [round] = sequenceRoundsFromLesson(picture);
    expect(round).toEqual({
      id: "picture/v3/build-ask",
      lessonId: "picture",
      lessonTitle: "问照片里的一处",
      question: "拼一句只问这一处",
      context: "原来那句：说说这张照片里有什么。",
      items: [
        { id: "look", text: "看这张照片，" },
        { id: "cup", text: "杯子里" },
        { id: "foam", text: "有没有泡沫？" },
        { id: "all", text: "说说整张照片", why: "这块又变成问整张图了。" },
      ],
      answers: [
        ["look", "cup", "foam"],
        ["cup", "foam"],
      ],
    });
  });

  it("walks a connect probe as an order, each stop carrying the reason for the link into it", () => {
    const [round] = sequenceRoundsFromLesson(route);
    expect(round?.question).toBe("两个目标，同一条路线：想改搜索框");
    expect(round?.answers).toEqual([["screen", "layout", "head", "file"]]);
    expect(round?.items).toEqual([
      { id: "screen", text: "屏幕上的搜索框" },
      { id: "layout", text: "摆放处", reason: "看见的那块一定在摆放处" },
      { id: "head", text: "开头几行", reason: "名字对应哪个文件，回开头几行看" },
      { id: "file", text: "SearchBar 文件", reason: "路径指向它" },
      { id: "grid", text: "图片网格" },
    ]);
  });

  it("skips a probe step the lesson never drew as a link", () => {
    const skipped = structuredClone(route) as { activities: { probes: unknown[] }[] };
    skipped.activities[0]!.probes = [{ label: "跳着走", path: ["screen", "head", "file"] }];
    expect(sequenceRoundsFromLesson(skipped as GameLesson)).toEqual([]);
  });

  it("skips what a lawn cannot show rather than shortening it", () => {
    const long = structuredClone(build);
    long.pieces[0] = { id: "look", text: "请你认真仔细地看看这张我刚拍好的照片，" };
    const crowded = structuredClone(build);
    crowded.pieces = Array.from({ length: SEQUENCE_MAX_PIECES + 1 }, (_, i) => ({
      id: i < 3 ? ["look", "cup", "foam"][i]! : `x${i}`,
      text: `块${i}`,
    }));
    const lesson = (step: unknown): GameLesson => ({
      id: "p",
      title: "p",
      activities: [{ id: "v3", kind: "primm", steps: [step] }],
    });
    expect(sequenceRoundsFromLesson(lesson(long))).toEqual([]);
    expect(sequenceRoundsFromLesson(lesson(crowded))).toEqual([]);
  });
});
