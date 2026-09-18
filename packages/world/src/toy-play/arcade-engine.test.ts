import { describe, expect, it } from "vitest";
import { ArcadeSession } from "./arcade-engine.js";
import { CLAIMS, FLIGHT_CARDS, SENTENCES, VOCABULARY, wordIndex } from "./arcade-content.js";

const time = (game: ArcadeSession, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) game.advance(1 / 60);
};
describe("actual arcade mechanics, independent of rendering", () => {
  it("gravity landing judges the chosen column, not whether Space was pressed", () => {
    const game = new ArcadeSession("stack");
    game.act({ type: "start" });
    const card = CLAIMS[game.getState().falling!.card]!;
    game.act({ type: "lane", index: card.answer });
    time(game, 11);
    expect(game.getState().correct).toBe(1);
    expect(game.getState().piles.flat()).toHaveLength(0);
  });
  it("ten flight waves can be won through ordinary steering and upgrades", () => {
    const game = new ArcadeSession("invaders", 7103, 0.5);
    game.act({ type: "start" });
    let iterations = 0;
    while (!["won", "lost"].includes(game.getState().phase) && iterations++ < 30000) {
      const s = game.getState();
      if (s.phase === "upgrade") {
        game.act({ type: "upgrade", choice: s.lives < 3 ? "heart" : "rapid" });
        continue;
      }
      const targets = s.enemies
        .map((f) => {
          let x = f.x + (f.vx * 0.5 * s.slow * Math.max(0, 3.25 - f.z)) / 8.5;
          if (x > 3.3) x = 6.6 - x;
          if (x < -3.3) x = -6.6 - x;
          return { f, x };
        })
        .filter(({ f, x }) => (x < 0 ? 0 : 1) === FLIGHT_CARDS[f.card]![2]);
      game.act({ type: "aim", x: targets.sort((a, b) => b.f.z - a.f.z)[0]?.x ?? -3.5 });
      game.advance(1 / 30);
    }
    expect(game.getState().phase).toBe("won");
    expect(game.getState().wave).toBe(10);
    expect(game.getState().correct).toBeGreaterThan(40);
    expect(game.getState().score).toBeGreaterThan(600);
  });
  it("host suspension stops all motion until explicitly resumed", () => {
    const game = new ArcadeSession("invaders");
    game.act({ type: "start" });
    time(game, 1);
    game.setSuspended(true);
    const before = structuredClone(game.getState());
    time(game, 5);
    expect(game.getState()).toEqual(before);
    game.setSuspended(false);
    time(game, 0.5);
    expect(game.getState().elapsed).toBeGreaterThan(before.elapsed);
  });
  it("sorting: parcels fall, wrong columns retain blocks and a full column ends play", () => {
    const game = new ArcadeSession("stack");
    time(game, 10);
    expect(game.getState().phase).toBe("ready");
    game.act({ type: "start" });
    const y = game.getState().falling!.y;
    time(game, 1);
    expect(game.getState().falling!.y).toBeLessThan(y);
    let guard = 0;
    while (game.getState().phase === "playing" && guard++ < 30) {
      const s = game.getState();
      if (s.falling) {
        // Use column zero wrongly when possible; correctly handle its own cards.
        game.act({ type: "lane", index: 0 });
        game.act({ type: "drop" });
      }
      time(game, 0.9);
    }
    expect(game.getState().phase).toBe("lost");
    expect(game.getState().piles[0]).toHaveLength(4);
    const before = structuredClone(game.getState());
    time(game, 10);
    game.act({ type: "drop" });
    expect(game.getState()).toEqual(before);
  });
  it("sorting: a complete finite round is possible without tapping Next after every item", () => {
    const game = new ArcadeSession("stack");
    game.act({ type: "start" });
    for (let i = 0; i < 24; i++) {
      const card = CLAIMS[game.getState().falling!.card]!;
      game.act({ type: "lane", index: card.answer });
      game.act({ type: "drop" });
      time(game, 0.9);
    }
    expect(game.getState().phase).toBe("won");
    expect(game.getState().resolved).toBe(24);
    expect(game.getState().firstTry).toBe(24);
    expect(game.getState().piles.flat()).toHaveLength(0);
  });
  it("words: every visible row has an available answer, clearing waits and errors reappear later", () => {
    const game = new ArcadeSession("cloze-tetris");
    game.act({ type: "start" });
    const row = game.getState().rows[0]!;
    const bad = game.getState().bag.find((w) => w !== wordIndex(row.card))!;
    game.act({ type: "fit", rowId: row.id, word: bad });
    expect(game.getState().junk).toBe(1);
    expect(game.getState().rows[0]!.filled).toBe(false);
    game.act({ type: "fit", rowId: row.id, word: wordIndex(row.card) });
    expect(game.getState().rows[0]!.filled).toBe(true);
    expect(game.getState().rowQueue.some((q) => q.card === row.card && q.review)).toBe(true);
    const score = game.getState().score;
    game.act({ type: "fit", rowId: row.id, word: wordIndex(row.card) });
    expect(game.getState().score).toBe(score);
    time(game, 0.5);
    expect(game.getState().rows.some((r) => r.id === row.id)).toBe(true);
    time(game, 0.6);
    expect(game.getState().rows.some((r) => r.id === row.id)).toBe(false);
    let guard = 0;
    while (game.getState().phase === "playing" && guard++ < 40) {
      for (const r of game.getState().rows)
        if (!r.filled) {
          expect(game.getState().bag).toContain(wordIndex(r.card));
          expect(game.getState().bag).toHaveLength(6);
          expect(new Set(game.getState().bag).size).toBe(6);
          game.act({ type: "fit", rowId: r.id, word: wordIndex(r.card) });
        }
      time(game, 1.1);
    }
    expect(game.getState().phase).toBe("won");
    expect(game.getState().resolved).toBe(24);
    expect(game.getState().correct).toBe(25);
    expect(game.getState().firstTry).toBe(23);
    expect(game.getState().reviews[0]!.corrected).toBe(true);
  });
  it("words: rows keep rising even without clicks and overflow loses", () => {
    const game = new ArcadeSession("cloze-tetris");
    game.act({ type: "start" });
    expect(game.getState().rows).toHaveLength(3);
    time(game, 35);
    expect(game.getState().phase).toBe("lost");
  });
  it("flight: automatic firing moves actual projectiles, wrong hits reveal without awarding points", () => {
    const game = new ArcadeSession("invaders");
    game.act({ type: "start" });
    const state = game.getState();
    const foe = state.enemies[0]!;
    foe.x = 2;
    foe.vx = 0;
    foe.z = 0;
    foe.age = 2;
    foe.card = 0; // controlled collision fixture: a photo target on the right
    game.act({ type: "aim", x: 2 });
    time(game, 1.2);
    expect(game.getState().shots.length).toBeGreaterThan(0);
    expect(foe.revealed).toBe(true);
    expect(foe.speed).toBeGreaterThan(1);
    expect(game.getState().score).toBe(0);
    expect(game.getState().reviews).toHaveLength(1);
    foe.x = -2;
    game.act({ type: "aim", x: -2 });
    time(game, 1.2);
    expect(game.getState().enemies.some((e) => e.id === foe.id)).toBe(false);
    expect(game.getState().score).toBe(15);
    expect(game.getState().firstTry).toBe(0);
    expect(game.getState().reviews[0]!.corrected).toBe(true);
  });
  it("flight: reaching the line consumes lives; zero lives stops the loop", () => {
    const game = new ArcadeSession("invaders");
    game.act({ type: "start" });
    for (let wave = 0; wave < 10 && game.getState().phase !== "lost"; wave++) {
      time(game, 100);
      if (game.getState().phase === "upgrade") game.act({ type: "upgrade", choice: "rapid" });
    }
    expect(game.getState().phase).toBe("lost");
    expect(game.getState().lives).toBe(0);
  });
  it("flight: challenge timeout does not fabricate kills, clear bonus or victory", () => {
    const game = new ArcadeSession("invaders");
    game.act({ type: "start" });
    // Exercise the final-wave boundary without modifying the production API.
    const state = game.getState() as ReturnType<ArcadeSession["getSnapshot"]>;
    state.wave = 10;
    state.challengeLeft = 0.03;
    time(game, 0.1);
    expect(game.getState().phase).toBe("lost");
    expect(game.getState().score).toBe(0);
    expect(game.getState().challengeExpired).toBe(true);
    expect(game.getState().reviews.length).toBeGreaterThan(0);
  });
  it("fixed integration is refresh-rate independent and frozen intervals never catch up", () => {
    const a = new ArcadeSession("invaders", 12);
    const b = new ArcadeSession("invaders", 12);
    a.act({ type: "start" });
    b.act({ type: "start" });
    for (let i = 0; i < 180; i++) a.advance(1 / 60);
    for (let i = 0; i < 90; i++) b.advance(1 / 30);
    expect(a.getState()).toEqual(b.getState());
    a.freeze();
    const elapsed = a.getState().elapsed;
    a.advance(60);
    expect(a.getState().elapsed - elapsed).toBeCloseTo(0.1, 8);
    a.act({ type: "reset" });
    expect(a.getState().elapsed).toBe(0);
    expect(a.getState().phase).toBe("ready");
  });
  it("practice data and action domains are bounded and bilingual", () => {
    expect(SENTENCES).toHaveLength(24);
    expect(new Set(SENTENCES.map((c) => c.id)).size).toBe(24);
    SENTENCES.forEach((c, i) => {
      expect(c.text.every((t) => t.includes("____"))).toBe(true);
      expect(wordIndex(i)).toBeGreaterThanOrEqual(0);
    });
    expect(VOCABULARY.every((w) => w[0].length && w[1].length)).toBe(true);
    const g = new ArcadeSession("stack");
    g.act({ type: "start" });
    for (const index of [-1, 3, Infinity, NaN, 0.2]) g.act({ type: "lane", index });
    expect(g.getState().lane).toBe(1);
  });
});
