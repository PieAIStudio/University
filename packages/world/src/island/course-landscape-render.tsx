import { useEffect, useLayoutEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { usePrefersReducedMotion } from "../reduced-motion.js";
import { islandLookFrozen } from "./island-surface-style.js";
import { courseSpringMaterialDetail } from "./course-spring-material.js";
import { createCraftMaterialDetail } from "./craft-material.js";
import * as THREE from "three";
import type { IslandBlueprint } from "./island-blueprint.js";
import type { IslandDressingPlan } from "./island-dressing.js";
import { courseLandscapePlan, type CourseLandscapePlan } from "./course-landscape-plan.js";
import { buildCourseLandscapeGeometry } from "./course-landscape-geometry.js";
import {
  createSurfaceMaterialDetail,
  prepareSurfaceDetailCoordinates,
} from "./surface-material-detail.js";

export function CourseLandscape({
  blueprint,
  dressing,
  scale,
  plan: providedPlan,
}: {
  readonly blueprint: IslandBlueprint;
  readonly dressing: IslandDressingPlan;
  readonly scale: number;
  readonly plan?: CourseLandscapePlan;
}) {
  const plan = useMemo(
    () => providedPlan ?? courseLandscapePlan(blueprint, dressing),
    [providedPlan, blueprint, dressing],
  );
  const geometry = useMemo(() => {
    const result = buildCourseLandscapeGeometry(plan);
    if (result.rock) prepareSurfaceDetailCoordinates(result.rock);
    return result;
  }, [plan]);
  const detail = useMemo(() => createSurfaceMaterialDetail("stone"), []);
  useLayoutEffect(() => {
    detail.activate();
    return () => detail.dispose();
  }, [detail]);
  const rockMaterial = useMemo(() => {
    const result = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0,
      userData: {
        surfaceDetailInfo: detail.info,
        ...(import.meta.env.DEV ? { surfaceDetail: detail.uniforms } : {}),
      },
    });
    result.onBeforeCompile = detail.onBeforeCompile;
    result.customProgramCacheKey = detail.customProgramCacheKey;
    return result;
  }, [detail]);
  const craft = useMemo(() => createCraftMaterialDetail(), []);
  useLayoutEffect(() => {
    craft.activate();
    return () => craft.dispose();
  }, [craft]);
  const material = useMemo(() => {
    const result = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0,
      userData: {
        surfaceDetailInfo: craft.info,
        ...(import.meta.env.DEV ? { surfaceDetail: craft.uniforms } : {}),
      },
    });
    result.onBeforeCompile = craft.onBeforeCompile;
    result.customProgramCacheKey = craft.customProgramCacheKey;
    return result;
  }, [craft]);
  const flow = useMemo(() => courseSpringMaterialDetail(), []);
  const reducedMotion = usePrefersReducedMotion();
  useFrame(({ clock }) => {
    flow.uniforms.uSpringFlowTime.value =
      reducedMotion || islandLookFrozen() ? 0 : clock.elapsedTime;
  });
  const waterMaterial = useMemo(() => {
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.45,
      metalness: 0,
      side: THREE.DoubleSide,
      userData: import.meta.env.DEV ? { springFlow: flow.uniforms } : {},
    });
    material.onBeforeCompile = flow.onBeforeCompile;
    material.customProgramCacheKey = flow.customProgramCacheKey;
    return material;
  }, [flow]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(
    () => () => {
      rockMaterial.dispose();
    },
    [rockMaterial],
  );
  useEffect(() => () => waterMaterial.dispose(), [waterMaterial]);
  return (
    <group
      name="course-landscape"
      scale={scale}
      userData={{
        landscapeReport: {
          search: plan.search,
          outcropCount: plan.outcrops.length,
          ruinCount: plan.outcrops.filter((site) => site.feature === "ruin").length,
          floraCount: plan.flora.length,
          meadowBedCount: plan.meadowBeds?.length ?? 0,
          meadowFloraCount: plan.flora.filter((p) => p.anchorId.startsWith("meadow/")).length,
          leafyCount: plan.flora.filter((p) => p.asset === "leafy").length,
          mushroomCount: plan.flora.filter((p) => p.asset === "mushroom").length,
          borderCount: plan.borders?.length ?? 0,
          groundStoneCount: plan.stones?.length ?? 0,
          stallCount: plan.stalls?.length ?? 0,
          shoulderTreeCount: plan.canopy?.length ?? 0,
          academyCount: plan.academies?.length ?? 0,
          springCount: plan.spring ? 1 : 0,
          triangles: geometry.triangles,
          ...(import.meta.env.DEV
            ? {
                outcrops: plan.outcrops,
                flora: plan.flora,
                meadowBeds: plan.meadowBeds,
                borders: plan.borders,
                groundStones: plan.stones,
                canopy: plan.canopy,
                academies: plan.academies,
                spring: plan.spring,
              }
            : {}),
        },
      }}
    >
      {geometry.rock ? (
        <mesh
          name="course-rock-outcrops"
          geometry={geometry.rock}
          material={rockMaterial}
          castShadow
          receiveShadow
        />
      ) : null}
      {geometry.flora ? (
        <mesh
          name="course-garden-flora"
          geometry={geometry.flora}
          material={material}
          castShadow
          receiveShadow
        />
      ) : null}
      {geometry.water ? (
        <mesh name="course-coastal-spring" geometry={geometry.water} material={waterMaterial} />
      ) : null}
    </group>
  );
}
