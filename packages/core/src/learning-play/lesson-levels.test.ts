import { describe, expect, it } from "vitest";

import { availableLevels, defaultActivityLevel, groupActivityLevels } from "./lesson-levels.js";
import type { LearningActivitySpec } from "./types.js";

function connect(id: string, extra: Record<string, unknown> = {}): LearningActivitySpec {
  return {
    id,
    kind: "connect",
    title: id,
    brief: "b",
    goal: "g",
    takeaway: "t",
    hint: "h",
    source: { label: "s", url: "https://example.com/" },
    nodes: [],
    edges: [],
    probes: [],
    ...extra,
  } as unknown as LearningActivitySpec;
}

describe("lesson activity levels", () => {
  /*
    The point of the whole feature: a lesson can now store more than one level,
    and asking for any member's id gets you all of them. This is the boundary
    that did not exist — `selectActivityLevel` and the three-level family type
    have worked for a year, and nothing outside the play lab could reach them,
    because a lesson had nowhere to put a second payload.
  */
  it("groups a family so any member id finds every level", () => {
    const grouped = groupActivityLevels([
      connect("a", { family: "wiring", difficulty: "intro" }),
      connect("b", { family: "wiring", difficulty: "challenge" }),
    ]);
    expect(availableLevels(grouped.get("a")!)).toEqual(["intro", "challenge"]);
    expect(availableLevels(grouped.get("b")!)).toEqual(["intro", "challenge"]);
    expect(grouped.get("a")).toBe(grouped.get("b"));
  });

  /* V5: 默认先提供入门 — not whichever level the prose happened to point at. */
  it("starts at the easiest level the lesson authored", () => {
    const grouped = groupActivityLevels([
      connect("a", { family: "w", difficulty: "challenge" }),
      connect("b", { family: "w", difficulty: "practice" }),
    ]);
    expect(defaultActivityLevel(grouped.get("a")!)).toBe("practice");
  });

  /*
    Twenty-seven lessons already store one activity and a label. They must keep
    rendering exactly as they did, with no picker and nothing to choose.
  */
  it("leaves a lone activity alone", () => {
    const grouped = groupActivityLevels([connect("solo", { difficulty: "practice" })]);
    expect(availableLevels(grouped.get("solo")!)).toEqual(["practice"]);
  });

  /*
    One engine has to carry all three levels — that is what makes them the same
    activity. Rendering a sort board as the "harder" version of a connect board
    would be a worse answer than declining to group and letting the gate say so.
  */
  it("refuses to group a family that mixes engines", () => {
    const grouped = groupActivityLevels([
      connect("a", { family: "w", difficulty: "intro" }),
      connect("b", { family: "w", difficulty: "challenge", kind: "sort" }),
    ]);
    expect(availableLevels(grouped.get("a")!)).toEqual(["intro"]);
  });
});
