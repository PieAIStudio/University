/**
 * Compact, merge-compatible miniature props for the distant archipelago.
 *
 * Every call returns a newly owned indexed geometry. Source primitives are
 * disposed immediately after merging; this module deliberately keeps no
 * permanent geometry or material cache.
 */
import * as THREE from "three";
import { mergeBufferGeometries } from "three-stdlib";

import { createSmoothIcosahedron } from "./foliage-geometry.js";
import { miniatureBevelBox } from "./miniature-bevel.js";
import donorShapes from "./kenney-rock-shapes.json" with { type: "json" };

export type MiniatureAssetKind =
  | "fir"
  | "broadleaf"
  | "blossom"
  | "autumn"
  | "stone"
  | "crystal"
  | "ruin"
  | "windmill"
  | "gate"
  | "fence"
  | "flowers"
  | "grass"
  | "fern"
  | "snowpeak";

export interface MiniatureAssetBounds {
  /** Exact maximum distance from the local Y axis across emitted vertices. */
  readonly radius: number;
  /** Exact emitted maxY - minY. Tall assets are normalized to one. */
  readonly height: number;
}

/** Exact course projection counts, checked against the emitted geometry. */
export const COURSE_SCENIC_TREE_TRIANGLES = { fir: 408, broadleaf: 432 } as const;

type Point = readonly [number, number, number];

interface PartTransform {
  readonly position?: Point;
  readonly rotation?: Point;
  readonly scale?: Point;
  readonly quaternion?: THREE.Quaternion;
}

const COLORS = {
  bark: 0x765038,
  barkLight: 0x9a6943,
  firDeep: 0x2f674b,
  firMid: 0x458755,
  firLight: 0x74ac5c,
  firTip: 0x9aca6c,
  leafDeep: 0x3d7f55,
  leafMid: 0x65a85d,
  leafLight: 0x92c86e,
  blossomDeep: 0xe88fa8,
  blossomMid: 0xf3aec0,
  blossomLight: 0xf9ced7,
  autumnDeep: 0xc86835,
  autumnMid: 0xe68b3f,
  autumnLight: 0xf3b34f,
  stoneDeep: 0x657184,
  stoneMid: 0x8793a2,
  stoneLight: 0xaab3bd,
  ruin: 0xa7a39a,
  ruinLight: 0xc3beb2,
  crystalDeep: 0x2aa5c7,
  crystalMid: 0x4fcbe1,
  crystalLight: 0x8ee9ef,
  crystalGlint: 0xc8fbf7,
  cream: 0xf0dfbd,
  creamShade: 0xd8c69f,
  roof: 0x4f8f87,
  roofLight: 0x75aca0,
  gate: 0xa45d3d,
  gateDark: 0x74422f,
  gold: 0xe5b85b,
  grassDeep: 0x4e8d4c,
  grassMid: 0x6eaa52,
  grassLight: 0x94c45d,
  petalPink: 0xf3a6bd,
  petalCream: 0xffefdc,
  snow: 0xf4f6ed,
  snowShade: 0xcfe1df,
} as const;

const TALL_ASSET_KINDS: readonly MiniatureAssetKind[] = [
  "fir",
  "broadleaf",
  "blossom",
  "autumn",
  "crystal",
  "ruin",
  "windmill",
  "gate",
  "snowpeak",
];

function ensureIndexed(geometry: THREE.BufferGeometry): void {
  if (geometry.getIndex()) return;
  const count = geometry.getAttribute("position").count;
  geometry.setIndex(Array.from({ length: count }, (_, index) => index));
}

/** THREE.Color converts the authored sRGB swatch into linear working values. */
function paintGeometry(geometry: THREE.BufferGeometry, color: number): void {
  const linear = new THREE.Color().setHex(color, THREE.SRGBColorSpace);
  const count = geometry.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) linear.toArray(colors, index * 3);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

function addPart(
  parts: THREE.BufferGeometry[],
  geometry: THREE.BufferGeometry,
  color: number,
  transform: PartTransform = {},
): void {
  geometry.deleteAttribute("uv");
  geometry.deleteAttribute("tangent");
  geometry.clearGroups();
  ensureIndexed(geometry);
  if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();

  const position = transform.position ?? [0, 0, 0];
  const rotation = transform.rotation ?? [0, 0, 0];
  const scale = transform.scale ?? [1, 1, 1];
  const quaternion =
    transform.quaternion?.clone() ??
    new THREE.Quaternion().setFromEuler(
      new THREE.Euler(rotation[0], rotation[1], rotation[2], "XYZ"),
    );
  geometry.applyMatrix4(
    new THREE.Matrix4().compose(
      new THREE.Vector3(position[0], position[1], position[2]),
      quaternion,
      new THREE.Vector3(scale[0], scale[1], scale[2]),
    ),
  );
  paintGeometry(geometry, color);
  parts.push(geometry);
}

