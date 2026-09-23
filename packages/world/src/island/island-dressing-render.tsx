/** Render a semantic dressing plan through the shared instanced GLB adapter. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { AssetField, BatchedAssetLibraryField, type Placement } from "../kit.js";
import type { HexMap } from "../grid/course-grid.js";
import { resolveIslandRuntimeAsset, type IslandAssetPackId } from "./island-asset-registry.js";
import { IslandFoliage, isIslandFoliagePlacement } from "./island-foliage-render.js";
import { IslandCampfire } from "./island-campfire-render.js";
import {
  planIslandDressing,
  type IslandDressingDetail,
  type IslandDressingPlan,
} from "./island-dressing.js";
import { islandGeometryScale } from "./island-geometry.js";
import type { IslandBlueprint } from "./island-blueprint.js";
import { CourseLandscape } from "./course-landscape-render.js";
import { courseFacilityTreatment } from "./course-facility-material.js";
import { courseLandscapePlan, courseReplacementIds } from "./course-landscape-plan.js";
import { createDressingBoulderGeometry } from "./course-rock-profile.js";

/** Kenney rocks the course draws as procedural boulders at the same placements. */
const BOULDER_FOR_SOURCE: Readonly<Record<string, "large" | "small">> = {
  "nature-kit/rock_largeA": "large",
  "nature-kit/rock_smallA": "small",
};

/**
 * The roadside rocks as game-art boulders (`createDressingBoulderGeometry`):
 * one instanced draw per variant, placed exactly where the Kenney GLB would
 * have stood — same position, turn and unit-height scale.
 */
function DressingBoulderField({
  variant,
  at,
}: {
  readonly variant: "large" | "small";
  readonly at: readonly Placement[];
}) {
  const geometry = useMemo(() => createDressingBoulderGeometry(variant), [variant]);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
    [],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const matrix = new THREE.Matrix4();
    const turn = new THREE.Quaternion();
    const axis = new THREE.Vector3(0, 1, 0);
    at.forEach((placement, index) => {
      turn.setFromAxisAngle(axis, placement.turn ?? 0);
      matrix.compose(
        placement.position,
        turn,
        new THREE.Vector3(placement.height, placement.height, placement.height),
      );
      target.setMatrixAt(index, matrix);
    });
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, [at]);
  return (
    <instancedMesh
      ref={mesh}
      name={`course-boulders-${variant}`}
      args={[geometry, material, at.length]}
      castShadow
      receiveShadow
    />
  );
}

export interface IslandDressingField {
  readonly key: string;
  readonly pack: IslandAssetPackId;
  readonly src: string;
  readonly at: readonly Placement[];
}

/**
 * Resolve data before JSX so missing whitelist entries are measurable in a
 * unit test and never become one-off loader logic in the scene.
 */
export function islandDressingFields(
  plan: IslandDressingPlan,
  scale: number,
  heightMultiplier = 1,
  replacementIds?: ReadonlySet<string>,
): readonly IslandDressingField[] {
  const grouped = new Map<string, { pack: IslandAssetPackId; src: string; at: Placement[] }>();
  for (const placement of plan.placements) {
    if (isIslandFoliagePlacement(placement)) continue;
    if (replacementIds?.has(placement.id)) continue;
    const resolution = resolveIslandRuntimeAsset(placement.packId, placement.assetId);
    if (!resolution) continue;
    const key = `${resolution.pack}/${resolution.assetId}`;
    const field = grouped.get(key) ?? {
      pack: resolution.pack,
      src: resolution.src,
      at: [],
    };
    field.at.push({
      position: new THREE.Vector3(placement.x * scale, placement.y * scale, placement.z * scale),
      height: placement.height * scale * heightMultiplier * (resolution.heightScale ?? 1),
      turn: placement.turn,
    });
    grouped.set(key, field);
  }
  return [...grouped.entries()].map(([key, field]) => ({ key, ...field }));
}

/**
 * GLB JSON audit of the course outpost models (camp/tent/rocks/bridge):
 *
 * - camp, bridge: opaque, no images, no COLOR_0, metalness 0, uniform
 *   roughness 1, per-mesh baseColorFactor. Safe for one vertex-colour batch.
 * - tent: mixed roughness 0.5/0.8/1.0 and primitives with the default
 *   metallic material. AssetField keeps those contracts.
 * - rocks: no materials array; every primitive is the glTF default
 *   (metallic 1, white). Not the untextured dielectric batch.
 * - treeTrunks: embedded palette textures. Fountain Kenney water is BLEND.
 *
 * Nature stays on AssetField with preserveMap=false (PAINT), not PROP_FAMILY.
 * Hex family recolour is the grid PropField path, not this one.
 */
