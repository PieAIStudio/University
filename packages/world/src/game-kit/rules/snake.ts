import { displayWidth, type SequencePiece, type SequenceRound } from "@pieai/university-core";

import { RoundGame, type PlayRound, type RoundGameState } from "./round-game.js";

/**
 * 贪吃蛇 — the courtyard lawn as a grid (ADR-0011).
 *
 * The learner's avatar leads a little train across the lawn. Word crates lie
 * on it; eating them in an order the lesson accepts builds the sentence (or
 * walks the route) one wagon at a time. A crate that belongs in no order is a
 * distractor and costs a heart with its own reason; a crate that belongs but
 * not yet costs a heart and shows which one comes next. Hunger is the clock:
 * it refills with every right bite, and when it runs out the next crate jumps
 * onto the train by itself, counted as missed.
 *
 * The train never dies on a wall or on itself: it turns at the hedge and
 * passes over its own wagons. Steering is the game's feel; the judgement is
 * the order, and only the order costs hearts.
 */
export const LAWN = { cols: 11, rows: 8 } as const;
export const SNAKE_SETTLE_SECONDS = 1.2;
const START = { c: 1, r: 4 } as const;

export type Direction = "up" | "down" | "left" | "right";
export interface Cell {
  readonly c: number;
  readonly r: number;
}

const STEP: Record<Direction, Cell> = {
  up: { c: 0, r: -1 },
  down: { c: 0, r: 1 },
  left: { c: -1, r: 0 },
  right: { c: 1, r: 0 },
};
const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};
const DIRECTIONS: readonly Direction[] = ["up", "right", "down", "left"];

export interface Crate {
  readonly id: string;
  c: number;
  r: number;
}

export type SnakeEvent =
  | {
      readonly id: number;
      readonly kind: "bite";
      readonly pieceId: string;
      readonly points: number;
      readonly firstTry: boolean;
    }
  | {
      readonly id: number;
      readonly kind: "wrong";
      /** The crate the train ran into. */
      readonly pieceId: string;
      /** A distractor, or a right crate eaten before its turn. */
      readonly why: "decoy" | "order";
      readonly shielded: boolean;
    }
  | {
      readonly id: number;
      readonly kind: "escaped";
      readonly pieceId: string;
      readonly shielded: boolean;
    }
  | { readonly id: number; readonly kind: "complete" };

export interface SnakeState extends RoundGameState<SequenceRound, SnakeEvent> {
  /** Head first. The train passes over itself, so cells may repeat. */
  body: Cell[];
  /** Where each segment stood one move ago, for the scene's glide. */
  prev: Cell[];
  dir: Direction;
  /** Turns asked for, taken one per move. */
  turns: Direction[];
  /** Seconds into the current move. */
  moving: number;
  /** Seconds per move this round. */
  stride: number;
  crates: Crate[];
  /** The pieces eaten so far, in order: the sentence on the train. */
  eaten: string[];
  /** Crates shown as "next" after a mistake; eating one now is only "corrected". */
  revealed: string[];
  /** A crate the learner tapped: the train steers itself to it. */
  aim: string | null;
  hunger: number;
  window: number;
  settle: number;
}

export type SnakeAction =
  | { readonly type: "turn"; readonly dir: Direction }
  | { readonly type: "aim"; readonly pieceId: string };

const chars = (text: string) => displayWidth(text) / 2;
const same = (a: Cell, b: Cell) => a.c === b.c && a.r === b.r;
const inside = (cell: Cell) =>
  cell.c >= 0 && cell.c < LAWN.cols && cell.r >= 0 && cell.r < LAWN.rows;
const add = (cell: Cell, dir: Direction): Cell => ({
  c: cell.c + STEP[dir].c,
  r: cell.r + STEP[dir].r,
});
const distance = (a: Cell, b: Cell) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);

/** Seconds per move: quicker each round, gentler when calm or slowed. */
export function strideSeconds(roundIndex: number, pace: number): number {
  return (0.34 * (1 / (1 + 0.05 * roundIndex))) / pace;
}

/** Seconds before the train is too hungry to wait: time to read every crate once. */
export function hungerSeconds(round: SequenceRound, roundIndex: number, pace: number): number {
  const reading = round.items.reduce((sum, piece) => sum + chars(piece.text), 0);
  const seconds = Math.min(16, Math.max(9, 6 + 0.12 * reading));
  return (seconds * (1 / (1 + 0.06 * roundIndex))) / pace;
}

/** The pieces that may come next after `eaten`, by every order that still fits. */
export function nextPieces(round: SequenceRound, eaten: readonly string[]): string[] {
  const next = new Set<string>();
  for (const order of round.answers)
    if (order.length > eaten.length && eaten.every((id, at) => order[at] === id))
      next.add(order[eaten.length]!);
  return [...next];
}