function addBox(
  parts: THREE.BufferGeometry[],
  size: Point,
  position: Point,
  color: number,
  rotation: Point = [0, 0, 0],
): void {
  addPart(parts, miniatureBevelBox(size), color, {
    position,
    rotation,
  });
}

function addCylinder(
  parts: THREE.BufferGeometry[],
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segments: number,
  position: Point,
  color: number,
  rotation: Point = [0, 0, 0],
): void {
  addPart(parts, new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), color, {
    position,
    rotation,
  });
}

function addCone(
  parts: THREE.BufferGeometry[],
  radius: number,
  height: number,
  segments: number,
  position: Point,
  color: number,
  quaternion?: THREE.Quaternion,
): void {
  addPart(parts, new THREE.ConeGeometry(radius, height, segments), color, {
    position,
    quaternion,
  });
}

function addSmoothLobe(
  parts: THREE.BufferGeometry[],
  position: Point,
  scale: Point,
  color: number,
  rotation: Point = [0, 0, 0],
  detail = 0,
): void {
  addPart(parts, createSmoothIcosahedron(detail, 0.45), color, {
    position,
    rotation,
    scale,
  });
}

function createFacetedIcosahedron(): THREE.BufferGeometry {
  const smooth = createSmoothIcosahedron(0);
  const faceted = smooth.toNonIndexed();
  smooth.dispose();
  ensureIndexed(faceted);
  faceted.computeVertexNormals();
  return faceted;
}

function addFacetedBoulder(
  parts: THREE.BufferGeometry[],
  position: Point,
  scale: Point,
  color: number,
  rotation: Point,
): void {
  addPart(parts, createFacetedIcosahedron(), color, { position, scale, rotation });
}

