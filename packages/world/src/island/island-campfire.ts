/**
 * Campfire flame: modest, warm, low-poly flame and ember bed for camp outposts.
 *
 * Anchor coordinates are derived directly from the matrix-transformed scene bounds
 * of elemental-serenity/camp.glb (pit centre and wood coals level).
 *
 * Rendering constraints:
 * - Render ONLY when packId === "elemental-serenity", assetId === "camp" and state === "lit".
 * - Single shared low-poly geometry instanced across all lit camps on the island.
 * - Zero point lights, zero shadow casting, zero particle systems.
 * - Reduced motion -> stable flame; no per-frame React state.
 */
import * as THREE from "three";

import type { IslandDressingPlacement } from "./island-dressing.js";

/**
 * Authoritative reference camp placement height in standard course dressing.
 */
export const CAMP_REFERENCE_HEIGHT = 0.32;

/**
 * Matrix-aware bounding data measured from elemental-serenity/camp.glb scene.
 * Note: Raw glTF accessors (in Blender local mesh space) are transformed by scene nodes:
 *   Node 0 (rocks): rotation X -90°, scale ~0.4297, translation [-5.63, 0.08, -6.97]
 *   Node 1 (wood): rotation X -90°, scale ~1.0308, translation [-5.59, 0.54, -7.02]
 *
 * The bounds below are the authoritative matrix-transformed scene bounds:
 * Camp total scene bounding box:
 *   min: [-6.9904248, -0.1423323, -8.2678017]
 *   max: [-4.2944571,  0.5878592, -5.7650673]
 *   size: [2.6959677,  0.7301915,  2.5027344]
 *   center: [-5.642441, 0.2227634, -7.0164345]
 *
 * Wood logs node bounding box (transformed):
 *   min: [-6.4786425,  0.0234348, -7.8415643]
 *   max: [-4.7499701,  0.5878592, -6.2075498]
 *   size: [1.7286724,  0.5644244,  1.6340145]
 *   center: [-5.6143063, 0.305647, -7.0245571]
 */
export const CAMP_SCENE_TRANSFORMED_BOUNDS = {
  min: new THREE.Vector3(-6.9904248, -0.1423323, -8.2678017),
  max: new THREE.Vector3(-4.2944571, 0.5878592, -5.7650673),
  size: new THREE.Vector3(2.6959677, 0.7301915, 2.5027344),
  center: new THREE.Vector3(-5.642441, 0.2227634, -7.0164345),
} as const;

/** Alias for backward compatibility. */
export const CAMP_RAW_BOUNDING_BOX = CAMP_SCENE_TRANSFORMED_BOUNDS;

export const CAMP_WOOD_SCENE_TRANSFORMED_BOUNDS = {
  min: new THREE.Vector3(-6.4786425, 0.0234348, -7.8415643),
  max: new THREE.Vector3(-4.7499701, 0.5878592, -6.2075498),
  size: new THREE.Vector3(1.7286724, 0.5644244, 1.6340145),
  center: new THREE.Vector3(-5.6143063, 0.305647, -7.0245571),
} as const;

/** Alias for backward compatibility. */
export const CAMP_WOOD_RAW_BOUNDING_BOX = CAMP_WOOD_SCENE_TRANSFORMED_BOUNDS;

/**
 * Normalization helper matching AssetField / BatchedAssetLibraryField `partsFromScene`:
 * Base is shifted to y=0, horizontal coordinates centered on bounding box center,
 * and entire model scaled by 1 / height.
 */
export function deriveCampfireNormalizedAnchor(): THREE.Vector3 {
  const height = CAMP_SCENE_TRANSFORMED_BOUNDS.size.y;
  const normX =
    (CAMP_WOOD_SCENE_TRANSFORMED_BOUNDS.center.x - CAMP_SCENE_TRANSFORMED_BOUNDS.center.x) / height;
  const normZ =
    (CAMP_WOOD_SCENE_TRANSFORMED_BOUNDS.center.z - CAMP_SCENE_TRANSFORMED_BOUNDS.center.z) / height;
  // The ember coal bed sits inside the lower half of the logs (center is at y ~ 0.61, coal bed ~ 0.65)
  const normY =
    (CAMP_WOOD_SCENE_TRANSFORMED_BOUNDS.center.y - CAMP_SCENE_TRANSFORMED_BOUNDS.min.y) / height +
    0.0365;
  return new THREE.Vector3(normX, normY, normZ);
}

