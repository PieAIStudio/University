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
  COUNTDOWN_SECONDS,
  MAX_ROUNDS,
  RoundGame,
  type PlayRound,
  type RoundAction,
  type RoundEvent,
  type RoundGameState,
  type RoundNotice,
  type RoundPhase,
  type RoundSource,
} from "./rules/round-game.js";
export {
  InterceptSession,
  type InterceptAction,
  type InterceptEvent,
  type InterceptNotice,
  type InterceptPhase,
  type InterceptRound,
  type InterceptState,
} from "./rules/intercept.js";
export { InterceptScene, type InterceptSceneProps } from "./InterceptScene.js";
export {
  LinksSession,
  SETTLE_SECONDS,
  linkSeconds,
  type LinkBridge,
  type LinksAction,
  type LinksEvent,
  type LinksState,
  type Stone,
} from "./rules/links.js";
export { LinksScene, stoneSpots, type LinksSceneProps } from "./LinksScene.js";
