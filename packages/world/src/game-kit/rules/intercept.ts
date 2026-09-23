import {
  createSortState,
  displayWidth,
  placeSortItem,
  type GameRound,
  type SortState,
} from "@pieai/university-core";

import {
  applyUpgrade,
  availableUpgrades,
  createRun,
  endRound,
  logOutcome,
  loseHeart,
  scoreCorrected,
  scoreRight,
  type LogEntry,
  type RunState,
  type UpgradeId,
} from "./run.js";
import { GameSession, seededRandom, shuffled } from "./session.js";

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
const COUNTDOWN_SECONDS = 3;
/** Main rounds per run, before the review round. */
export const MAX_ROUNDS = 6;
const SHORT_ITEM = 10;

export type InterceptPhase =
  | "intro"
  | "briefing"
  | "countdown"
  | "playing"
  | "upgrade"
  | "won"
  | "lost";

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
    }
  | { readonly id: number; readonly kind: "round-clear" }
  | { readonly id: number; readonly kind: "lost" }
  | { readonly id: number; readonly kind: "won" };

/** What the frame says after an event; the item's own words, never invented ones. */
export interface InterceptNotice {
  readonly id: number;
  readonly kind: "right" | "corrected" | "wrong" | "docked" | "shield";
  readonly itemId: string;
  /** The lesson's reason: `tempting.whyNot` when the learner took the tempting bin, else `why`. */
  readonly reason: string;
  readonly points: number;
}

export interface InterceptRound {
  readonly round: GameRound;
  /** A review round replays what went wrong earlier; no upgrade follows it. */
  readonly review: boolean;
  readonly itemIds: readonly string[];
}

export interface InterceptState {
  phase: InterceptPhase;
  rounds: InterceptRound[];
  roundIndex: number;
  /** Main rounds in this run, excluding review. */
  mainRounds: number;
  queue: string[];
  boats: Boat[];
  balls: Ball[];
  run: RunState;
  log: LogEntry[];
  offered: UpgradeId[];
  countdown: number;
  spawnIn: number;
  cooldown: number;
  /** Chosen by the learner; otherwise the boat nearest the dock. */
  targetId: number | null;
  /** Player-chosen gentler pace, for the whole run. */
  calm: boolean;
  events: InterceptEvent[];
  notice: InterceptNotice | null;
  elapsed: number;
  serial: number;
}

export type InterceptAction =
  | { readonly type: "start"; readonly calm?: boolean }
  | { readonly type: "ready" }
  | { readonly type: "throw"; readonly binId: string }
  | { readonly type: "target"; readonly boatId: number }
  | { readonly type: "upgrade"; readonly id: UpgradeId };

/** An event before the session numbers it (a distributive `Omit`). */
type EventInput = InterceptEvent extends infer E
  ? E extends InterceptEvent
    ? Omit<E, "id">
    : never
  : never;

/** Reading room in CJK characters: an English letter is half of one. */
const chars = (text: string) => displayWidth(text) / 2;

/** Seconds a boat takes to cross, by how long its text is to read. */
export function crossingSeconds(text: string, roundIndex: number, pace: number): number {
  const reading = Math.min(13, Math.max(7, 6 + 0.16 * chars(text)));
  return (reading * (1 / (1 + 0.06 * roundIndex))) / pace;
}

export class InterceptSession extends GameSession<InterceptState, InterceptAction> {
  private readonly random: () => number;
  private readonly sorts = new Map<string, SortState>();
  private readonly byRound = new Map<string, GameRound>();

  constructor(
    rounds: readonly GameRound[],
    readonly seed = 1,
  ) {
    const random = seededRandom(seed);
    const main = rounds.slice(0, MAX_ROUNDS).map((round) => ({
      round,
      review: false,
      itemIds: shuffled(
        round.items.map((item) => item.id),
        random,
      ),
    }));
    super({
      phase: "intro",
      rounds: main,
      roundIndex: 0,
      mainRounds: main.length,
      queue: [],
      boats: [],
      balls: [],
      run: createRun(),
      log: [],
      offered: [],
      countdown: 0,
      spawnIn: 0,
      cooldown: 0,
      targetId: null,
      calm: false,
      events: [],
      notice: null,
      elapsed: 0,
      serial: 0,
    });
    this.random = random;
    for (const { round } of main) this.byRound.set(round.id, round);
  }

  currentRound(): InterceptRound | null {
    return this.state.rounds[this.state.roundIndex] ?? null;
  }

  itemOf(itemId: string) {
    const round = this.currentRound()?.round;
    return round?.items.find((item) => item.id === itemId) ?? null;
  }

  protected running(state: InterceptState) {
    return state.phase === "countdown" || state.phase === "playing";
  }

  private emit(event: EventInput) {
    const s = this.state;
    s.events.push({ ...event, id: ++s.serial } as InterceptEvent);
    if (s.events.length > 24) s.events.splice(0, s.events.length - 24);
  }

  private say(notice: Omit<InterceptNotice, "id">) {
    this.state.notice = { ...notice, id: ++this.state.serial };
  }

  private pace() {
    const s = this.state;
    return (s.calm ? 0.7 : 1) * s.run.slowNext;
  }