/**
 * Normalized fire anchor relative to the unit-height, base-centered camp model.
 * x: ~0.0385, y: ~0.65, z: ~ -0.0111
 */
export const CAMPFIRE_NORMALIZED_ANCHOR = deriveCampfireNormalizedAnchor();

/**
 * Modest flame height in world units at standard reference camp height 0.32m (0.35m - 0.5m range).
 * Relative height ratio to reference camp: 0.40 / 0.32 = 1.25.
 */
export const CAMPFIRE_FLAME_HEIGHT = 0.4;

/**
 * Modest flame base diameter in world units at standard reference camp height 0.32m.
 * Fits within the ~0.76m wood pit diameter (~34% coverage).
 */
export const CAMPFIRE_FLAME_WIDTH = 0.26;
export const CAMPFIRE_FLAME_DIAMETER = CAMPFIRE_FLAME_WIDTH;

/** Exact low-poly triangle count of the shared flame mesh. */
export const CAMPFIRE_FLAME_TRIANGLES = 22;

/**
 * Filter contract: Only "elemental-serenity" pack with assetId "camp" and state === "lit" gets fire.
 * Avoids same-name alternate models in other packs. Idle camps, tents, rocks, and bridges must NEVER get fire.
 */
export function isLitCampPlacement(placement: IslandDressingPlacement): boolean {
  return (
    placement.packId === "elemental-serenity" &&
    placement.assetId === "camp" &&
    placement.state === "lit"
  );
}

export function filterLitCampPlacements(
  placements: readonly IslandDressingPlacement[],
): readonly IslandDressingPlacement[] {
  return placements.filter(isLitCampPlacement);
}

/**
 * Derive instance world transform for a lit camp's flame.
 * Scales proportionally with placement.height relative to CAMP_REFERENCE_HEIGHT,
 * as well as global scale and heightMultiplier.
 */
export function campfireFlameTransform(
  placement: IslandDressingPlacement,
  scale = 1,
  heightMultiplier = 1,
): THREE.Matrix4 {
  const campPlacementHeight = placement.height;
  const heightRatio = campPlacementHeight / CAMP_REFERENCE_HEIGHT;
  const campHeight = campPlacementHeight * scale * heightMultiplier;
  const campPos = new THREE.Vector3(placement.x * scale, placement.y * scale, placement.z * scale);

  // Local anchor offset scaled by camp height and rotated around Y by placement.turn
  const cosTurn = Math.cos(placement.turn);
  const sinTurn = Math.sin(placement.turn);
  const localX = CAMPFIRE_NORMALIZED_ANCHOR.x * campHeight;
  const localY = CAMPFIRE_NORMALIZED_ANCHOR.y * campHeight;
  const localZ = CAMPFIRE_NORMALIZED_ANCHOR.z * campHeight;

  const worldAnchor = new THREE.Vector3(
    campPos.x + (localX * cosTurn + localZ * sinTurn),
    campPos.y + localY,
    campPos.z + (-localX * sinTurn + localZ * cosTurn),
  );

  const flameWidth = CAMPFIRE_FLAME_WIDTH * heightRatio * scale * heightMultiplier;
  const flameHeight = CAMPFIRE_FLAME_HEIGHT * heightRatio * scale * heightMultiplier;

  const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), placement.turn);
  const flameScale = new THREE.Vector3(flameWidth, flameHeight, flameWidth);

  const matrix = new THREE.Matrix4();
  matrix.compose(worldAnchor, quat, flameScale);
  return matrix;
}

