/**
 * Course crown volumes: three overlapping anisotropic icosahedra per tree or
 * bush. Placement coordinates stay with island-dressing; this module only
 * turns a height/turn into lobe transforms and the shared unit mesh.
 */
import * as THREE from "three";
import { mergeVertices } from "three-stdlib";

import { seeded } from "./random.js";

export const COURSE_TREE_CROWN_DETAIL = 1;
export const COURSE_BUSH_CROWN_DETAIL = 1;
export const COURSE_CROWN_LOBES_PER_TREE = 3;
export const COURSE_CROWN_LOBES_PER_BUSH = 3;
export const COURSE_TREE_CROWN_TRIANGLES_PER_LOBE = 80;
export const COURSE_BUSH_CROWN_TRIANGLES_PER_LOBE = 80;
export const COURSE_TREE_CROWN_TRIANGLES = 240;
export const COURSE_BUSH_CROWN_TRIANGLES = 240;
/** Both complete scenic tree roots fit this normalized horizontal disk. */
export const COURSE_TREE_ROOT_RADIUS_RATIO = 0.1;
export const COURSE_TREE_TRUNK_TRIANGLE_CEILING = 384;
export const COURSE_TREE_TOTAL_TRIANGLE_CEILING = 624;
/** The donor contains bare branch skeletons, not complete tree silhouettes. */
export const COURSE_TREE_TRUNK_HEIGHT_RATIO = 0.68;

/** Existing painterly green family from the retired card ramp. */
export const CROWN_FAMILY = {
  shadow: new THREE.Color(0x27472d),
  mid: new THREE.Color(0x5e9549),
  highlight: new THREE.Color(0xb4d86c),
} as const;

export interface FoliagePlacement {
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly height: number;
  readonly turn: number;
  /** Shared-field patch colour supplied by the cached dressing plan. */
  readonly foliageTint?: number;
  readonly shapeSeed?: string;
  readonly groundOffsets?: readonly number[];
}

export interface CrownLobeTransform {
  readonly position: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
  readonly scale: THREE.Vector3;
  readonly color: THREE.Color;
}

interface LobeRecipe {
  readonly along: number;
  readonly up: number;
  readonly side: number;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly radiusZ: number;
  readonly yaw: number;
}

/**
 * Central upper lobe plus two lower offset lobes. Radii overlap so the three
 * ellipsoids read as one rounded mass rather than stacked balls.
 */
const TREE_LOBE_RECIPES: readonly LobeRecipe[] = [
  { along: 0, up: 0.68, side: 0, radiusX: 0.38, radiusY: 0.32, radiusZ: 0.36, yaw: 0 },
  { along: -0.16, up: 0.5, side: 0.05, radiusX: 0.3, radiusY: 0.24, radiusZ: 0.28, yaw: 0.55 },
  { along: 0.15, up: 0.48, side: -0.07, radiusX: 0.29, radiusY: 0.23, radiusZ: 0.27, yaw: -0.62 },
];

/** Flattened buns, slightly buried so the silhouette sits on the ground. */
const BUSH_LOBE_RECIPES: readonly LobeRecipe[] = [
  { along: 0, up: 0.37, side: 0, radiusX: 0.49, radiusY: 0.44, radiusZ: 0.45, yaw: 0 },
  { along: -0.16, up: 0.26, side: 0.08, radiusX: 0.32, radiusY: 0.31, radiusZ: 0.31, yaw: 0.7 },
  { along: 0.15, up: 0.23, side: -0.07, radiusX: 0.3, radiusY: 0.28, radiusZ: 0.29, yaw: -0.8 },
];

const UP = new THREE.Vector3(0, 1, 0);
const CROWN_SCALE_JITTER = { min: 0.94, span: 0.12 } as const;

/** Conservative XZ envelope of the actual lobe recipes under every seeded
 * yaw/pitch and scale jitter. A rotation cannot enlarge a lobe's circumsphere.
 * Planning reads these recipes, not a second guessed "tree height" radius.
 */
export function foliageFootprintRadius(kind: "tree" | "bush", height: number): number {
  const recipes = kind === "tree" ? TREE_LOBE_RECIPES : BUSH_LOBE_RECIPES;
  return (
    height *
    Math.max(
      ...recipes.map(
        (recipe) =>
          Math.hypot(recipe.along, recipe.side) +
          Math.max(recipe.radiusX, recipe.radiusY, recipe.radiusZ) *
            (CROWN_SCALE_JITTER.min + CROWN_SCALE_JITTER.span),
      ),
    )
  );
}

function geometryTriangleCount(geometry: THREE.BufferGeometry): number {
  const index = geometry.getIndex();
  if (index) return index.count / 3;
  const position = geometry.getAttribute("position");
  return position ? position.count / 3 : 0;
}

/**
 * Unit icosahedron with welded vertices so MeshStandardMaterial gets real
 * smooth normals. Three.js emits a non-indexed mesh; without the weld each
 * face is a unique triangle and shading goes flat.
 */
export function createSmoothIcosahedron(detail: number, upBias = 0): THREE.BufferGeometry {
  const source = new THREE.IcosahedronGeometry(1, detail);
  source.deleteAttribute("uv");
  source.deleteAttribute("normal");
  const geometry = mergeVertices(source);
  source.dispose();
  geometry.computeVertexNormals();

  if (upBias > 0) {
    const normalAttr = geometry.getAttribute("normal");
    const bias = new THREE.Vector3(0, upBias, 0);
    const n = new THREE.Vector3();
    for (let i = 0; i < normalAttr.count; i += 1) {
      n.fromBufferAttribute(normalAttr, i);
      n.add(bias).normalize();
      normalAttr.setXYZ(i, n.x, n.y, n.z);
    }
    normalAttr.needsUpdate = true;
  }
  return geometry;
}