function flatTriangleGeometry(
  triangles: readonly (readonly [Point, Point, Point])[],
): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const triangle of triangles) {
    for (const point of triangle) positions.push(point[0], point[1], point[2]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  ensureIndexed(geometry);
  geometry.computeVertexNormals();
  return geometry;
}

function ellipsePoint(
  centerX: number,
  centerZ: number,
  radiusX: number,
  radiusZ: number,
  y: number,
  index: number,
  sides: number,
  phase: number,
): Point {
  const angle = phase + (index / sides) * Math.PI * 2;
  return [centerX + Math.cos(angle) * radiusX, y, centerZ + Math.sin(angle) * radiusZ];
}

function createFacetedFrustum(options: {
  readonly bottomCenter: readonly [number, number];
  readonly topCenter: readonly [number, number];
  readonly bottomRadius: readonly [number, number];
  readonly topRadius: readonly [number, number];
  readonly bottomY: number;
  readonly topY: number;
  readonly sides: number;
  readonly phase?: number;
  readonly capBottom?: boolean;
  readonly capTop?: boolean;
}): THREE.BufferGeometry {
  const phase = options.phase ?? 0;
  const bottom = Array.from({ length: options.sides }, (_, index) =>
    ellipsePoint(
      options.bottomCenter[0],
      options.bottomCenter[1],
      options.bottomRadius[0],
      options.bottomRadius[1],
      options.bottomY,
      index,
      options.sides,
      phase,
    ),
  );
  const top = Array.from({ length: options.sides }, (_, index) =>
    ellipsePoint(
      options.topCenter[0],
      options.topCenter[1],
      options.topRadius[0],
      options.topRadius[1],
      options.topY,
      index,
      options.sides,
      phase,
    ),
  );
  const triangles: Array<readonly [Point, Point, Point]> = [];
  for (let index = 0; index < options.sides; index += 1) {
    const next = (index + 1) % options.sides;
    triangles.push([bottom[index]!, top[next]!, bottom[next]!]);
    triangles.push([bottom[index]!, top[index]!, top[next]!]);
    if (options.capBottom)
      triangles.push([
        [options.bottomCenter[0], options.bottomY, options.bottomCenter[1]],
        bottom[index]!,
        bottom[next]!,
      ]);
    if (options.capTop)
      triangles.push([
        [options.topCenter[0], options.topY, options.topCenter[1]],
        top[next]!,
        top[index]!,
      ]);
  }
  return flatTriangleGeometry(triangles);
}

function createFacetedCone(options: {
  readonly center: readonly [number, number];
  readonly radius: readonly [number, number];
  readonly bottomY: number;
  readonly tip: Point;
  readonly sides: number;
  readonly phase?: number;
  readonly capBottom?: boolean;
}): THREE.BufferGeometry {
  const phase = options.phase ?? 0;
  const ring = Array.from({ length: options.sides }, (_, index) =>
    ellipsePoint(
      options.center[0],
      options.center[1],
      options.radius[0],
      options.radius[1],
      options.bottomY,
      index,
      options.sides,
      phase,
    ),
  );
  const triangles: Array<readonly [Point, Point, Point]> = [];
  for (let index = 0; index < options.sides; index += 1) {
    const next = (index + 1) % options.sides;
    triangles.push([ring[index]!, options.tip, ring[next]!]);
    if (options.capBottom)
      triangles.push([
        [options.center[0], options.bottomY, options.center[1]],
        ring[index]!,
        ring[next]!,
      ]);
  }
  return flatTriangleGeometry(triangles);
}

/** Five-sided shaft with a tapered shoulder and an offset point. */
function createCrystalShard(
  centerX: number,
  centerZ: number,
  radius: number,
  height: number,
  leanX: number,
  leanZ: number,
  phase: number,
): THREE.BufferGeometry {
  const sides = 5;
  const shoulderY = height * 0.72;
  const bottom = Array.from({ length: sides }, (_, index) =>
    ellipsePoint(centerX, centerZ, radius, radius * 0.84, 0, index, sides, phase),
  );
  const shoulder = Array.from({ length: sides }, (_, index) =>
    ellipsePoint(
      centerX + leanX * 0.72,
      centerZ + leanZ * 0.72,
      radius * 0.72,
      radius * 0.62,
      shoulderY,
      index,
      sides,
      phase,
    ),
  );
  const tip: Point = [centerX + leanX, height, centerZ + leanZ];
  const triangles: Array<readonly [Point, Point, Point]> = [];
  for (let index = 0; index < sides; index += 1) {
    const next = (index + 1) % sides;
    triangles.push([bottom[index]!, shoulder[next]!, bottom[next]!]);
    triangles.push([bottom[index]!, shoulder[index]!, shoulder[next]!]);
    triangles.push([shoulder[index]!, tip, shoulder[next]!]);
    triangles.push([[centerX, 0, centerZ], bottom[index]!, bottom[next]!]);
  }
  return flatTriangleGeometry(triangles);
}

/** Rooted, curved lanceolate leaf. Two diamond sections and two poles form
 * a closed sixteen-triangle solid; the broad middle replaces upright fins.
 */
function createGrassBlade(
  height: number,
  width: number,
  depth: number,
  bend: number,
): THREE.BufferGeometry {
  const points = [new THREE.Vector3(0, 0, 0)];
  for (const [t, spread] of [
    [0.34, 0.7],
    [0.7, 1],
  ]) {
    const x = bend * t! * t!,
      y = height * t!;
    points.push(
      new THREE.Vector3(x + width * spread! * 0.5, y, 0),
      new THREE.Vector3(x, y, depth * 0.5),
      new THREE.Vector3(x - width * spread! * 0.5, y, 0),
      new THREE.Vector3(x, y, -depth * 0.5),
    );
  }
  points.push(new THREE.Vector3(bend, height, 0));
  const indices: number[] = [];
  const centre = new THREE.Vector3(bend * 0.35, height * 0.52, 0);
  const triangle = (a: number, b: number, c: number) => {
    const normal = points[b]!.clone().sub(points[a]!).cross(points[c]!.clone().sub(points[a]!));
    const outward = points[a]!.clone()
      .add(points[b]!)
      .add(points[c]!)
      .multiplyScalar(1 / 3)
      .sub(centre);
    indices.push(...(normal.dot(outward) > 0 ? [a, b, c] : [a, c, b]));
  };
  for (let side = 0; side < 4; side++) {
    const next = (side + 1) % 4;
    triangle(0, 1 + side, 1 + next);
    triangle(1 + side, 5 + side, 5 + next);
    triangle(1 + side, 5 + next, 1 + next);
    triangle(9, 5 + next, 5 + side);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      points.flatMap((p) => p.toArray()),
      3,
    ),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildFir(): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  addCylinder(parts, 0.052, 0.075, 0.46, 6, [0, 0.23, 0], COLORS.bark);
  // One rounded, tapered crown. Four flattened ico lobes read as a stack of
  // plates at catalogue scale; spend triangles on the continuous silhouette.
  const profile = [
    [0, 0.22],
    [0.2, 0.23],
    [0.315, 0.28],
    [0.335, 0.33],
    [0.308, 0.4],
    [0.234, 0.51],
    [0.211, 0.55],
    [0.245, 0.56],
    [0.25, 0.6],
    [0.212, 0.67],
    [0.16, 0.77],
    [0.14, 0.78],
    [0.17, 0.8],
    [0.172, 0.84],
    [0.14, 0.9],
    [0.079, 0.99],
    [0.025, 1.06],
    [0, 1.075],
  ] as const;
  const crown = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    12,
  );
  // LatheGeometry emits a collapsed triangle at each pole; remove those,
  // retaining its analytic smooth normals and the single closed silhouette.
  const position = crown.getAttribute("position"),
    source = crown.getIndex()!;
  const indices: number[] = [];
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  for (let i = 0; i < source.count; i += 3) {
    a.fromBufferAttribute(position, source.getX(i));
    b.fromBufferAttribute(position, source.getX(i + 1));
    c.fromBufferAttribute(position, source.getX(i + 2));
    if (b.sub(a).cross(c.sub(a)).lengthSq() > 1e-14)
      indices.push(source.getX(i), source.getX(i + 1), source.getX(i + 2));
  }
  crown.setIndex(indices);
  // As in course crowns, a mass of leaves receives scattered sky light.
  // Bend only crown normals; trunks and rocks retain their real hard planes.
  const normals = crown.getAttribute("normal");
  for (let i = 0; i < normals.count; i++) {
    a.fromBufferAttribute(normals, i);
    // Keep the skirt's real change of plane. Forcing every normal upward
    // erased the three tiers into a uniformly lit plastic mound. A modest
    // wrap retains soft sky scatter without removing the shaded underside.
    a.y += 0.34;
    a.normalize();
    normals.setXYZ(i, a.x, a.y, a.z);
  }
  addPart(parts, crown, COLORS.firMid);
  const colors = crown.getAttribute("color");
  const low = new THREE.Color(COLORS.firMid),
    high = new THREE.Color(COLORS.firLight);
  const tone = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    tone.copy(low).lerp(high, THREE.MathUtils.smoothstep(position.getY(i), 0.35, 1.04) * 0.65);
    colors.setXYZ(i, tone.r, tone.g, tone.b);
  }
  return parts;
}