const complete = (round: SequenceRound, eaten: readonly string[]) =>
  round.answers.some(
    (order) => order.length === eaten.length && order.every((id, at) => eaten[at] === id),
  );

const isDecoy = (round: SequenceRound, pieceId: string) =>
  !round.answers.some((order) => order.includes(pieceId));

export class SnakeSession extends RoundGame<SequenceRound, SnakeEvent, SnakeState, SnakeAction> {
  constructor(rounds: readonly SequenceRound[], seed = 1) {
    super(rounds, seed, {
      body: [START],
      prev: [START],
      dir: "right",
      turns: [],
      moving: 0,
      stride: 0.34,
      crates: [],
      eaten: [],
      revealed: [],
      aim: null,
      hunger: 0,
      window: 0,
      settle: 0,
    });
  }

  pieceOf(pieceId: string): SequencePiece | null {
    return this.currentRound()?.round.items.find((piece) => piece.id === pieceId) ?? null;
  }

  /** A distractor, by the lesson's orders: it belongs in none of them. */
  isDecoy(pieceId: string): boolean {
    const round = this.currentRound()?.round;
    return round ? isDecoy(round, pieceId) : false;
  }

  protected setUp(current: PlayRound<SequenceRound>) {
    const s = this.state;
    s.body = [START];
    s.prev = [START];
    s.dir = "right";
    s.turns = [];
    s.moving = 0;
    s.eaten = [];
    s.revealed = [];
    s.aim = null;
    s.settle = 0;
    s.stride = strideSeconds(s.roundIndex, this.pace());
    s.window = hungerSeconds(current.round, s.roundIndex, this.pace());
    s.hunger = s.window;
    s.crates = [];
    for (const id of current.itemIds) {
      const cell = this.freeCell(3);
      s.crates.push({ id, ...cell });
    }
  }

  /** A cell no crate stands on, away from the head and from other crates. */
  private freeCell(fromHead: number): Cell {
    const s = this.state;
    const head = s.body[0]!;
    // Off the head's own row too, so the first straight run eats nothing by accident.
    const ok = (cell: Cell, spacing: number) =>
      distance(cell, head) >= fromHead &&
      cell.r !== head.r &&
      s.crates.every((crate) => distance(crate, cell) >= spacing);
    for (const spacing of [3, 2, 1]) {
      const cells: Cell[] = [];
      for (let c = 0; c < LAWN.cols; c += 1)
        for (let r = 0; r < LAWN.rows; r += 1) if (ok({ c, r }, spacing)) cells.push({ c, r });
      if (cells.length) return cells[Math.floor(this.random() * cells.length)]!;
    }
    return { c: LAWN.cols - 1, r: 0 };
  }

  protected input(action: SnakeAction) {
    const s = this.state;
    if (!s.crates.length && s.settle > 0) return;
    if (action.type === "aim") {
      if (s.crates.some((crate) => crate.id === action.pieceId)) s.aim = action.pieceId;
      return;
    }
    // Steering by hand takes over from the autopilot.
    s.aim = null;
    const last = s.turns.at(-1) ?? s.dir;
    if (action.dir === last || action.dir === OPPOSITE[last]) return;
    if (s.turns.length < 2) s.turns.push(action.dir);
  }

  protected play(dt: number) {
    const s = this.state;
    if (s.settle > 0) {
      s.settle = Math.max(0, s.settle - dt);
      return;
    }
    s.hunger -= dt;
    if (s.hunger <= 0) {
      this.starve();
      if (s.settle > 0) return;
    }
    s.moving += dt;
    while (s.moving >= s.stride && s.settle <= 0) {
      s.moving -= s.stride;
      this.move();
    }
  }

  protected roundDone() {
    const s = this.state;
    const round = this.currentRound()!.round;
    return complete(round, s.eaten) && s.settle <= 0;
  }

  protected reviewItems(round: SequenceRound): readonly string[] {
    // An order is only practised whole.
    return round.items.map((piece) => piece.id);
  }

  private heading(): Direction {
    const s = this.state;
    const head = s.body[0]!;
    const target = s.aim ? s.crates.find((crate) => crate.id === s.aim) : null;
    if (target) {
      const route = this.route(head, target);
      if (route) return route;
      s.aim = null;
    }
    while (s.turns.length) {
      const turn = s.turns.shift()!;
      if (turn !== OPPOSITE[s.dir]) return turn;
    }
    return s.dir;
  }

