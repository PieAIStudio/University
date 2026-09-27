import { Avatar } from "@pieai/swimmer-avatar-kit/react-three-fiber";
import { useFrame } from "@react-three/fiber";
import type { AvatarHandle, AvatarRecipe } from "@pieai/swimmer-avatar-kit";
import { useEffect, useMemo, useRef } from "react";
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
 * chooses the account recipe and asks the kit to fit it to one display height,
 * so a recipe with a different body or biped stance remains the learner's
 * actual avatar.
 */
export function PlayerMarker({
  position,
  recipe,
  signedIn = false,
  faceToward = null,
  onAvatar,
}: {
  readonly position: THREE.Vector3;
  readonly recipe?: AvatarRecipe | null;
  readonly signedIn?: boolean;
  /** Turn to face this world point instead of the camera (throwing at a monster). */
  readonly faceToward?: THREE.Vector3 | null;
  /** The kit's handle once built, for one-shot actions such as `throw`. */
  readonly onAvatar?: (avatar: AvatarHandle | null) => void;
}) {
  const marker = useRef<THREE.Group>(null);
  const worldPosition = useMemo(() => new THREE.Vector3(), []);
  const guest = useMemo(() => guestAvatarRecipe(), []);
  const shown = signedIn && recipe ? recipe : guest;
  const avatarCallback = useRef(onAvatar);
  avatarCallback.current = onAvatar;
  useEffect(() => () => avatarCallback.current?.(null), []);

  useFrame(({ camera }) => {
    const node = marker.current;
    if (!node) return;
    node.getWorldPosition(worldPosition);
    // Placement orientation, not a competing avatar animation. Kit-owned
    // gaze/blink/breath still run inside this group unchanged.
    const toward = faceToward ?? camera.position;
    node.rotation.y = Math.atan2(toward.x - worldPosition.x, toward.z - worldPosition.z);
  });

  return (
    <group ref={marker} name={AVATAR_OCCLUSION_TARGET} position={position}>
      <Avatar
        recipe={shown}
        gaze
        quality="compact"
        height={PLAYER_MARKER_HEIGHT}
        onBuilt={onAvatar}
      />
    </group>
  );
}
