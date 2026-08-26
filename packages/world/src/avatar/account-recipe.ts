import {
  deserializeAvatarRecipe,
  serializeAvatarRecipe,
  type AvatarRecipe,
} from "@pieai/swimmer-avatar-kit";

/**
 * Account data stays renderer-agnostic: it stores the kit's versioned envelope
 * as a string, while the world is the only place that turns it back into a
 * recipe. A malformed or old value should show the stable guest avatar, not
 * make the learner's map fail to render.
 */
export function avatarRecipeFromAccount(value: string | null | undefined): AvatarRecipe | null {
  if (!value) return null;
  try {
    return deserializeAvatarRecipe(value);
  } catch {
    return null;
  }
}

export function avatarRecipeForAccount(recipe: AvatarRecipe): string {
  return serializeAvatarRecipe(recipe);
}
