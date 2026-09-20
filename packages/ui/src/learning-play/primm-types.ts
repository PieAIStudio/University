import type { GradingPort, LearningActivitySpec, LessonRef } from "@pieai/university-core";
import type { LessonAssetView } from "../view/lesson-view.js";

export type PrimmActivity = Extract<LearningActivitySpec, { kind: "primm" }>;
/** One screen per phase (versions 1–2). */
export type PrimmClassicActivity = Exclude<PrimmActivity, { experienceVersion: 3 }>;
/** One action per screen inside the five phases (version 3). */
export type PrimmStepsActivity = Extract<PrimmActivity, { experienceVersion: 3 }>;
export type RunPrimm = (
  input: Parameters<NonNullable<GradingPort["executePrimm"]>>[0],
  signal: AbortSignal,
) => ReturnType<NonNullable<GradingPort["executePrimm"]>>;
export type PrimmOutput = Awaited<ReturnType<RunPrimm>>;
export interface PrimmEvaluation {
  readonly outcome: "pass" | "fail" | "undecided";
  readonly explanation: string;
}
export interface PrimmWork {
  readonly request: Parameters<RunPrimm>[0];
  readonly result: PrimmOutput;
  readonly finalWork?: string;
}
export interface PrimmLessonProps {
  readonly activity: PrimmActivity;
  readonly assets?: readonly LessonAssetView[];
  readonly lessonRef?: LessonRef;
  readonly contentRevision?: number;
  readonly answerDraftScope?: string;
  readonly runPrimm?: RunPrimm;
  readonly evaluatePrimm?: (work: PrimmWork, signal: AbortSignal) => Promise<PrimmEvaluation>;
  readonly refreshPrimmEvaluation?: (
    work: PrimmWork,
    signal: AbortSignal,
  ) => Promise<PrimmEvaluation>;
  readonly copyPrimmEvaluation?: () => Promise<void>;
  readonly onPrimmComplete?: (signal: AbortSignal) => Promise<void>;
  readonly onPathProgress?: (completed: number) => void;
}
