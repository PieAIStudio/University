import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

/**
 * The painted-toy look V7's rewards share: rounded forms, a clear-coated paint
 * and an even ink outline. The close-up chest, the knowledge star and the rank
 * and badge emblems are all built from these, so they read as one set of
 * objects. Ported from docs/reference/player-journey/v7/lab/rewards3d.js, whose
 * look the Owner approved.
 */

const OUTLINE = 0x24172e;

/** The ink: a back-faced hull pushed out along its normals by `thickness`. */
export function inkMaterial(thickness: number): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.BackSide });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uThick = { value: thickness };
    shader.vertexShader =
      "uniform float uThick;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        "vec3 transformed = position + normalize(normal) * uThick;",
      );
  };
  material.customProgramCacheKey = () => `toy-ink:${thickness}`;
  return material;
}

export function paint(
  colour: THREE.ColorRepresentation,
  {
    rough = 0.48,
    metal = 0,
    emissive = 0x000000,
    glow = 0,
  }: { rough?: number; metal?: number; emissive?: THREE.ColorRepresentation; glow?: number } = {},
): THREE.MeshPhysicalMaterial {
  // A clear coat gives painted toys their white streak of highlight.
  return new THREE.MeshPhysicalMaterial({
    color: colour,
    roughness: rough,
    metalness: metal,
    emissive,
    emissiveIntensity: glow,
    clearcoat: 0.5,
    clearcoatRoughness: 0.25,
  });
}

export function rbox(
  w: number,
  h: number,
  d: number,
  r = 0.03,
  segments = 3,
): THREE.BufferGeometry {
  return new RoundedBoxGeometry(w, h, d, segments, Math.min(r, w / 2, h / 2, d / 2) * 0.999);
}

/** A mesh with its ink outline; `ink` null draws the mesh alone. */
export function inked(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  ink: THREE.Material | null,
): THREE.Group {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  group.add(mesh);
  if (!ink) return group;
  const hull = geometry.clone();
  for (const name of Object.keys(hull.attributes))
    if (name !== "position") hull.deleteAttribute(name);
  const welded = mergeVertices(hull, 1e-4);
  hull.dispose();
  welded.computeVertexNormals();
  const outline = new THREE.Mesh(welded, ink);
  outline.renderOrder = -1;
  group.add(outline);
  return group;
}

export function starShape(outer: number, inner: number, points = 5, turn = Math.PI / 2) {
  const shape = new THREE.Shape();
  for (let index = 0; index <= points * 2; index += 1) {
    const r = index % 2 === 0 ? outer : inner;
    const a = turn + (index * Math.PI) / points;
    if (index === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return shape;
}

/** A star whose corners are rounded, so a sunburst reads as cast metal, not paper. */
export function roundedStarShape(
  outer: number,
  inner: number,
  points: number,
  turn = Math.PI / 2,
  soft = 0.35,
): THREE.Shape {
  const corners: THREE.Vector2[] = [];
  for (let index = 0; index < points * 2; index += 1) {
    const r = index % 2 === 0 ? outer : inner;
    const a = turn + (index * Math.PI) / points;
    corners.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }
  const mid = (a: THREE.Vector2, b: THREE.Vector2, t: number) =>
    new THREE.Vector2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
  const shape = new THREE.Shape();
  const start = mid(corners[corners.length - 1]!, corners[0]!, 1 - soft / 2);
  shape.moveTo(start.x, start.y);
  corners.forEach((corner, index) => {
    const next = corners[(index + 1) % corners.length]!;
    const out = mid(corner, next, soft / 2);
    shape.quadraticCurveTo(corner.x, corner.y, out.x, out.y);
    const before = mid(corner, next, 1 - soft / 2);
    shape.lineTo(before.x, before.y);
  });
  return shape;
}

/** Extruded and centred on z, with a rounded bevel. */
export function extrude(
  shape: THREE.Shape | THREE.Shape[],
  depth: number,
  bevel = 0.02,
  bevelSegments = 3,
  curveSegments = 18,
): THREE.BufferGeometry {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments,
    curveSegments,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

/** A soft five-point star: the gold chest's emblem, its coins and the knowledge star. */
export function roundedStarGeometry(outer: number, inner: number, depth: number, bevel: number) {
  return extrude(roundedStarShape(outer, inner, 5, Math.PI / 2, 0.3), depth, bevel, 2, 10);
}

/** Every geometry and material under `root`, each disposed once. */
export function disposeToy(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
      materials.add(material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}
