import type { SequenceRound } from "@pieai/university-core";
import { describe, expect, it } from "vitest";

import { START_HEARTS } from "./run.js";
import { STEP_SECONDS } from "./session.js";
import {
  LAWN,
  SNAKE_SETTLE_SECONDS,
  SnakeSession,
  hungerSeconds,
  nextPieces,
  type SnakeState,
} from "./snake.js";

const foam: SequenceRound = {
  id: "picture/v3/build-ask",
  lessonId: "picture",
  lessonTitle: "问照片里的一处",
  question: "拼一句只问这一处",
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
};
const route: SequenceRound = {
  id: "names/route/probe-1",
  lessonId: "names",
  lessonTitle: "顺着名字找文件",
  question: "想改搜索框",
  items: [
    { id: "screen", text: "搜索框" },
    { id: "layout", text: "摆放处", reason: "看见的那块一定在摆放处" },
    { id: "file", text: "SearchBar 文件", reason: "路径指向它" },
  ],
  answers: [["screen", "layout", "file"]],
};

function play(session: SnakeSession, seconds: number) {
  for (let t = 0; t < seconds - 1e-9; t += STEP_SECONDS) session.advance(STEP_SECONDS);
}

function started(rounds = [foam, route], seed = 5) {
  const session = new SnakeSession(rounds, seed);
  session.act({ type: "start" });
  session.act({ type: "ready" });
  play(session, 3.05);
  return session;
}

const state = (session: SnakeSession): Readonly<SnakeState> => session.getState();

/** Steer to a crate with the autopilot and wait until something is eaten or said. */
function eat(session: SnakeSession, pieceId: string) {
  const before = state(session).serial;
  session.act({ type: "aim", pieceId });
  for (let i = 0; i < 400 && state(session).serial === before; i += 1) play(session, 0.05);
}

describe("贪吃蛇 rules", () => {
  it("lays every piece on the lawn as a crate, off the train's starting row", () => {
    const s = state(started());
    expect(s.phase).toBe("playing");
    expect(s.crates.map((crate) => crate.id).sort()).toEqual(["all", "cup", "foam", "look"]);
    for (const crate of s.crates) {
      expect(crate.c).toBeGreaterThanOrEqual(0);
      expect(crate.c).toBeLessThan(LAWN.cols);
      expect(crate.r).not.toBe(s.body[0]!.r);
    }
  });

  it("accepts any order the lesson accepts, and finishes when one is complete", () => {
    const session = started();
    eat(session, "cup");
    expect(state(session).eaten).toEqual(["cup"]);
    expect(state(session).notice?.kind).toBe("right");
    expect(state(session).body).toHaveLength(2);
    eat(session, "foam");
    expect(state(session).eaten).toEqual(["cup", "foam"]);
    expect(state(session).events.at(-1)?.kind).toBe("complete");
    play(session, SNAKE_SETTLE_SECONDS + 0.05);
    expect(state(session).phase).toBe("upgrade");
  });

  it("charges a heart for a distractor, quoting its own reason, and spits it out", () => {
    const session = started();
    eat(session, "all");
    const s = state(session);
    expect(s.run.hearts).toBe(START_HEARTS - 1);
    expect(s.notice).toMatchObject({
      kind: "wrong",
      itemId: "all",
      reason: "这块又变成问整张图了。",
    });
    expect(s.crates.some((crate) => crate.id === "all")).toBe(false);
    expect(s.eaten).toEqual([]);
  });

  it("charges a heart for a right crate eaten early, and shows the one that comes next", () => {
    const session = started([route]);
    eat(session, "file");
    const s = state(session);
    expect(s.run.hearts).toBe(START_HEARTS - 1);
    expect(s.notice).toMatchObject({ kind: "wrong", itemId: "screen" });
    expect(s.revealed).toEqual(["screen"]);
    expect(s.crates.some((crate) => crate.id === "file")).toBe(true);
    eat(session, "screen");
    expect(state(session).notice?.kind).toBe("corrected");
  });

  it("feeds the next crate by itself when hunger runs out, counted as missed", () => {
    const session = started([route]);
    play(session, state(session).window + 0.1);
    const s = state(session);
    expect(s.eaten).toEqual(["screen"]);
    expect(s.notice?.kind).toBe("escaped");
    expect(s.log.find((e) => e.itemId === "screen")?.outcome).toBe("missed");
  });

  it("never stops at the hedge: it turns and keeps going", () => {
    const session = started([route]);
    play(session, 6);
    const head = state(session).body[0]!;
    expect(head.c).toBeGreaterThanOrEqual(0);
    expect(head.c).toBeLessThan(LAWN.cols);
    expect(head.r).toBeGreaterThanOrEqual(0);
    expect(head.r).toBeLessThan(LAWN.rows);
  });

  it("ignores a turn straight back into the train", () => {
    const session = started([route]);
    session.act({ type: "turn", dir: "left" });
    expect(state(session).turns).toEqual([]);
    session.act({ type: "turn", dir: "up" });
    expect(state(session).turns).toEqual(["up"]);
  });

  it("replays a whole order in review, and logs untouched distractors as right", () => {
    const session = started([foam]);
    eat(session, "look");
    eat(session, "foam");
    expect(state(session).notice?.kind).toBe("wrong");
    eat(session, "cup");
    eat(session, "foam");
    play(session, SNAKE_SETTLE_SECONDS + 0.05);
    const s = state(session);
    expect(s.log.find((e) => e.itemId === "all")?.outcome).toBe("first");
    expect(s.rounds[s.roundIndex]?.review).toBe(true);
    expect([...(s.rounds[s.roundIndex]?.itemIds ?? [])].sort()).toEqual([
      "all",
      "cup",
      "foam",
      "look",
    ]);
  });

  it("knows which pieces may come next under every accepted order", () => {
    expect(nextPieces(foam, []).sort()).toEqual(["cup", "look"]);
    expect(nextPieces(foam, ["look"])).toEqual(["cup"]);
    expect(nextPieces(foam, ["cup"])).toEqual(["foam"]);
    expect(hungerSeconds(foam, 0, 0.7)).toBeGreaterThan(hungerSeconds(foam, 0, 1));
  });
});
