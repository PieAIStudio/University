/** Deterministic, batched engineering geometry for the island's underside. */
import * as THREE from "three";

import type { IslandBlueprint, IslandOutlinePoint } from "./island-blueprint.js";
import { hash } from "./random.js";

export type IslandUndersideDetail = "course" | "world";

/**
 * One shared mount profile keeps the rock root and the metal hull fitted.
 * Ratios are relative to the authored outline and the resolved terrain depth.
 */
export const ISLAND_UNDERSIDE_MOUNT_PROFILE = {
  cliffShoulderRatio: 0.74,
  rootRatio: 0.52,
  stepDepthRatio: 0.74,
  rootDepthRatio: 0.86,
  plateOuterRatio: 0.72,
  rimInnerRatio: 0.58,
  panelInnerRatio: 0.2,
} as const;

export const ISLAND_UNDERSIDE_TRIANGLE_BUDGET = {
  world: 400,
  course: 700,
} as const;

const PANEL_TONES = [0x929ca4, 0x74818c, 0xa2aab0] as const;
const RIB = new THREE.Color(0xb3bac0);
const RIB_SIDE = new THREE.Color(0x85919b);
const CORE = new THREE.Color(0x7c8993);
const CORE_DARK = new THREE.Color(0x566570);
const POD = new THREE.Color(0x74838e);
const POD_DARK = new THREE.Color(0x4b5b67);
const CYAN = new THREE.Color(0x55d9ff);

interface GeometryBuffers {
  readonly positions: number[];
  readonly colors: number[];
  readonly indices: number[];
}

export interface IslandUndersideStats {
  readonly panelCount: number;
  readonly ribCount: number;
  readonly podCount: number;
  readonly structureTriangles: number;
  readonly glowTriangles: number;
  readonly plateTopY: number;
  readonly plateBottomY: number;
  readonly lipBottomY: number;
  readonly coreBottomY: number;
  readonly thrusterTopY: number;
}

export interface IslandUndersideGeometry {
  readonly structure: THREE.BufferGeometry;
  readonly glow: THREE.BufferGeometry;
  readonly stats: IslandUndersideStats;
}

type ExpectedNormal = readonly [number, number, number];

function scaledColor(color: THREE.Color, amount: number): THREE.Color {
  return color.clone().multiplyScalar(amount);
}

function pushVertex(buffers: GeometryBuffers, point: THREE.Vector3, color: THREE.Color): number {
  const index = buffers.positions.length / 3;
  buffers.positions.push(point.x, point.y, point.z);
  buffers.colors.push(color.r, color.g, color.b);
  return index;
}

/** Append a flat triangle and correct its winding toward an expected face normal. */
function appendTriangle(
  buffers: GeometryBuffers,
  first: THREE.Vector3,
  second: THREE.Vector3,
  third: THREE.Vector3,
  color: THREE.Color,
  expected: ExpectedNormal,
): void {
  const normal = new THREE.Vector3()
    .subVectors(second, first)
    .cross(new THREE.Vector3().subVectors(third, first));
  const dot = normal.x * expected[0] + normal.y * expected[1] + normal.z * expected[2];
  const start = pushVertex(buffers, first, color);
  if (dot >= 0) {
    pushVertex(buffers, second, color);
    pushVertex(buffers, third, color);
  } else {
    pushVertex(buffers, third, color);
    pushVertex(buffers, second, color);
  }
  buffers.indices.push(start, start + 1, start + 2);
}

function appendQuad(
  buffers: GeometryBuffers,
  first: THREE.Vector3,
  second: THREE.Vector3,
  third: THREE.Vector3,
  fourth: THREE.Vector3,
  color: THREE.Color,
  expected: ExpectedNormal,
): void {
  appendTriangle(buffers, first, second, third, color, expected);
  appendTriangle(buffers, first, third, fourth, color, expected);
}

function pointAtY(point: THREE.Vector3, y: number): THREE.Vector3 {
  return new THREE.Vector3(point.x, y, point.z);
}

function outwardNormal(first: THREE.Vector3, second: THREE.Vector3): ExpectedNormal {
  const x = first.x + second.x;
  const z = first.z + second.z;
  const length = Math.hypot(x, z) || 1;
  return [x / length, 0, z / length];
}

