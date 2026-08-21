/**
 * The words and the sound decision the star button is a renderer of.
 *
 * Kept out of the component so the Chinese label and "only make a noise when
 * favouriting" can be tested without mounting a button. Un-favouriting is
 * silent on purpose: taking a star off is undoing a small commitment, not a
 * second event that needs its own chime.
 */

export function favouriteStarLabel(pressed: boolean, headword?: string): string {
  const trimmed = headword?.trim() ?? "";
  const target = trimmed.length > 0 ? `「${trimmed}」` : "这个词义";
  return pressed ? `取消收藏${target}` : `收藏${target}`;
}

/** True only on the press that puts the sense onto the list. */
export function shouldPlayFavouriteSound(willFavourite: boolean): boolean {
  return willFavourite;
}
