/** Lightweight shared identities; importing a standalone 3D route must not
 * import the entire native two-dimensional component registry.
 *
 * Every 3D game is assembled from the game kit (ADR-0011): questions from the
 * lessons, the learner's avatar plays. The garden editions, the factory and
 * workshop scenes and the flat arcades before them were deleted on 2026-10-01
 * (Owner G3; their screenshots stay in the interaction-components album). */
export const THREE_GAMES = ["courtyard", "links", "snake", "moles", "runner", "blocks"] as const;
export type ThreeGame = (typeof THREE_GAMES)[number];
