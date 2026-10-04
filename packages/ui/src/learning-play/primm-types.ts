import type {
  GradingPort,
  LearningActivitySpec,
  LessonRef,
  LessonStageCue,
} from "@pieai/university-core";
import type { ReactNode } from "react";
import type { LessonAssetView } from "../view/lesson-view.js";

export type PrimmActivity = Extract<LearningActivitySpec, { kind: "primm" }>;
/** One action per screen inside the five phases (version 3). */
export type PrimmStepsActivity = PrimmActivity;
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
  /**
   * The lesson's 3D stage (V7 amendment one), drawn by the host above the
   * step. This package never draws it: it only says where the lesson is.
   */
  readonly renderStage?: (cue: LessonStageCue) => ReactNode;
  /**
   * The lesson finished with a 「今天就能做的小事」: the host keeps its words so
   * 「用了吗？」 can be asked on a later day (V7 amendment one).
   */
  readonly onTryToday?: (task: string) => void;
}