function addBranches(parts: THREE.BufferGeometry[]): void {
  addBox(parts, [0.075, 0.31, 0.075], [0.09, 0.51, 0], COLORS.barkLight, [0, 0.1, -0.55]);
  addBox(parts, [0.07, 0.28, 0.07], [-0.09, 0.5, -0.015], COLORS.bark, [0.08, -0.2, 0.62]);
}

function buildBroadleaf(detail = 0): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  addCylinder(parts, 0.065, 0.095, 0.56, 6, [0, 0.28, 0], COLORS.bark);
  addBranches(parts);
  // Compile the five growth masses into ONE continuous crown. Intersecting
  // differently coloured balls produced hard saw-tooth seams at close range.
  // Rays start inside the central growth mass; real positive exits through
  // peripheral masses shape a connected radial envelope. Missed ellipsoids
  // contribute nothing. The shell stays within the original tree reserve.
  const crown = createSmoothIcosahedron(detail ? 3 : 2);
  const centre = new THREE.Vector3(0, 0.78, 0);
  const lobes = [
    { at: [0, 0.77, 0], r: [0.255, 0.215, 0.24] },
    { at: [-0.225, 0.72, 0.025], r: [0.185, 0.19, 0.18] },
    { at: [0.22, 0.82, -0.02], r: [0.195, 0.205, 0.18] },
    { at: [0.012, 0.96, 0.045], r: [0.2, 0.175, 0.19] },
    { at: [-0.018, 0.7, -0.19], r: [0.205, 0.18, 0.19] },
  ];
  const positions = crown.getAttribute("position"),
    direction = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    direction.fromBufferAttribute(positions, i).normalize();
    let reach = 0;
    for (const lobe of lobes) {
      let a = 0,
        b = 0,
        c = -1;
      for (let axis = 0; axis < 3; axis++) {
        const offset = (centre.getComponent(axis) - lobe.at[axis]!) / lobe.r[axis]!;
        const d = direction.getComponent(axis) / lobe.r[axis]!;
        a += d * d;
        b += 2 * d * offset;
        c += offset * offset;
      }
      const discriminant = b * b - 4 * a * c;
      if (discriminant < 0) continue;
      const exit = (-b + Math.sqrt(discriminant)) / (2 * a);
      if (exit <= 0) continue;
      const h = Math.max(0, 0.026 - Math.abs(reach - exit)) / 0.026;
      reach = Math.max(reach, exit) + h * h * 0.0065;
    }
    const p = direction.clone().multiplyScalar(reach).add(centre);
    const radial = Math.hypot(p.x, p.z);
    if (radial > 0.43) {
      p.x *= 0.43 / radial;
      p.z *= 0.43 / radial;
    }
    positions.setXYZ(i, p.x, p.y, p.z);
  }
  crown.computeVertexNormals();
  const normals = crown.getAttribute("normal");
  for (let i = 0; i < normals.count; i++) {
    direction.fromBufferAttribute(normals, i);
    direction.y += 0.22;
    direction.normalize();
    normals.setXYZ(i, direction.x, direction.y, direction.z);
  }
  addPart(parts, crown, COLORS.leafMid);
  const colours = crown.getAttribute("color"),
    shade = new THREE.Color(COLORS.leafMid),
    light = new THREE.Color(COLORS.leafLight);
  const pigment = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    pigment.copy(shade).lerp(light, THREE.MathUtils.smoothstep(positions.getY(i), 0.62, 1.1) * 0.6);
    colours.setXYZ(i, pigment.r, pigment.g, pigment.b);
  }
  return parts;
}

