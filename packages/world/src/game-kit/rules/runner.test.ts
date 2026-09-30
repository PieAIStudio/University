import type { ChoiceRound } from "@pieai/university-core";
import { describe, expect, it } from "vitest";

import { START_HEARTS } from "./run.js";
import { RunnerSession, approachSeconds, type RunnerState } from "./runner.js";
import { STEP_SECONDS } from "./session.js";

const options = [
  { id: "ask", label: "直接问" },
  { id: "attach", label: "先附上材料" },
  { id: "self", label: "自己拿主意" },
];
const ask: ChoiceRound = {
  id: "sample/ask",
  lessonId: "sample",
  lessonTitle: "示例",
  question: "怎么交给 AI？",
  items: [
    {
      id: "reply",
      text: "想让 AI 帮你回长邮件",
      options,
      bestId: "attach",
      why: "它没看过那封邮件。",
      whyNot: { ask: "不给邮件，只能瞎猜。", self: "起草正是 AI 能帮的。" },
    },
    {
      id: "leave",
      text: "要不要请假去婚礼",
      options,
      bestId: "self",
      why: "这是你的安排。",
      whyNot: { ask: "拿主意的还得是你。", attach: "材料再多它也不知道你想不想去。" },
    },
  ],
};

function play(session: RunnerSession, seconds: number) {
  for (let t = 0; t < seconds - 1e-9; t += STEP_SECONDS) session.advance(STEP_SECONDS);
}

function started(rounds = [ask, ask].map((r, i) => ({ ...r, id: `${r.id}/${i}` })), seed = 4) {
  const session = new RunnerSession(rounds, seed);
  session.act({ type: "start" });
  session.act({ type: "ready" });
  play(session, 3.05);
  play(session, 0.35);
  return session;
}

const state = (session: RunnerSession): Readonly<RunnerState> => session.getState();

/** Steer to the lane carrying `optionId` and run to the fork. */
function choose(session: RunnerSession, optionId: string) {
  const fork = state(session).fork!;
  session.act({ type: "lane", lane: fork.lanes.indexOf(optionId) });
  play(session, fork.seconds + 0.05);
}

describe("三岔路 rules", () => {
  it("brings one situation at a time, one lane per option, starting between them", () => {
    const s = state(started());
    expect(s.fork).not.toBeNull();
    expect([...s.fork!.lanes].sort()).toEqual(["ask", "attach", "self"]);
    expect(s.lane).toBe(1);
  });

  it("scores the best option at the fork, with the lesson's reason", () => {
    const session = started();
    const itemId = state(session).fork!.itemId;
    const best = ask.items.find((item) => item.id === itemId)!.bestId;
    choose(session, best);
    expect(state(session).notice).toMatchObject({ kind: "right", itemId });
    expect(state(session).fork?.taken).not.toBeNull();
  });

  it("charges a heart for another option, quoting what that choice costs here", () => {
    const session = started();
    const item = ask.items.find((candidate) => candidate.id === state(session).fork!.itemId)!;
    const other = options.find((option) => option.id !== item.bestId)!.id;
    choose(session, other);
    expect(state(session).run.hearts).toBe(START_HEARTS - 1);
    expect(state(session).notice?.reason).toBe(item.whyNot[other]);
  });

  it("runs through the lane it is in when nobody steers", () => {
    const session = started();
    const fork = state(session).fork!;
    play(session, fork.seconds + 0.05);
    expect(state(session).fork?.taken).toBe(1);
  });

  it("does not steer off the path or after the fork", () => {
    const session = started();
    session.act({ type: "steer", by: -1 });
    session.act({ type: "steer", by: -1 });
    expect(state(session).lane).toBe(0);
    play(session, state(session).fork!.seconds + 0.05);
    session.act({ type: "steer", by: 1 });
    expect(state(session).lane).toBe(0);
  });

  it("gives more time to read a longer situation, calmly, and less each round", () => {
    const [short, long] = [
      ask.items[1]!,
      { ...ask.items[0]!, text: "一个很长很长的情况描述，要读好一会儿才读得完" },
    ];
    expect(approachSeconds(long, 0, 1)).toBeGreaterThan(approachSeconds(short, 0, 1));
    expect(approachSeconds(short, 0, 0.7)).toBeGreaterThan(approachSeconds(short, 0, 1));
    expect(approachSeconds(short, 4, 1)).toBeLessThan(approachSeconds(short, 0, 1));
  });
});
