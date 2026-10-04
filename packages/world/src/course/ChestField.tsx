import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { islandLookFrozen } from "../island/island-surface-style.js";
import { usePrefersReducedMotion } from "../reduced-motion.js";
import {
  CHEST_COLOURS,
  CHEST_HEIGHT,
  CHEST_WIDTH,
  buildChestGeometry,
  composeChestMatrix,
  composeLidMatrix,
} from "./chest-geometry.js";
import type { ChestTier, CourseChest } from "./chests-and-monsters.js";

const TIERS: readonly ChestTier[] = ["wood", "rare", "epic", "legendary"];
/** Chests sit a hair into the ground so a slope never shows light under a corner. */
const SINK = 0.02;
/** The chest you can take now hops this high, this often (V7 station 3: 「轻轻地跳」). */
const HOP_HEIGHT = 0.07;
const HOP_RATE = 2.4;

/**
 * Every chest on the course island: two instanced draws per tier (body, lid),
 * and one soft glow on the ground under the chest you can take now. Picking a
 * chest does what picking the thing it belongs to does.
 */
export function ChestField({
  chests,
  onPick,
}: {
  readonly chests: readonly CourseChest[];
  readonly onPick?: (chest: CourseChest) => void;
}) {
  const geometries = useMemo(
    () => new Map(TIERS.map((tier) => [tier, buildChestGeometry(tier)] as const)),
    [],
  );
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.58,
        metalness: 0.04,
      }),
    [],
  );
  const glowGeometry = useMemo(() => {
    // Additive: black at the rim is transparent, so the disc fades out without a texture.
    const disc = new THREE.CircleGeometry(1, 28);
    disc.rotateX(-Math.PI / 2);
    const position = disc.getAttribute("position") as THREE.BufferAttribute;
    const colours = new Float32Array(position.count * 3);
    for (let index = 0; index < position.count; index += 1) {
      const k = Math.max(0, 1 - Math.hypot(position.getX(index), position.getZ(index)));
      colours.set([k, k, k], index * 3);
    }
    disc.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    return disc;
  }, []);
  const glowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  useEffect(
    () => () => {
      for (const geometry of geometries.values()) {
        geometry.body.dispose();
        geometry.lid.dispose();
      }
      material.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();
    },
    [geometries, material, glowGeometry, glowMaterial],
  );

  const byTier = useMemo(
    () => new Map(TIERS.map((tier) => [tier, chests.filter((chest) => chest.tier === tier)])),
    [chests],
  );
  const ready = useMemo(() => chests.find((chest) => chest.state === "ready") ?? null, [chests]);
  const bodies = useRef(new Map<ChestTier, THREE.InstancedMesh | null>());
  const lids = useRef(new Map<ChestTier, THREE.InstancedMesh | null>());
  const glow = useRef<THREE.Mesh>(null);

  const scratch = useMemo(
    () => ({
      at: new THREE.Vector3(),
      chest: new THREE.Matrix4(),
      lid: new THREE.Matrix4(),
      squash: new THREE.Matrix4(),
    }),
    [],
  );
  const place = (chest: CourseChest, lift: number, squash: number) => {
    const tier = byTier.get(chest.tier) ?? [];
    const slot = tier.indexOf(chest);
    const body = bodies.current.get(chest.tier);
    const lid = lids.current.get(chest.tier);
    if (slot < 0 || !body || !lid) return;
    scratch.at.copy(chest.position);
    scratch.at.y += lift - SINK;
    const matrix = composeChestMatrix(scratch.at, chest.yaw, chest.scale, scratch.chest);
    if (squash !== 1) {
      const wide = 1 / Math.sqrt(squash);
      matrix.multiply(scratch.squash.makeScale(wide, squash, wide));
    }
    body.setMatrixAt(slot, matrix);
    lid.setMatrixAt(slot, composeLidMatrix(matrix, chest.state === "open" ? 1 : 0, scratch.lid));
    body.instanceMatrix.needsUpdate = true;
    lid.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => {
    for (const chest of chests) place(chest, 0, 1);
    for (const tier of TIERS) {
      bodies.current.get(tier)?.computeBoundingSphere();
      lids.current.get(tier)?.computeBoundingSphere();
    }
    const disc = glow.current;
    if (disc && ready) {
      disc.position.copy(ready.position).setY(ready.position.y + 0.03);
      disc.scale.setScalar(CHEST_WIDTH * ready.scale * 1.15);
      (disc.material as THREE.MeshBasicMaterial).color.set(CHEST_COLOURS[ready.tier].glow);
    }
    // `place` reads the refs and the grouping of this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chests, byTier, ready]);

  const reducedMotion = usePrefersReducedMotion();
  useLayoutEffect(() => {
    if (reducedMotion && ready) place(ready, 0, 1);
    // Reduced-motion changes re-place the current chest; the helper reads the
    // live refs rather than becoming a dependency itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, ready]);
  useFrame(({ clock }) => {
    if (!ready || reducedMotion || islandLookFrozen()) return;
    const t = clock.elapsedTime * HOP_RATE;
    const up = Math.max(0, Math.sin(t));
    // Land with a small squash, rise stretched: the hop reads at map distance.
    const squash = up < 0.15 ? 1 - (0.15 - up) * 0.5 : 1 + up * 0.04;
    place(ready, up * up * HOP_HEIGHT * ready.scale, squash);
    const disc = glow.current;
    if (disc) {
      const pulse = 0.75 + 0.25 * Math.sin(clock.elapsedTime * 2.2);
      (disc.material as THREE.MeshBasicMaterial).opacity = pulse;
    }
  });

  if (!chests.length) return null;
  const pick =
    (tier: ChestTier) =>
    (event: ThreeEvent<MouseEvent>): void => {
      const chest =
        event.instanceId === undefined ? undefined : byTier.get(tier)?.[event.instanceId];
      if (!chest || !onPick) return;
      event.stopPropagation();
      onPick(chest);
    };
  return (
    <group name="course-chests">
      {TIERS.map((tier) => {
        const list = byTier.get(tier) ?? [];
        if (!list.length) return null;
        const geometry = geometries.get(tier)!;
        return [
          <instancedMesh
            key={`${tier}-body`}
            ref={(node) => {
              bodies.current.set(tier, node);
            }}
            name={`course-chest-${tier}-body`}
            args={[geometry.body, material, list.length]}
            castShadow
            receiveShadow
            frustumCulled={false}
            onClick={pick(tier)}
          />,
          <instancedMesh
            key={`${tier}-lid`}
            ref={(node) => {
              lids.current.set(tier, node);
            }}
            name={`course-chest-${tier}-lid`}
            args={[geometry.lid, material, list.length]}
            castShadow
            receiveShadow
            frustumCulled={false}
            onClick={pick(tier)}
          />,
        ];
      })}
      {ready ? (
        <mesh
          ref={glow}
          name="course-chest-ready-glow"
          geometry={glowGeometry}
          material={glowMaterial}
          renderOrder={3}
          raycast={() => {}}
        />
      ) : null}
    </group>
  );
}

/** A shut chest's height in world units, for anything placed above one. */
export const CHEST_WORLD_HEIGHT = CHEST_HEIGHT * CHEST_WIDTH;
