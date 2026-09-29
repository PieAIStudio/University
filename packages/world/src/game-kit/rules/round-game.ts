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
 * The run every island game shares (ADR-0011, rules layer).
 *
 * intro → briefing → countdown → playing → upgrade → briefing … → review
 * rounds → won, or lost the moment the last heart goes. A mechanic says what
 * happens while playing and when its round is done; this owns everything
 * else, so hearts, upgrades, the review round and the log mean the same thing
 * in every game.
 */
export const COUNTDOWN_SECONDS = 3;
/** Main rounds per run, before the review round. */
export const MAX_ROUNDS = 6;

export type RoundPhase =
  | "intro"
  | "briefing"
  | "countdown"
  | "playing"
  | "upgrade"
  | "won"
  | "lost";

/** What every mechanic's round has, whatever its items look like. */
export interface RoundSource {
  readonly id: string;
  readonly lessonId: string;
  readonly lessonTitle: string;
  readonly question: string;
  readonly items: readonly { readonly id: string }[];
}

export interface PlayRound<R extends RoundSource> {
  readonly round: R;
  /** A review round replays what went wrong earlier; no upgrade follows it. */
  readonly review: boolean;
  /** The items this pass plays, in play order. */
  readonly itemIds: readonly string[];
}

/**
 * What the frame says after a verdict: the lesson's own words, never invented
 * ones. `escaped` is an item the learner let go by — a boat that docked, a
 * mole that ducked, a block that landed on its own.
 */
export interface RoundNotice {
  readonly id: number;
  readonly kind: "right" | "corrected" | "wrong" | "escaped" | "shield";
  readonly itemId: string;
  readonly reason: string;
  readonly points: number;
}

export type RoundEvent =
  | { readonly id: number; readonly kind: "round-clear" }
  | { readonly id: number; readonly kind: "lost" }
  | { readonly id: number; readonly kind: "won" };

export interface RoundGameState<R extends RoundSource, E extends { readonly id: number }> {
  phase: RoundPhase;
  rounds: PlayRound<R>[];
  roundIndex: number;
  /** Main rounds in this run, excluding review. */
  mainRounds: number;
  run: RunState;
  log: LogEntry[];
  offered: UpgradeId[];
  countdown: number;
  /** Player-chosen gentler pace, for the whole run. */
  calm: boolean;
  /** The scene's cue sheet: the newest two dozen, numbered. */
  events: (E | RoundEvent)[];
  notice: RoundNotice | null;
  elapsed: number;
  serial: number;
}

export type RoundAction =
  | { readonly type: "start"; readonly calm?: boolean }
  | { readonly type: "ready" }
  | { readonly type: "upgrade"; readonly id: UpgradeId };

/** An event before the session numbers it (a distributive `Omit`). */
export type Unnumbered<E> = E extends { readonly id: number } ? Omit<E, "id"> : never;

function roundGameStart<R extends RoundSource>(
  rounds: readonly R[],
  random: () => number,
  maxRounds: number,
): RoundGameState<R, never> {
  const main = rounds.slice(0, maxRounds).map((round) => ({
    round,
    review: false,
    itemIds: shuffled(
      round.items.map((item) => item.id),
      random,
    ),
  }));
  return {
    phase: "intro",
    rounds: main,
    roundIndex: 0,
    mainRounds: main.length,
    run: createRun(),
    log: [],
    offered: [],
    countdown: 0,
    calm: false,
    events: [],
    notice: null,
    elapsed: 0,
    serial: 0,
  };
}

export abstract class RoundGame<
  R extends RoundSource,
  E extends { readonly id: number; readonly kind: string },
  S extends RoundGameState<R, E>,
  A extends { readonly type: string },