  private brief() {
    const s = this.state;
    const current = this.currentRound()!;
    s.phase = "briefing";
    s.queue = [...current.itemIds];
    s.boats = [];
    s.balls = [];
    s.targetId = null;
    s.notice = null;
    if (!this.sorts.has(current.round.id) || current.review)
      this.sorts.set(current.round.id, createSortState());
  }

  protected apply(action: InterceptAction) {
    const s = this.state;
    if (action.type === "start" && s.phase === "intro") {
      s.calm = Boolean(action.calm);
      if (!s.rounds.length) return;
      this.brief();
      return;
    }
    if (action.type === "ready" && s.phase === "briefing") {
      s.phase = "countdown";
      s.countdown = COUNTDOWN_SECONDS;
      return;
    }
    if (action.type === "upgrade" && s.phase === "upgrade" && s.offered.includes(action.id)) {
      applyUpgrade(s.run, action.id);
      s.offered = [];
      s.roundIndex += 1;
      this.brief();
      return;
    }
    if (s.phase !== "playing") return;
    if (action.type === "target") {
      const boat = s.boats.find((b) => b.id === action.boatId && b.state === "sailing");
      if (boat) s.targetId = boat.id;
      return;
    }
    if (action.type === "throw") this.throwAt(action.binId);
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

  protected step(dt: number) {
    const s = this.state;
    s.elapsed += dt;
    if (s.phase === "countdown") {
      s.countdown -= dt;
      if (s.countdown <= 0) {
        s.countdown = 0;
        s.phase = "playing";
        s.spawnIn = 0;
      }
      return;
    }
    s.cooldown = Math.max(0, s.cooldown - dt);
    this.spawn(dt);
    this.sail(dt);
    this.fly(dt);
    for (const boat of s.boats) if (boat.state !== "sailing") boat.gone += dt;
    s.boats = s.boats.filter((boat) => boat.state === "sailing" || boat.gone < 1.2);
    if (s.run.hearts <= 0) {
      s.phase = "lost";
      this.emit({ kind: "lost" });
      return;
    }
    if (!s.queue.length && s.boats.every((b) => b.state !== "sailing") && !s.balls.length)
      this.finishRound();
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
    const s = this.state;
    const current = this.currentRound()!;
    const round = current.round;
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
      const first = !boat.revealed;
      const points = first ? scoreRight(s.run, s.run.bonusNext) : scoreCorrected(s.run);
      logOutcome(
        s.log,
        round.id,
        item.id,
        first && !current.review ? "first" : "corrected",
        current.review,
      );
      this.emit({ kind: "right", boatId: boat.id, binId, points });
      this.say({ kind: first ? "right" : "corrected", itemId: item.id, reason: item.why, points });
      return;
    }
    if (verdict.kind !== "wrong") return;
    this.sorts.set(round.id, verdict.state);
    boat.revealed = true;
    const took = loseHeart(s.run);
    logOutcome(s.log, round.id, item.id, "missed", current.review);
    this.emit({ kind: "wrong", boatId: boat.id, binId, shielded: took === "shield" });
    this.say({
      kind: took === "shield" ? "shield" : "wrong",
      itemId: item.id,
      reason: verdict.whyNot ?? item.why,
      points: 0,
    });
  }

  private dock(boat: Boat) {
    const s = this.state;
    const current = this.currentRound()!;
    const round = current.round;
    boat.state = "docked";
    const took = loseHeart(s.run);
    logOutcome(s.log, round.id, boat.itemId, "missed", current.review);
    const item = round.items.find((candidate) => candidate.id === boat.itemId)!;
    this.emit({ kind: "docked", boatId: boat.id, shielded: took === "shield" });
    this.say({
      kind: took === "shield" ? "shield" : "docked",
      itemId: item.id,
      reason: item.why,
      points: 0,
    });
  }

  private finishRound() {
    const s = this.state;
    const finished = this.currentRound()!;
    endRound(s.run);
    this.emit({ kind: "round-clear" });
    if (!finished.review && s.roundIndex === s.mainRounds - 1)
      s.rounds.push(...this.reviewRounds());
    if (s.roundIndex >= s.rounds.length - 1) {
      s.phase = "won";
      this.emit({ kind: "won" });
      return;
    }
    const next = s.rounds[s.roundIndex + 1]!;
    if (next.review) {
      s.roundIndex += 1;
      this.brief();
      return;
    }
    s.phase = "upgrade";
    s.offered = shuffled(availableUpgrades(s.run), this.random).slice(0, 3);
  }

  /** Everything not right the first time comes back once, grouped by its round. */
  private reviewRounds(): InterceptRound[] {
    const s = this.state;
    const result: InterceptRound[] = [];
    for (const { round } of s.rounds.slice(0, s.mainRounds)) {
      const again = round.items
        .map((item) => item.id)
        .filter((id) =>
          s.log.some((e) => e.roundId === round.id && e.itemId === id && e.outcome !== "first"),
        );
      if (again.length) result.push({ round, review: true, itemIds: shuffled(again, this.random) });
    }
    return result;
  }

  /** The round a logged item belongs to, for the review sheet. */
  roundOf(roundId: string): GameRound | null {
    return this.byRound.get(roundId) ?? null;
  }
}
