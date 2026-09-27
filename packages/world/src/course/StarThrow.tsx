import { useFrame } from "@react-three/fiber";
import type { AvatarHandle } from "@pieai/swimmer-avatar-kit";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { islandLookFrozen } from "../island/island-surface-style.js";
import { roundedStarGeometry } from "./hero-chest.js";
import { OpeningParticles } from "./opening-particles.js";

/**
 * The knowledge star (V7 decision P1): it rises from the opened chest to the
 * learner's hand, the avatar throws it, and it bursts into starlight on the
 * next stop's monster. The segment's boss takes three.
 *
 * All timing is relative to `started`; the avatar's own `throw` action is
 * started so that its release beat lands exactly when the star leaves the hand.
 */

/** Seconds for a star to rise from the chest into the hand. */
export const STAR_RISE = 0.55;
/** Seconds of flight from hand to monster. */
export const STAR_FLIGHT = 0.75;
/** Seconds between the stars thrown at a boss. */
export const STAR_GAP = 0.6;
/** Held in the hand, this far above the avatar's feet. */
const HAND_HEIGHT = 1.15;

export type ThrowEvent =
  | { readonly kind: "release"; readonly star: number }
  | { readonly kind: "impact"; readonly star: number; readonly last: boolean }
  | { readonly kind: "done" };

/** Seconds from the start at which each star leaves the hand and lands. */
export function throwSchedule(stars: number) {
  return Array.from({ length: stars }, (_, star) => {
    const release = STAR_RISE + star * STAR_GAP;
    return { release, impact: release + STAR_FLIGHT };
  });
}

export function StarThrow({
  from,
  avatarAt,
  target,
  stars = 1,
  started,
  avatar,
  onEvent,
}: {
  /** The opened chest's mouth, world space. */
  readonly from: THREE.Vector3;
  /** The avatar's feet, world space. */
  readonly avatarAt: THREE.Vector3;
  /** Where the star lands: the monster's middle, world space. */
  readonly target: THREE.Vector3;
  readonly stars?: number;
  readonly started: boolean;
  readonly avatar: { readonly current: AvatarHandle | null };
  readonly onEvent?: (event: ThrowEvent) => void;
}) {
  const geometry = useMemo(() => {
    const star = roundedStarGeometry(0.2, 0.095, 0.06, 0.03);
    star.center();
    return star;
  }, []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xffd84d,
        emissive: 0xffb300,
        emissiveIntensity: 0.9,
        roughness: 0.3,
        metalness: 0.2,
      }),
    [],
  );
  const burst = useMemo(() => new OpeningParticles(11), []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      burst.dispose();
    },
    [geometry, material, burst],
  );
  const schedule = useMemo(() => throwSchedule(stars), [stars]);
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const clock = useRef({ t: 0, next: 0, thrown: -1 });
  const report = useRef(onEvent);
  report.current = onEvent;
  useEffect(() => {
    clock.current = { t: 0, next: 0, thrown: -1 };
  }, [started]);

  const hand = useMemo(() => new THREE.Vector3(), []);
  const point = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, delta) => {
    if (!started) {
      for (const mesh of meshes.current) if (mesh) mesh.visible = false;
      return;
    }
    const state = clock.current;
    state.t += islandLookFrozen() ? 0 : Math.min(delta, 0.05);
    const t = state.t;
    // The hand: at shoulder height, a step toward the target from the feet.
    hand
      .copy(target)
      .sub(avatarAt)
      .setY(0)
      .normalize()
      .multiplyScalar(0.35)
      .add(avatarAt)
      .setY(avatarAt.y + HAND_HEIGHT);
    schedule.forEach((star, index) => {
      const mesh = meshes.current[index];
      if (!mesh) return;
      const riseStart = star.release - STAR_RISE;
      // Start the throw so its release beat lands on the star's release.
      const beat = 0.29;
      if (index > state.thrown && t >= star.release - beat) {
        state.thrown = index;
        avatar.current?.play("throw");
      }
      if (t < riseStart || t > star.impact) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      if (t < star.release) {
        const k = (t - riseStart) / STAR_RISE;
        const eased = 1 - (1 - k) ** 3;
        point.lerpVectors(from, hand, eased);
        point.y += Math.sin(k * Math.PI) * 0.6;
        mesh.scale.setScalar(0.4 + 0.6 * eased);
      } else {
        const k = (t - star.release) / STAR_FLIGHT;
        point.lerpVectors(hand, target, k);
        point.y += Math.sin(k * Math.PI) * 1.2;
        mesh.scale.setScalar(1);
      }
      mesh.position.copy(point);
      mesh.rotation.z = t * 9;
      mesh.rotation.y = t * 4;
    });
    // Fire due events in order.
    while (state.next < schedule.length * 2) {
      const index = Math.floor(state.next / 2);
      const star = schedule[index]!;
      const releasing = state.next % 2 === 0;
      const at = releasing ? star.release : star.impact;
      if (t < at) break;
      state.next += 1;
      if (releasing) report.current?.({ kind: "release", star: index });
      else {
        burst.group.position.copy(target);
        burst.spray(28, 0.7, 0, 0xfff0a8, false);
        report.current?.({ kind: "impact", star: index, last: index === schedule.length - 1 });
        if (index === schedule.length - 1) report.current?.({ kind: "done" });
      }
    }
    burst.update(Math.min(delta, 0.05));
  });

  return (
    <group name="course-star-throw">
      {schedule.map((_, index) => (
        <mesh
          key={index}
          ref={(node) => {
            meshes.current[index] = node;
          }}
          geometry={geometry}
          material={material}
          visible={false}
          raycast={() => {}}
        />
      ))}
      <primitive object={burst.group} />
    </group>
  );
}
