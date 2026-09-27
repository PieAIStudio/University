import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { islandLookFrozen } from "../island/island-surface-style.js";
import { hash } from "../island/random.js";
import { useKitModels } from "../kit.js";
import { usePrefersReducedMotion } from "../reduced-motion.js";
import { bakeMonsterPose } from "./monster-pose.js";

/**
 * Cards about to be forgotten come back to the island (V7 decision O1): a small
 * glimmer wisp floats over each cleared stone whose review cards are due, and a
 * purple ring circles that stone. Reviewing the cards sends them away; the map
 * reads "your island has visitors" rather than "you have 3 cards due".
 *
 * A handful at most, so they bob and turn every frame; one instanced draw per
 * part of the model, one for the rings.
 */

/** The wisp's height in world units (the learner is 1.8). */
export const WISP_HEIGHT = 0.8;
/** How high it floats above its stone's top. */
const HOVER = 0.9;
const RING_COLOUR = 0xb07bff;

export interface WispSpot {
  readonly id: string;
  /** The top of the cleared stone it has come back to. */
  readonly at: THREE.Vector3;
  /** The stone's radius, for the ring. */
  readonly radius: number;
}

export function WispField({ spots }: { readonly spots: readonly WispSpot[] }) {
  const [gltf] = useKitModels(["wisp"]);
  const baked = useMemo(() => bakeMonsterPose(gltf!.scene, gltf!.animations), [gltf]);
  useEffect(
    () => () => {
      for (const part of baked.parts) {
        part.geometry.dispose();
        if (part.owned) part.material.dispose();
      }
    },
    [baked],
  );
  const ring = useMemo(() => {
    const geometry = new THREE.RingGeometry(1.08, 1.32, 48);
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }, []);
  const ringMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: RING_COLOUR,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  useEffect(
    () => () => {
      ring.dispose();
      ringMaterial.dispose();
    },
    [ring, ringMaterial],
  );

  const parts = useRef<(THREE.InstancedMesh | null)[]>([]);
  const rings = useRef<THREE.InstancedMesh>(null);
  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      turn: new THREE.Quaternion(),
      size: new THREE.Vector3(),
      at: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
    }),
    [],
  );
  const place = (seconds: number, still: boolean) => {
    spots.forEach((spot, slot) => {
      const phase = hash(`${spot.id}:wisp`) * Math.PI * 2;
      const bob = still ? 0 : Math.sin(seconds * 1.6 + phase) * 0.12;
      scratch.at.copy(spot.at).setY(spot.at.y + HOVER + bob);
      scratch.turn.setFromAxisAngle(scratch.up, still ? phase : seconds * 0.6 + phase);
      scratch.size.setScalar(WISP_HEIGHT);
      scratch.matrix.compose(scratch.at, scratch.turn, scratch.size);
      for (const mesh of parts.current) mesh?.setMatrixAt(slot, scratch.matrix);
      scratch.at.copy(spot.at).setY(spot.at.y + 0.03);
      scratch.turn.identity();
      scratch.size.setScalar(spot.radius * (still ? 1 : 1 + Math.sin(seconds * 2 + phase) * 0.04));
      rings.current?.setMatrixAt(
        slot,
        scratch.matrix.compose(scratch.at, scratch.turn, scratch.size),
      );
    });
    for (const mesh of [...parts.current, rings.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  };
  const reducedMotion = usePrefersReducedMotion();
  useLayoutEffect(() => {
    place(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots, baked]);
  useFrame(({ clock }) => {
    if (reducedMotion || islandLookFrozen() || !spots.length) return;
    place(clock.elapsedTime, false);
    ringMaterial.opacity = 0.6 + 0.25 * Math.sin(clock.elapsedTime * 2);
  });

  if (!spots.length) return null;
  return (
    <group name="course-review-wisps">
      {baked.parts.map((part, index) => (
        <instancedMesh
          key={`${index}:${spots.length}`}
          ref={(node) => {
            parts.current[index] = node;
          }}
          args={[part.geometry, part.material, spots.length]}
          frustumCulled={false}
          raycast={() => {}}
        />
      ))}
      <instancedMesh
        key={`rings:${spots.length}`}
        ref={rings}
        args={[ring, ringMaterial, spots.length]}
        renderOrder={2}
        frustumCulled={false}
        raycast={() => {}}
      />
    </group>
  );
}
