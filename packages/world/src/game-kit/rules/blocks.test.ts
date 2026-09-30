import type { GameRound } from "@pieai/university-core";
import { describe, expect, it } from "vitest";

import {
  BlocksSession,
  MAX_BRICKS,
  WELL_ROWS,
  fallSpeed,
  floorOf,
  type BlocksState,
} from "./blocks.js";
import { START_HEARTS } from "./run.js";
import { STEP_SECONDS } from "./session.js";

const decide: GameRound = {
  id: "sample/decide",
  lessonId: "sample",
  lessonTitle: "示例",
  question: "交给 AI，还是你自己定？",
  bins: [
    { id: "ai", label: "交给 AI" },
    { id: "me", label: "你自己定" },
  ],
  items: [
    { id: "list", text: "把长邮件理成清单", binId: "ai", why: "理清楚是 AI 擅长的。" },
    {
      id: "date",
      text: "核对截止日期",
      binId: "me",
      why: "日子错了会误事。",
      tempting: { binId: "ai", whyNot: "AI 抄日期也会抄错。" },
    },
  ],
};

function play(session: BlocksSession, seconds: number) {
  for (let t = 0; t < seconds - 1e-9; t += STEP_SECONDS) session.advance(STEP_SECONDS);
}

function started(rounds = [decide, { ...decide, id: "sample/decide/2" }], seed = 6) {
  const session = new BlocksSession(rounds, seed);
  session.act({ type: "start" });
  session.act({ type: "ready" });
  play(session, 3.05);
  play(session, 0.05);
  return session;
}

const state = (session: BlocksSession): Readonly<BlocksState> => session.getState();
const column = (binId: string) => decide.bins.findIndex((bin) => bin.id === binId);

/** Put the falling block in the column of `binId` and drop it. */
function place(session: BlocksSession, binId: string) {
  session.act({ type: "column", col: column(binId) });
  session.act({ type: "drop" });
  play(session, 1);
}

describe("俄罗斯方块 rules", () => {
  it("drops one block at a time from the top of the middle-left column, with the next one known", () => {
    const session = started();
    const s = state(session);
    expect(s.block?.col).toBe(0);
    expect(s.block?.y).toBeLessThan(1);
    expect(session.nextItemId()).not.toBeNull();
  });

  it("scores a block landed in its bin's column", () => {
    const session = started();
    const item = session.itemOf(state(session).block!.itemId)!;
    place(session, item.binId);
    expect(state(session).notice).toMatchObject({ kind: "right", itemId: item.id });
    expect(state(session).bricks).toEqual([0, 0]);
  });

  it("charges a heart for a wrong column, with the tempting reason, and leaves a brick there", () => {
    const session = started();
    while (state(session).block?.itemId !== "date") {
      const item = session.itemOf(state(session).block!.itemId)!;
      place(session, item.binId);
    }
    place(session, "ai");
    const s = state(session);
    expect(s.run.hearts).toBe(START_HEARTS - 1);
    expect(s.notice?.reason).toBe("AI 抄日期也会抄错。");
    expect(s.bricks[column("ai")]).toBe(1);
  });

  it("lands a block on its own when nobody moves it", () => {
    const session = started();
    const first = state(session).block!.id;
    for (let i = 0; i < 400 && !state(session).block?.landed; i += 1) play(session, 0.05);
    expect(state(session).block?.id).toBe(first);
    expect(state(session).block?.landed).not.toBeNull();
  });

  it("clears the bricks for the next round", () => {
    const session = started();
    for (let i = 0; i < 2; i += 1)
      place(
        session,
        decide.bins.find((bin) => bin.id !== session.itemOf(state(session).block!.itemId)!.binId)!
          .id,
      );
    play(session, 1);
    const s = state(session);
    expect(["upgrade", "lost"]).toContain(s.phase);
    if (s.phase === "upgrade") {
      session.act({ type: "upgrade", id: s.offered[0]! });
      expect(state(session).bricks).toEqual([0, 0]);
    }
  });

  it("falls faster in later rounds and slower when calm; bricks raise the floor to a cap", () => {
    expect(fallSpeed("短", 3, 1)).toBeGreaterThan(fallSpeed("短", 0, 1));
    expect(fallSpeed("短", 0, 0.7)).toBeLessThan(fallSpeed("短", 0, 1));
    expect(floorOf(0)).toBe(WELL_ROWS - 1);
    expect(floorOf(MAX_BRICKS + 3)).toBe(WELL_ROWS - 1 - MAX_BRICKS);
  });
});
