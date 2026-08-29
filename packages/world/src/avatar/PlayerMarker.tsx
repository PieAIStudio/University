import { Avatar } from "@pieai/swimmer-avatar-kit/react-three-fiber";
import type { AvatarHandle, AvatarRecipe } from "@pieai/swimmer-avatar-kit";
import { useCallback, useMemo, useRef } from "react";
import * as THREE from "three";

import { guestAvatarRecipe } from "./default-recipe.js";
import { AVATAR_OCCLUSION_TARGET } from "./avatar-occlusion.js";

/** The marker is large enough to read beside a lesson stone, across recipes. */
export const PLAYER_MARKER_HEIGHT = 1.8;

/**
 * The one player marker used by both map levels.
 *
 * It deliberately delegates the frame loop to SwimmerAvatarKit's `<Avatar>`:
 * the kit owns blinking, gaze, expressions and breathing. This component only
 * chooses the account recipe and normalises its display height, so a recipe
 * with a different body or biped stance remains the learner's actual avatar.
 */
export function PlayerMarker({
  position,
  recipe,
  signedIn = false,
}: {
  readonly position: THREE.Vector3;
  readonly recipe?: AvatarRecipe | null;
  readonly signedIn?: boolean;
}) {
  const marker = useRef<THREE.Group>(null);
  const guest = useMemo(() => guestAvatarRecipe(), []);
  const shown = signedIn && recipe ? recipe : guest;
  const onBuilt = useCallback((avatar: AvatarHandle) => {
    const node = marker.current;
    if (!node || avatar.bounds.h <= 0) return;
    node.scale.setScalar(PLAYER_MARKER_HEIGHT / avatar.bounds.h);
  }, []);

  return (
    <group ref={marker} name={AVATAR_OCCLUSION_TARGET} position={position}>
      <Avatar recipe={shown} gaze onBuilt={onBuilt} />
    </group>
  );
}
