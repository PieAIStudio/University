import type { LinkRound } from "@pieai/university-core";
import { describe, expect, it } from "vitest";

import { LinksSession, SETTLE_SECONDS, linkSeconds, type LinksState } from "./links.js";
import { START_HEARTS } from "./run.js";
import { STEP_SECONDS } from "./session.js";

const route: LinkRound = {
  id: "names/route",
  lessonId: "names",
  lessonTitle: "顺着名字找文件",
  question: "顺着名字，找到该打开的文件",
  nodes: [
    { id: "screen", label: "屏幕上的搜索框" },
    { id: "layout", label: "摆放处" },
    { id: "head", label: "开头几行" },
    { id: "file", label: "SearchBar 文件" },
  ],
  items: [
    { id: "screen>layout", from: "screen", to: "layout", why: "看见的那块一定在摆放处" },
    { id: "layout>head", from: "layout", to: "head", why: "名字对应哪个文件，回开头几行看" },
    { id: "head>file", from: "head", to: "file", why: "名字旁边的路径指向它" },
  ],
  probes: [["screen", "layout", "head", "file"]],
};
const pair: LinkRound = {
  id: "cutout/map",
  lessonId: "cutout",
  lessonTitle: "抠图",
  question: "交回来的东西，能走到哪",
  nodes: [
    { id: "photo", label: "你的照片" },
    { id: "model", label: "模型" },
    { id: "map", label: "判断图" },
  ],
  items: [
    { id: "photo>model", from: "photo", to: "model", why: "你把照片交给它看" },
    { id: "model>map", from: "model", to: "map", why: "它交回来的是一张判断图" },
  ],
  probes: [],
};

function play(session: LinksSession, seconds: number) {
  for (let t = 0; t < seconds - 1e-9; t += STEP_SECONDS) session.advance(STEP_SECONDS);
}

function started(rounds = [route, pair], seed = 3) {
  const session = new LinksSession(rounds, seed);
  session.act({ type: "start" });
  session.act({ type: "ready" });
  play(session, 3.05);
  return session;
}

const state = (session: LinksSession): Readonly<LinksState> => session.getState();
const link = (session: LinksSession, a: string, b: string) => {
  session.act({ type: "pick", nodeId: a });
  session.act({ type: "pick", nodeId: b });
};

describe("连连看 rules", () => {
  it("briefs, counts down, then lays every node out as a stone with a full tide", () => {
    const session = new LinksSession([route], 3);
    session.act({ type: "start" });
    expect(state(session).phase).toBe("briefing");
    session.act({ type: "ready" });
    play(session, 3.05);
    const s = state(session);
    expect(s.phase).toBe("playing");
    expect(s.stones.map((stone) => stone.id).sort()).toEqual(["file", "head", "layout", "screen"]);
    expect(new Set(s.stones.map((stone) => stone.slot)).size).toBe(4);
    expect(s.open).toHaveLength(3);
    expect(s.tide).toBeGreaterThan(0);
  });

  it("builds a link from either end and scores it with the lesson's reason", () => {
    const session = started();
    link(session, "layout", "screen");
    const s = state(session);
    expect(s.bridges).toEqual([{ edgeId: "screen>layout", how: "right" }]);
    expect(s.notice).toMatchObject({ kind: "right", itemId: "screen>layout" });
    expect(s.notice?.reason).toBe("看见的那块一定在摆放处");
    expect(s.run.combo).toBe(1);
    expect(s.stones.find((stone) => stone.id === "screen")?.done).toBe(true);
    expect(s.stones.find((stone) => stone.id === "layout")?.done).toBe(false);
  });

  it("charges a heart for a link the lesson does not have, and shows the first stone's real one", () => {
    const session = started();
    link(session, "screen", "file");
    let s = state(session);
    expect(s.run.hearts).toBe(START_HEARTS - 1);
    expect(s.notice).toMatchObject({ kind: "wrong", itemId: "screen>layout" });
    expect(s.revealed).toEqual(["screen>layout"]);
    link(session, "screen", "layout");
    s = state(session);
    expect(s.notice?.kind).toBe("corrected");
    expect(s.bridges.at(-1)).toEqual({ edgeId: "screen>layout", how: "corrected" });
    expect(s.log.find((e) => e.itemId === "screen>layout")?.outcome).toBe("corrected");
  });

  it("ignores a second tap on the same stone, a finished stone, and a link already standing", () => {
    const session = started();
    session.act({ type: "pick", nodeId: "screen" });
    session.act({ type: "pick", nodeId: "screen" });
    expect(state(session).picked).toBeNull();
    link(session, "screen", "layout");
    session.act({ type: "pick", nodeId: "screen" });
    expect(state(session).picked).toBeNull();
    link(session, "layout", "screen");
    expect(state(session).run.hearts).toBe(START_HEARTS);
  });

  it("lets the tide take a link when it runs out, refilling after every bridge", () => {
    const session = started();
    const window = state(session).window;
    play(session, window * 0.6);
    link(session, "screen", "layout");
    expect(state(session).tide).toBeCloseTo(window, 5);
    play(session, window + 0.05);
    const s = state(session);
    expect(s.run.hearts).toBe(START_HEARTS - 1);
    expect(s.notice?.kind).toBe("escaped");
    expect(s.bridges.at(-1)?.how).toBe("escaped");
    expect(s.open).toHaveLength(1);
  });

  it("takes a shown link first when the tide runs out", () => {
    const session = started();
    link(session, "file", "screen");
    const shown = state(session).revealed[0];
    play(session, state(session).tide + 0.05);
    expect(state(session).bridges.at(-1)).toEqual({ edgeId: shown, how: "escaped" });
  });

  it("holds the finished picture for a moment, then offers upgrades", () => {
    const session = started();
    link(session, "screen", "layout");
    link(session, "layout", "head");
    link(session, "head", "file");
    expect(state(session).events.at(-1)?.kind).toBe("linked");
    expect(state(session).phase).toBe("playing");
    play(session, SETTLE_SECONDS + 0.05);
    expect(state(session).phase).toBe("upgrade");
    expect(state(session).offered.length).toBeGreaterThan(0);
  });

  it("replays only what went wrong, with the rest of the picture already standing", () => {
    const session = started([pair]);
    link(session, "photo", "map");
    link(session, "photo", "model");
    link(session, "model", "map");
    play(session, SETTLE_SECONDS + 0.05);
    let s = state(session);
    expect(s.phase).toBe("briefing");
    expect(s.rounds[s.roundIndex]?.review).toBe(true);
    expect(s.open).toEqual(["photo>model"]);
    expect(s.bridges).toEqual([{ edgeId: "model>map", how: "given" }]);
    session.act({ type: "ready" });
    play(session, 3.05);
    link(session, "model", "photo");
    play(session, SETTLE_SECONDS + 0.05);
    s = state(session);
    expect(s.phase).toBe("won");
    expect(s.log.find((e) => e.itemId === "photo>model")?.outcome).toBe("corrected");
  });

  it("gives calmer and slower upgrades more time per link, and later rounds less", () => {
    expect(linkSeconds(route, 0, 0.7)).toBeGreaterThan(linkSeconds(route, 0, 1));
    expect(linkSeconds(route, 3, 1)).toBeLessThan(linkSeconds(route, 0, 1));
  });
});