/**
 * Construct the shared 22-triangle faceted stylized warm flame geometry.
 *
 * Bounds in unit space:
 * - Height: y in [0, 1.0]
 * - Horizontal diameter: normalized to 1.0 (radius in X/Z <= 0.5), so scaling by
 *   flameWidth produces exact, truthful physical dimensions.
 *
 * Luminous design:
 * - Outer body (18 tris): Base coals at y=0 radiate luminous white-gold (0xfff8c0) and warm amber (0xffb833)
 *   rising through vibrant flame orange (0xff8c1a) to a deep crimson crest (0xd92600).
 * - Exterior front tongue (4 tris): An intentional ascending lick of flame sits on the visible forward
 *   exterior facet (z > 0.32, y in [0.04, 0.66]), casting radiant white-gold highlights visible to the camera.
 */
export function createCampfireFlameGeometry(): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();

  const segments = 6;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const colLuminousCoals = new THREE.Color(0xfff8c0); // radiant glowing warm white-gold
  const colLuminousAmber = new THREE.Color(0xffb833); // radiant warm amber
  const colFlameOrange = new THREE.Color(0xff8c1a); // vibrant flame orange
  const colFieryTip = new THREE.Color(0xd92600); // deep fiery tip

  // Outer base ring: y=0, radius=0.42 (diameter 0.84)
  for (let i = 0; i < segments; i += 1) {
    const theta = (i / segments) * Math.PI * 2;
    positions.push(Math.cos(theta) * 0.42, 0, Math.sin(theta) * 0.42);
    colLuminousCoals.toArray(colors, colors.length);
  }

  // Outer mid ring: y=0.45, radius=0.50 (max unit diameter = 1.0), slight organic yaw twist
  for (let i = 0; i < segments; i += 1) {
    const theta = (i / segments) * Math.PI * 2 + 0.18;
    positions.push(Math.cos(theta) * 0.5, 0.45, Math.sin(theta) * 0.5);
    colLuminousAmber.toArray(colors, colors.length);
  }

  // Outer apex: y=1.0, slight organic tip tilt
  const outerApexIdx = segments * 2;
  positions.push(0.04, 1.0, -0.03);
  colFieryTip.toArray(colors, colors.length);

  // Outer faces: 6 base quads (12 tris) + 6 tip triangles (6 tris) = 18 tris
  for (let i = 0; i < segments; i += 1) {
    const next = (i + 1) % segments;
    const b1 = i;
    const b2 = next;
    const m1 = segments + i;
    const m2 = segments + next;

    indices.push(b1, m1, m2);
    indices.push(b1, m2, b2);
    indices.push(m1, outerApexIdx, m2);
  }

  // Secondary visible front tongue: 5 vertices (4 tris) on the forward exterior facet
  const frontStart = outerApexIdx + 1;
  const colRibbonBright = new THREE.Color(0xfffae0); // bright glowing white-gold
  const colRibbonMid = new THREE.Color(0xffd166); // glowing gold
  const colRibbonTop = new THREE.Color(colFlameOrange);

  // v0: front base anchor
  positions.push(0.0, 0.04, 0.44);
  colRibbonBright.toArray(colors, colors.length);

  // v1: left mid tongue
  positions.push(-0.07, 0.28, 0.47);
  colRibbonMid.toArray(colors, colors.length);

  // v2: right mid tongue
  positions.push(0.08, 0.25, 0.47);
  colRibbonMid.toArray(colors, colors.length);

  // v3: upper center tongue
  positions.push(0.0, 0.48, 0.42);
  colRibbonTop.toArray(colors, colors.length);

  // v4: crest tip
  positions.push(0.03, 0.66, 0.32);
  colFieryTip.toArray(colors, colors.length);

  // 4 tris on the front facet:
  indices.push(frontStart + 0, frontStart + 2, frontStart + 1);
  indices.push(frontStart + 1, frontStart + 2, frontStart + 3);
  indices.push(frontStart + 1, frontStart + 3, frontStart + 4);
  indices.push(frontStart + 2, frontStart + 4, frontStart + 3);

  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Unlit basic material with vertex colors:
 * Flame is inherently emissive and requires no point light or shadow passes.
 */
export function createCampfireMaterial(): THREE.Material {
  return new THREE.MeshBasicMaterial({
    vertexColors: true,
    toneMapped: true,
    side: THREE.DoubleSide,
  });
}
