import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { HexMap } from "./course-grid.js";

type CloudDepth = "back" | "side" | "front";

function cloudGeometry(): THREE.BufferGeometry {
  // The old cloud was three separated low-poly spheres, which read as a row
  // of pale rocks at the course camera. A single shallow silhouette gives it
  // the illustrated cloud language of the target: a calm flat base with
  // three soft crowns. It is still one shared geometry for all three depth
  // layers and costs fewer triangles than the sphere lobes.
  const shape = new THREE.Shape();
  shape.moveTo(-1.55, -0.36);
  shape.lineTo(1.55, -0.36);
  shape.lineTo(1.55, -0.05);
  shape.quadraticCurveTo(1.42, 0.06, 1.25, 0.08);
  shape.quadraticCurveTo(1.08, 0.62, 0.7, 0.64);
  shape.quadraticCurveTo(0.4, 0.66, 0.2, 0.42);
  shape.quadraticCurveTo(-0.02, 1.05, -0.5, 1.08);
  shape.quadraticCurveTo(-0.98, 1.1, -1.12, 0.52);
  shape.quadraticCurveTo(-1.42, 0.56, -1.55, 0.2);
  shape.closePath();
  // Keep the silhouette cheap, but give the quadratic crowns enough samples
  // to read as soft cloud lobes instead of a second low-poly grid.
  const flat = new THREE.ShapeGeometry(shape, 6);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", flat.getAttribute("position"));
  geometry.setAttribute("normal", flat.getAttribute("normal"));
  geometry.setIndex(flat.getIndex()!);
  geometry.computeBoundingSphere();
  flat.dispose();
  return geometry;
}

function cloudPositions(
  map: HexMap,
  depth: CloudDepth,
): readonly [number, number, number, number][] {
  const width = map.bounds.maxX - map.bounds.minX;
  const depthOffset = map.bounds.maxZ - map.bounds.minZ;
  // Course-design is a fixed 65° aerial shot. Position the cloud frame in
  // that camera's horizontal basis instead of using world X/Z directly: a
  // world-axis spread can project both front clouds into the same lower ray
  // and cover the floating cone on one route archetype.
  const azimuth = (65 * Math.PI) / 180;
  const viewX = Math.sin(azimuth);
  const viewZ = Math.cos(azimuth);
  const rightX = Math.cos(azimuth);
  const rightZ = -Math.sin(azimuth);
  const framePoint = (horizontal: number, forward: number): readonly [number, number] => [
    rightX * horizontal + viewX * forward,
    rightZ * horizontal + viewZ * forward,
  ];
  // Clouds are framing punctuation, not a second patterned ground plane.
  // Fewer larger silhouettes leave the route as the visual protagonist.
  const count = depth === "front" ? 2 : depth === "back" ? 3 : 2;
  return Array.from({ length: count }, (_, index) => {
    const spread = index / Math.max(1, count - 1) - 0.5;
    if (depth === "back") {
      // Leave the central lower ray open for the island's pointed underside.
      // The middle cloud still frames the island, but sits on the right side
      // like the target's distant cloud bank instead of covering the cone.
      const frameSpread = index === 1 ? 0.2 : spread < 0 ? -0.78 : 0.88;
      const [x, z] = framePoint(frameSpread * width, -depthOffset * 0.72);
      return [
        x,
        map.bounds.maxHalf * 0.26 + (index % 2) * 0.55,
        z,
        map.hexSize * (1.15 + (index % 3) * 0.2),
      ];
    }
    if (depth === "side") {
      const [x, z] = framePoint(width * 0.55, spread * depthOffset * 0.25);
      return [
        x,
        map.bounds.maxHalf * 0.16 + (index % 2) * 0.42,
        z,
        map.hexSize * (1.05 + (index % 2) * 0.22),
      ];
    }
    const [x, z] = framePoint(spread * width * 0.44, depthOffset * 0.45);
    return [
      x,
      -map.bounds.maxHalf * 0.18 + (index % 2) * 0.34,
      z,
      map.hexSize * (0.94 + (index % 2) * 0.16),
    ];
  });
}

function CloudLayer({ map, depth, dimmed }: { map: HexMap; depth: CloudDepth; dimmed: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const positions = useMemo(() => cloudPositions(map, depth), [depth, map]);
  const geometry = useMemo(cloudGeometry, []);
  const rotation = useMemo(
    () => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (65 * Math.PI) / 180, 0)),
    [],
  );
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: dimmed ? 0x9aa8a8 : depth === "back" ? 0xfff0d4 : 0xfff9e9,
        transparent: true,
        opacity: depth === "front" ? 0.55 : depth === "side" ? 0.68 : 0.76,
        depthWrite: false,
        depthTest: false,
      }),
    [depth, dimmed],
  );
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const matrix = new THREE.Matrix4();
    positions.forEach(([x, y, z, scale], index) => {
      matrix.compose(
        new THREE.Vector3(x, y, z),
        rotation,
        new THREE.Vector3(scale * 1.72, scale * 1.14, scale * 1.14),
      );
      target.setMatrixAt(index, matrix);
    });
    target.instanceMatrix.needsUpdate = true;
  }, [positions, rotation]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, positions.length]}
      name={`hex-grid-clouds-${depth}`}
      renderOrder={-1}
      frustumCulled={false}
    />
  );
}

export function GridCloudLayers({ map, dimmed = false }: { map: HexMap; dimmed?: boolean }) {
  return (
    <group name="hex-grid-cloud-layers">
      <CloudLayer map={map} depth="back" dimmed={dimmed} />
      <CloudLayer map={map} depth="side" dimmed={dimmed} />
      <CloudLayer map={map} depth="front" dimmed={dimmed} />
    </group>
  );
}
