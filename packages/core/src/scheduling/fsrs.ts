/**
 * One scheduler, so both shells answer "what is due tomorrow" the same way.
 *
 * Before this file there were two answers. The authoring shell ran real FSRS
 * through `ts-fsrs` with recorded parameters and a config hash; the online
 * shell ran a placeholder that doubled an interval and called it a day. A
 * learner working through the same course in both would have been given two
 * different review dates for the same card, and neither would have been wrong
 * in a way anyone could see — which is the worst kind of wrong.
 *
 * What lives here is the algorithm and nothing else: no storage, no events, no
 * session. The local shell keeps its SQLite event log and its replay check; the
 * online shell keeps its localStorage. Both call the same three functions, so
 * the thing they persist differs and the thing they compute does not.
 *
 * `node:crypto` is deliberately absent. This package runs in a browser as well
 * as in Node, so parameter hashing — which only the local store needs, to prove
 * a stored row was scheduled under the parameters it claims — stays on the
 * server side that already had it.
 */
import {
  createEmptyCard,
  fsrs,
  FSRSVersion,
  generatorParameters,
  Rating,
  State,
  type Card,
  type FSRSParameters,
  type Grade,
} from "ts-fsrs";

export { Rating, State };
export type { Card, FSRSParameters, Grade };

/**
 * The parameters, and the reason each one is not the default.
 *
 * `request_retention` 0.9 is the FSRS default and stays: a learner who wants a
 * different retention target is asking a product question, not a code one.
 *
 * `enable_fuzz` is off, and that is the load-bearing choice. Fuzz spreads due
 * dates by a random few percent so a big deck does not pile onto one morning.
 * It also means the same card, same rating, same instant yields a different due
 * date each run — which makes the local store's replay check, the one that
 * re-derives every review event and asserts the chain still lands where it
 * says, impossible to write. A reproducible schedule is worth more here than a
 * flatter queue.
 */
export const SCHEDULER_PARAMETERS: FSRSParameters = generatorParameters({
  request_retention: 0.9,
  enable_fuzz: false,
});

export const SCHEDULER_VERSION = FSRSVersion;

const scheduler = fsrs(SCHEDULER_PARAMETERS);

/** A card nobody has answered yet. */
export function newCard(now: Date = new Date()): Card {
  return createEmptyCard(now);
}

/**
 * Answer a card and get the next one back.
 *
 * Pure: the same card, rating and instant always produce the same result, which
 * is what lets the local store replay its whole event log and check that the
 * chain still holds.
 */
export function review(card: Card, rating: Grade, at: Date = new Date()): Card {
  return scheduler.next(card, at, rating).card;
}

/** Whether this card has come round. The queue is this and nothing more. */
export function isDue(card: Card, asOf: Date = new Date()): boolean {
  return card.due.getTime() <= asOf.getTime();
}

/**
 * The four buttons, named for what a learner did rather than for a number.
 *
 * `Again` is not "wrong". FSRS treats it as "this did not come back in time",
 * which is a different and kinder claim, and it is the one the review screen
 * should be making.
 */
export const RATING = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
} as const satisfies Record<string, Grade>;

export type RatingName = keyof typeof RATING;

/**
 * A card as plain JSON, for a store that cannot hold a `Date`.
 *
 * localStorage and a JSON column both flatten dates to strings; going through
 * one named pair of functions is what stops each store inventing its own way
 * and drifting on the edge cases — a missing `last_review` on a new card being
 * the one that bites.
 */
export interface StoredCard {
  readonly due: string;
  readonly stability: number;
  readonly difficulty: number;
  readonly elapsed_days: number;
  readonly scheduled_days: number;
  readonly learning_steps: number;
  readonly reps: number;
  readonly lapses: number;
  readonly state: State;
  readonly last_review?: string;
}

export function storeCard(card: Card): StoredCard {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    ...(card.last_review ? { last_review: card.last_review.toISOString() } : {}),
  };
}

export function loadCard(stored: StoredCard): Card {
  return {
    due: new Date(stored.due),
    stability: stored.stability,
    difficulty: stored.difficulty,
    elapsed_days: stored.elapsed_days,
    scheduled_days: stored.scheduled_days,
    learning_steps: stored.learning_steps,
    reps: stored.reps,
    lapses: stored.lapses,
    state: stored.state,
    ...(stored.last_review ? { last_review: new Date(stored.last_review) } : {}),
  };
}
