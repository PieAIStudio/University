import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { hash } from "../island/random.js";
import { islandLookFrozen } from "../island/island-surface-style.js";
import type { GridCell, HexMap } from "./course-grid.js";
import { createHexFieldMaterial, type HexLayer } from "./hex-field-material.js";
import { hexKey, hexNeighbors, hexToWorld } from "./hex.js";
import { gridSurfaceSlopeFor } from "./grid-elevation.js";
import { gridTerrainValueScale } from "./grid-palette.js";

interface HexFieldProps {
  readonly map: HexMap;
  readonly dimmed?: boolean;
}

export const HEX_GEOMETRY_TRIANGLES = 18;
export const HEX_BEVEL_GEOMETRY_TRIANGLES = 30;

export function hexGeometryTriangleCount(beveled: boolean): number {
  return beveled ? HEX_BEVEL_GEOMETRY_TRIANGLES : HEX_GEOMETRY_TRIANGLES;
}

export function hexGeometry(
  seamStrength: number,
  cliffBottom = -0.5,
  beveled = false,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const colours: number[] = [];
  const faces: number[] = [];
  const indices: number[] = [];
  // A seam is a small reduction from the shared hex radius. It is deliberately
  // a geometry rule, not an outline shader: route edges stay crisp on a phone
  // and same-height meadow cells can still read as one continuous island.
  const radius = 1 - seamStrength;
  const top = 0.5;
  // The top face keeps its established centre and height. The optional bevel
  // is reserved for route and detached cells: those are semantic stepping
  // stones, while a bevel on every meadow cell turns one terrace into a tiled
  // board. The shared prism path keeps the same instance scale and pick target
  // in both cases.
  const bottom = cliffBottom;
  const bevelWidth = beveled ? 0.085 : 0;
  const bevelDepth = beveled ? 0.12 : 0;
  const innerRadius = Math.max(0.01, radius - bevelWidth);
  const bevelTop = top - bevelDepth;
  const centre = [0, top, 0] as const;
  for (let side = 0; side < 6; side += 1) {
    const firstAngle = Math.PI / 6 + side * (Math.PI / 3);
    const secondAngle = Math.PI / 6 + ((side + 1) % 6) * (Math.PI / 3);
    const first = [
      Math.cos(firstAngle) * innerRadius,
      top,
      Math.sin(firstAngle) * innerRadius,
    ] as const;
    const second = [
      Math.cos(secondAngle) * innerRadius,
      top,
      Math.sin(secondAngle) * innerRadius,
    ] as const;
    const firstOuter = [
      Math.cos(firstAngle) * radius,
      bevelTop,
      Math.sin(firstAngle) * radius,
    ] as const;
    const secondOuter = [
      Math.cos(secondAngle) * radius,
      bevelTop,
      Math.sin(secondAngle) * radius,
    ] as const;
    const wallFirst = beveled ? firstOuter : first;
    const wallSecond = beveled ? secondOuter : second;
    const firstBottom = [wallFirst[0], bottom, wallFirst[2]] as const;
    const secondBottom = [wallSecond[0], bottom, wallSecond[2]] as const;

    // Keep the top winding counter-clockwise when viewed from above.
    const topBase = positions.length / 3;
    positions.push(...centre, ...second, ...first);
    // Keep the top-face ramp quiet. A dark rim on every hex reads as a dotted
    // outline at the aerial camera; neighbouring-tile variation lives in
    // `cellTopColour` instead, so same-height meadow stays one terrace.
    const edgeValue = 0.97 + (side % 3) * 0.015;
    const nearEdgeValue = 0.98 + (side % 2) * 0.01;
    colours.push(
      1.02,
      1.02,
      1.02,
      edgeValue,
      edgeValue,
      edgeValue,
      nearEdgeValue,
      nearEdgeValue,
      nearEdgeValue,
    );
    faces.push(0, 0, 0);
    indices.push(topBase, topBase + 1, topBase + 2);

    if (beveled) {
      const bevelBase = positions.length / 3;
      positions.push(...first, ...second, ...secondOuter, ...firstOuter);
      // The physical chamfer gets a little albedo headroom; its direction is
      // still supplied by the generated normal and the scene's existing key.
      colours.push(1.12, 1.12, 1.12, 1.12, 1.12, 1.12, 1.12, 1.12, 1.12, 1.12, 1.12, 1.12);
      faces.push(2, 2, 2, 2);
      indices.push(
        bevelBase,
        bevelBase + 1,
        bevelBase + 2,
        bevelBase,
        bevelBase + 2,
        bevelBase + 3,
      );
    }

    const sideBase = positions.length / 3;
    positions.push(...wallFirst, ...wallSecond, ...secondBottom, ...firstBottom);
    // A subtle vertical value shift gives the soil side a chunky, painted
    // read without making the lower half a second course-specific palette.
    colours.push(0.98, 0.98, 0.98, 0.9, 0.9, 0.9, 0.74, 0.74, 0.74, 0.82, 0.82, 0.82);
    faces.push(1, 1, 1, 1);
    indices.push(sideBase, sideBase + 1, sideBase + 2, sideBase, sideBase + 2, sideBase + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  geometry.setAttribute("gridFace", new THREE.Float32BufferAttribute(faces, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.gridTriangles = hexGeometryTriangleCount(beveled);
  return geometry;
}

export function gridRimWeightsForCells(map: HexMap, cells: readonly GridCell[]): Float32Array {
  const mainKeys = new Set(map.mainCells.map(hexKey));
  const values = new Float32Array(Math.max(1, cells.length));
  cells.forEach((cell, index) => {
    if (cell.kind === "detached") {
      values[index] = 1;
      return;
    }
    values[index] =
      mainKeys.has(cell.key) &&
      hexNeighbors(cell.coord).some((neighbor) => !mainKeys.has(hexKey(neighbor)))
        ? 1
        : 0;
  });
  return values;
}

export function setGridRimAttribute(geometry: THREE.BufferGeometry, values: Float32Array): void {
  geometry.setAttribute("gridRim", new THREE.InstancedBufferAttribute(values, 1));
}

function setSurfaceSlopeAttribute(
  geometry: THREE.BufferGeometry,
  map: HexMap,
  cells: readonly GridCell[],
  enabled: boolean,
): void {
  const values = new Float32Array(Math.max(1, cells.length) * 2);
  if (enabled) {
    cells.forEach((cell, index) => {
      const slope = gridSurfaceSlopeFor(cell, map.cells, map.seed);
      const height = Math.max(cell.topY, 0.01);
      values[index * 2] = (slope.x * map.hexSize) / height;
      values[index * 2 + 1] = (slope.z * map.hexSize) / height;
    });
  }
  geometry.setAttribute("gridSlope", new THREE.InstancedBufferAttribute(values, 2));
}

export function cellTopColour(map: HexMap, cell: GridCell): THREE.Color {
  const colour = new THREE.Color(
    map.projection !== "world" && cell.kind === "route" ? map.palette.road : map.palette.top,
  );
  if (cell.kind !== "route") {
    colour.multiplyScalar(gridTerrainValueScale(map.projection, cell.height));
  }
  if (cell.kind !== "route") {
    // Unit territories carry a restrained hue cue as well as the elevation
    // value. It is keyed to the authored unit, so neighbouring cells in one
    // territory still read as one patch; the small amount keeps the field from
    // becoming an accent-colour checkerboard.
    if (cell.unitIndex !== null) {
      const unitValue = [0.92, 0.96, 1, 1.04, 1.08][cell.unitIndex % 5] ?? 1;
      colour.multiplyScalar(unitValue);
      colour.lerp(new THREE.Color(map.palette.accent), 0.045 + (cell.unitIndex % 4) * 0.02);
    }
    // Keep the last variation small: the territory and terrace are the broad
    // colour fields, while a per-cell hash should only stop a large region from
    // looking stamped. A wider hash range turns the meadow into a checkerboard.
    colour.multiplyScalar(0.985 + hash(`${map.seed}/${cell.key}/top-value`) * 0.03);
  }
  const lesson = cell.lessonIndex === null ? undefined : map.lessons[cell.lessonIndex];
  if (lesson?.state === "locked") colour.lerp(new THREE.Color(map.palette.shadow), 0.42);
  if (lesson?.state === "done") colour.lerp(new THREE.Color(map.palette.accent), 0.07);
  if (lesson?.state === "live") colour.lerp(new THREE.Color(map.palette.accent), 0.18);
  return colour;
}

function cellMatrix(cell: GridCell, map: HexMap, target: THREE.Matrix4, pulse = 0): THREE.Matrix4 {
  const point = hexToWorld(cell.coord, map.hexSize);
  const height = Math.max(cell.topY, 0.01);
  target.compose(
    new THREE.Vector3(point.x, height * 0.5 + pulse, point.z),
    new THREE.Quaternion(),
    new THREE.Vector3(map.hexSize, height, map.hexSize),
  );
  return target;
}

function bedMatrix(cell: GridCell, map: HexMap, target: THREE.Matrix4): THREE.Matrix4 {
  const point = hexToWorld(cell.coord, map.hexSize);
  // A shallow shared bed closes only the hairline between neighbouring cells.
  // It sits below every real prism, so route and terrain retain their own
  // silhouette and the bed cannot become a second visible tile layer.
  target.compose(
    new THREE.Vector3(point.x, 0, point.z),
    new THREE.Quaternion(),
    new THREE.Vector3(map.hexSize, 0.16, map.hexSize),
  );
  return target;
}

function HexBedField({
  map,
  dimmed,
  cliffBottom,
  cells,
  mesh,
}: {
  readonly map: HexMap;
  readonly dimmed: boolean;
  readonly cliffBottom: number;
  readonly cells: readonly GridCell[];
  readonly mesh: React.MutableRefObject<THREE.InstancedMesh | null>;
}) {
  const geometry = useMemo(() => hexGeometry(0, cliffBottom, false), [cliffBottom]);
  const material = useMemo(() => createHexFieldMaterial(map, dimmed, "land"), [dimmed, map]);
  const matrix = useMemo(() => new THREE.Matrix4(), []);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    setSurfaceSlopeAttribute(geometry, map, cells, false);
    setGridRimAttribute(geometry, new Float32Array(Math.max(1, cells.length)));
    cells.forEach((cell, index) => {
      target.setMatrixAt(index, bedMatrix(cell, map, matrix));
      const colour = new THREE.Color(cell.kind === "route" ? map.palette.road : map.palette.top);
      if (cell.kind !== "route") {
        colour.multiplyScalar(gridTerrainValueScale(map.projection, cell.height));
      }
      target.setColorAt(index, colour);
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
    target.computeBoundingSphere();
  }, [cells, geometry, map, matrix, mesh]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, Math.max(1, cells.length)]}
      name="hex-grid-bed"
      receiveShadow
      frustumCulled={false}
    />
  );
}

function HexLayerField({
  map,
  dimmed,
  layer,
  cliffBottom,
  cells,
  beveled,
  mesh,
}: {
  readonly map: HexMap;
  readonly dimmed: boolean;
  readonly layer: HexLayer;
  readonly cliffBottom: number;
  readonly cells: readonly GridCell[];
  readonly beveled: boolean;
  readonly mesh: React.MutableRefObject<THREE.InstancedMesh | null>;
}) {
  const geometry = useMemo(
    () =>
      hexGeometry(
        layer === "route"
          ? map.seamStrength.route
          : layer === "detached"
            ? map.seamStrength.detached
            : map.seamStrength.land,
        cliffBottom,
        beveled,
      ),
    [
      beveled,
      cliffBottom,
      layer,
      map.seamStrength.detached,
      map.seamStrength.land,
      map.seamStrength.route,
    ],
  );
  const material = useMemo(() => createHexFieldMaterial(map, dimmed, layer), [dimmed, layer, map]);
  const matrix = useMemo(() => new THREE.Matrix4(), []);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    setSurfaceSlopeAttribute(geometry, map, cells, layer === "land" && map.projection === "course");
    setGridRimAttribute(geometry, gridRimWeightsForCells(map, cells));
    cells.forEach((cell, index) => {
      target.setMatrixAt(index, cellMatrix(cell, map, matrix));
      target.setColorAt(index, cellTopColour(map, cell));
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
    target.computeBoundingSphere();
  }, [cells, geometry, layer, map, matrix, mesh]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, Math.max(1, cells.length)]}
      name={`hex-grid-${layer}`}
      receiveShadow
      frustumCulled={false}
    />
  );
}

