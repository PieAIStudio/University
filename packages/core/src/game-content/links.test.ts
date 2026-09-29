import { describe, expect, it } from "vitest";

import { LINK_MAX_NODES, linkRoundsFromLesson } from "./links.js";
import { roundsForSegment, type GameLesson } from "./rounds.js";

const connect = (overrides: Record<string, unknown> = {}) => ({
  id: "route",
  kind: "connect",
  title: "顺着名字，找到该打开的文件",
  brief: "屏幕上有个搜索框。你想改它。",
  nodes: [
    { id: "screen", label: "屏幕上的搜索框", note: "…", x: 16, y: 25 },
    { id: "layout", label: "把各块摆在一起的地方", note: "…", x: 50, y: 25 },
    { id: "file", label: "SearchBar 那个文件", note: "…", x: 84, y: 25 },
  ],
  edges: [
    { from: "screen", to: "layout", why: "你看见的那一块，一定出现在摆放处" },
    { from: "layout", to: "file", why: "名字指向这个文件" },
  ],
  probes: [{ label: "想改搜索框", path: ["screen", "layout", "file"] }],
  ...overrides,
});

const lesson = (activities: unknown[], id = "names"): GameLesson => ({
  id,
  title: "顺着名字找文件",
  activities,
});

describe("连连看 rounds", () => {
  it("projects a connect activity unchanged: nodes, links with their reasons, probes", () => {
    const [round] = linkRoundsFromLesson(lesson([connect()]));
    expect(round).toEqual({
      id: "names/route",
      lessonId: "names",
      lessonTitle: "顺着名字找文件",
      question: "顺着名字，找到该打开的文件",
      brief: "屏幕上有个搜索框。你想改它。",
      nodes: [
        { id: "screen", label: "屏幕上的搜索框" },
        { id: "layout", label: "把各块摆在一起的地方" },
        { id: "file", label: "SearchBar 那个文件" },
      ],
      items: [
        {
          id: "screen>layout",
          from: "screen",
          to: "layout",
          why: "你看见的那一块，一定出现在摆放处",
        },
        { id: "layout>file", from: "layout", to: "file", why: "名字指向这个文件" },
      ],
      probes: [["screen", "layout", "file"]],
    });
  });

  it("skips what a pond cannot show rather than shortening it", () => {
    const long = connect({
      nodes: [
        { id: "screen", label: "屏幕上那个你一直盯着、很想改一改的搜索框" },
        { id: "layout", label: "摆放处" },
        { id: "file", label: "文件" },
      ],
    });
    const crowded = connect({
      nodes: Array.from({ length: LINK_MAX_NODES + 1 }, (_, i) => ({
        id: `n${i}`,
        label: `点${i}`,
      })),
      edges: [
        { from: "n0", to: "n1", why: "…" },
        { from: "n1", to: "n2", why: "…" },
      ],
      probes: [],
    });
    expect(linkRoundsFromLesson(lesson([long, crowded]))).toEqual([]);
  });

  it("refuses a pair linked twice, since the game plays links without direction", () => {
    const twice = connect({
      edges: [
        { from: "screen", to: "layout", why: "…" },
        { from: "layout", to: "screen", why: "…" },
      ],
    });
    expect(linkRoundsFromLesson(lesson([twice]))).toEqual([]);
  });

  it("drops a probe that names a node the round does not have", () => {
    const [round] = linkRoundsFromLesson(
      lesson([connect({ probes: [{ label: "x", path: ["screen", "ghost"] }] })]),
    );
    expect(round?.probes).toEqual([]);
  });

  it("orders a segment's own lessons first, then earlier ones from the nearest back", () => {
    const lessons = ["a", "b", "c"].map((id) => lesson([connect()], id));
    const ids = roundsForSegment(linkRoundsFromLesson, lessons, ["c"]).map((r) => r.lessonId);
    expect(ids).toEqual(["c", "b", "a"]);
  });
});
