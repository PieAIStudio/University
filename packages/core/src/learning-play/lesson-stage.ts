import type { PrimmPhase } from "./primm.js";

/**
 * Where a step lesson is, for its 3D stage (V7 amendment one): the reader says,
 * the stage follows. The lesson never waits for the stage, so a cue carries
 * only what has already happened.
 */
export type LessonStageScene = "intro" | PrimmPhase | "finish";

export interface LessonStageCue {
  readonly scene: LessonStageScene;
  /** The current step's action; absent on the opening and the ending. */
  readonly action?: string;
  /** Counts the learner's settled actions; the stage reacts when it changes. */
  readonly beat: number;
  /** The latest settled action's verdict, when it had one. */
  readonly verdict?: "ok" | "no";
}
