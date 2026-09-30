import { displayWidth, type SpotRound } from "@pieai/university-core";

import { RoundGame, type PlayRound, type RoundGameState } from "./round-game.js";

/**
 * 打地鼠 — molehills on the courtyard lawn (ADR-0011).
 *
 * Moles pop up holding one sentence each, checked against the source shown
 * above the field. Whack the one the round asks for; leave the others alone.
 * A mole ducks when its time is up: a target that ducks unwhacked got away and
 * costs a heart, while any other mole that ducks was rightly left alone.
 * Whacking a mole that should have been left alone costs a heart with that
 * sentence's own reason.
 *
 * Reading comes first: at most two moles are up at once, one when the
 * sentences are long, and each stays up for as long as its sentence takes to
 * read at the round's pace.
 */
export const HOLES = 6;
export const RISE_SECONDS = 0.25;
export const DUCK_SECONDS = 0.3;
const HIT_SECONDS = 0.45;
const SPAWN_GAP = 0.7;
const SHORT_SENTENCE = 12;

export interface Mole {
  readonly id: number;
  readonly itemId: string;
  readonly hole: number;
  /** Seconds since it began to rise. */
  age: number;
  /** Seconds it stays fully up. */
  readonly up: number;
  state: "up" | "hit" | "ducking";
  /** Seconds since it was hit or began to duck. */
  gone: number;
}

export type MolesEvent =
  | { readonly id: number; readonly kind: "pop"; readonly moleId: number }
  | {
      readonly id: number;
      readonly kind: "whack";
      readonly moleId: number;
      readonly right: boolean;
      readonly points: number;
      readonly shielded: boolean;
    }
  | {
      readonly id: number;
      readonly kind: "escaped";
      readonly moleId: number;
      readonly shielded: boolean;
    };

export interface MolesState extends RoundGameState<SpotRound, MolesEvent> {
  queue: string[];
  moles: Mole[];
  spawnIn: number;
}

export type MolesAction = { readonly type: "whack"; readonly moleId: number };

const chars = (text: string) => displayWidth(text) / 2;

/** Seconds a mole stays up: its sentence read once, less each round. */
export function upSeconds(text: string, roundIndex: number, pace: number): number {
  const reading = Math.min(7, Math.max(3, 2.2 + 0.18 * chars(text)));
  return (reading * (1 / (1 + 0.06 * roundIndex))) / pace;
}

export class MolesSession extends RoundGame<SpotRound, MolesEvent, MolesState, MolesAction> {
  constructor(rounds: readonly SpotRound[], seed = 1) {
    super(rounds, seed, { queue: [], moles: [], spawnIn: 0 });
  }

  sentenceOf(itemId: string) {
    return this.currentRound()?.round.items.find((item) => item.id === itemId) ?? null;
  }

  /** Whether a mole is out of its hole far enough to be hit. */
  static reachable(mole: Mole): boolean {
    return mole.state === "up" && mole.age < RISE_SECONDS + mole.up;
  }

  protected setUp(current: PlayRound<SpotRound>) {
    const s = this.state;
    s.queue = [...current.itemIds];
    s.moles = [];
    s.spawnIn = 0.4;
  }

  protected input(action: MolesAction) {
    const s = this.state;
    const mole = s.moles.find((candidate) => candidate.id === action.moleId);
    if (!mole || !MolesSession.reachable(mole)) return;
    const item = this.sentenceOf(mole.itemId)!;
    mole.state = "hit";
    mole.gone = 0;
    if (item.target) {
      const points = this.scored(item.id, true, item.why);
      this.emit({ kind: "whack", moleId: mole.id, right: true, points, shielded: false });
      return;
    }
    const shielded = this.missed(item.id, item.why, "wrong");
    this.emit({ kind: "whack", moleId: mole.id, right: false, points: 0, shielded });
  }

  protected play(dt: number) {
    const s = this.state;
    for (const mole of s.moles) {
      mole.age += dt;
      if (mole.state !== "up") {
        mole.gone += dt;
        continue;
      }
      if (mole.age >= RISE_SECONDS + mole.up) {
        mole.state = "ducking";
        mole.gone = 0;
        this.ducked(mole);
      }
    }
    s.moles = s.moles.filter(
      (mole) =>
        mole.state === "up" ||
        (mole.state === "hit" && mole.gone < HIT_SECONDS) ||
        (mole.state === "ducking" && mole.gone < DUCK_SECONDS),
    );
    this.spawn(dt);
  }

  private ducked(mole: Mole) {
    const item = this.sentenceOf(mole.itemId)!;
    if (!item.target) {
      this.spared(item.id);
      return;
    }
    const shielded = this.missed(item.id, item.why, "escaped");
    this.emit({ kind: "escaped", moleId: mole.id, shielded });
  }

  private spawn(dt: number) {
    const s = this.state;
    s.spawnIn -= dt;
    if (!s.queue.length || s.spawnIn > 0) return;
    const round = this.currentRound()!.round;
    const short = round.items.every((item) => chars(item.text) <= SHORT_SENTENCE);
    const up = s.moles.filter((mole) => mole.state === "up");
    if (up.length >= (short ? 2 : 1)) return;
    const busy = new Set(s.moles.map((mole) => mole.hole));
    const free = Array.from({ length: HOLES }, (_, hole) => hole).filter((hole) => !busy.has(hole));
    if (!free.length) return;
    const itemId = s.queue.shift()!;
    const item = this.sentenceOf(itemId)!;
    const mole: Mole = {
      id: ++s.serial,
      itemId,
      hole: free[Math.floor(this.random() * free.length)]!,
      age: 0,
      up: upSeconds(item.text, s.roundIndex, this.pace()),
      state: "up",
      gone: 0,
    };
    s.moles.push(mole);
    s.spawnIn = SPAWN_GAP;
    this.emit({ kind: "pop", moleId: mole.id });
  }

  protected roundDone() {
    const s = this.state;
    return !s.queue.length && !s.moles.length;
  }
}
