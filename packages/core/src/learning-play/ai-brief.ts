import type { ActivityBase } from "./types.js";

/**
 * An agreement the request left open, and what was agreed.
 *
 * Both halves are strings the payload chooses. This used to be three named
 * axes — `access`, `confirmation`, `roster` — with three literal value unions,
 * and the effect was that every lesson using this game taught the same
 * product: a sign-up sheet with a login, a confirmation and a member list.
 * The teaching point (a vague request has several honest readings, and you
 * pin them down by naming them) has nothing to do with sign-up sheets, so
 * the axes now come from the activity's own questions.
 */
export type BriefConfiguration = Readonly<Record<string, string>>;
export type BriefChoices = Readonly<Record<string, string>>;

/**
 * Something the visitor can do to the product, and which agreement decides
 * what happens when they do.
 *
 * The outcome of an action *is* the value agreed on its axis — 「立即确认」
 * agreed means 「立即确认」 observed. That identity used to be a lookup table
 * inside the engine (`confirmation === "instant" ? "joined" : "queued"`), which
 * is what made the outcomes a fixed vocabulary rather than the lesson's own
 * words.
 */
export interface BriefAction {
  readonly id: string;
  readonly label: string;
  readonly decidedBy: string;
  /**
   * What the visitor sees for each value that axis can take, and for the gate's
   * block if there is one.
   *
   * The engine decides *which* outcome by reading the agreement; this says what
   * that outcome looks like in the lesson's own words. Keeping the two separate
   * is what lets 「立即确认」 and 「一周后失效」 be outcomes of the same engine
   * without either one being spelled into it.
   */
  readonly outcomes: Readonly<Record<string, string>>;
  /**
   * What this action shows instead, once something else has already happened.
   *
   * Products accumulate: a list that is public shows other people's names, and
   * shows *yours* too once you have joined it. That second sentence is the one
   * that makes 「public」 concrete rather than abstract, and it was previously a
   * hardcoded branch reading `roster === "public" && submission === "joined"`.
   * Stated as a precondition, it is a property this product happens to have
   * rather than a rule the engine holds about sign-up sheets.
   */
  readonly after?: {
    readonly action: string;
    readonly outcome: string;
    readonly outcomes: Readonly<Record<string, string>>;
  };
}

/**
 * The agreement that can stop a visitor before anything else happens.
 *
 * Optional, because plenty of products have no such thing. It is kept as a
 * first-class idea rather than left to the axes because it is the one piece of
 * product behaviour that changes what *every* action does, and a lesson whose
 * requirement is 「只有登录的人能报名」 is teaching precisely that.
 */
export interface BriefGate {
  readonly axis: string;
  /** The value on that axis that makes the visitor identify themselves first. */
  readonly requiresUnlock: string;
  readonly unlockLabel: string;
  /** What the visitor gets instead, until they do. */
  readonly blockedOutcome: string;
}

export interface BriefActivity extends ActivityBase {
  readonly kind: "ai-brief";
  /** Given agreements, shown to the learner; never an acceptance receipt. */
  readonly initialChoices?: BriefChoices;
  readonly productName: string;
  readonly productDescription: string;
  readonly visitorName: string;
  readonly request: string;
  readonly actions: readonly BriefAction[];
  readonly gate?: BriefGate;
  readonly questions: readonly {
    readonly axis: string;
    readonly label: string;
    readonly question: string;
    readonly answer: string;
    readonly options: readonly {
      readonly value: string;
      readonly label: string;
      readonly clause: string;
    }[];
  }[];
  readonly target: BriefConfiguration;
  readonly followUp?: {
    readonly request: string;
    readonly target: BriefConfiguration;
  };
  readonly interpretations: readonly [BriefConfiguration, BriefConfiguration];
}

/** The agreements this activity actually asks about, in the order it asks. */
export function briefAxes(activity: BriefActivity): readonly string[] {
  return [...new Set(activity.questions.map((question) => question.axis))];
}

export interface BriefPreview {
  readonly unlocked: boolean;
  /** actionId → the outcome the visitor last got from it. */
  readonly done: Readonly<Record<string, string>>;
}

export interface BriefObservation {
  readonly configuration: string;
  readonly variant: number;
  readonly action: string;
  readonly result: string;
  readonly unlocked: boolean;
}

export interface BriefAcceptance {
  readonly choices: BriefChoices;
  readonly observations: readonly BriefObservation[];
}

/** The action id reserved for「identify yourself」; never one of `actions`. */
export const BRIEF_UNLOCK = "unlock";

export function evaluateBriefRounds(activity: BriefActivity, rounds: readonly BriefAcceptance[]) {
  const targets = [activity.target, ...(activity.followUp ? [activity.followUp.target] : [])];
  const passedRounds = targets.map((target, index) => {
    const round = rounds[index];
    return (
      !!round && evaluateBrief({ ...activity, target }, round.choices, round.observations).passed
    );
  });
  return { passed: rounds.length === targets.length && passedRounds.every(Boolean), passedRounds };
}

export const createBriefPreview = (): BriefPreview => ({ unlocked: false, done: {} });

export const briefFingerprint = (
  activity: BriefActivity,
  configuration: BriefConfiguration,
): string =>
  briefAxes(activity)
    .map((axis) => configuration[axis] ?? "")
    .join("/");