const COURSE_BATCHABLE_OPAQUE_UNTEXTURED_SRCS = new Set([
  "/models/elemental-serenity/camp.glb",
  "/models/elemental-serenity/bridge.glb",
]);

/**
 * AssetField preserveMap=true uses max(0.72, authored). Camp and bridge are 1.
 * Passing this keeps the batched material from collapsing that to 0.86.
 */
export const COURSE_BATCHED_MATERIAL_ROUGHNESS = 1;

export function isCourseBatchableOpaqueUntexturedSrc(src: string): boolean {
  return COURSE_BATCHABLE_OPAQUE_UNTEXTURED_SRCS.has(src);
}

/**
 * Course dressing splits by material contract so one vertex-colour BatchedMesh
 * cannot strip Kenney colormaps, fountain water alpha, tent roughness, or
 * default-metallic rocks.
 */
export function islandDressingCourseBatches(fields: readonly IslandDressingField[]): {
  readonly batched: readonly { readonly src: string; readonly at: readonly Placement[] }[];
  readonly fallback: readonly IslandDressingField[];
} {
  const batched: { src: string; at: readonly Placement[] }[] = [];
  const fallback: IslandDressingField[] = [];
  for (const field of fields) {
    if (field.pack !== "nature-kit" && isCourseBatchableOpaqueUntexturedSrc(field.src)) {
      batched.push({ src: field.src, at: field.at });
    } else {
      fallback.push(field);
    }
  }
  return { batched, fallback };
}

function dressingIdentity(blueprint: IslandBlueprint, detail: IslandDressingDetail): string {
  return `${blueprint.studyId}/${blueprint.courseId}/${blueprint.seed}/${blueprint.layoutRevision}/${blueprint.lessonCount}/${detail}`;
}

export function IslandDressing({
  blueprint,
  detail,
  targetRadius,
}: {
  readonly blueprint: IslandBlueprint;
  readonly detail: "course";
  readonly targetRadius?: number;
  /** Accepted for caller compatibility. Course dressing is continuous and ignores hex maps. */
  readonly grid?: HexMap;
}) {
  const identity = dressingIdentity(blueprint, detail);
  const [readyIdentity, setReadyIdentity] = useState("");
  useEffect(() => {
    setReadyIdentity("");
    // Let the terrain, markers and camera commit one frame before GLB parsing
    // and GPU resource cloning begin. Readiness is the identity of this
    // blueprint, so switching courses cannot keep the previous ready flag.
    let secondFrame: number | undefined;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setReadyIdentity(identity));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) cancelAnimationFrame(secondFrame);
    };
  }, [detail, identity]);
  const assetsReady = readyIdentity === identity;
  const plan = useMemo(
    () => (assetsReady ? planIslandDressing(blueprint, detail) : null),
    [assetsReady, blueprint, detail],
  );
  const scale = islandGeometryScale(blueprint, detail, targetRadius);
  const landscape = useMemo(
    () => (plan ? courseLandscapePlan(blueprint, plan) : null),
    [blueprint, plan],
  );
  const replacements = useMemo(
    () => (landscape ? courseReplacementIds(landscape) : undefined),
    [landscape],
  );
  const fields = useMemo(
    () => (plan ? islandDressingFields(plan, scale, 1, replacements) : []),
    [plan, scale, replacements],
  );
  const batches = useMemo(() => islandDressingCourseBatches(fields), [fields]);
  if (!plan || !landscape) return null;
  return (
    <group
      name="island-dressing-course"
      userData={{
        islandDressingReady: true,
        ...(import.meta.env.DEV
          ? { islandDressingPlan: plan, replacementIds: [...(replacements ?? [])] }
          : {}),
      }}
    >
      {batches.batched.length > 0 ? (
        <BatchedAssetLibraryField
          fields={batches.batched}
          name="course-elemental-batch"
          castShadow
          colorSource="material"
          roughness={COURSE_BATCHED_MATERIAL_ROUGHNESS}
        />
      ) : null}
      {batches.fallback.map((field) =>
        BOULDER_FOR_SOURCE[field.key] ? (
          <DressingBoulderField
            key={field.key}
            variant={BOULDER_FOR_SOURCE[field.key]!}
            at={field.at}
          />
        ) : (
          <AssetField
            key={field.key}
            src={field.src}
            at={field.at}
            preserveMap={field.pack !== "nature-kit"}
            castShadow
            materialTreatment={courseFacilityTreatment(field.key)}
          />
        ),
      )}
      <IslandFoliage plan={plan} scale={scale} />
      <IslandCampfire plan={plan} scale={scale} />
      <CourseLandscape blueprint={blueprint} dressing={plan} scale={scale} plan={landscape} />
    </group>
  );
}

export { IslandCampfire } from "./island-campfire-render.js";
