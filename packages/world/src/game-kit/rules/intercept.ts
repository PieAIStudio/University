import {
  createSortState,
  displayWidth,
  placeSortItem,
  type GameRound,
  type SortState,
} from "@pieai/university-core";

import {
  RoundGame,
  type PlayRound,
  type RoundAction,
  type RoundGameState,
  type RoundNotice,
  type RoundPhase,
} from "./round-game.js";

/**
 * 庭院拦截 — the first game assembled from the kit (ADR-0011).
 *
 * Paper boats carry a round's items across the pond toward the terrace. Each
 * bin of the round is a basket and a button; pressing one throws that colour
 * at a boat. The verdict is the lesson's own sort engine (`placeSortItem`), so
 * a right throw here is exactly a right placement in the lesson.
 *
 * Pond coordinates: x left–right, z from the far gate (negative) to the
 * terrace (positive); the scene maps them into its arena.
 */
export const POND = { gateZ: -4.2, dockZ: 1.2, halfWidth: 3 } as const;
/** The avatar's hand, where every ball starts. */
export const HAND = { x: 0, y: 1.2, z: 2.1 } as const;
/** From the button to the ball leaving the hand: the avatar's throw beat at speed 1.6. */
export const WINDUP_SECONDS = 0.18;
export const FLIGHT_SECONDS = 0.36;
const THROW_COOLDOWN = 0.22;
const SHORT_ITEM = 10;

export type InterceptPhase = RoundPhase;

export interface Boat {
  readonly id: number;
  readonly itemId: string;
  readonly originX: number;
  x: number;
  z: number;
  /** Where along the crossing, 0 at the gate to 1 at the dock. */
  progress: number;
  readonly seconds: number;
  readonly drift: number;
  readonly sway: number;
  /** Shown its right bin after a wrong throw. */
  revealed: boolean;
  /** A ball is on its way to this boat. */
  targeted: boolean;
  state: "sailing" | "sunk" | "docked";
  /** Seconds since it sank or docked, for the scene's exit animation. */
  gone: number;
}

export interface Ball {
  readonly id: number;
  readonly binId: string;
  readonly boatId: number;
  /** Negative while the avatar winds up; 0–1 in flight. */
  t: number;
  x: number;
  y: number;
  z: number;
}

export type InterceptEvent =
  | { readonly id: number; readonly kind: "throw"; readonly binId: string; readonly boatId: number }
  | {
      readonly id: number;
      readonly kind: "right";
      readonly boatId: number;
      readonly binId: string;
      readonly points: number;
    }
  | {
      readonly id: number;
      readonly kind: "wrong";
      readonly boatId: number;
      readonly binId: string;
      readonly shielded: boolean;
    }
  | {
      readonly id: number;
      readonly kind: "docked";
      readonly boatId: number;
      readonly shielded: boolean;
    };

/** What the frame says after an event; the item's own words, never invented ones. */
export type InterceptNotice = RoundNotice;
export type InterceptRound = PlayRound<GameRound>;

export interface InterceptState extends RoundGameState<GameRound, InterceptEvent> {
  queue: string[];
  boats: Boat[];
  balls: Ball[];
  spawnIn: number;
  cooldown: number;
  /** Chosen by the learner; otherwise the boat nearest the dock. */
  targetId: number | null;
}

export type InterceptAction =
  | RoundAction
  | { readonly type: "throw"; readonly binId: string }
  | { readonly type: "target"; readonly boatId: number };

/** Reading room in CJK characters: an English letter is half of one. */
const chars = (text: string) => displayWidth(text) / 2;

/** Seconds a boat takes to cross, by how long its text is to read. */
export function crossingSeconds(text: string, roundIndex: number, pace: number): number {
  const reading = Math.min(13, Math.max(7, 6 + 0.16 * chars(text)));
  return (reading * (1 / (1 + 0.06 * roundIndex))) / pace;
}

export class InterceptSession extends RoundGame<
  GameRound,
  InterceptEvent,
  InterceptState,
  Exclude<InterceptAction, RoundAction>
