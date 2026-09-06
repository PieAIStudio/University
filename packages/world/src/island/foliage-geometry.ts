/**
 * Course crown volumes: three overlapping anisotropic icosahedra per tree or
 * bush. Placement coordinates stay with island-dressing; this module only
 * turns a height/turn into lobe transforms and the shared unit mesh.
 */
import * as THREE from "three";
import { mergeVertices } from "three-stdlib";

import { seeded } from "./random.js";

export const COURSE_TREE_CROWN_DETAIL = 1;
export const COURSE_BUSH_CROWN_DETAIL = 0;
export const COURSE_CROWN_LOBES_PER_TREE = 3;
export const COURSE_CROWN_LOBES_PER_BUSH = 3;
export const COURSE_TREE_CROWN_TRIANGLES_PER_LOBE = 80;
export const COURSE_BUSH_CROWN_TRIANGLES_PER_LOBE = 20;
export const COURSE_TREE_CROWN_TRIANGLES = 240;
export const COURSE_BUSH_CROWN_TRIANGLES = 60;
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
  { along: 0, up: 0.48, side: 0, radiusX: 0.42, radiusY: 0.54, radiusZ: 0.4, yaw: 0 },
  { along: -0.16, up: 0.34, side: 0.08, radiusX: 0.32, radiusY: 0.36, radiusZ: 0.3, yaw: 0.7 },
  { along: 0.15, up: 0.32, side: -0.07, radiusX: 0.3, radiusY: 0.34, radiusZ: 0.28, yaw: -0.8 },
];

const UP = new THREE.Vector3(0, 1, 0);

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
export function createSmoothIcosahedron(detail: number): THREE.BufferGeometry {
  const source = new THREE.IcosahedronGeometry(1, detail);
  // Strip UV and normal before weld: Foliage uses untextured vertex/instance colors,
  // and UV cuts otherwise leave coincident vertices unmerged along seams with
  // mismatched normals.
  source.deleteAttribute("uv");
  source.deleteAttribute("normal");
  const geometry = mergeVertices(source);
  source.dispose();
  geometry.computeVertexNormals();
  return geometry;
}

export function icosahedronTriangleCount(detail: number): number {
  const geometry = createSmoothIcosahedron(detail);
  const triangles = geometryTriangleCount(geometry);
  geometry.dispose();
  return triangles;
}

function familyColour(random: () => number): THREE.Color {
  const t = random();
  const toward = t < 0.5 ? CROWN_FAMILY.shadow : CROWN_FAMILY.highlight;
  return CROWN_FAMILY.mid.clone().lerp(toward, Math.abs(t - 0.5) * 0.3);
}

function lobesFromRecipes(
  placement: FoliagePlacement,
  recipes: readonly LobeRecipe[],
  seedKey: string,
  bury = 0,
): CrownLobeTransform[] {
  const random = seeded(
    `${seedKey}/${placement.position.x}/${placement.position.z}/${placement.turn}`,
  );
  const height = placement.height;
  const swing = (random() - 0.5) * 0.4;
  const lobes: CrownLobeTransform[] = [];
  for (const recipe of recipes) {
    const scaleJitter = 0.94 + random() * 0.12;
    const yaw = placement.turn + recipe.yaw + swing + (random() - 0.5) * 0.18;
    const pitch = (random() - 0.5) * 0.16;
    const local = new THREE.Vector3(
      recipe.along * height,
      recipe.up * height - bury,
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
      color: familyColour(random),
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
