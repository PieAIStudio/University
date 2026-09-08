import type { ActivityBase } from "./types.js";

export const BRIEF_AXES = ["access", "confirmation", "roster"] as const;
export type BriefAxis = (typeof BRIEF_AXES)[number];
export interface BriefConfiguration {
  readonly access: "guest" | "account";
  readonly confirmation: "instant" | "review";
  readonly roster: "private" | "public";
}
export type BriefChoices = Partial<BriefConfiguration>;
export interface BriefActivity extends ActivityBase {
  readonly kind: "ai-brief";
  /** Given agreements, shown to the learner; never an acceptance receipt. */
  readonly initialChoices?: BriefChoices;
  readonly productName: string;
  readonly productDescription: string;
  readonly visitorName: string;
  readonly actionLabel: string;
  readonly request: string;
  readonly questions: readonly {
    readonly axis: BriefAxis;
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
export interface BriefPreview {
  readonly signedIn: boolean;
  readonly submission: "none" | "login" | "joined" | "queued";
  readonly rosterOpen: boolean;
}
export interface BriefObservation {
  readonly configuration: string;
  readonly variant: number;
  readonly action: "submit" | "roster";
  readonly result: "login" | "joined" | "queued" | "private" | "public";
  readonly signedIn: boolean;
}
export interface BriefAcceptance {
  readonly choices: BriefChoices;
  readonly observations: readonly BriefObservation[];
}

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
export const createBriefPreview = (): BriefPreview => ({
  signedIn: false,
  submission: "none",
  rosterOpen: false,
});
export const briefFingerprint = (configuration: BriefConfiguration): string =>
  BRIEF_AXES.map((axis) => configuration[axis]).join("/");

export function resolveBrief(
  activity: BriefActivity,
  choices: BriefChoices,
  variant: 0 | 1,
): BriefConfiguration {
  return { ...activity.interpretations[variant], ...choices };
}

/** These are executable product assumptions, not predictions about a live model. */
export function actOnBrief(
  configuration: BriefConfiguration,
  state: BriefPreview,
  action: "submit" | "roster" | "login",
  variant: 0 | 1,
): { state: BriefPreview; observation?: BriefObservation } {
  if (action === "login") return { state: { ...state, signedIn: true, submission: "none" } };
  const blocked = configuration.access === "account" && !state.signedIn;
  const result = blocked
    ? "login"
    : action === "roster"
      ? configuration.roster
      : configuration.confirmation === "instant"
        ? "joined"
        : "queued";
  return {
    state:
      action === "roster"
        ? { ...state, rosterOpen: true, ...(blocked ? { submission: "login" as const } : {}) }
        : { ...state, submission: result as "login" | "joined" | "queued" },
    observation: {
      configuration: briefFingerprint(configuration),
      variant,
      action,
      result,
      signedIn: state.signedIn,
    },
  };
}

export function evaluateBrief(
  activity: BriefActivity,
  choices: BriefChoices,
  observations: readonly BriefObservation[],
) {
  const missing = BRIEF_AXES.filter((axis) => choices[axis] === undefined);
  const mismatches = BRIEF_AXES.filter(
    (axis) => choices[axis] !== undefined && choices[axis] !== activity.target[axis],
  );
  const current = observations.filter(
    (event) => event.configuration === briefFingerprint(activity.target),
  );
  const submitted = current.some(
    (event) =>
      event.action === "submit" &&
      event.result === (activity.target.confirmation === "instant" ? "joined" : "queued") &&
      (activity.target.access === "guest" ? !event.signedIn : event.signedIn),
  );
  const accessChecked =
    activity.target.access === "guest"
      ? submitted
      : current.some(
          (event) => event.action === "submit" && event.result === "login" && !event.signedIn,
        );
  const rosterChecked = current.some(
    (event) =>
      event.action === "roster" &&
      event.result === activity.target.roster &&
      (activity.target.access === "guest" || event.signedIn),
  );
  return {
    passed: !missing.length && !mismatches.length && submitted && accessChecked && rosterChecked,
    missing,
    mismatches,
    submitted,
    accessChecked,
    rosterChecked,
  };
}
