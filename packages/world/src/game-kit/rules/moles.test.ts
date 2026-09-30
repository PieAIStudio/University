import type { SpotRound } from "@pieai/university-core";
import { describe, expect, it } from "vitest";

import { HOLES, MolesSession, RISE_SECONDS, upSeconds, type MolesState } from "./moles.js";
import { START_HEARTS } from "./run.js";
import { STEP_SECONDS } from "./session.js";

const email: SpotRound = {
  id: "sample/email",
  lessonId: "sample",
  lessonTitle: "示例",
  question: "敲掉它编出来的句子",
  source: "周三中午前报人数；周四下班前订场地。",
  items: [
    { id: "count", text: "周三中午前报人数。", target: false, why: "邮件里写了。" },
    { id: "room", text: "周四下班前订场地。", target: false, why: "邮件里写了。" },
    { id: "budget", text: "预算有五千元。", target: true, why: "邮件没提预算。" },
  ],
};

function play(session: MolesSession, seconds: number) {
  for (let t = 0; t < seconds - 1e-9; t += STEP_SECONDS) session.advance(STEP_SECONDS);
}

function started(rounds = [email, email], seed = 2) {
  const session = new MolesSession(
    rounds.map((r, i) => ({ ...r, id: `${r.id}/${i}` })),
    seed,
  );
  session.act({ type: "start" });
  session.act({ type: "ready" });
  play(session, 3.05);
  return session;
}

const state = (session: MolesSession): Readonly<MolesState> => session.getState();
const upNow = (session: MolesSession) =>
  state(session).moles.filter((mole) => MolesSession.reachable(mole));

/** Wait until a mole with this sentence is up, and return it. */
function waitFor(session: MolesSession, itemId: string) {
  for (let i = 0; i < 400; i += 1) {
    const mole = upNow(session).find((candidate) => candidate.itemId === itemId);
    if (mole) return mole;
    play(session, 0.05);
  }
  throw new Error(`no mole for ${itemId}`);
}

describe("打地鼠 rules", () => {
  it("pops one sentence at a time in holes the field has", () => {
    const session = started();
    play(session, 0.5);
    const up = upNow(session);
    expect(up.length).toBeGreaterThan(0);
    expect(up.length).toBeLessThanOrEqual(2);
    for (const mole of up) expect(mole.hole).toBeLessThan(HOLES);
  });

  it("scores a whacked target with the lesson's reason", () => {
    const session = started();
    const mole = waitFor(session, "budget");
    session.act({ type: "whack", moleId: mole.id });
    expect(state(session).notice).toMatchObject({
      kind: "right",
      itemId: "budget",
      reason: "邮件没提预算。",
    });
    expect(state(session).moles.find((m) => m.id === mole.id)?.state).toBe("hit");
  });

  it("charges a heart for whacking a sentence that should be left alone", () => {
    const session = started();
    const mole = waitFor(session, "count");
    session.act({ type: "whack", moleId: mole.id });
    expect(state(session).run.hearts).toBe(START_HEARTS - 1);
    expect(state(session).notice).toMatchObject({
      kind: "wrong",
      itemId: "count",
      reason: "邮件里写了。",
    });
  });

  it("charges a heart when a target ducks away, and counts the others as rightly left", () => {
    const session = started([email]);
    const mole = waitFor(session, "budget");
    play(session, RISE_SECONDS + mole.up + 0.1);
    expect(state(session).notice).toMatchObject({ kind: "escaped", itemId: "budget" });
    play(session, 20);
    const s = state(session);
    expect(s.log.find((e) => e.itemId === "count")?.outcome).toBe("first");
    expect(s.log.find((e) => e.itemId === "budget")?.outcome).toBe("missed");
  });

  it("ignores a whack on a mole already hit", () => {
    const session = started();
    const mole = waitFor(session, "count");
    session.act({ type: "whack", moleId: mole.id });
    session.act({ type: "whack", moleId: mole.id });
    expect(state(session).run.hearts).toBe(START_HEARTS - 1);
  });

  it("keeps a mole up longer for a longer sentence, and shorter each round", () => {
    expect(upSeconds("一句很长很长很长很长很长很长的话。", 0, 1)).toBeGreaterThan(
      upSeconds("短句。", 0, 1),
    );
    expect(upSeconds("短句。", 4, 1)).toBeLessThan(upSeconds("短句。", 0, 1));
  });
});
