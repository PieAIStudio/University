import { describe, expect, it } from "vitest";

import {
  MIN_ISLAND_ROUNDS,
  islandRoundsForSegment,
  pickIslandGame,
  type IslandRounds,
} from "./island-games.js";
import type { GameLesson } from "./rounds.js";

const sort = (id: string) => ({
  id,
  kind: "sort",
  question: "答得出吗？",
  buckets: [
    { id: "yes", label: "答得出" },
    { id: "no", label: "答不出" },
  ],
  items: [
    { id: "a", label: "颜色", bucketId: "yes", why: "看得到。" },
    { id: "b", label: "甜不甜", bucketId: "no", why: "尝不到。" },
  ],
});

const empty: IslandRounds = {
  courtyard: [],
  links: [],
  snake: [],
  moles: [],
  runner: [],
  blocks: [],
};

describe("island games", () => {
  it("projects every game's rounds from the same practised lessons", () => {
    const lessons: GameLesson[] = [
      { id: "one", title: "一", activities: [sort("s1")] },
      { id: "two", title: "二", activities: [sort("s2")] },
    ];
    const rounds = islandRoundsForSegment(lessons, ["one", "two"]);
    expect(rounds.courtyard).toHaveLength(2);
    expect(rounds.blocks).toBe(rounds.courtyard);
    expect(rounds.links).toEqual([]);
  });

  it("plays nothing below the minimum, so a node falls back to its 2D game", () => {
    const one = { ...empty, links: [{ id: "x" }] } as unknown as IslandRounds;
    expect(MIN_ISLAND_ROUNDS).toBe(2);
    expect(pickIslandGame(one, 0)).toBeNull();
  });

  it("takes turns across nodes among the games there are enough rounds for", () => {
    const two = [{ id: "a" }, { id: "b" }];
    const rounds = {
      ...empty,
      courtyard: two,
      blocks: two,
      runner: two,
    } as unknown as IslandRounds;
    const games = [0, 2, 4, 6].map((ordinal) => pickIslandGame(rounds, ordinal)?.game);
    expect(games).toEqual(["courtyard", "runner", "blocks", "courtyard"]);
    // The same node asks for the same game every visit.
    expect(pickIslandGame(rounds, 2)?.game).toBe(pickIslandGame(rounds, 2)?.game);
  });
});
