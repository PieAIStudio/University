import type { ReactNode } from "react";
import type { PrimmStep, PrimmStepOf } from "@pieai/university-core";
import type { useI18n } from "../../i18n/index.js";
import type { LessonAssetView } from "../../view/lesson-view.js";
import type { StepsSession } from "../primm-steps-session.js";
import type { PrimmLessonProps, PrimmStepsActivity, PrimmWork } from "../primm-types.js";

/*
 * What one step screen needs from the lesson, written down.
 *
 * Each step kind lives in its own file and draws one screen from this context.
 * Everything that touches the network, a timer or the saved draft stays in the
 * shell (`PrimmSteps.tsx`) and reaches a step only as a function here, so a
 * step file is a renderer and a judge of its own action, nothing more.
 */

export type Tone = "good" | "bad" | "info";
export interface Feedback {
  readonly tone: Tone;
  readonly title: string;
  readonly text?: string;
}
export type Busy = "run" | "evaluate" | "complete" | null;

/** The bar's one forward action. A step that does not set it keeps the shell's Continue. */
export interface Primary {
  readonly label: string;
  readonly enabled: boolean;
  readonly onClick: () => void;
}

/** One step screen: its body, and the two things the shell around it shows. */
export interface StepView {
  readonly body: ReactNode;
  readonly primary?: Primary | undefined;
  /** The 看演示 gesture, also played once on a first visit. */
  readonly demo?: (() => void) | undefined;
}

export interface StepContext {
  readonly t: ReturnType<typeof useI18n>["t"];
  readonly activity: PrimmStepsActivity;
  readonly steps: readonly PrimmStep[];
  readonly session: StepsSession;
  readonly screen: number;
  readonly headingId: string;
  readonly busy: Busy;
  readonly error: string;
  readonly starterImage: string | undefined;

  readonly update: (patch: Partial<StepsSession>) => void;
  readonly go: (index: number) => void;
  /** The step's action settled: mark it done, play its sound and show the teacher's line. */
  readonly finishStep: (id: string, result: Feedback) => void;
  /** A wrong try that does not finish the step: a short toast and a 'no' beat for the stage. */
  readonly miss: (message: string) => void;
  /** A settled beat for the stage without a toast (the sort step plays its own sounds). */
  readonly pulse: (verdict: "ok" | "no", bin?: number) => void;
  readonly setFeedback: (feedback: Feedback | null) => void;
  /** For a step whose demonstration is set by a child component during its own render. */
  readonly setDemo: (play: () => void) => void;

  /** Really run prepared or learner text once; the result is kept per request key. */
  readonly execute: (
    key: string,
    phase: "run" | "modify" | "make",
    prompt: string,
  ) => Promise<PrimmWork | null>;
  readonly cancel: () => void;
  /** Grade the learner's own work (refresh asks again for an undecided verdict). */
  readonly evaluate: (refresh?: boolean) => Promise<void>;
  readonly refreshPrimmEvaluation: PrimmLessonProps["refreshPrimmEvaluation"];
  readonly copyPrimmEvaluation: PrimmLessonProps["copyPrimmEvaluation"];

  /** The request a send step runs, as a key and its exact text. */
  readonly requestOf: (send: PrimmStepOf<"send">) => { key: string; prompt: string } | null;
  /** The most recent real run before a step, whichever send produced it. */
  readonly latestRun: (before: number) => PrimmWork | undefined;
  readonly asset: (id: string) => LessonAssetView | undefined;
  readonly photoUrl: (id: string) => string | undefined;
  /** Text materials, open where they are read and folded where they only remind. */
  readonly notes: (ids: readonly string[], open: boolean) => ReactNode;
}
