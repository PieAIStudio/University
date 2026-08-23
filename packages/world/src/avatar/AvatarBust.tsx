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
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { guestAvatarRecipe } from "./default-recipe.js";

/** Facing straight away from the camera. */
const AWAY = Math.PI;
/**
 * How far it turns to peek — about 66°, which is a shoulder-glance rather than
 * a turn. Past roughly 90° it stops reading as "caught looking" and becomes
 * simply facing you, and the whole point is that it has *not* turned around.
 */
const PEEK = Math.PI - 1.15;
/** Seconds it holds the glance before turning back. */
const PEEK_HOLD = 1.3;
/** Seconds between glances. A range, not a period — see below. */
const GAP = { min: 4.5, max: 9.5 } as const;

/**
 * Damping rate for the turn. Higher is snappier.
 *
 * `THREE.MathUtils.damp` rather than a linear lerp on delta: lerp with a fixed
 * factor is framerate-dependent, so the same animation is faster on a 120Hz
 * screen than on a 60Hz one. `damp` is the frame-rate-independent form.
 */
const TURN_RATE = 4.2;

function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ShyCreature({
  recipe,
  onBuilt,
}: {
  recipe: AvatarRecipe;
  onBuilt?: (avatar: AvatarHandle) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const state = useRef({ peeking: false, until: 0, clock: 0 });

  /*
    Timing is the one thing here that is deliberately not seeded.

    Everywhere else in this package randomness is banned — a layout keyed to
    `Math.random` moves a learner's island between visits, and that is a real
    defect. This is the opposite case: a glance on a fixed period is a metronome,
    and a metronome is the thing that makes an animation read as a loop rather
    than as something alive. Nothing depends on reproducing it.
  */
  const nextGap = () => GAP.min + Math.random() * (GAP.max - GAP.min);

  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    const own = state.current;
    own.clock += delta;
    if (own.clock >= own.until) {
      own.peeking = !own.peeking;
      own.until = own.clock + (own.peeking ? PEEK_HOLD : nextGap());
    }
    node.rotation.y = THREE.MathUtils.damp(
      node.rotation.y,
      own.peeking ? PEEK : AWAY,
      TURN_RATE,
      delta,
    );
  });

  return (
    <group ref={group} rotation-y={AWAY}>
      <Avatar recipe={recipe} onBuilt={onBuilt} />
    </group>
  );
}

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

  /*
    Reduced motion does not mean "hold the pose it happened to be in". Freezing
    the shy state leaves a permanent back of a head, which is worse than the
    animation it replaced — the invitation becomes a bug. So the still frame is
    the three-quarter view: you can see it is a creature, and you can see it is
    not you.
  */
  if (!signedIn && prefersReducedMotion()) {
    return (
      <group rotation-y={PEEK}>
        <Avatar recipe={guest} onBuilt={onBuilt} />
      </group>
    );
  }

  if (!signedIn) return <ShyCreature recipe={guest} onBuilt={onBuilt} />;
  // Signed in: face front, and let the kit's own gaze follow the pointer.
  return <Avatar recipe={shown} gaze onBuilt={onBuilt} />;
}