/** One annular sector with a visible outer and inner edge thickness. */
function appendSectorSolid(
  buffers: GeometryBuffers,
  innerFirst: THREE.Vector3,
  innerSecond: THREE.Vector3,
  outerSecond: THREE.Vector3,
  outerFirst: THREE.Vector3,
  topY: number,
  bottomY: number,
  topColor: THREE.Color,
  bottomColor: THREE.Color,
  edgeColor: THREE.Color,
): void {
  const innerFirstTop = pointAtY(innerFirst, topY);
  const innerSecondTop = pointAtY(innerSecond, topY);
  const outerSecondTop = pointAtY(outerSecond, topY);
  const outerFirstTop = pointAtY(outerFirst, topY);
  const innerFirstBottom = pointAtY(innerFirst, bottomY);
  const innerSecondBottom = pointAtY(innerSecond, bottomY);
  const outerSecondBottom = pointAtY(outerSecond, bottomY);
  const outerFirstBottom = pointAtY(outerFirst, bottomY);

  appendQuad(
    buffers,
    innerFirstTop,
    outerFirstTop,
    outerSecondTop,
    innerSecondTop,
    topColor,
    [0, 1, 0],
  );
  appendQuad(
    buffers,
    innerFirstBottom,
    innerSecondBottom,
    outerSecondBottom,
    outerFirstBottom,
    bottomColor,
    [0, -1, 0],
  );
  appendQuad(
    buffers,
    outerFirstTop,
    outerFirstBottom,
    outerSecondBottom,
    outerSecondTop,
    edgeColor,
    outwardNormal(outerFirst, outerSecond),
  );
  const innerOutward = outwardNormal(innerFirst, innerSecond);
  appendQuad(
    buffers,
    innerSecondTop,
    innerSecondBottom,
    innerFirstBottom,
    innerFirstTop,
    edgeColor,
    [-innerOutward[0], 0, -innerOutward[2]],
  );
}

/** A rectangular spar following an arbitrary radial line. */
function appendBeam(
  buffers: GeometryBuffers,
  start: THREE.Vector3,
  end: THREE.Vector3,
  width: number,
  startTopY: number,
  startBottomY: number,
  endTopY: number,
  endBottomY: number,
  faceColor: THREE.Color,
  sideColor: THREE.Color,
): void {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.hypot(dx, dz) || 1;
  const px = (-dz / length) * width * 0.5;
  const pz = (dx / length) * width * 0.5;
  const first = new THREE.Vector3(start.x + px, 0, start.z + pz);
  const second = new THREE.Vector3(end.x + px, 0, end.z + pz);
  const third = new THREE.Vector3(end.x - px, 0, end.z - pz);
  const fourth = new THREE.Vector3(start.x - px, 0, start.z - pz);
  const top = [
    pointAtY(first, startTopY),
    pointAtY(second, endTopY),
    pointAtY(third, endTopY),
    pointAtY(fourth, startTopY),
  ];
  const bottom = [
    pointAtY(first, startBottomY),
    pointAtY(second, endBottomY),
    pointAtY(third, endBottomY),
    pointAtY(fourth, startBottomY),
  ];
  const along: ExpectedNormal = [dx / length, 0, dz / length];
  const across: ExpectedNormal = [px / (width * 0.5), 0, pz / (width * 0.5)];

  appendQuad(buffers, top[0]!, top[1]!, top[2]!, top[3]!, faceColor, [0, 1, 0]);
  appendQuad(buffers, bottom[0]!, bottom[3]!, bottom[2]!, bottom[1]!, faceColor, [0, -1, 0]);
  appendQuad(buffers, top[0]!, bottom[0]!, bottom[1]!, top[1]!, sideColor, across);
  appendQuad(buffers, top[3]!, top[2]!, bottom[2]!, bottom[3]!, sideColor, [
    -across[0],
    0,
    -across[2],
  ]);
  appendQuad(buffers, top[1]!, bottom[1]!, bottom[2]!, top[2]!, sideColor, along);
  appendQuad(buffers, top[3]!, bottom[3]!, bottom[0]!, top[0]!, sideColor, [
    -along[0],
    0,
    -along[2],
  ]);
}

