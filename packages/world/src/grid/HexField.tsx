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

function hexGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colours: number[] = [];
  const faces: number[] = [];
  const indices: number[] = [];
  const radius = 0.96;
  const top = 0.5;
  const bottom = -0.5;
  const centre = [0, top, 0] as const;
  for (let side = 0; side < 6; side += 1) {
    const firstAngle = Math.PI / 6 + side * (Math.PI / 3);
    const secondAngle = Math.PI / 6 + ((side + 1) % 6) * (Math.PI / 3);
    const first = [Math.cos(firstAngle) * radius, top, Math.sin(firstAngle) * radius] as const;
    const second = [Math.cos(secondAngle) * radius, top, Math.sin(secondAngle) * radius] as const;
    const firstBottom = [first[0], bottom, first[2]] as const;
    const secondBottom = [second[0], bottom, second[2]] as const;

    // Keep the top winding counter-clockwise when viewed from above. The
    // first prototype used centre → first → second, which made every top
    // normal point down and turned the grid into a set of black wedges.
    const topBase = positions.length / 3;
    positions.push(...centre, ...second, ...first);
    colours.push(1.06, 1.06, 1.06, 0.9, 0.9, 0.9, 0.96, 0.96, 0.96);
    faces.push(0, 0, 0);
    indices.push(topBase, topBase + 1, topBase + 2);

    const sideBase = positions.length / 3;
    positions.push(...first, ...second, ...secondBottom, ...firstBottom);
    colours.push(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1);
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

function mapMaterial(map: HexMap, dimmed: boolean): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.88,
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
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      "if (vGridFace > 0.5) outgoingLight = max(outgoingLight, gridCliff * 0.32);\n#include <opaque_fragment>",
    );
  };
  material.customProgramCacheKey = () =>
    `hex-field-${map.palette.cliff}-${dimmed ? "dim" : "full"}`;
  return material;
}

function cellTopColour(map: HexMap, cell: GridCell): THREE.Color {
  const colour = new THREE.Color(cell.kind === "route" ? map.palette.road : map.palette.top);
  if (cell.unitIndex !== null && cell.kind !== "route") {
    const unitTint = new THREE.Color(map.palette.accent);
    colour.lerp(unitTint, 0.06 + (cell.unitIndex % 4) * 0.035);
  }
  const lesson = cell.lessonIndex === null ? undefined : map.lessons[cell.lessonIndex];
  if (lesson?.state === "locked") colour.lerp(new THREE.Color(map.palette.shadow), 0.54);
  if (lesson?.state === "done") colour.lerp(new THREE.Color(map.palette.accent), 0.08);
  if (lesson?.state === "live") colour.lerp(new THREE.Color(map.palette.accent), 0.22);
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

export function HexField({ map, dimmed = false }: HexFieldProps) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(hexGeometry, []);
  const material = useMemo(() => mapMaterial(map, dimmed), [dimmed, map]);
  const activeKey = useMemo(
    () => map.lessons.find((lesson) => lesson.state === "live")?.key ?? null,
    [map.lessons],
  );
  const matrix = useMemo(() => new THREE.Matrix4(), []);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    map.cells.forEach((cell, index) => {
      target.setMatrixAt(index, cellMatrix(cell, map, matrix));
      target.setColorAt(index, cellTopColour(map, cell));
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
    target.computeBoundingSphere();
  }, [map, matrix]);

  useFrame(({ clock }) => {
    const target = mesh.current;
    if (!target || activeKey === null || (import.meta.env.DEV && islandLookFrozen())) return;
    const activeIndex = map.cells.findIndex((cell) => cell.key === activeKey);
    if (activeIndex < 0) return;
    const pulse = Math.sin(clock.elapsedTime * 2.2) * 0.045;
    cellMatrix(map.cells[activeIndex]!, map, matrix, pulse);
    target.setMatrixAt(activeIndex, matrix);
    target.instanceMatrix.needsUpdate = true;
  });

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);
  useEffect(() => {
    return () => material.dispose();
  }, [material]);

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, Math.max(1, map.cells.length)]}
      name="hex-grid-field"
      userData={{
        gridCellCount: map.cells.length,
        gridTriangleCount: geometry.userData.gridTriangles * map.cells.length,
        gridBounds: map.bounds,
        gridPalette: map.palette,
        gridMainKeys: map.mainCells.map((cell) => `${cell.q},${cell.r}`),
        gridRouteKeys: map.route.map((cell) => `${cell.q},${cell.r}`),
      }}
      receiveShadow
      frustumCulled={false}
    />
  );
}
