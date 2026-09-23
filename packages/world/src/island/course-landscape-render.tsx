import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { usePrefersReducedMotion } from "../reduced-motion.js";
import { islandLookFrozen } from "./island-surface-style.js";
import { courseSpringMaterialDetail } from "./course-spring-material.js";
import { springMistTexture } from "./course-spring-geometry.js";
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
  const flow = useMemo(() => courseSpringMaterialDetail("still"), []);
  const fallFlow = useMemo(() => courseSpringMaterialDetail("fall", flow.uniforms), [flow]);
  const reducedMotion = usePrefersReducedMotion();
  const mist = useRef<THREE.Points>(null);
  useFrame(({ clock }) => {
    const moving = !reducedMotion && !islandLookFrozen();
    flow.uniforms.uSpringFlowTime.value = moving ? clock.elapsedTime : 0;
    // The mist drifts and breathes around its rest positions; held still otherwise.
    const puffs = mist.current;
    if (!puffs || !geometry.mist) return;
    const position = puffs.geometry.getAttribute("position") as THREE.BufferAttribute;
    const t = moving ? clock.elapsedTime : 0;
    for (let i = 0; i < position.count; i += 1) {
      position.setXYZ(
        i,
        geometry.mist[i * 3]! + Math.sin(t * 0.31 + i * 1.7) * 0.25,
        geometry.mist[i * 3 + 1]! + Math.sin(t * 0.47 + i * 2.3) * 0.35,
        geometry.mist[i * 3 + 2]! + Math.cos(t * 0.29 + i * 1.1) * 0.25,
      );
    }
    position.needsUpdate = true;
  });
  const waterMaterial = useMemo(() => {
    // Low roughness: the tilted ripple normals catch the sun and the sky.
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.16,
      metalness: 0,
      side: THREE.DoubleSide,
      userData: import.meta.env.DEV ? { springFlow: flow.uniforms } : {},
    });
    material.onBeforeCompile = flow.onBeforeCompile;
    material.customProgramCacheKey = flow.customProgramCacheKey;
    return material;
  }, [flow]);
  const fallMaterial = useMemo(() => {
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.3,
      metalness: 0,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
    });
    material.onBeforeCompile = fallFlow.onBeforeCompile;
    material.customProgramCacheKey = fallFlow.customProgramCacheKey;
    return material;
  }, [fallFlow]);
  const mistMaterial = useMemo(
    () =>
      new THREE.PointsMaterial({
        map: springMistTexture(),
        color: 0xffffff,
        size: 5,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    [],
  );
  const mistGeometry = useMemo(() => {
    if (!geometry.mist) return null;
    const result = new THREE.BufferGeometry();
    result.setAttribute("position", new THREE.Float32BufferAttribute(geometry.mist.slice(), 3));
    return result;
  }, [geometry]);
  useEffect(() => () => mistGeometry?.dispose(), [mistGeometry]);
  useEffect(
    () => () => {
      fallMaterial.dispose();
      mistMaterial.dispose();
    },
    [fallMaterial, mistMaterial],
  );
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
        <mesh
          name="course-coastal-spring"
          geometry={geometry.water}
          material={waterMaterial}
          receiveShadow
        />
      ) : null}
      {geometry.fall ? (
        <mesh
          name="course-spring-fall"
          geometry={geometry.fall}
          material={fallMaterial}
          renderOrder={3}
        />
      ) : null}
      {mistGeometry ? (
        <points
          ref={mist}
          name="course-spring-mist"
          geometry={mistGeometry}
          material={mistMaterial}
          renderOrder={4}
          frustumCulled={false}
        />
      ) : null}
    </group>
  );
}
