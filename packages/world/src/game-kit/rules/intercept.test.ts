import type { GameRound } from "@pieai/university-core";
import { describe, expect, it } from "vitest";

import {
  FLIGHT_SECONDS,
  InterceptSession,
  WINDUP_SECONDS,
  crossingSeconds,
  type InterceptState,
} from "./intercept.js";
import { START_HEARTS, availableUpgrades, createRun } from "./run.js";
import { STEP_SECONDS } from "./session.js";

const photo: GameRound = {
  id: "picture/v2/can-photo-answer",
  lessonId: "picture",
  lessonTitle: "问照片里的一处",
  question: "光看照片，答得出来吗？",
  bins: [
    { id: "yes", label: "答得出" },
    { id: "no", label: "答不出" },
  ],
  items: [
    { id: "colour", text: "杯子是什么颜色？", binId: "yes", why: "颜色看得到。" },
    {
      id: "sweet",
      text: "咖啡甜不甜？",
      binId: "no",
      why: "味道看不到。",
      tempting: { binId: "yes", whyNot: "看起来好喝，不等于尝得出甜。" },
    },
    { id: "shop", text: "这是哪家店？", binId: "no", why: "照片里没有店名。" },
  ],
};
const notice: GameRound = {
  id: "notice/sort",
  lessonId: "notice",
  lessonTitle: "通知",
  question: "哪些话能按通知照做？",
  bins: [
    { id: "written", label: "通知直接写了" },
    { id: "not", label: "通知没有这样说" },
  ],
  items: [
    { id: "date", text: "9 月 27 日 A 区地面车位暂停使用。", binId: "written", why: "原话。" },
    { id: "east", text: "A 区的车可以直接从东门出去。", binId: "not", why: "没说。" },
  ],
};

const THROW = WINDUP_SECONDS + FLIGHT_SECONDS;

function play(session: InterceptSession, seconds: number) {
  for (let t = 0; t < seconds - 1e-9; t += STEP_SECONDS) session.advance(STEP_SECONDS);
}

/** Start, skip the briefing and countdown, and wait for the first boat. */
function started(rounds = [photo, notice], seed = 7) {
  const session = new InterceptSession(rounds, seed);
  session.act({ type: "start" });
  session.act({ type: "ready" });
  play(session, 3.05);
  return session;
}

const state = (session: InterceptSession): Readonly<InterceptState> => session.getState();
const sailing = (session: InterceptSession) =>
  state(session).boats.filter((boat) => boat.state === "sailing");
const binOf = (itemId: string, round = photo) =>
  round.items.find((item) => item.id === itemId)!.binId;
const otherBin = (itemId: string, round = photo) =>
  round.bins.find((bin) => bin.id !== binOf(itemId, round))!.id;