function buildBlossom(): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  addCylinder(parts, 0.06, 0.09, 0.58, 6, [0, 0.29, 0], COLORS.barkLight);
  addBranches(parts);
  addSmoothLobe(parts, [-0.02, 0.77, 0], [0.29, 0.25, 0.27], COLORS.blossomMid, [0, 0.2, 0], 1);
  addSmoothLobe(
    parts,
    [-0.22, 0.72, 0.025],
    [0.2, 0.19, 0.19],
    COLORS.blossomDeep,
    [0, -0.35, 0.04],
  );
  addSmoothLobe(parts, [0.21, 0.74, -0.03], [0.21, 0.2, 0.2], COLORS.blossomLight, [0, 0.5, -0.04]);
  addSmoothLobe(parts, [0.065, 0.92, 0.02], [0.21, 0.19, 0.2], COLORS.blossomLight, [0, -0.2, 0]);
  addSmoothLobe(parts, [-0.11, 0.9, -0.06], [0.17, 0.16, 0.17], COLORS.blossomMid, [0, 0.7, 0]);
  return parts;
}

function buildAutumn(): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  addCylinder(parts, 0.065, 0.095, 0.56, 6, [0, 0.28, 0], COLORS.bark);
  addBranches(parts);
  addSmoothLobe(parts, [0, 0.76, 0], [0.31, 0.27, 0.28], COLORS.autumnMid, [0, 0.2, 0], 1);
  addSmoothLobe(
    parts,
    [-0.2, 0.72, 0.03],
    [0.225, 0.21, 0.21],
    COLORS.autumnDeep,
    [0, -0.45, 0.05],
  );
  addSmoothLobe(
    parts,
    [0.2, 0.75, -0.025],
    [0.23, 0.215, 0.21],
    COLORS.autumnLight,
    [0, 0.5, -0.04],
  );
  addSmoothLobe(parts, [0.03, 0.91, 0.02], [0.225, 0.2, 0.215], COLORS.autumnLight, [0, -0.2, 0]);
  return parts;
}

function buildFern(): THREE.BufferGeometry[] {
  const source = donorShapes.assets.find((asset) => asset.id === "plant_flatShort")!;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      source.vertices.flatMap((v) => [v[0]! * 0.36, v[1]! * 0.3, v[2]! * 0.36]),
      3,
    ),
  );
  geometry.setIndex(source.faces.flat());
  geometry.computeVertexNormals();
  const parts: THREE.BufferGeometry[] = [];
  addPart(parts, geometry, 0x5f9446);
  const position = geometry.getAttribute("position"),
    color = geometry.getAttribute("color");
  const low = new THREE.Color(0x4f7c42),
    high = new THREE.Color(0xa7c65a);
  const shade = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    shade.copy(low).lerp(high, Math.min(1, Math.hypot(position.getX(i), position.getZ(i)) / 0.36));
    color.setXYZ(i, shade.r, shade.g, shade.b);
  }
  return parts;
}

function buildStone(): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  // One squat, bevelled block with a real flat foot and an offset crown.
  // These two open bands meet exactly: no hidden cap or second overlapping rock.
  addPart(
    parts,
    createFacetedFrustum({
      bottomCenter: [-0.07, -0.015],
      topCenter: [-0.065, 0],
      bottomRadius: [0.23, 0.22],
      topRadius: [0.34, 0.29],
      bottomY: 0,
      topY: 0.08,
      sides: 5,
      phase: 0.25,
      capBottom: true,
    }),
    COLORS.stoneDeep,
  );
  addPart(
    parts,
    createFacetedFrustum({
      bottomCenter: [-0.065, 0],
      topCenter: [-0.08, -0.025],
      bottomRadius: [0.34, 0.29],
      topRadius: [0.29, 0.25],
      bottomY: 0.08,
      topY: 0.42,
      sides: 5,
      phase: 0.25,
    }),
    COLORS.stoneMid,
  );
  addPart(
    parts,
    createFacetedFrustum({
      bottomCenter: [-0.08, -0.025],
      topCenter: [-0.11, -0.03],
      bottomRadius: [0.29, 0.25],
      topRadius: [0.24, 0.2],
      bottomY: 0.42,
      topY: 0.5,
      sides: 5,
      phase: 0.25,
      capTop: true,
    }),
    COLORS.stoneLight,
  );
  addFacetedBoulder(
    parts,
    [0.27, 0.135, 0.045],
    [0.19, 0.145, 0.17],
    COLORS.stoneLight,
    [-0.1, -0.35, 0.08],
  );
  addFacetedBoulder(
    parts,
    [-0.32, 0.105, 0.09],
    [0.15, 0.11, 0.13],
    COLORS.stoneDeep,
    [0.16, 0.4, -0.08],
  );
  return parts;
}

