import type { ActivityBase } from "./types.js";

/**
 * One of the two ways of doing the thing.
 *
 * Exactly two, and neither is the reference. `hunt` already covers the
 * asymmetric case — a rule that claims to hold, and an implementation that
 * betrays it — and its whole shape depends on one side being the promise. Here
 * neither side is promising anything: 「按字找」 and 「比像不像」 are both real
 * methods, and the lesson is where they come apart, not which one lied.
 */
export interface ContrastApproach {
  readonly id: string;
  readonly label: string;
  /** How this one works, in one line the reader can hold while predicting. */
  readonly note: string;
}

export interface ContrastCase {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  /**
   * What each approach does with this case, keyed by approach id.
   *
   * Whether the two agree is read off these strings rather than declared in a
   * field of its own. A declared `agree: true` sitting above two visibly
   * different sentences would be a contradiction the reader can see and the
   * engine cannot, and the author would have had to write the agreement twice —
   * once for the screen, once for the judgement — with nothing keeping the two
   * copies honest. Writing the identical sentence in both columns is the same
   * claim, made once, in the place the reader is already looking.
   */
  readonly outcomes: Readonly<Record<string, string>>;
  /** Why they land together here, or why they split. Shown after the reveal. */
  readonly why: string;
}

export interface ContrastActivity extends ActivityBase {
  readonly kind: "contrast";
  readonly approaches: readonly [ContrastApproach, ContrastApproach];
  readonly cases: readonly ContrastCase[];
  /** What the reader is being asked to predict, said once above the board. */
  readonly question: string;
}

/**
 * Whether both approaches land in the same place on this case.
 *
 * Trailing space and a doubled space are not a difference the reader can see,
 * so they are not allowed to be a difference the engine sees either — a stray
 * space would otherwise flip a case from 「they agree」 to 「they split」 and
 * silently invert what the board teaches. Anything past whitespace is a real
 * difference: two sentences meaning roughly the same thing still read as two
 * answers in two columns, and the author who wants them to agree has to write
 * one sentence.
 */
const settled = (text: string | undefined) => text?.trim().replaceAll(/\s+/gu, " ") ?? "";

export function contrastCaseAgrees(activity: ContrastActivity, kase: ContrastCase): boolean {
  const [first, second] = activity.approaches;
  return settled(kase.outcomes[first.id]) === settled(kase.outcomes[second.id]);
}

export interface ContrastState {
  /** caseId → what the reader predicted, once they have got it right. */
  readonly settled: Readonly<Record<string, boolean>>;
  readonly misses: number;
}

export type ContrastVerdict =
  | { readonly kind: "unknown-case" }
  | { readonly kind: "already-settled" }
  | {
      readonly kind: "right";
      readonly agree: boolean;
      readonly why: string;
      readonly state: ContrastState;
    }
  | {
      readonly kind: "wrong";
      readonly agree: boolean;
      readonly why: string;
      readonly state: ContrastState;
    };

export function createContrastState(): ContrastState {
  return { settled: {}, misses: 0 };
}

/**
 * Predict one case, then see both columns.
 *
 * The reveal happens either way — a wrong prediction still shows what the two
 * approaches actually did, because being surprised is the point of the
 * exercise and hiding the outcome would turn a miss into a dead end. The case
 * stays open so it can be answered again; only the miss is kept.
 */
export function predictContrast(
  activity: ContrastActivity,
  state: ContrastState,
  caseId: string,
  predictedAgree: boolean,
): ContrastVerdict {
  const kase = activity.cases.find((candidate) => candidate.id === caseId);
  if (!kase) return { kind: "unknown-case" };
  if (state.settled[caseId] !== undefined) return { kind: "already-settled" };
  const agree = contrastCaseAgrees(activity, kase);
  if (agree === predictedAgree) {
    return {
      kind: "right",
      agree,
      why: kase.why,
      state: { settled: { ...state.settled, [caseId]: agree }, misses: state.misses },
    };
  }
  return {
    kind: "wrong",
    agree,
    why: kase.why,
    state: { settled: state.settled, misses: state.misses + 1 },
  };
}

export function isContrastComplete(activity: ContrastActivity, state: ContrastState): boolean {
  return activity.cases.every((kase) => state.settled[kase.id] !== undefined);
}

/**
 * Whether this board teaches a contrast, and whether it can be played at all.
 *
 * The load-bearing rule is the last one: a board whose cases all agree, or all
 * differ, is not a contrast. It is a board that rewards answering the same way
 * every time, and a reader who never changes their answer cannot be
 * distinguished from one who understood. `isValidSortActivity` refuses an
 * always-empty bucket for the same reason.
 *
 * The outcome-coverage rule is the other half, and it is the one that fails
 * quietly: an outcome map missing a key, or carrying a mistyped approach id,
 * renders a column with nothing in it. The reader sees a blank where the
 * comparison was supposed to be and has no way to know whether that is the
 * answer or the bug.
 */
export function isValidContrastActivity(activity: ContrastActivity): boolean {
  const [first, second] = activity.approaches;
  if (!first || !second || first.id === second.id) return false;
  const approachIds = new Set([first.id, second.id]);

  const caseIds = new Set(activity.cases.map((kase) => kase.id));
  if (caseIds.size !== activity.cases.length) return false;
  if (activity.cases.length < 2) return false;

  for (const kase of activity.cases) {
    const keys = Object.keys(kase.outcomes);
    if (keys.length !== approachIds.size) return false;
    if (!keys.every((key) => approachIds.has(key))) return false;
    // An empty outcome renders as an empty column, which reads as "it does
    // nothing here" rather than as the missing text it is.
    if (!keys.every((key) => kase.outcomes[key]?.trim())) return false;
  }

  const agreements = activity.cases.map((kase) => contrastCaseAgrees(activity, kase));
  return agreements.includes(true) && agreements.includes(false);
}
