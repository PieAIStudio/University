/** Lightweight shared identities; importing a standalone 3D route must not
 * import the entire native two-dimensional component registry. */
export const THREE_GAMES = [
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
