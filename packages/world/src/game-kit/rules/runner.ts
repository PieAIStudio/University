import { displayWidth, type ChoiceItem, type ChoiceRound } from "@pieai/university-core";

import { RoundGame, type PlayRound, type RoundGameState } from "./round-game.js";

/**
 * 三岔路 — the endless-runner fork (ADR-0011), the shape people know from
 * Temple Run and Subway Surfers.
 *
 * The learner's avatar runs down a garden path. Each situation from the
 * lesson rides above the path; ahead, the path splits into one lane per
 * option, each under an arch with the option's words. Steer into a lane (or
 * tap its arch) before the fork: the best option scores; any other costs a
 * heart with the lesson's own cost of that choice. Reaching the fork without
 * a choice runs straight through the lane the avatar is in, so hesitating is
 * a choice too — the middle lane is never free.
 *
 * Lanes: 0 is left. The avatar starts each situation in the middle of the
 * lanes this situation has; which option sits in which lane is shuffled.
 */
export const APPROACH = { start: 0, fork: 1 } as const;
const GAP_SECONDS = 0.9;

export interface Fork {
  readonly itemId: string;
  /** Option ids by lane, left to right. */
  readonly lanes: readonly string[];
  /** 0 when the situation appears, 1 at the fork. */
  progress: number;
  readonly seconds: number;
  /** The lane the learner committed to, once they reached the fork. */
  taken: number | null;
  /** Seconds since the fork was reached, for the scene's pass-through. */
  since: number;
}

export type RunnerEvent =
  | { readonly id: number; readonly kind: "steer"; readonly lane: number }
  | {
      readonly id: number;
      readonly kind: "fork";
      readonly itemId: string;
      readonly lane: number;
      readonly right: boolean;
      readonly points: number;
      readonly shielded: boolean;
    };

export interface RunnerState extends RoundGameState<ChoiceRound, RunnerEvent> {
  queue: string[];
  fork: Fork | null;
  /** The lane the avatar runs in now. */
  lane: number;
  /** Where the avatar is between lanes, for the scene's glide. */
  laneX: number;
  gapIn: number;
  /** Metres run, for the scene's scrolling ground. */
  distance: number;
}

export type RunnerAction =
  | { readonly type: "steer"; readonly by: -1 | 1 }
  | { readonly type: "lane"; readonly lane: number };

const chars = (text: string) => displayWidth(text) / 2;

/** Seconds from a situation's appearing to its fork: time to read it and its options. */
export function approachSeconds(item: ChoiceItem, roundIndex: number, pace: number): number {
  const reading =
    chars(item.text) + item.options.reduce((sum, option) => sum + chars(option.label), 0);
  const seconds = Math.min(12, Math.max(5, 3 + 0.16 * reading));
  return (seconds * (1 / (1 + 0.06 * roundIndex))) / pace;
}

export class RunnerSession extends RoundGame<ChoiceRound, RunnerEvent, RunnerState, RunnerAction> {
  constructor(rounds: readonly ChoiceRound[], seed = 1) {
    super(rounds, seed, { queue: [], fork: null, lane: 1, laneX: 1, gapIn: 0, distance: 0 });
  }

  itemOf(itemId: string): ChoiceItem | null {
    return this.currentRound()?.round.items.find((item) => item.id === itemId) ?? null;
  }

  protected setUp(current: PlayRound<ChoiceRound>) {
    const s = this.state;
    s.queue = [...current.itemIds];
    s.fork = null;
    s.gapIn = 0.3;
    // The first fork is already down the path when the round is briefed, so
    // its arches (and a first-use guide pointing at their buttons) are there.
    if (s.queue.length) this.next();
  }

  protected input(action: RunnerAction) {
    const s = this.state;
    const fork = s.fork;
    if (!fork || fork.taken !== null) return;
    const lanes = fork.lanes.length;
    const lane = action.type === "lane" ? action.lane : s.lane + action.by;
    if (lane < 0 || lane >= lanes || lane === s.lane) return;
    s.lane = lane;
    this.emit({ kind: "steer", lane });
  }

  protected play(dt: number) {
    const s = this.state;
    s.distance += dt * 4 * this.pace();
    s.laneX += (s.lane - s.laneX) * Math.min(1, dt * 12);
    const fork = s.fork;
    if (!fork) {
      s.gapIn -= dt;
      if (s.gapIn <= 0 && s.queue.length) this.next();
      return;
    }
    if (fork.taken !== null) {
      fork.since += dt;
      if (fork.since >= GAP_SECONDS) {
        s.fork = null;
        s.gapIn = 0.2;
      }
      return;
    }
    fork.progress = Math.min(1, fork.progress + dt / fork.seconds);
    if (fork.progress >= 1) this.reach(fork);
  }

  private next() {
    const s = this.state;
    const item = this.itemOf(s.queue.shift()!)!;
    const order = item.options.map((option) => option.id);
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.random() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    s.fork = {
      itemId: item.id,
      lanes: order,
      progress: 0,
      seconds: approachSeconds(item, s.roundIndex, this.pace()),
      taken: null,
      since: 0,
    };
    // Start in the middle of this fork's lanes; with two lanes, the left one.
    s.lane = Math.floor((order.length - 1) / 2);
  }

  private reach(fork: Fork) {
    const s = this.state;
    const item = this.itemOf(fork.itemId)!;
    fork.taken = s.lane;
    const chosen = fork.lanes[s.lane]!;
    if (chosen === item.bestId) {
      const points = this.scored(item.id, true, item.why);
      this.emit({
        kind: "fork",
        itemId: item.id,
        lane: s.lane,
        right: true,
        points,
        shielded: false,
      });
      return;
    }
    const shielded = this.missed(item.id, item.whyNot[chosen] ?? item.why, "wrong");
    this.emit({ kind: "fork", itemId: item.id, lane: s.lane, right: false, points: 0, shielded });
  }

  protected roundDone() {
    const s = this.state;
    return !s.queue.length && !s.fork;
  }
}
