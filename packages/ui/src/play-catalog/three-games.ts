/** Lightweight shared identities; importing a standalone 3D route must not
 * import the entire native two-dimensional component registry.
 *
 * Adding an id here is half of adding a game. The other half is a scene in
 * `@pieai/university-world`, and `toy-play/three-game-lock.ts` there is what
 * makes the two halves fail together instead of drifting apart — which they
 * had, in both directions at once. Three ids below have finished copy in both
 * locales and no scene at all; the lock names them so the gap is counted, and
 * it refuses to let a fourth join them unnoticed. */
export const THREE_GAMES = [
  "courtyard",
  "links",
  "sky-invaders",
  "factory-stack",
  "press-words",
  "slice",
  "wire",
  "rank",
  "invaders",
  "stack",
  "cloze-tetris",
] as const;
export type ThreeGame = (typeof THREE_GAMES)[number];

/** Assembled from the game kit (ADR-0011): questions from the lessons, the learner's avatar plays. */
export const KIT_THREE_GAMES = ["courtyard", "links"] as const satisfies readonly ThreeGame[];
export type KitThreeGame = (typeof KIT_THREE_GAMES)[number];
