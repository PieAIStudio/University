import { describe, expect, it } from "vitest";
import { WorkshopSession, WIRING_ROUNDS, PROCESS_TASKS } from "./workshop-engine.js";
import { CLAIMS } from "./arcade-content.js";
const advance = (s: WorkshopSession, seconds: number) => {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) s.advance(1 / 60);
};
describe("six-scene expansion: three genuinely different added games", () => {
  it("wiring requires every connection, identifies wrong evidence and completes three circuits", () => {
    const s = new WorkshopSession("wire");
    s.act({ type: "start" });
    s.act({ type: "check" });
    expect(s.getState().phase).toBe("playing");
    expect(s.getState().score).toBe(0);
    for (let round = 0; round < 3; round++) {
      WIRING_ROUNDS[round]!.forEach((_, i) => {
        s.act({ type: "pick", index: i });
        s.act({ type: "connect", index: 2 });
      });
      s.act({ type: "check" });
      expect(s.getState().mistakes).toBe(round + 1);
      expect(s.getState().phase).toBe("playing");
      WIRING_ROUNDS[round]!.forEach((c, i) => {
        s.act({ type: "pick", index: i });
        s.act({ type: "connect", index: CLAIMS[c]!.answer });
      });
      s.act({ type: "check" });
      expect(s.getState().phase).toBe("running");
      s.act({ type: "check" });
      advance(s, 1.6);
      expect(s.getState().correct).toBe((round + 1) * 4);
      expect(s.getState().score).toBe((round + 1) * 40);
      if (round < 2) {
        expect(s.getState().phase).toBe("round");
        s.act({ type: "next" });
      }
    }
    expect(s.getState().phase).toBe("won");
  });
  it("train stops at missing prerequisite, then accepts both valid independent check orders", () => {
    const s = new WorkshopSession("rank");
    s.act({ type: "start" });
    s.act({ type: "check" });
    advance(s, 1);
    expect(s.getState().phase).toBe("playing");
    expect(s.getState().mistakes).toBe(1);
    expect(s.getState().score).toBe(0);
    for (let round = 0; round < 3; round++) {
      const target = round === 1 ? [0, 2, 1, 3] : [0, 1, 2, 3];
      target.forEach((id, i) => {
        const at = s.getState().order.indexOf(id);
        s.act({ type: "swap", index: i });
        s.act({ type: "swap", index: at });
      });
      s.act({ type: "check" });
      advance(s, 4);
      expect(s.getState().phase).toBe(round < 2 ? "round" : "won");
      if (round < 2) s.act({ type: "next" });
    }
    expect(s.getState().correct).toBe(3);
    PROCESS_TASKS.forEach((task) =>
      task.steps.forEach((step) => step.requires.forEach((i) => expect(i).toBeLessThan(4))),
    );
  });
  it("slicing moves capsules, counts actual hits once and never counts dodged claims as learned", () => {
    const s = new WorkshopSession("slice", 8);
    s.act({ type: "start" });
    advance(s, 0.8);
    const f = s.getState().capsules[0]!;
    const y = f.y;
    advance(s, 0.4);
    expect(f.y).toBeGreaterThan(y);
    let guard = 0;
    while (s.getState().phase === "playing" && guard++ < 15000) {
      for (const c of s.getState().capsules)
        if (c.good && c.age > 0.5) {
          s.act({ type: "cut", id: c.id });
          const score = s.getState().score;
          s.act({ type: "cut", id: c.id });
          expect(s.getState().score).toBe(score);
        }
      s.advance(1 / 30);
    }
    expect(s.getState().phase).toBe("won");
    expect(s.getState().resolved).toBe(24);
    expect(s.getState().correct).toBe(CLAIMS.filter((c) => c.answer < 2).length * 2);
    expect(s.getState().mistakes).toBe(0);
    expect(s.getState().missed).toBe(0);
  });
  it("three unsupported cuts end play; wrong claims remain available for review", () => {
    const s = new WorkshopSession("slice");
    s.act({ type: "start" });
    let guard = 0;
    while (s.getState().phase === "playing" && guard++ < 12000) {
      for (const c of s.getState().capsules)
        if (!c.good && c.age > 0.5) s.act({ type: "cut", id: c.id });
      s.advance(1 / 30);
    }
    expect(s.getState().phase).toBe("lost");
    expect(s.getState().mistakes).toBe(3);
    expect(s.getState().errors.length).toBeGreaterThan(0);
  });
  it("suspension blocks game inputs and time; reset is deterministic", () => {
    for (const mode of ["slice", "wire", "rank"] as const) {
      const s = new WorkshopSession(mode);
      s.act({ type: "start" });
      advance(s, 1);
      s.setSuspended(true);
      const frozen = structuredClone(s.getState());
      advance(s, 8);
      s.act({ type: "pick", index: 1 });
      s.act({ type: "check" });
      expect(s.getState()).toEqual(frozen);
      s.setSuspended(false);
      s.act({ type: "reset" });
      expect(s.getState()).toEqual(new WorkshopSession(mode).getState());
    }
  });
});