export function resolveBrief(
  activity: BriefActivity,
  choices: BriefChoices,
  variant: 0 | 1,
): BriefConfiguration {
  return { ...activity.interpretations[variant], ...choices };
}

/**
 * What the visitor sees for an action's outcome, given everything else they
 * have already done to this product.
 */
export function briefOutcomeText(
  action: BriefAction,
  outcome: string,
  state: BriefPreview,
): string {
  const after = action.after;
  if (after && state.done[after.action] === after.outcome && after.outcomes[outcome]) {
    return after.outcomes[outcome]!;
  }
  return action.outcomes[outcome] ?? outcome;
}

/** Whether this action is blocked by the gate under this configuration. */
export function briefBlocked(
  activity: BriefActivity,
  configuration: BriefConfiguration,
  unlocked: boolean,
): boolean {
  const gate = activity.gate;
  return !!gate && configuration[gate.axis] === gate.requiresUnlock && !unlocked;
}

/** These are executable product assumptions, not predictions about a live model. */
export function actOnBrief(
  activity: BriefActivity,
  configuration: BriefConfiguration,
  state: BriefPreview,
  actionId: string,
  variant: 0 | 1,
): { state: BriefPreview; observation?: BriefObservation } {
  if (actionId === BRIEF_UNLOCK) return { state: { unlocked: true, done: {} } };
  const action = activity.actions.find((candidate) => candidate.id === actionId);
  if (!action) return { state };
  const blocked = briefBlocked(activity, configuration, state.unlocked);
  const result = blocked ? activity.gate!.blockedOutcome : (configuration[action.decidedBy] ?? "");
  return {
    state: { ...state, done: { ...state.done, [actionId]: result } },
    observation: {
      configuration: briefFingerprint(activity, configuration),
      variant,
      action: actionId,
      result,
      unlocked: state.unlocked,
    },
  };
}

export function evaluateBrief(
  activity: BriefActivity,
  choices: BriefChoices,
  observations: readonly BriefObservation[],
) {
  const axes = briefAxes(activity);
  const missing = axes.filter((axis) => choices[axis] === undefined);
  const mismatches = axes.filter(
    (axis) => choices[axis] !== undefined && choices[axis] !== activity.target[axis],
  );
  const current = observations.filter(
    (event) => event.configuration === briefFingerprint(activity, activity.target),
  );

  const gate = activity.gate;
  const gatedAtTarget = !!gate && activity.target[gate.axis] === gate.requiresUnlock;

  /*
    Every action has to have been tried under the agreed rules and produced what
    those rules imply. Selecting the right clauses is not evidence: the whole
    point of the game is that two readings of one sentence look identical until
    somebody uses the product.
  */
  const tried = activity.actions.map((action) => ({
    id: action.id,
    ok: current.some(
      (event) =>
        event.action === action.id &&
        event.result === activity.target[action.decidedBy] &&
        (gatedAtTarget ? event.unlocked : true),
    ),
  }));

  /*
    And when the agreed rules do gate, the learner has to have met the gate —
    otherwise 「访客也能报名」 and 「必须先登录」 are indistinguishable from
    inside a session that happened to be signed in the whole time.
  */
  const gateChecked =
    !gatedAtTarget ||
    current.some((event) => event.result === gate!.blockedOutcome && !event.unlocked);

  return {
    passed: !missing.length && !mismatches.length && tried.every((row) => row.ok) && gateChecked,
    missing,
    mismatches,
    tried,
    gateChecked,
  };
}

/**
 * Whether this brief can be agreed and then observed at all.
 *
 * The rules that matter are the joins: an action decided by an axis nobody is
 * asked about can never be got right, and a gate on such an axis silently never
 * fires. Both render as a product that simply does not respond to the
 * agreements the learner just made.
 */
export function isValidBriefActivity(activity: BriefActivity): boolean {
  const axes = new Set(briefAxes(activity));
  if (axes.size === 0) return false;
  if (activity.actions.length === 0) return false;

  const actionIds = new Set(activity.actions.map((action) => action.id));
  if (actionIds.size !== activity.actions.length) return false;
  if (actionIds.has(BRIEF_UNLOCK)) return false;
  if (!activity.actions.every((action) => axes.has(action.decidedBy))) return false;

  if (activity.gate && !axes.has(activity.gate.axis)) return false;

  /*
    Every outcome an action can reach must have something to show for it. A
    missing entry renders as a product that responds to being used with a blank,
    which the learner reads as 「nothing happened」 rather than as the missing
    sentence it is — the same quiet failure as a contrast case that does not say
    what both approaches did.
  */
  for (const action of activity.actions) {
    const axisValues = activity.questions
      .filter((question) => question.axis === action.decidedBy)
      .flatMap((question) => question.options.map((option) => option.value));
    const needed = [...axisValues, ...(activity.gate ? [activity.gate.blockedOutcome] : [])];
    if (!needed.every((value) => action.outcomes[value]?.trim())) return false;
  }

  // Every axis asked about must offer the value the target settles on, or the
  // learner is being asked to agree to something they cannot pick.
  for (const question of activity.questions) {
    const values = new Set(question.options.map((option) => option.value));
    if (values.size !== question.options.length) return false;
    const wanted = activity.target[question.axis];
    if (wanted !== undefined && !values.has(wanted)) return false;
  }
  return [...axes].every((axis) => activity.target[axis] !== undefined);
}