export function HexField({ map, dimmed = false }: HexFieldProps) {
  const bedMesh = useRef<THREE.InstancedMesh>(null);
  const landMesh = useRef<THREE.InstancedMesh>(null);
  const routeMesh = useRef<THREE.InstancedMesh>(null);
  const detachedMesh = useRef<THREE.InstancedMesh>(null);
  const cliffBottom = useMemo(
    () => -(0.95 + 0.35 * Math.min(1, map.route.length / 41)),
    [map.route.length],
  );
  const bedCells = useMemo(() => map.cells.filter((cell) => cell.kind !== "detached"), [map.cells]);
  const landCells = useMemo(() => map.cells.filter((cell) => cell.kind === "land"), [map.cells]);
  const routeCells = useMemo(() => map.cells.filter((cell) => cell.kind === "route"), [map.cells]);
  const detachedCells = useMemo(
    () => map.cells.filter((cell) => cell.kind === "detached"),
    [map.cells],
  );
  const activeKey = useMemo(
    () => map.lessons.find((lesson) => lesson.state === "live")?.key ?? null,
    [map.lessons],
  );
  const matrix = useMemo(() => new THREE.Matrix4(), []);

  useFrame(({ clock }) => {
    if (activeKey === null || (import.meta.env.DEV && islandLookFrozen())) return;
    const activeCell = map.cells.find((cell) => cell.key === activeKey);
    if (!activeCell) return;
    const target = activeCell.kind === "route" ? routeMesh.current : landMesh.current;
    const cells = activeCell.kind === "route" ? routeCells : landCells;
    if (!target) return;
    const activeIndex = cells.findIndex((cell) => cell.key === activeKey);
    if (activeIndex < 0) return;
    const pulse = Math.sin(clock.elapsedTime * 2.2) * 0.045;
    cellMatrix(activeCell, map, matrix, pulse);
    target.setMatrixAt(activeIndex, matrix);
    target.instanceMatrix.needsUpdate = true;
  });

  // Keep the debug metric truthful on the first render too: refs are still null
  // while JSX is being evaluated, even though every hex layer uses this geometry.
  const triangleCount =
    HEX_GEOMETRY_TRIANGLES * (bedCells.length + landCells.length) +
    HEX_BEVEL_GEOMETRY_TRIANGLES * (routeCells.length + detachedCells.length);

  return (
    <group
      name="hex-grid-field"
      userData={{
        gridCellCount: map.cells.length,
        gridTriangleCount: triangleCount,
        gridBounds: map.bounds,
        gridPalette: map.palette,
        gridMainKeys: map.mainCells.map((cell) => `${cell.q},${cell.r}`),
        gridRouteKeys: map.route.map((cell) => `${cell.q},${cell.r}`),
        gridSeamStrength: map.seamStrength,
      }}
    >
      <HexBedField
        map={map}
        dimmed={dimmed}
        cliffBottom={cliffBottom}
        cells={bedCells}
        mesh={bedMesh}
      />
      <HexLayerField
        map={map}
        dimmed={dimmed}
        layer="land"
        cliffBottom={cliffBottom}
        cells={landCells}
        beveled={false}
        mesh={landMesh}
      />
      <HexLayerField
        map={map}
        dimmed={dimmed}
        layer="route"
        cliffBottom={cliffBottom}
        cells={routeCells}
        beveled
        mesh={routeMesh}
      />
      <HexLayerField
        map={map}
        dimmed={dimmed}
        layer="detached"
        cliffBottom={cliffBottom}
        cells={detachedCells}
        beveled
        mesh={detachedMesh}
      />
    </group>
  );
}