function appendFrustum(
  buffers: GeometryBuffers,
  center: THREE.Vector3,
  topY: number,
  bottomY: number,
  topRadiusX: number,
  topRadiusZ: number,
  bottomRadiusX: number,
  bottomRadiusZ: number,
  segments: number,
  phase: number,
  capColor: THREE.Color,
  sideColor: THREE.Color,
): void {
  const topCenter = new THREE.Vector3(center.x, topY, center.z);
  const bottomCenter = new THREE.Vector3(center.x, bottomY, center.z);
  for (let index = 0; index < segments; index += 1) {
    const angle = phase + (index / segments) * Math.PI * 2;
    const nextAngle = phase + ((index + 1) / segments) * Math.PI * 2;
    const topFirst = new THREE.Vector3(
      center.x + Math.cos(angle) * topRadiusX,
      topY,
      center.z + Math.sin(angle) * topRadiusZ,
    );
    const topSecond = new THREE.Vector3(
      center.x + Math.cos(nextAngle) * topRadiusX,
      topY,
      center.z + Math.sin(nextAngle) * topRadiusZ,
    );
    const bottomFirst = new THREE.Vector3(
      center.x + Math.cos(angle) * bottomRadiusX,
      bottomY,
      center.z + Math.sin(angle) * bottomRadiusZ,
    );
    const bottomSecond = new THREE.Vector3(
      center.x + Math.cos(nextAngle) * bottomRadiusX,
      bottomY,
      center.z + Math.sin(nextAngle) * bottomRadiusZ,
    );
    const normal: ExpectedNormal = [
      Math.cos((angle + nextAngle) * 0.5),
      0,
      Math.sin((angle + nextAngle) * 0.5),
    ];
    appendQuad(buffers, topFirst, bottomFirst, bottomSecond, topSecond, sideColor, normal);
    appendTriangle(buffers, topCenter, topSecond, topFirst, capColor, [0, 1, 0]);
    appendTriangle(buffers, bottomCenter, bottomFirst, bottomSecond, capColor, [0, -1, 0]);
  }
}

/** A cheap open cone; the nozzle hides its top and the point defines thrust direction. */
function appendGlowCone(
  buffers: GeometryBuffers,
  center: THREE.Vector3,
  topY: number,
  bottomY: number,
  radius: number,
  segments: number,
  phase: number,
): void {
  const tip = new THREE.Vector3(center.x, bottomY, center.z);
  for (let index = 0; index < segments; index += 1) {
    const angle = phase + (index / segments) * Math.PI * 2;
    const nextAngle = phase + ((index + 1) / segments) * Math.PI * 2;
    const first = new THREE.Vector3(
      center.x + Math.cos(angle) * radius,
      topY,
      center.z + Math.sin(angle) * radius,
    );
    const second = new THREE.Vector3(
      center.x + Math.cos(nextAngle) * radius,
      topY,
      center.z + Math.sin(nextAngle) * radius,
    );
    const normal: ExpectedNormal = [
      Math.cos((angle + nextAngle) * 0.5),
      0,
      Math.sin((angle + nextAngle) * 0.5),
    ];
    appendTriangle(buffers, first, tip, second, CYAN, normal);
  }
}

function sampledOutlinePoint(
  outline: readonly IslandOutlinePoint[],
  share: number,
  radial: number,
  scale: number,
): THREE.Vector3 {
  const wrapped = ((share % 1) + 1) % 1;
  const at = wrapped * outline.length;
  const left = Math.floor(at) % outline.length;
  const right = (left + 1) % outline.length;
  const amount = at - Math.floor(at);
  const first = outline[left]!;
  const second = outline[right]!;
  return new THREE.Vector3(
    (first.x + (second.x - first.x) * amount) * radial * scale,
    0,
    (first.z + (second.z - first.z) * amount) * radial * scale,
  );
}

