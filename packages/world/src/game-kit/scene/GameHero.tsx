import { Avatar } from "@pieai/swimmer-avatar-kit/react-three-fiber";
import type {
  AvatarAction,
  AvatarExpression,
  AvatarHandle,
  AvatarRecipe,
} from "@pieai/swimmer-avatar-kit";
import { useFrame } from "@react-three/fiber";
import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";

import { guestAvatarRecipe } from "../../avatar/default-recipe.js";

/**
 * The learner's own avatar as a game's hero (ADR-0011, scene layer; Owner
 * 2026-09-23: "the character who chose the lesson on the map plays it").
 *
 * The same recipe the map shows, at a game's height; the kit (0.7) supplies
 * the moves. A game tells the hero where to look and what to do; the hero
 * turns smoothly, plays the kit action, and wears an expression for a moment
 * before going back to idle. Reduced motion keeps every action but at a
 * third of its size.
 */
export interface GameHeroHandle {
  /** Turn to face a world point; `null` faces the camera. */
  look(target: THREE.Vector3 | null): void;
  act(action: AvatarAction, options?: { speed?: number }): void;
  feel(expression: AvatarExpression, seconds?: number): void;
}

export const GameHero = forwardRef<
  GameHeroHandle,
  {
    readonly position: readonly [number, number, number];
    readonly recipe?: AvatarRecipe | null;
    readonly height?: number;
    readonly reducedMotion?: boolean;
    readonly paused?: boolean;
  }
>(function GameHero(
  { position, recipe, height = 1.6, reducedMotion = false, paused = false },
  ref,
) {
  const group = useRef<THREE.Group>(null);
  const feet = useRef<THREE.Group>(null);
  const avatar = useRef<AvatarHandle>(null);
  const guest = useMemo(() => guestAvatarRecipe(), []);
  const shown = recipe ?? guest;
  const facing = useRef<THREE.Vector3 | null>(null);
  const yaw = useRef(Math.PI);
  const mood = useRef<{ until: number } | null>(null);
  const clock = useRef(0);
  const world = useMemo(() => new THREE.Vector3(), []);

  useImperativeHandle(
    ref,
    () => ({
      look(target) {
        facing.current = target ? target.clone() : null;
      },
      act(action, options) {
        avatar.current?.play(action, {
          strength: reducedMotion ? 0.35 : 1,
          ...(options?.speed ? { speed: options.speed } : {}),
        });
      },
      feel(expression, seconds = 0.9) {
        avatar.current?.setExpression(expression);
        mood.current = { until: clock.current + seconds };
      },
    }),
    [reducedMotion],
  );

  useFrame(({ camera }, delta) => {
    if (paused) return;
    clock.current += delta;
    const node = group.current;
    if (!node) return;
    node.getWorldPosition(world);
    const target = facing.current ?? camera.position;
    // The kit's avatar faces +z; turn it toward the target on the ground plane.
    const wanted = Math.atan2(target.x - world.x, target.z - world.z);
    let turn = wanted - yaw.current;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    yaw.current += turn * (1 - Math.exp(-delta * (reducedMotion ? 30 : 12)));
    node.rotation.y = yaw.current;
    if (mood.current && clock.current >= mood.current.until) {
      mood.current = null;
      avatar.current?.setExpression("idle");
    }
  });

  return (
    <group ref={group} position={position} name="game-hero">
      {/* The kit reports its support datum in our units; stand it on the step. */}
      <group ref={feet}>
        <Avatar
          ref={avatar}
          recipe={shown}
          gaze={false}
          quality="compact"
          height={height}
          paused={paused}
          onBuilt={(built) => {
            if (feet.current) feet.current.position.y = -built.rig.groundY;
          }}
        />
      </group>
    </group>
  );
});