> extends GameSession<S, RoundAction | A> {
  protected readonly random: () => number;
  private readonly byRound = new Map<string, R>();

  /** `own` is the mechanic's fields at the start of a run. */
  constructor(
    rounds: readonly R[],
    readonly seed: number,
    own: Omit<S, keyof RoundGameState<R, E>>,
    maxRounds = MAX_ROUNDS,
  ) {
    const random = seededRandom(seed);
    super({ ...roundGameStart(rounds, random, maxRounds), ...own } as S);
    this.random = random;
    for (const { round } of this.state.rounds) this.byRound.set(round.id, round);
  }

  /** Set the mechanic up for the round now being briefed. */
  protected abstract setUp(current: PlayRound<R>): void;
  /** One fixed step of play. */
  protected abstract play(seconds: number): void;
  /** The learner's input while playing. */
  protected abstract input(action: A): void;
  /** True once everything this round plays has been settled. */
  protected abstract roundDone(): boolean;

  currentRound(): PlayRound<R> | null {
    return this.state.rounds[this.state.roundIndex] ?? null;
  }

  /** The round a logged item belongs to, for the review sheet. */
  roundOf(roundId: string): R | null {
    return this.byRound.get(roundId) ?? null;
  }

  protected running(state: S) {
    return state.phase === "countdown" || state.phase === "playing";
  }

  /** Speed of anything that moves toward the learner: calm and the slow upgrade. */
  protected pace() {
    return (this.state.calm ? 0.7 : 1) * this.state.run.slowNext;
  }

  protected emit(event: Unnumbered<E> | Unnumbered<RoundEvent>) {
    const s = this.state;
    s.events.push({ ...event, id: ++s.serial } as E | RoundEvent);
    if (s.events.length > 24) s.events.splice(0, s.events.length - 24);
  }

  protected say(notice: Omit<RoundNotice, "id">) {
    this.state.notice = { ...notice, id: ++this.state.serial };
  }

  /**
   * A right answer: full points the first time, fewer once the item was shown
   * wrong or got away. Returns the points for the scene's effect.
   */
  protected scored(itemId: string, firstTry: boolean, reason: string): number {
    const s = this.state;
    const current = this.currentRound()!;
    const points = firstTry ? scoreRight(s.run, s.run.bonusNext) : scoreCorrected(s.run);
    logOutcome(
      s.log,
      current.round.id,
      itemId,
      firstTry && !current.review ? "first" : "corrected",
      current.review,
    );
    this.say({ kind: firstTry ? "right" : "corrected", itemId, reason, points });
    return points;
  }

  /** A wrong answer or an item let go: a heart, unless the shield takes it. */
  protected missed(itemId: string, reason: string, kind: "wrong" | "escaped"): boolean {
    const s = this.state;
    const current = this.currentRound()!;
    const shielded = loseHeart(s.run) === "shield";
    logOutcome(s.log, current.round.id, itemId, "missed", current.review);
    this.say({ kind: shielded ? "shield" : kind, itemId, reason, points: 0 });
    return shielded;
  }

  /** Right without a verdict to show — an item correctly left alone. */
  protected spared(itemId: string) {
    const current = this.currentRound()!;
    logOutcome(this.state.log, current.round.id, itemId, "first", current.review);
  }

  private brief() {
    const s = this.state;
    s.phase = "briefing";
    s.notice = null;
    this.setUp(this.currentRound()!);
  }

  protected apply(action: RoundAction | A) {
    const s = this.state;
    if (action.type === "start" && s.phase === "intro") {
      s.calm = Boolean((action as RoundAction & { type: "start" }).calm);
      if (!s.rounds.length) return;
      this.brief();
      return;
    }
    if (action.type === "ready" && s.phase === "briefing") {
      s.phase = "countdown";
      s.countdown = COUNTDOWN_SECONDS;
      return;
    }
    if (action.type === "upgrade") {
      const id = (action as RoundAction & { type: "upgrade" }).id;
      if (s.phase !== "upgrade" || !s.offered.includes(id)) return;
      applyUpgrade(s.run, id);
      s.offered = [];
      s.roundIndex += 1;
      this.brief();
      return;
    }
    if (s.phase === "playing") this.input(action as A);
  }

  protected step(dt: number) {
    const s = this.state;
    s.elapsed += dt;
    if (s.phase === "countdown") {
      s.countdown -= dt;
      if (s.countdown <= 0) {
        s.countdown = 0;
        s.phase = "playing";
      }
      return;
    }
    this.play(dt);
    if (s.run.hearts <= 0) {
      s.phase = "lost";
      this.emit({ kind: "lost" });
      return;
    }
    if (this.roundDone()) this.finishRound();
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

  /**
   * What a review pass replays of a round, given the items not right the first
   * time. Most mechanics replay just those; one whose items only make sense
   * together (a sentence to build) replays the whole round.
   */
  protected reviewItems(round: R, again: readonly string[]): readonly string[] {
    void round;
    return again;
  }

  /** Everything not right the first time comes back once, grouped by its round. */
  private reviewRounds(): PlayRound<R>[] {
    const s = this.state;
    const result: PlayRound<R>[] = [];
    for (const { round } of s.rounds.slice(0, s.mainRounds)) {
      const again = round.items
        .map((item) => item.id)
        .filter((id) =>
          s.log.some((e) => e.roundId === round.id && e.itemId === id && e.outcome !== "first"),
        );
      if (!again.length) continue;
      result.push({
        round,
        review: true,
        itemIds: shuffled([...this.reviewItems(round, again)], this.random),
      });
    }
    return result;
  }
}