function geometryFromBuffers(buffers: GeometryBuffers): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(buffers.positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(buffers.colors, 3));
  geometry.setIndex(buffers.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function triangleCount(geometry: THREE.BufferGeometry): number {
  return (geometry.getIndex()?.count ?? geometry.getAttribute("position").count) / 3;
}

/**
 * Build two batches: lit metal and cyan structure light. There is no free-
 * standing torus; every luminous face is embedded in a rib end or nozzle.
 */
export function buildIslandUndersideGeometry(
  blueprint: IslandBlueprint,
  detail: IslandUndersideDetail,
  scale: number,
  depth: number,
): IslandUndersideGeometry {
  const panelCount = detail === "world" ? 6 : 10;
  const ribCount = panelCount;
  const podCount = detail === "world" ? 4 : 6;
  const coreSegments = detail === "world" ? 8 : 12;
  const podSegments = detail === "world" ? 6 : 8;
  const glowSegments = detail === "world" ? 5 : 7;
  const structure: GeometryBuffers = { positions: [], colors: [], indices: [] };
  const glow: GeometryBuffers = { positions: [], colors: [], indices: [] };
  const halfX = blueprint.bounds.halfX * scale;
  const halfZ = blueprint.bounds.halfZ * scale;
  const minHalf = Math.min(halfX, halfZ);
  const plateThickness = Math.max(depth * 0.105, minHalf * 0.05);
  const plateTopY = -depth * (ISLAND_UNDERSIDE_MOUNT_PROFILE.rootDepthRatio + 0.035);
  const plateBottomY = plateTopY - plateThickness;
  const lipBottomY = plateBottomY - plateThickness * 0.38;
  const coreBottomY = plateBottomY - depth * (detail === "world" ? 0.34 : 0.26);
  const collarBottomY = plateBottomY - depth * 0.09;
  const phaseShare = hash(`${blueprint.seed}/engineering-hull/phase`) / panelCount;
  const phaseRadians = phaseShare * Math.PI * 2;
  const toneOffset = Math.floor(
    hash(`${blueprint.seed}/engineering-hull/panel-tones`) * PANEL_TONES.length,
  );

  for (let index = 0; index < panelCount; index += 1) {
    const firstShare = index / panelCount + phaseShare;
    const secondShare = (index + 1) / panelCount + phaseShare;
    const innerFirst = sampledOutlinePoint(
      blueprint.outline,
      firstShare,
      ISLAND_UNDERSIDE_MOUNT_PROFILE.panelInnerRatio,
      scale,
    );
    const innerSecond = sampledOutlinePoint(
      blueprint.outline,
      secondShare,
      ISLAND_UNDERSIDE_MOUNT_PROFILE.panelInnerRatio,
      scale,
    );
    const rimFirst = sampledOutlinePoint(
      blueprint.outline,
      firstShare,
      ISLAND_UNDERSIDE_MOUNT_PROFILE.rimInnerRatio,
      scale,
    );
    const rimSecond = sampledOutlinePoint(
      blueprint.outline,
      secondShare,
      ISLAND_UNDERSIDE_MOUNT_PROFILE.rimInnerRatio,
      scale,
    );
    const outerFirst = sampledOutlinePoint(
      blueprint.outline,
      firstShare,
      ISLAND_UNDERSIDE_MOUNT_PROFILE.plateOuterRatio,
      scale,
    );
    const outerSecond = sampledOutlinePoint(
      blueprint.outline,
      secondShare,
      ISLAND_UNDERSIDE_MOUNT_PROFILE.plateOuterRatio,
      scale,
    );
    const panel = new THREE.Color(PANEL_TONES[(index + toneOffset) % PANEL_TONES.length]!);
    appendSectorSolid(
      structure,
      innerFirst,
      innerSecond,
      rimSecond,
      rimFirst,
      plateTopY,
      plateBottomY,
      scaledColor(panel, 0.78),
      panel,
      scaledColor(panel, 0.66),
    );
    appendSectorSolid(
      structure,
      rimFirst,
      rimSecond,
      outerSecond,
      outerFirst,
      plateTopY + plateThickness * 0.06,
      lipBottomY,
      scaledColor(panel, 0.74),
      scaledColor(panel, 0.82),
      scaledColor(panel, 0.7),
    );

    // A short luminous dash sits inside each metal lip at the end of a spar.
    const lightHalfShare = 0.105 / panelCount;
    const lightFirst = sampledOutlinePoint(
      blueprint.outline,
      firstShare - lightHalfShare,
      ISLAND_UNDERSIDE_MOUNT_PROFILE.plateOuterRatio + 0.002,
      scale,
    );
    const lightSecond = sampledOutlinePoint(
      blueprint.outline,
      firstShare + lightHalfShare,
      ISLAND_UNDERSIDE_MOUNT_PROFILE.plateOuterRatio + 0.002,
      scale,
    );
    appendQuad(
      glow,
      pointAtY(lightFirst, plateBottomY + plateThickness * 0.18),
      pointAtY(lightFirst, plateBottomY - plateThickness * 0.14),
      pointAtY(lightSecond, plateBottomY - plateThickness * 0.14),
      pointAtY(lightSecond, plateBottomY + plateThickness * 0.18),
      CYAN,
      outwardNormal(lightFirst, lightSecond),
    );
  }

  const beamWidth = minHalf * (detail === "world" ? 0.07 : 0.04);
  for (let index = 0; index < ribCount; index += 1) {
    const share = index / ribCount + phaseShare;
    const start = sampledOutlinePoint(blueprint.outline, share, 0.12, scale);
    const end = sampledOutlinePoint(
      blueprint.outline,
      share,
      ISLAND_UNDERSIDE_MOUNT_PROFILE.rimInnerRatio * 0.985,
      scale,
    );
    appendBeam(structure, start, end, beamWidth, beamTopY, beamBottomY, RIB, RIB_SIDE);
  }

  const collarBottomY = plateBottomY - depth * 0.075;
  appendFrustum(
    structure,
    new THREE.Vector3(),
    plateBottomY - depth * 0.004,
    collarBottomY,
    halfX * 0.25,
    halfZ * 0.25,
    halfX * 0.22,
    halfZ * 0.22,
    coreSegments,
    phaseRadians,
    CORE,
    CORE_DARK,
  );
  appendFrustum(
    structure,
    new THREE.Vector3(),
    collarBottomY + depth * 0.008,
    coreBottomY,
    halfX * 0.2,
    halfZ * 0.2,
    halfX * 0.13,
    halfZ * 0.13,
    coreSegments,
    phaseRadians + Math.PI / coreSegments,
    CORE_DARK,
    CORE,
  );

  const podRadius = minHalf * (detail === "world" ? 0.075 : 0.055);
  const podHeight = Math.max(depth * 0.14, plateThickness * 0.82);
  const thrusterTopY = plateBottomY - plateThickness * 0.035;
  const thrusterBottomY = thrusterTopY - podHeight;
  const podPhaseShare = phaseShare + 0.5 / podCount;
  for (let index = 0; index < podCount; index += 1) {
    const share = index / podCount + podPhaseShare;
    const position = sampledOutlinePoint(blueprint.outline, share, 0.48, scale);
    appendFrustum(
      structure,
      position,
      thrusterTopY,
      thrusterBottomY,
      podRadius * 1.18,
      podRadius * 1.18,
      podRadius * 0.78,
      podRadius * 0.78,
      podSegments,
      phaseRadians,
      POD,
      POD_DARK,
    );
    appendGlowCone(
      glow,
      position,
      thrusterBottomY - depth * 0.006,
      thrusterBottomY - depth * (detail === "world" ? 0.13 : 0.11),
      podRadius * 0.52,
      glowSegments,
      phaseRadians,
    );
  }

  const structureGeometry = geometryFromBuffers(structure);
  const glowGeometry = geometryFromBuffers(glow);
  const stats: IslandUndersideStats = {
    panelCount,
    ribCount,
    podCount,
    structureTriangles: triangleCount(structureGeometry),
    glowTriangles: triangleCount(glowGeometry),
    plateTopY,
    plateBottomY,
    lipBottomY,
    coreBottomY,
    thrusterTopY,
  };
  return { structure: structureGeometry, glow: glowGeometry, stats };
}
