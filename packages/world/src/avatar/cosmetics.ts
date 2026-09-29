import { fillRecipe, type AvatarRecipe } from "@pieai/swimmer-avatar-kit";
import { guestAvatarRecipe } from "./default-recipe.js";

/** Product unlock ids select the published kit's existing hat parameters.
 * They do not replace the user's stored recipe or add another avatar renderer. */
const HATS = {
  "avatar-flower": { style: "flower", accIx: 2 },
  "avatar-bow": { style: "bow", accIx: 4 },
  "avatar-beanie": { style: "beanie", accIx: 3 },
  "avatar-crown": { style: "crown", accIx: 2 },
  "avatar-set-band": { style: "band", accIx: 4 },
} as const;
export function cosmeticAvatarRecipe(base: AvatarRecipe | null, id?: string): AvatarRecipe | null {
  if (!id || !Object.hasOwn(HATS, id)) return base;
  const recipe = base ?? guestAvatarRecipe();
  const hat = HATS[id as keyof typeof HATS];
  const previous = recipe.parts.hat?.params;
  const parameters =
    previous !== null && typeof previous === "object" && !Array.isArray(previous) ? previous : {};
  return fillRecipe({
    ...recipe,
    parts: { ...recipe.parts, hat: { ...recipe.parts.hat, params: { ...parameters, ...hat } } },
  });
}
