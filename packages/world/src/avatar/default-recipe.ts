/**
 * The face a signed-out learner sees, and why it is a specific one.
 *
 * `randomRecipe()` is what the avatar lab uses, and it is wrong here for a
 * reason that only shows up on the second page load: a default that rerolls is
 * not a character, it is noise. Somebody who saw a bear this morning and a
 * slime this afternoon has not met anyone, and replacing it with their own
 * avatar stops being an event.
 *
 * The kit's generator takes a seed and nothing else — species falls out of the
 * seed rather than being selectable — so this is a seed that was searched for
 * rather than a species that was asked for. `university:guest:2` is the first
 * seed in this namespace that yields a bunny.
 *
 * Bunny, out of the nine species, because this avatar spends most of its life
 * facing away (see `AvatarBust`). From behind, a bear and a cat are the same
 * round shape; ears that stick up are a silhouette you can recognise before
 * anything turns around, and peeking over a shoulder is a gesture that already
 * belongs to a rabbit. It also has to be friendly — this is the first moving
 * thing a beginner sees, and `monster` and `robot` each say something about
 * the product that is not true.
 */
import { completeRecipe, randomRecipe, type AvatarRecipe } from "@pieai/swimmer-avatar-kit";

/**
 * Stable across reloads, machines and sessions.
 *
 * Versioned in the string so that changing the guest avatar later is a visible
 * edit rather than a silent reroll — and so this file explains, at the point of
 * change, that it is changing a character people have met.
 */
export const GUEST_AVATAR_SEED = "university:guest:96";

let cached: AvatarRecipe | null = null;

/** The guest creature. Built once; the geometry behind it is not cheap. */
export function guestAvatarRecipe(): AvatarRecipe {
  cached ??= completeRecipe(randomRecipe(GUEST_AVATAR_SEED));
  return cached;
}
