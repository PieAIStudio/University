import type { View } from "../url-state";

/**
 * Which routes render the world behind them.
 *
 * The camera, the flight and the label projector used to live here too, and
 * `packages/world` held a second copy of all three. They are one thing now,
 * in the package, and this file keeps only the part that is genuinely the
 * delivery shell's: a routing decision about its own `View` union, which the
 * scene has no business knowing.
 */
export const SHOWS_THE_MAP = new Set<View["kind"]>(["world", "course"]);