  /** The first step of a shortest path to `target` that walks around other crates. */
  private route(from: Cell, target: Cell): Direction | null {
    const s = this.state;
    const blocked = (cell: Cell) =>
      s.crates.some((crate) => !same(crate, target) && same(crate, cell));
    const seen = new Set([`${from.c},${from.r}`]);
    const queue: { cell: Cell; first: Direction }[] = [];
    for (const dir of DIRECTIONS) {
      if (s.body.length > 1 && dir === OPPOSITE[s.dir]) continue;
      const cell = add(from, dir);
      if (!inside(cell) || blocked(cell)) continue;
      if (same(cell, target)) return dir;
      seen.add(`${cell.c},${cell.r}`);
      queue.push({ cell, first: dir });
    }
    while (queue.length) {
      const { cell, first } = queue.shift()!;
      for (const dir of DIRECTIONS) {
        const next = add(cell, dir);
        const key = `${next.c},${next.r}`;
        if (!inside(next) || seen.has(key) || blocked(next)) continue;
        if (same(next, target)) return first;
        seen.add(key);
        queue.push({ cell: next, first });
      }
    }
    return null;
  }

  private move() {
    const s = this.state;
    let dir = this.heading();
    const head = s.body[0]!;
    if (!inside(add(head, dir))) {
      // Turn at the hedge rather than stop: toward the side with more lawn.
      const sides = DIRECTIONS.filter((d) => d !== dir && d !== OPPOSITE[dir]);
      const room = (d: Direction) => {
        let cell = add(head, d);
        let n = 0;
        while (inside(cell)) {
          n += 1;
          cell = add(cell, d);
        }
        return n;
      };
      dir = room(sides[0]!) >= room(sides[1]!) ? sides[0]! : sides[1]!;
      s.turns = [];
    }
    s.dir = dir;
    s.prev = s.body.map((cell) => ({ ...cell }));
    const next = add(head, dir);
    s.body = [next, ...s.body.slice(0, -1)];
    const crate = s.crates.find((candidate) => same(candidate, next));
    if (crate) this.bite(crate);
  }

  private grow() {
    const s = this.state;
    const tail = s.prev.at(-1) ?? s.body.at(-1)!;
    s.body.push({ ...tail });
    s.prev.push({ ...tail });
  }

  private bite(crate: Crate) {
    const s = this.state;
    const round = this.currentRound()!.round;
    const piece = round.items.find((candidate) => candidate.id === crate.id)!;
    const next = nextPieces(round, s.eaten);
    if (s.aim === crate.id) s.aim = null;
    if (next.includes(crate.id)) {
      s.crates = s.crates.filter((candidate) => candidate.id !== crate.id);
      s.eaten.push(crate.id);
      this.grow();
      const firstTry = !s.revealed.includes(crate.id);
      const points = this.scored(crate.id, firstTry, piece.reason ?? "");
      this.emit({ kind: "bite", pieceId: crate.id, points, firstTry });
      this.afterBite();
      return;
    }
    if (isDecoy(round, crate.id)) {
      s.crates = s.crates.filter((candidate) => candidate.id !== crate.id);
      const shielded = this.missed(crate.id, piece.why ?? "", "wrong");
      this.emit({ kind: "wrong", pieceId: crate.id, why: "decoy", shielded });
      return;
    }
    // Right crate, wrong turn: show the one that comes next, and move this one away.
    const expected = round.items.find((candidate) => candidate.id === next[0])!;
    if (!s.revealed.includes(expected.id)) s.revealed.push(expected.id);
    Object.assign(crate, this.freeCellAwayFrom(crate));
    const shielded = this.missed(expected.id, expected.reason ?? "", "wrong");
    this.emit({ kind: "wrong", pieceId: crate.id, why: "order", shielded });
  }

  private freeCellAwayFrom(crate: Crate): Cell {
    const s = this.state;
    const others = s.crates.filter((candidate) => candidate !== crate);
    const saved = s.crates;
    s.crates = others;
    const cell = this.freeCell(3);
    s.crates = saved;
    return cell;
  }

  /** Hunger ran out: the next crate jumps on by itself, and counts as missed. */
  private starve() {
    const s = this.state;
    const round = this.currentRound()!.round;
    const nextId = nextPieces(round, s.eaten).find((id) => s.crates.some((c) => c.id === id));
    s.hunger = s.window;
    if (!nextId) return;
    const piece = round.items.find((candidate) => candidate.id === nextId)!;
    s.crates = s.crates.filter((candidate) => candidate.id !== nextId);
    if (s.aim === nextId) s.aim = null;
    s.eaten.push(nextId);
    this.grow();
    const shielded = this.missed(nextId, piece.reason ?? "", "escaped");
    this.emit({ kind: "escaped", pieceId: nextId, shielded });
    this.afterBite();
  }

  private afterBite() {
    const s = this.state;
    const round = this.currentRound()!.round;
    s.hunger = s.window;
    if (!complete(round, s.eaten)) return;
    // Distractors left on the lawn were rightly left alone.
    for (const crate of s.crates) if (isDecoy(round, crate.id)) this.spared(crate.id);
    s.crates = [];
    s.aim = null;
    s.settle = SNAKE_SETTLE_SECONDS;
    this.emit({ kind: "complete" });
  }
}
