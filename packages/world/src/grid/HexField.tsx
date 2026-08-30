import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { islandLookFrozen } from "../island/island-surface-style.js";
import type { GridCell, HexMap } from "./course-grid.js";
import { hexToWorld } from "./hex.js";

interface HexFieldProps {
  readonly map: HexMap;
  readonly dimmed?: boolean;
}

type HexLayer = "land" | "route" | "detached";

export function hexGeometry(seamStrength: number, cliffBottom = -0.5): THREE.BufferGeometry {
  const positions: number[] = [];
  const colours: number[] = [];
  const faces: number[] = [];
  const indices: number[] = [];
  // A seam is a small reduction from the shared hex radius. It is deliberately
  // a geometry rule, not an outline shader: route edges stay crisp on a phone
  // and same-height meadow cells can still read as one continuous island.
  const radius = 1 - seamStrength;
  const top = 0.5;
  // The top face keeps its established centre and height. Extending only the
  // lower local edge gives the island a chunky exposed cliff without moving a
  // lesson position, label, or pick target.
  const bottom = cliffBottom;
  const centre = [0, top, 0] as const;
  for (let side = 0; side < 6; side += 1) {
    const firstAngle = Math.PI / 6 + side * (Math.PI / 3);
    const secondAngle = Math.PI / 6 + ((side + 1) % 6) * (Math.PI / 3);
    const first = [Math.cos(firstAngle) * radius, top, Math.sin(firstAngle) * radius] as const;
    const second = [Math.cos(secondAngle) * radius, top, Math.sin(secondAngle) * radius] as const;
    const firstBottom = [first[0], bottom, first[2]] as const;
    const secondBottom = [second[0], bottom, second[2]] as const;

    // Keep the top winding counter-clockwise when viewed from above.
    const topBase = positions.length / 3;
    positions.push(...centre, ...second, ...first);
    colours.push(1.06, 1.06, 1.06, 0.9, 0.9, 0.9, 0.96, 0.96, 0.96);
    faces.push(0, 0, 0);
    indices.push(topBase, topBase + 1, topBase + 2);

    const sideBase = positions.length / 3;
    positions.push(...first, ...second, ...secondBottom, ...firstBottom);
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
  geometry.userData.gridTriangles = indices.length / 3;
  return geometry;
}

export function mapMaterial(
  map: HexMap,
  dimmed: boolean,
  layer: HexLayer,
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: layer === "route" ? 0.72 : 0.88,
    metalness: 0,
    flatShading: true,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.gridCliff = { value: new THREE.Color(map.palette.cliff) };
    shader.uniforms.gridShadow = { value: new THREE.Color(map.palette.shadow) };
    shader.uniforms.gridDim = { value: dimmed ? 0.62 : 1 };
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      "#include <common>\nattribute float gridFace;\nvarying float vGridFace;",
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvGridFace = gridFace;",
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      "#include <common>\nvarying float vGridFace;\nuniform vec3 gridCliff;\nuniform vec3 gridShadow;\nuniform float gridDim;",
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      "#include <color_fragment>\nif (vGridFace > 1.5) diffuseColor.rgb = gridShadow;\nelse if (vGridFace > 0.5) diffuseColor.rgb = gridCliff;\ndiffuseColor.rgb *= gridDim;",
    );
    // The soil should remain legible at the low-poly camera even when the
    // directional shadow falls between two cells. This is a floor, not an
    // unlit material: the warm key and cool hemisphere still provide the form.
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      "if (vGridFace > 0.5) outgoingLight = mix(gridCliff * 0.72, outgoingLight, 0.34);\n#include <opaque_fragment>",
    );
  };
  material.customProgramCacheKey = () =>
    `hex-field-${map.palette.cliff}-${layer}-${dimmed ? "dim" : "full"}`;
  return material;
}

export function cellTopColour(map: HexMap, cell: GridCell): THREE.Color {
  const colour = new THREE.Color(
    map.projection !== "world" && cell.kind === "route" ? map.palette.road : map.palette.top,
  );
  if (cell.unitIndex !== null && cell.kind !== "route") {
    const unitTint = new THREE.Color(map.palette.accent);
    colour.lerp(unitTint, 0.045 + (cell.unitIndex % 4) * 0.02);
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
  const geometry = useMemo(() => hexGeometry(0, cliffBottom), [cliffBottom]);
  const material = useMemo(() => mapMaterial(map, dimmed, "land"), [dimmed, map]);
  const matrix = useMemo(() => new THREE.Matrix4(), []);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    cells.forEach((cell, index) => {
      target.setMatrixAt(index, bedMatrix(cell, map, matrix));
      target.setColorAt(
        index,
        new THREE.Color(cell.kind === "route" ? map.palette.road : map.palette.top),
      );
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
    target.computeBoundingSphere();
  }, [cells, map, matrix, mesh]);

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
  mesh,
}: {
  readonly map: HexMap;
  readonly dimmed: boolean;
  readonly layer: HexLayer;
  readonly cliffBottom: number;
  readonly cells: readonly GridCell[];
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
      ),
    [cliffBottom, layer, map.seamStrength.detached, map.seamStrength.land, map.seamStrength.route],
  );
  const material = useMemo(() => mapMaterial(map, dimmed, layer), [dimmed, layer, map]);
  const matrix = useMemo(() => new THREE.Matrix4(), []);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    cells.forEach((cell, index) => {
      target.setMatrixAt(index, cellMatrix(cell, map, matrix));
      target.setColorAt(index, cellTopColour(map, cell));
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
    target.computeBoundingSphere();
  }, [cells, map, matrix, mesh]);

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
    () => -(0.5 + 2.5 * Math.min(1, map.route.length / 41)),
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
    18 * (bedCells.length + landCells.length + routeCells.length + detachedCells.length);

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
        mesh={landMesh}
      />
      <HexLayerField
        map={map}
        dimmed={dimmed}
        layer="route"
        cliffBottom={cliffBottom}
        cells={routeCells}
        mesh={routeMesh}
      />
      <HexLayerField
        map={map}
        dimmed={dimmed}
        layer="detached"
        cliffBottom={cliffBottom}
        cells={detachedCells}
        mesh={detachedMesh}
      />
    </group>
  );
}
