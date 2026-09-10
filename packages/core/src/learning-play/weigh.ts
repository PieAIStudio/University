import type { ActivityBase } from "./types.js";

/**
 * One of the choices on the table.
 *
 * `note` says what this choice buys and what it costs — stated once, up front,
 * as a standing property of the choice. What it costs *here* belongs to the
 * situation, because that is the part that moves.
 */
export interface WeighOption {
  readonly id: string;
  readonly label: string;
  readonly note: string;
}

export interface WeighSituation {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly bestOptionId: string;
  /** Why this one wins *here*. Not why it is good in general. */
  readonly why: string;
  /**
   * What each of the other choices would have cost in this situation, keyed by
   * that option's id.
   *
   * This is the field that makes the activity a trade-off rather than a quiz.
   * Without it a right answer teaches "A is the answer"; with it, a right
   * answer teaches what was given up to get it — and the reader meets the same
   * sentence again, inverted, in the situation where the answer flips.
   *
   * It was a single string, which was wrong the moment a board had three
   * options: 「the other one」 names two different choices with two different
   * costs, and one sentence has to either pick one silently or blur both. Two
   * of the first five boards written against this interface had three options.
   */
  readonly costOfOther: Readonly<Record<string, string>>;
}

export interface WeighActivity extends ActivityBase {
  readonly kind: "weigh";
  readonly options: readonly WeighOption[];
  readonly situations: readonly WeighSituation[];
  /** The decision being made, said once above the board. */
  readonly question: string;
}

export interface WeighState {
  /** situationId → the option that won it, once the reader has found it. */
  readonly decided: Readonly<Record<string, string>>;
  readonly misses: number;
}

export type WeighVerdict =
  | { readonly kind: "unknown-situation" }
  | { readonly kind: "unknown-option" }
  | { readonly kind: "already-decided" }
  | {
      readonly kind: "right";
      readonly why: string;
      readonly costOfOther: Readonly<Record<string, string>>;
      readonly state: WeighState;
    }
  | { readonly kind: "wrong"; readonly state: WeighState };

export function createWeighState(): WeighState {
  return { decided: {}, misses: 0 };
}

/**
 * Choose for one situation.
 *
 * A miss says nothing beyond "not here" — deliberately. The reason this choice
 * loses in this situation is the answer, and handing it over on a wrong guess
 * would let the reader collect every explanation without ever making the
 * judgement. `placeSortItem` gives its `whyNot` away because a sort board's
 * temptation is authored per item and there is exactly one wrong thing to say
 * about it; here every other option is wrong for its own reason, and the set of
 * them is the lesson.
 */
export function decideWeigh(
  activity: WeighActivity,
  state: WeighState,
  situationId: string,
  optionId: string,
): WeighVerdict {
  const situation = activity.situations.find((candidate) => candidate.id === situationId);
  if (!situation) return { kind: "unknown-situation" };
  if (!activity.options.some((option) => option.id === optionId)) return { kind: "unknown-option" };
  if (state.decided[situationId]) return { kind: "already-decided" };
  if (situation.bestOptionId === optionId) {
    return {
      kind: "right",
      why: situation.why,
      costOfOther: situation.costOfOther,
      state: {
        decided: { ...state.decided, [situationId]: optionId },
        misses: state.misses,
      },
    };
  }
  return { kind: "wrong", state: { decided: state.decided, misses: state.misses + 1 } };
}

export function isWeighComplete(activity: WeighActivity, state: WeighState): boolean {
  return activity.situations.every(
    (situation) => state.decided[situation.id] === situation.bestOptionId,
  );
}

/**
 * Which options actually won something, in the order the board presents them.
 *
 * The host shows this at the end, because the flip is the takeaway and it is
 * not visible from any single situation — the reader answered "A" once and "B"
 * once and needs to be shown that both were right.
 */
export function weighOutcomes(
  activity: WeighActivity,
): readonly { readonly optionId: string; readonly situationIds: readonly string[] }[] {
  return activity.options.map((option) => ({
    optionId: option.id,
    situationIds: activity.situations
      .filter((situation) => situation.bestOptionId === option.id)
      .map((situation) => situation.id),
  }));
}

/**
 * Whether this board is a trade-off, and whether it can be played at all.
 *
 * The rule that carries the whole activity is the last one: **no option may go
 * unwon**. A board where one choice is right every time teaches "always pick
 * A", which is the precise opposite of the thing a 决策 lesson exists to teach,
 * and it is indistinguishable from a correct board by every other check —
 * every situation has an answer, every answer has a reason, the reader can
 * finish it. They finish it without ever making a decision.
 *
 * The floor of two situations per board is the same rule seen from the other
 * side: one situation cannot show an answer changing.
 */
export function isValidWeighActivity(activity: WeighActivity): boolean {
  const optionIds = new Set(activity.options.map((option) => option.id));
  if (optionIds.size !== activity.options.length) return false;
  if (optionIds.size < 2) return false;

  const situationIds = new Set(activity.situations.map((situation) => situation.id));
  if (situationIds.size !== activity.situations.length) return false;
  if (activity.situations.length < optionIds.size) return false;

  for (const situation of activity.situations) {
    if (!optionIds.has(situation.bestOptionId)) return false;
    /*
      Every losing option *on this board* has to say what picking it here would
      have cost. A missing entry renders as a blank where the trade-off was
      supposed to be — the same quiet failure as a contrast case that does not
      say what both approaches did.

      Keys for options this board does not offer are allowed, and that is not
      laziness: tiers subset the options, so the situation that prices all three
      choices is the same object the two-option tier uses. An id that is simply
      wrong is still caught, because the option it was meant to name then has no
      cost of its own. What is refused is a cost written against the winning
      option, which is a contradiction the reader can see on screen.
    */
    const costs = situation.costOfOther ?? {};
    if (costs[situation.bestOptionId] !== undefined) return false;
    const losing = [...optionIds].filter((id) => id !== situation.bestOptionId);
    if (!losing.every((id) => costs[id]?.trim())) return false;
  }

  return activity.options.every((option) =>
    activity.situations.some((situation) => situation.bestOptionId === option.id),
  );
}
