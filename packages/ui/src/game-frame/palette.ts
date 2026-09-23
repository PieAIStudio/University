/**
 * The colours a game gives its answer bins (ADR-0011).
 *
 * One list for both halves: the frame paints its answer buttons with it and
 * the scene paints its baskets and balls with it, so button two and basket two
 * can never drift apart. Colour is never the only cue — every button and
 * basket also carries its label and number.
 */
export const BIN_COLOURS = ["#73b6a1", "#739ec6", "#f2c963"] as const;
/** Text on a bin colour; each pair clears 4.5:1. */
export const BIN_INK = "#1d3336";

export function binColour(index: number): string {
  return BIN_COLOURS[index % BIN_COLOURS.length]!;
}