describe("庭院拦截 rules", () => {
  it("briefs calmly, counts down, then sails the round's items", () => {
    const session = new InterceptSession([photo], 3);
    expect(state(session).phase).toBe("intro");
    session.act({ type: "start" });
    expect(state(session).phase).toBe("briefing");
    // The briefing does not run a clock: nothing sails while the learner reads.
    play(session, 5);
    expect(state(session).boats).toEqual([]);
    session.act({ type: "ready" });
    expect(state(session).phase).toBe("countdown");
    play(session, 3.05);
    expect(state(session).phase).toBe("playing");
    expect(sailing(session)).toHaveLength(1);
  });

  it("scores a right throw with the lesson's own verdict and keeps the combo", () => {
    const session = started();
    const boat = sailing(session)[0]!;
    session.act({ type: "throw", binId: binOf(boat.itemId) });
    play(session, THROW + 0.05);
    const s = state(session);
    expect(s.boats.find((b) => b.id === boat.id)!.state).toBe("sunk");
    expect(s.run.score).toBe(100);
    expect(s.run.combo).toBe(1);
    expect(s.run.hearts).toBe(START_HEARTS);
    expect(s.notice).toMatchObject({ kind: "right", itemId: boat.itemId });
    expect(s.log).toEqual([{ roundId: photo.id, itemId: boat.itemId, outcome: "first" }]);
  });

  it("charges a heart for a wrong throw, then shows the right bin; a later right is only 'corrected'", () => {
    const session = started();
    const boat = sailing(session)[0]!;
    session.act({ type: "throw", binId: otherBin(boat.itemId) });
    play(session, THROW + 0.05);
    let s = state(session);
    expect(s.run.hearts).toBe(START_HEARTS - 1);
    expect(s.run.combo).toBe(0);
    expect(s.boats.find((b) => b.id === boat.id)).toMatchObject({
      state: "sailing",
      revealed: true,
    });
    expect(s.notice?.kind).toBe("wrong");
    play(session, 0.3);
    session.act({ type: "target", boatId: boat.id });
    session.act({ type: "throw", binId: binOf(boat.itemId) });
    play(session, THROW + 0.05);
    s = state(session);
    expect(s.run.score).toBe(30);
    expect(s.log.find((e) => e.itemId === boat.itemId)!.outcome).toBe("corrected");
  });

  it("quotes the tempting bin's own reason when the learner takes it", () => {
    const session = started([{ ...photo, items: [photo.items[1]!] }]);
    session.act({ type: "throw", binId: "yes" });
    play(session, THROW + 0.05);
    expect(state(session).notice).toMatchObject({
      kind: "wrong",
      reason: "看起来好喝，不等于尝得出甜。",
    });
  });

  it("charges a heart when a boat reaches the terrace untouched", () => {
    const session = started([{ ...photo, items: [photo.items[0]!] }]);
    const boat = sailing(session)[0]!;
    play(session, boat.seconds + 0.1);
    const s = state(session);
    expect(s.run.hearts).toBe(START_HEARTS - 1);
    expect(s.log[0]).toMatchObject({ itemId: boat.itemId, outcome: "missed" });
  });

  it("lets a shield take the next lost heart instead", () => {
    const session = started([{ ...photo, items: [photo.items[0]!] }]);
    (state(session) as InterceptState).run.shield = true;
    session.act({ type: "throw", binId: "no" });
    play(session, THROW + 0.05);
    const s = state(session);
    expect(s.run.hearts).toBe(START_HEARTS);
    expect(s.run.shield).toBe(false);
    expect(s.notice?.kind).toBe("shield");
  });

  it("does not spend two balls on one boat: a second press takes the next boat", () => {
    const session = started([{ ...photo, items: photo.items.slice(0, 2) }], 11);
    play(session, sailing(session)[0]!.seconds * 0.45);
    expect(sailing(session)).toHaveLength(2);
    session.act({ type: "throw", binId: "yes" });
    play(session, 0.3);
    session.act({ type: "throw", binId: "no" });
    const targets = state(session).balls.map((ball) => ball.boatId);
    expect(new Set(targets).size).toBe(2);
  });

  it("offers three upgrades that change the hands, never the answers", () => {
    const session = started([{ ...photo, items: [photo.items[0]!] }, notice]);
    session.act({ type: "throw", binId: "yes" });
    play(session, THROW + 0.2);
    const s = state(session);
    expect(s.phase).toBe("upgrade");
    expect(s.offered).toHaveLength(3);
    for (const id of s.offered) expect(["heart", "slow", "shield", "bonus"]).toContain(id);
    session.act({ type: "upgrade", id: s.offered[0]! });
    expect(state(session).phase).toBe("briefing");
    expect(state(session).roundIndex).toBe(1);
    // A full heart bar is not offered another heart.
    expect(availableUpgrades({ ...createRun(), hearts: 5 })).not.toContain("heart");
  });

  it("slows the round after a slow upgrade", () => {
    expect(crossingSeconds("咖啡甜不甜？", 0, 0.75)).toBeGreaterThan(
      crossingSeconds("咖啡甜不甜？", 0, 1),
    );
    const session = started([{ ...photo, items: [photo.items[0]!] }, notice, photo]);
    session.act({ type: "throw", binId: "yes" });
    play(session, THROW + 0.2);
    (state(session) as InterceptState).offered = ["slow", "heart", "shield"];
    session.act({ type: "upgrade", id: "slow" });
    session.act({ type: "ready" });
    play(session, 3.05);
    const slow = sailing(session)[0]!.seconds;
    expect(slow).toBeCloseTo(
      crossingSeconds(
        notice.items.find((i) => i.id === sailing(session)[0]!.itemId)!.text,
        1,
        0.75,
      ),
      6,
    );
  });

  it("brings back what went wrong in a review round, and ends won", () => {
    const session = started([
      { ...photo, items: photo.items.slice(0, 1) },
      { ...notice, items: notice.items.slice(0, 1) },
    ]);
    session.act({ type: "throw", binId: "no" }); // wrong: colour belongs to "yes"
    play(session, THROW + 0.1);
    session.act({ type: "throw", binId: "yes" }); // corrected
    play(session, THROW + 0.2);
    session.act({ type: "upgrade", id: state(session).offered[0]! });
    session.act({ type: "ready" });
    play(session, 3.05);
    session.act({ type: "throw", binId: "written" });
    play(session, THROW + 0.2);
    // The review round follows directly, with only the item that was not first-try right.
    let s = state(session);
    expect(s.phase).toBe("briefing");
    expect(s.rounds[s.roundIndex]).toMatchObject({ review: true, itemIds: ["colour"] });
    session.act({ type: "ready" });
    play(session, 3.05);
    session.act({ type: "throw", binId: "yes" });
    play(session, THROW + 0.2);
    s = state(session);
    expect(s.phase).toBe("won");
    expect(s.log.find((e) => e.itemId === "colour")!.outcome).toBe("corrected");
    expect(s.log.find((e) => e.itemId === "date")!.outcome).toBe("first");
  });

  it("ends the run when the last heart goes", () => {
    const session = started([photo]);
    for (let i = 0; i < START_HEARTS; i += 1) {
      const boat = sailing(session)[0];
      if (!boat) play(session, 1.5);
      const target = sailing(session)[0]!;
      session.act({ type: "target", boatId: target.id });
      session.act({ type: "throw", binId: otherBin(target.itemId) });
      play(session, THROW + 0.3);
      if (state(session).phase === "lost") break;
      // Put the revealed boat away so the next wrong throw meets a fresh one.
      session.act({ type: "throw", binId: binOf(target.itemId) });
      play(session, THROW + 0.3);
    }
    expect(state(session).phase).toBe("lost");
    expect(state(session).events.at(-1)?.kind).toBe("lost");
  });

  it("holds still while suspended and does not catch up afterwards", () => {
    const session = started();
    const before = sailing(session)[0]!.progress;
    session.setSuspended(true);
    play(session, 5);
    expect(sailing(session)[0]!.progress).toBe(before);
    session.setSuspended(false);
    session.advance(5);
    // One stalled frame advances at most a tenth of a second.
    expect(sailing(session)[0]!.progress - before).toBeLessThan(
      0.1 / sailing(session)[0]!.seconds + 1e-9,
    );
  });
});
