/**
 * Campfire flame render component:
 *
 * Single instanced mesh for all lit camp outposts.
 * Handles subtle organic flicker on instance matrices directly,
 * respecting prefers-reduced-motion with a reactive listener without per-frame React state.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import type { IslandDressingPlan } from "./island-dressing.js";
import {
  campfireFlameTransform,
  createCampfireFlameGeometry,
  createCampfireMaterial,
  filterLitCampPlacements,
} from "./island-campfire.js";

const TEMP_MATRIX = new THREE.Matrix4();
const TEMP_POS = new THREE.Vector3();
const TEMP_QUAT = new THREE.Quaternion();
const TEMP_SCALE = new THREE.Vector3();

/**
 * Reactive listener for platform reduced-motion preference.
 * Immediately responds to OS or user setting changes at runtime.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    setReduced(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

export function IslandCampfire({
  plan,
  scale = 1,
  heightMultiplier = 1,
}: {
  readonly plan: IslandDressingPlan;
  readonly scale?: number;
  readonly heightMultiplier?: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const litPlacements = useMemo(() => filterLitCampPlacements(plan.placements), [plan.placements]);

  const geometry = useMemo(() => createCampfireFlameGeometry(), []);
  const material = useMemo(() => createCampfireMaterial(), []);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  const baseMatrices = useMemo(
    () =>
      litPlacements.map((placement) => campfireFlameTransform(placement, scale, heightMultiplier)),
    [litPlacements, scale, heightMultiplier],
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || baseMatrices.length === 0) return;
    baseMatrices.forEach((matrix, index) => {
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [baseMatrices]);

  const prefersReducedMotion = usePrefersReducedMotion();

  // If setting changes to reduced-motion while animated, restore clean base matrices immediately
  useEffect(() => {
    if (prefersReducedMotion) {
      const mesh = meshRef.current;
      if (!mesh || baseMatrices.length === 0) return;
      baseMatrices.forEach((matrix, index) => {
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }, [prefersReducedMotion, baseMatrices]);

  useFrame((state) => {
    // Stable flame if reduced motion is requested or mesh is absent
    if (prefersReducedMotion || !meshRef.current || baseMatrices.length === 0) return;
    const mesh = meshRef.current;
    const t = state.clock.getElapsedTime();

    for (let i = 0; i < baseMatrices.length; i += 1) {
      const base = baseMatrices[i]!;
      base.decompose(TEMP_POS, TEMP_QUAT, TEMP_SCALE);
      // Subtle organic flame flicker (height breathing +/- 4%, slight high-frequency flutter)
      const flicker = 1 + 0.038 * Math.sin(t * 11 + i * 1.7) + 0.018 * Math.cos(t * 19 + i * 2.9);
      TEMP_SCALE.y *= flicker;
      TEMP_MATRIX.compose(TEMP_POS, TEMP_QUAT, TEMP_SCALE);
      mesh.setMatrixAt(i, TEMP_MATRIX);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (litPlacements.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, litPlacements.length]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
      name="island-campfire-flames"
    />
  );
}
