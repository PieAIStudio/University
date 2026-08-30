/**
 * The avatar as it appears in the app's chrome, at two sizes and two moods.
 *
 * It lives here and not in `packages/ui` because it is three.js, and
 * `packages/ui` is held at zero `three` on purpose — a test of the lesson
 * reader must never have to stand up a WebGL mock. Both shells import it from
 * here, so there is one avatar, not one per shell.
 *
 * The signed-out state is the design decision worth explaining. A greyed-out
 * silhouette is the conventional answer and it says nothing: it reads as a
 * disabled control, and disabled controls are things you learn to ignore. This
 * one is a creature who is present and has not turned around yet — mostly the
 * back of its head, with an occasional glance over the shoulder. That is a
 * legible invitation without a word of copy, and it survives being seen a
 * hundred times, which "点击登录" does not.
 */
import { Avatar } from "@pieai/swimmer-avatar-kit/react-three-fiber";
import type { AvatarHandle, AvatarRecipe } from "@pieai/swimmer-avatar-kit";
import { useMemo } from "react";

import { guestAvatarRecipe } from "./default-recipe.js";

/**
 * The app chrome uses the kit's own idle animation in both identity states.
 *
 * SwimmerAvatarKit remains the sole owner of blink, gaze, expression and
 * breathing updates; University only supplies the selected recipe.
 * The scene marker uses the same component and recipe selection.
 */

export function AvatarBust({
  recipe,
  signedIn = false,
  onBuilt,
}: {
  /** The learner's own creature. Omitted while signed out. */
  readonly recipe?: AvatarRecipe;
  readonly signedIn?: boolean;
  /** Fires once the geometry exists, so a caller can frame it. */
  readonly onBuilt?: (avatar: AvatarHandle) => void;
}) {
  const guest = useMemo(() => guestAvatarRecipe(), []);
  const shown = signedIn && recipe ? recipe : guest;

  // Both states use the kit's own life animation. The guest is a stable recipe;
  // signed-in learners replace it with the recipe saved in account data.
  return <Avatar recipe={shown} gaze quality="compact" onBuilt={onBuilt} />;
}