function buildCrystal(): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  addPart(parts, createCrystalShard(0, 0, 0.17, 1, 0.045, -0.02, 0.2), COLORS.crystalLight);
  addPart(
    parts,
    createCrystalShard(-0.18, 0.035, 0.125, 0.62, -0.035, 0.02, 0.7),
    COLORS.crystalMid,
  );
  addPart(parts, createCrystalShard(0.17, 0.06, 0.115, 0.5, 0.04, 0.025, -0.1), COLORS.crystalDeep);
  addPart(
    parts,
    createCrystalShard(0.03, -0.15, 0.09, 0.38, -0.015, -0.03, 0.45),
    COLORS.crystalGlint,
  );
  // Long crystal planes catch different mineral values. This is baked
  // vertex colour in the existing opaque kit, not bloom or per-shard lights.
  const glint = new THREE.Color(COLORS.crystalGlint),
    tone = new THREE.Color();
  for (const part of parts) {
    const normals = part.getAttribute("normal"),
      colors = part.getAttribute("color");
    for (let i = 0; i < colors.count; i++) {
      const facing = THREE.MathUtils.clamp(normals.getX(i) * 0.6 + normals.getZ(i) * 0.4, 0, 1);
      const cap = Math.max(0, normals.getY(i));
      tone
        .setRGB(colors.getX(i), colors.getY(i), colors.getZ(i))
        .lerp(glint, facing * 0.32 + cap * 0.25);
      colors.setXYZ(i, tone.r, tone.g, tone.b);
    }
  }
  return parts;
}

function buildRuin(): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  addBox(parts, [0.19, 0.37, 0.2], [-0.25, 0.185, 0], COLORS.ruin, [0, 0.04, 0.015]);
  addBox(parts, [0.18, 0.34, 0.19], [0.25, 0.17, 0], COLORS.ruinLight, [0, -0.035, -0.012]);
  addBox(parts, [0.175, 0.34, 0.185], [-0.245, 0.53, 0], COLORS.ruinLight, [0.01, -0.02, -0.025]);
  addBox(parts, [0.17, 0.35, 0.185], [0.245, 0.515, 0], COLORS.ruin, [-0.015, 0.03, 0.02]);
  addBox(parts, [0.67, 0.17, 0.21], [0, 0.755, 0], COLORS.ruinLight, [0.01, 0, -0.025]);
  addBox(parts, [0.22, 0.14, 0.19], [-0.2, 0.91, 0.005], COLORS.ruin, [0.04, 0.08, 0.1]);
  return parts;
}

function buildWindmill(): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  addCylinder(parts, 0.205, 0.285, 0.62, 8, [0, 0.31, 0], COLORS.creamShade);
  addCone(parts, 0.305, 0.24, 8, [0, 0.74, 0], COLORS.roof);
  addBox(parts, [0.12, 0.23, 0.035], [0, 0.135, 0.272], COLORS.gateDark);
  addBox(parts, [0.085, 0.105, 0.03], [-0.09, 0.43, 0.225], COLORS.roofLight);
  addCylinder(parts, 0.055, 0.055, 0.12, 5, [0, 0.57, 0.34], COLORS.gold, [Math.PI / 2, 0, 0]);

  for (let blade = 0; blade < 4; blade += 1) {
    const angle = Math.PI / 4 + blade * (Math.PI / 2);
    const distance = 0.25;
    addBox(
      parts,
      [0.15, 0.4, 0.032],
      [-Math.sin(angle) * distance, 0.57 + Math.cos(angle) * distance, 0.365],
      blade % 2 === 0 ? COLORS.cream : COLORS.creamShade,
      [0, 0, angle],
    );
    // A pale sail face and one raised wooden spar read at catalogue size;
    // this stays in the same opaque assembly, with no moving hit geometry.
    addBox(
      parts,
      [0.022, 0.4, 0.025],
      [-Math.sin(angle) * distance, 0.57 + Math.cos(angle) * distance, 0.392],
      COLORS.barkLight,
      [0, 0, angle],
    );
  }
  return parts;
}

function buildGate(): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  addCylinder(parts, 0.05, 0.068, 0.72, 6, [-0.25, 0.36, 0], COLORS.gate);
  addCylinder(parts, 0.05, 0.068, 0.72, 6, [0.25, 0.36, 0], COLORS.gate);
  addBox(parts, [0.76, 0.095, 0.125], [0, 0.79, 0], COLORS.gateDark, [0, 0, -0.015]);
  addBox(parts, [0.57, 0.07, 0.09], [0, 0.65, 0], COLORS.gate, [0, 0, 0.012]);
  addCone(parts, 0.085, 0.1, 6, [-0.25, 0.75, 0], COLORS.gold);
  addCone(parts, 0.085, 0.1, 6, [0.25, 0.75, 0], COLORS.gold);
  return parts;
}