export function icosahedronTriangleCount(detail: number): number {
  const geometry = createSmoothIcosahedron(detail);
  const triangles = geometryTriangleCount(geometry);
  geometry.dispose();
  return triangles;
}

function lobesFromRecipes(
  placement: FoliagePlacement,
  recipes: readonly LobeRecipe[],
  seedKey: string,
  bury = 0,
): CrownLobeTransform[] {
  const random = seeded(
    `${seedKey}/${placement.shapeSeed ?? `${placement.position.x}/${placement.position.z}`}/${placement.turn}`,
  );
  const height = placement.height;
  const colour =
    placement.foliageTint === undefined ? CROWN_FAMILY.mid : new THREE.Color(placement.foliageTint);
  const swing = (random() - 0.5) * 0.4;
  const lobes: CrownLobeTransform[] = [];
  for (const [index, recipe] of recipes.entries()) {
    const scaleJitter = CROWN_SCALE_JITTER.min + random() * CROWN_SCALE_JITTER.span;
    const yaw = placement.turn + recipe.yaw + swing + (random() - 0.5) * 0.18;
    const pitch = (random() - 0.5) * 0.16;
    const local = new THREE.Vector3(
      recipe.along * height,
      recipe.up * height - bury + (placement.groundOffsets?.[index] ?? 0),
      recipe.side * height,
    );
    local.applyAxisAngle(UP, placement.turn);
    lobes.push({
      position: new THREE.Vector3(
        placement.position.x + local.x,
        placement.position.y + local.y,
        placement.position.z + local.z,
      ),
      quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ")),
      scale: new THREE.Vector3(
        recipe.radiusX * height * scaleJitter,
        recipe.radiusY * height * scaleJitter,
        recipe.radiusZ * height * scaleJitter,
      ),
      // Lobe value hierarchy is stable; hue belongs to the entire patch.
      color: colour.clone().multiplyScalar(index === 0 ? 1 : index === 1 ? 0.96 : 0.93),
    });
  }
  return lobes;
}

export function treeCrownLobes(placement: FoliagePlacement): readonly CrownLobeTransform[] {
  return lobesFromRecipes(placement, TREE_LOBE_RECIPES, "tree-crown");
}

export function bushCrownLobes(placement: FoliagePlacement): readonly CrownLobeTransform[] {
  return lobesFromRecipes(placement, BUSH_LOBE_RECIPES, "bush-crown", placement.height * 0.06);
}

// CPU-only vertices from the ACTUAL emitted shrub mesh; not a guessed sphere
// or a second terrain sampler. Its temporary geometry never reaches the GPU.
let bushContactVertices: readonly THREE.Vector3[] | undefined;
function shrubVertices(): readonly THREE.Vector3[] {
  if (!bushContactVertices) {
    const geometry = createSmoothIcosahedron(COURSE_BUSH_CROWN_DETAIL);
    const positions = geometry.getAttribute("position");
    bushContactVertices = Array.from({ length: positions.count }, (_, index) =>
      new THREE.Vector3().fromBufferAttribute(positions, index),
    );
    geometry.dispose();
  }
  return bushContactVertices;
}

/** Solve contact once in the plan. Every lobe keeps its shape/footprint and
 * moves only down when its real low vertex floats over the rendered terrain.
 * Renderer scale multiplies these offsets; it never re-samples the world.
 */
export function bushGroundOffsets(
  placement: FoliagePlacement,
  groundAt: (x: number, z: number) => number,
): readonly number[] {
  const vertices = shrubVertices();
  const scratch = new THREE.Vector3();
  return bushCrownLobes({ ...placement, groundOffsets: undefined }).map((lobe) => {
    let bottomY = Infinity;
    for (const vertex of vertices) {
      scratch.copy(vertex).multiply(lobe.scale).applyQuaternion(lobe.quaternion).add(lobe.position);
      bottomY = Math.min(bottomY, scratch.y);
    }
    // An icosahedron can have two equally low vertices on opposite sides.
    // Choosing just the first ties contact to floating-point iteration order
    // and lets the downhill foot float after a uniform preview scale.
    let largestGap = -Infinity;
    for (const vertex of vertices) {
      scratch.copy(vertex).multiply(lobe.scale).applyQuaternion(lobe.quaternion).add(lobe.position);
      if (scratch.y <= bottomY + placement.height * 1e-6) {
        largestGap = Math.max(largestGap, scratch.y - groundAt(scratch.x, scratch.z));
      }
    }
    return -Math.max(0, largestGap + 0.01);
  });
}

export function crownLobeCorners(lobe: CrownLobeTransform): THREE.Vector3[] {
  const corners: THREE.Vector3[] = [];
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      for (const z of [-1, 1]) {
        corners.push(
          new THREE.Vector3(x * lobe.scale.x, y * lobe.scale.y, z * lobe.scale.z)
            .applyQuaternion(lobe.quaternion)
            .add(lobe.position),
        );
      }
    }
  }
  return corners;
}

export function crownUnionBox(lobes: readonly CrownLobeTransform[]): THREE.Box3 {
  const box = new THREE.Box3();
  for (const lobe of lobes) {
    for (const corner of crownLobeCorners(lobe)) box.expandByPoint(corner);
  }
  return box;
}
