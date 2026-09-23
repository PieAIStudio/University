/**
 * The 3D learning game kit (ADR-0011): rules and scene blocks, plus the games
 * assembled from them. The frame (HUD) lives in `@pieai/university-ui`; the
 * content projection in `@pieai/university-core`.
 */
export { GameSession, STEP_SECONDS, seededRandom, shuffled } from "./rules/session.js";
export {
  MAX_HEARTS,
  START_HEARTS,
  UPGRADES,
  type ItemOutcome,
  type LogEntry,
  type RunState,
  type UpgradeId,
} from "./rules/run.js";
export {
  InterceptSession,
  MAX_ROUNDS,
  type InterceptAction,
  type InterceptEvent,
  type InterceptNotice,
  type InterceptPhase,
  type InterceptRound,
  type InterceptState,
} from "./rules/intercept.js";
export { InterceptScene, type InterceptSceneProps } from "./InterceptScene.js";