function buildFence(): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  for (const x of [-0.47, 0, 0.47])
    addCylinder(parts, 0.045, 0.056, 0.45, 6, [x, 0.225, 0], COLORS.barkLight, [0, 0, x * 0.025]);
  addBox(parts, [1.03, 0.075, 0.07], [0, 0.17, 0.012], COLORS.barkLight, [0, 0, 0.025]);
  addBox(parts, [1.03, 0.075, 0.07], [0, 0.34, -0.012], COLORS.gate, [0, 0, -0.02]);
  return parts;
}

function outwardQuaternion(x: number, y: number, z: number): THREE.Quaternion {
  return new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(x, y, z).normalize(),
  );
}

function addFlower(
  parts: THREE.BufferGeometry[],
  x: number,
  z: number,
  height: number,
  turn: number,
  petalColor: number,
): void {
  const stemHeight = height - 0.035;
  addCylinder(parts, 0.01, 0.014, stemHeight, 4, [x, stemHeight / 2, z], COLORS.grassDeep);
  for (let petal = 0; petal < 5; petal += 1) {
    const angle = turn + (petal / 5) * Math.PI * 2;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    // A closed, rounded six-edge petal has a readable face from above.
    // Radial cones made pinwheel spikes, not the broad daisies in the brief.
    const outline = Array.from({ length: 6 }, (_, i): Point => {
      const angle = (i * Math.PI) / 3;
      return [Math.cos(angle) * 0.07, 0, Math.sin(angle) * 0.041];
    });
    const faces: Array<readonly [Point, Point, Point]> = [];
    for (let i = 0; i < outline.length; i++) {
      const next = (i + 1) % outline.length;
      faces.push([[0, 0.016, 0], outline[next]!, outline[i]!]);
      faces.push([[0, -0.01, 0], outline[i]!, outline[next]!]);
    }
    addPart(parts, flatTriangleGeometry(faces), petalColor, {
      position: [x + dx * 0.065, height, z + dz * 0.065],
      rotation: [0, -angle, 0],
    });
  }
  addPart(parts, createSmoothIcosahedron(0, 0.35), COLORS.gold, {
    position: [x, height + 0.006, z],
    scale: [0.04, 0.035, 0.04],
  });
}

function buildFlowers(): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  addFlower(parts, -0.12, 0.025, 0.15, 0.15, COLORS.petalPink);
  addFlower(parts, 0.13, -0.025, 0.13, 0.7, COLORS.petalCream);
  addSmoothLobe(parts, [-0.11, 0.05, 0.025], [0.09, 0.048, 0.07], COLORS.grassLight);
  addSmoothLobe(parts, [0.12, 0.045, -0.025], [0.085, 0.043, 0.07], COLORS.grassMid);
  addCone(
    parts,
    0.029,
    0.115,
    4,
    [-0.055, 0.105, 0.015],
    COLORS.grassLight,
    outwardQuaternion(-0.9, 0.25, 0.25),
  );
  addCone(
    parts,
    0.029,
    0.105,
    4,
    [0.075, 0.085, -0.015],
    COLORS.grassMid,
    outwardQuaternion(0.75, 0.3, -0.35),
  );
  return parts;
}

function buildGrass(): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const recipes = [
    { x: 0, z: 0, height: 0.39, width: 0.095, bend: 0.035, turn: 0.1, color: COLORS.grassDeep },
    {
      x: -0.07,
      z: 0.015,
      height: 0.31,
      width: 0.085,
      bend: -0.03,
      turn: 1.25,
      color: COLORS.grassMid,
    },
    {
      x: 0.07,
      z: 0.02,
      height: 0.34,
      width: 0.085,
      bend: 0.025,
      turn: 2.5,
      color: COLORS.grassLight,
    },
    {
      x: -0.035,
      z: -0.065,
      height: 0.27,
      width: 0.075,
      bend: 0.02,
      turn: 3.75,
      color: COLORS.grassLight,
    },
    {
      x: 0.035,
      z: -0.06,
      height: 0.29,
      width: 0.078,
      bend: -0.025,
      turn: 5,
      color: COLORS.grassMid,
    },
  ] as const;
  for (const recipe of recipes)
    addPart(
      parts,
      // Low, fanned tufts read as lush meadow at catalogue scale; the former
      // tall narrow blades became dark upright pins. Same five closed blades.
      createGrassBlade(recipe.height * 0.62, recipe.width * 1.65, 0.032, recipe.bend * 2.8),
      recipe.color,
      {
        position: [recipe.x, 0, recipe.z],
        rotation: [0, recipe.turn, 0],
      },
    );
  return parts;
}

