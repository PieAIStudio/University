/**
 * A phone is not a small desktop.
 *
 * The clamp is the cheap half of the rule; the tier is the half that matters.
 * A retina phone at DPR 3 renders nine times the pixels of DPR 1 for a map made
 * of flat discs, which buys nothing and costs the frame budget the rest of the
 * lesson needs. AO and clouds both ask this so a 375-wide window is one
 * decision, not two.
 */
export function renderTier() {
  const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  const small =
    typeof window !== "undefined" && Math.min(window.innerWidth, window.innerHeight) < 720;
  return coarse || small ? ("mobile" as const) : ("desktop" as const);
}
