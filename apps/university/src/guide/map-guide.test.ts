import { describe, expect, it, vi } from "vitest";
import { Vector3 } from "three";
import type { Marker } from "@pieai/university-world/Maps.js";
import { mapGuideAnswer, mapGuideQuestions, type MapGuideMap } from "./map-guide.js";

const at = new Vector3();
const course = (markers: readonly Marker[]): MapGuideMap => ({
  view: "course",
  markers,
  lessonTitle: (id) => ({ l2: "说清楚你要什么" })[id],
});

describe("涟 answers from the map, and names the place the answer is about", () => {
  const pickLive = vi.fn();
  const pickOpenChallenge = vi.fn();
  const markers: Marker[] = [
    { id: "l1", kind: "lesson", text: "第一节", position: at, lessonId: "l1", lessonState: "done" },
    {
      id: "l2",
      kind: "lesson",
      text: "开始",
      position: at,
      lessonId: "l2",
      lessonState: "live",
      activate: pickLive,
    },
    { id: "gate", kind: "icon", text: "◇", position: at, learningKind: "checkpoint" },
    { id: "c1", kind: "icon", text: "⚡", position: at, learningKind: "challenge", locked: true },
    {
      id: "c2",
      kind: "icon",
      text: "⚡",
      label: "游戏挑战 · 第 4–6 节",
      position: at,
      learningKind: "challenge",
      activate: pickOpenChallenge,
    },
  ];

  it("start names the live stone by its lesson title, not its 「开始」 caption", () => {
    const answer = mapGuideAnswer("start", course(markers), () => {});
    expect(answer.place).toEqual({ kind: "marker", markerId: "l2", label: "说清楚你要什么" });
    expect(answer.text).toContain("说清楚你要什么");
    answer.go?.run();
    expect(pickLive).toHaveBeenCalledOnce();
  });

  it("challenge prefers the first ⚡ a learner can reach, and opens it the way a click does", () => {
    const answer = mapGuideAnswer("challenge", course(markers), () => {});
    expect(answer.place).toMatchObject({ kind: "marker", markerId: "c2" });
    answer.go?.run();
    expect(pickOpenChallenge).toHaveBeenCalledOnce();
  });

  it("a road whose challenges are all locked still points at the first, and says why", () => {
    const answer = mapGuideAnswer("challenge", course(markers.slice(0, 4)), () => {});
    expect(answer.place).toMatchObject({ markerId: "c1" });
    expect(answer.text).toMatch(/学到它旁边那一节/);
  });

  it("review and shortcuts point at the navigation's own entries", () => {
    const onShortcuts = vi.fn();
    expect(mapGuideAnswer("review", course(markers), onShortcuts).place).toMatchObject({
      kind: "nav",
      navId: "practice",
    });
    const shortcuts = mapGuideAnswer("shortcuts", course(markers), onShortcuts);
    expect(shortcuts.place).toMatchObject({ kind: "nav", navId: "more" });
    shortcuts.go?.run();
    expect(onShortcuts).toHaveBeenCalledOnce();
  });

  it("a map with nothing to point at answers without a place instead of guessing one", () => {
    const empty = course([]);
    expect(mapGuideAnswer("start", empty, () => {}).place).toBeNull();
    expect(mapGuideAnswer("challenge", empty, () => {}).place).toBeNull();
  });

  it("the archipelago points at the live island and has no challenge question", () => {
    const world: MapGuideMap = {
      view: "world",
      lessonTitle: () => undefined,
      markers: [
        { id: "done", kind: "course", text: "已学完", position: at, courseState: "done" },
        { id: "now", kind: "course", text: "认识 AI", position: at, courseState: "live" },
      ],
    };
    expect(mapGuideQuestions("world")).not.toContain("challenge");
    expect(mapGuideAnswer("start", world, () => {}).place).toEqual({
      kind: "marker",
      markerId: "now",
      label: "认识 AI",
    });
  });
});