function buildSnowpeak(): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  addPart(
    parts,
    createFacetedFrustum({
      bottomCenter: [0, 0],
      topCenter: [0.08, -0.045],
      bottomRadius: [0.43, 0.34],
      topRadius: [0.185, 0.145],
      bottomY: 0,
      topY: 0.69,
      sides: 7,
      phase: 0.18,
      capBottom: true,
    }),
    COLORS.stoneMid,
  );
  addPart(
    parts,
    createFacetedCone({
      center: [0.08, -0.045],
      radius: [0.185, 0.145],
      bottomY: 0.69,
      tip: [0.145, 1, -0.075],
      sides: 7,
      phase: 0.18,
    }),
    COLORS.snow,
  );
  addPart(
    parts,
    createFacetedCone({
      center: [-0.285, 0.055],
      radius: [0.18, 0.145],
      bottomY: 0,
      tip: [-0.2, 0.56, 0.08],
      sides: 6,
      phase: 0.05,
      capBottom: true,
    }),
    COLORS.stoneDeep,
  );
  addPart(
    parts,
    createFacetedCone({
      center: [0.28, 0.09],
      radius: [0.14, 0.12],
      bottomY: 0,
      tip: [0.235, 0.39, 0.055],
      sides: 6,
      phase: 0.4,
      capBottom: true,
    }),
    COLORS.snowShade,
  );
  return parts;
}

function finishGeometry(parts: THREE.BufferGeometry[], tall: boolean): THREE.BufferGeometry {
  let merged: THREE.BufferGeometry | null = null;
  try {
    merged = mergeBufferGeometries(parts, false);
  } finally {
    for (const part of parts) part.dispose();
  }
  if (!merged) throw new Error("Miniature asset parts must have identical indexed attributes");

  const position = merged.getAttribute("position");
  let minY = Infinity;
  let maxY = -Infinity;
  for (let index = 0; index < position.count; index += 1) {
    minY = Math.min(minY, position.getY(index));
    maxY = Math.max(maxY, position.getY(index));
  }
  const height = maxY - minY;
  if (!(height > 0) || !Number.isFinite(height)) {
    merged.dispose();
    throw new Error("Miniature asset must have a finite positive height");
  }
  merged.translate(0, -minY, 0);
  if (tall) merged.scale(1, 1 / height, 1);

  let radius = 0;
  for (let index = 0; index < position.count; index += 1)
    radius = Math.max(radius, Math.hypot(position.getX(index), position.getZ(index)));
  if (radius > 0.7) merged.scale(0.7 / radius, 1, 0.7 / radius);

  position.needsUpdate = true;
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  merged.clearGroups();
  return merged;
}

function unreachable(kind: never): never {
  throw new Error(`Unknown miniature asset: ${String(kind)}`);
}

/** Create a newly owned, indexed, vertex-coloured miniature geometry. */
export function createMiniatureAsset(
  kind: MiniatureAssetKind,
  projection: "world" | "course" = "world",
): THREE.BufferGeometry {
  let parts: THREE.BufferGeometry[];
  switch (kind) {
    case "fir":
      parts = buildFir();
      break;
    case "broadleaf":
      // Same silhouette family; spend extra crown faces only where the
      // course camera can see them. Catalogue counts stay unchanged.
      parts = buildBroadleaf(projection === "course" ? 1 : 0);
      break;
    case "blossom":
      parts = buildBlossom();
      break;
    case "autumn":
      parts = buildAutumn();
      break;
    case "stone":
      parts = buildStone();
      break;
    case "crystal":
      parts = buildCrystal();
      break;
    case "ruin":
      parts = buildRuin();
      break;
    case "windmill":
      parts = buildWindmill();
      break;
    case "gate":
      parts = buildGate();
      break;
    case "fence":
      parts = buildFence();
      break;
    case "flowers":
      parts = buildFlowers();
      break;
    case "grass":
      parts = buildGrass();
      break;
    case "fern":
      parts = buildFern();
      break;
    case "snowpeak":
      parts = buildSnowpeak();
      break;
    default:
      return unreachable(kind);
  }
  return finishGeometry(parts, TALL_ASSET_KINDS.includes(kind));
}

/** Compute bounds without retaining geometry or allocating a global GPU resource. */
export function miniatureAssetBounds(kind: MiniatureAssetKind): MiniatureAssetBounds {
  const geometry = createMiniatureAsset(kind);
  try {
    const position = geometry.getAttribute("position");
    let minY = Infinity;
    let maxY = -Infinity;
    let radius = 0;
    for (let index = 0; index < position.count; index += 1) {
      minY = Math.min(minY, position.getY(index));
      maxY = Math.max(maxY, position.getY(index));
      radius = Math.max(radius, Math.hypot(position.getX(index), position.getZ(index)));
    }
    return { radius, height: maxY - minY };
  } finally {
    geometry.dispose();
  }
}