> {
  private readonly sorts = new Map<string, SortState>();

  constructor(rounds: readonly GameRound[], seed = 1) {
    super(rounds, seed, {
      queue: [],
      boats: [],
      balls: [],
      spawnIn: 0,
      cooldown: 0,
      targetId: null,
    });
  }

  itemOf(itemId: string) {
    const round = this.currentRound()?.round;
    return round?.items.find((item) => item.id === itemId) ?? null;
  }

  protected setUp(current: InterceptRound) {
    const s = this.state;
    s.queue = [...current.itemIds];
    s.boats = [];
    s.balls = [];
    s.targetId = null;
    s.spawnIn = 0;
    if (!this.sorts.has(current.round.id) || current.review)
      this.sorts.set(current.round.id, createSortState());
  }

  protected input(action: Exclude<InterceptAction, RoundAction>) {
    const s = this.state;
    if (action.type === "target") {
      const boat = s.boats.find((b) => b.id === action.boatId && b.state === "sailing");
      if (boat) s.targetId = boat.id;
      return;
    }
    this.throwAt(action.binId);
  }

  protected roundDone() {
    const s = this.state;
    return !s.queue.length && s.boats.every((b) => b.state !== "sailing") && !s.balls.length;
  }

  /** The chosen boat if it is still free, else the free boat nearest the dock. */
  private target(): Boat | null {
    const s = this.state;
    const free = s.boats.filter((b) => b.state === "sailing" && !b.targeted);
    const chosen = free.find((b) => b.id === s.targetId);
    if (chosen) return chosen;
    return free.sort((a, b) => b.progress - a.progress)[0] ?? null;
  }

  private throwAt(binId: string) {
    const s = this.state;
    const round = this.currentRound()!.round;
    if (!round.bins.some((bin) => bin.id === binId) || s.cooldown > 0) return;
    const boat = this.target();
    if (!boat) return;
    boat.targeted = true;
    if (s.targetId === boat.id) s.targetId = null;
    s.cooldown = THROW_COOLDOWN;
    s.balls.push({
      id: ++s.serial,
      binId,
      boatId: boat.id,
      t: -WINDUP_SECONDS / FLIGHT_SECONDS,
      x: HAND.x,
      y: HAND.y,
      z: HAND.z,
    });
    this.emit({ kind: "throw", binId, boatId: boat.id });
  }

  protected play(dt: number) {
    const s = this.state;
    s.cooldown = Math.max(0, s.cooldown - dt);
    this.spawn(dt);
    this.sail(dt);
    this.fly(dt);
    for (const boat of s.boats) if (boat.state !== "sailing") boat.gone += dt;
    s.boats = s.boats.filter((boat) => boat.state === "sailing" || boat.gone < 1.2);
  }

  private spawn(dt: number) {
    const s = this.state;
    s.spawnIn -= dt;
    if (!s.queue.length || s.spawnIn > 0) return;
    const sailing = s.boats.filter((b) => b.state === "sailing");
    const round = this.currentRound()!.round;
    const texts = round.items.map((item) => item.text);
    const afloat = texts.every((text) => chars(text) <= SHORT_ITEM) ? 3 : 2;
    if (sailing.length >= afloat) return;
    const newest = sailing.reduce((a, b) => (a && a.progress < b.progress ? a : b), sailing[0]);
    if (newest && newest.progress < 0.4) return;
    const itemId = s.queue.shift()!;
    const item = round.items.find((candidate) => candidate.id === itemId)!;
    const start = (this.random() - 0.5) * 1.2;
    s.boats.push({
      id: ++s.serial,
      itemId,
      originX: start,
      x: start,
      z: POND.gateZ,
      progress: 0,
      seconds: crossingSeconds(item.text, s.roundIndex, this.pace()),
      drift: (this.random() - 0.5) * 2 * (POND.halfWidth - 0.6) - start,
      sway: this.random() * Math.PI * 2,
      revealed: false,
      targeted: false,
      state: "sailing",
      gone: 0,
    });
    s.spawnIn = 1.2;
  }

  private sail(dt: number) {
    const s = this.state;
    for (const boat of s.boats) {
      if (boat.state !== "sailing") continue;
      boat.progress = Math.min(1, boat.progress + dt / boat.seconds);
      const p = boat.progress;
      const eased = p * p * (3 - 2 * p);
      boat.z = POND.gateZ + (POND.dockZ - POND.gateZ) * p;
      // A gentle S across the pond, the same for the same seed every run.
      const x =
        boat.originX + boat.drift * eased + Math.sin(p * Math.PI * 2 + boat.sway) * 0.35 * (1 - p);
      boat.x = Math.max(-POND.halfWidth, Math.min(POND.halfWidth, x));
      if (p >= 1) this.dock(boat);
    }
  }

  private fly(dt: number) {
    const s = this.state;
    const landed: Ball[] = [];
    for (const ball of s.balls) {
      ball.t += dt / FLIGHT_SECONDS;
      if (ball.t < 0) continue;
      const boat = s.boats.find((b) => b.id === ball.boatId);
      const t = Math.min(1, ball.t);
      const tx = boat?.x ?? ball.x;
      const tz = boat?.z ?? ball.z;
      ball.x = HAND.x + (tx - HAND.x) * t;
      ball.z = HAND.z + (tz - HAND.z) * t;
      ball.y = HAND.y + (0.35 - HAND.y) * t + Math.sin(Math.PI * t) * 1.3;
      if (ball.t >= 1) landed.push(ball);
    }
    for (const ball of landed) {
      s.balls = s.balls.filter((b) => b.id !== ball.id);
      const boat = s.boats.find((b) => b.id === ball.boatId);
      if (!boat || boat.state !== "sailing") continue;
      boat.targeted = false;
      this.resolve(boat, ball.binId);
    }
  }

  private resolve(boat: Boat, binId: string) {
    const round = this.currentRound()!.round;
    const rules = {
      buckets: round.bins,
      items: round.items.map((item) => ({
        id: item.id,
        bucketId: item.binId,
        why: item.why,
        ...(item.tempting
          ? { tempting: { bucketId: item.tempting.binId, whyNot: item.tempting.whyNot } }
          : {}),
      })),
    };
    const verdict = placeSortItem(rules, this.sorts.get(round.id)!, boat.itemId, binId);
    const item = round.items.find((candidate) => candidate.id === boat.itemId)!;
    if (verdict.kind === "right") {
      this.sorts.set(round.id, verdict.state);
      boat.state = "sunk";
      const points = this.scored(item.id, !boat.revealed, item.why);
      this.emit({ kind: "right", boatId: boat.id, binId, points });
      return;
    }
    if (verdict.kind !== "wrong") return;
    this.sorts.set(round.id, verdict.state);
    boat.revealed = true;
    const shielded = this.missed(item.id, verdict.whyNot ?? item.why, "wrong");
    this.emit({ kind: "wrong", boatId: boat.id, binId, shielded });
  }

  private dock(boat: Boat) {
    boat.state = "docked";
    const item = this.currentRound()!.round.items.find(
      (candidate) => candidate.id === boat.itemId,
    )!;
    const shielded = this.missed(item.id, item.why, "escaped");
    this.emit({ kind: "docked", boatId: boat.id, shielded });
  }
}
