import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { HexMap } from "./course-grid.js";

type CloudDepth = "back" | "side" | "front";

function cloudPositions(
  map: HexMap,
  depth: CloudDepth,
): readonly [number, number, number, number][] {
  const width = map.bounds.maxX - map.bounds.minX;
  const depthOffset = map.bounds.maxZ - map.bounds.minZ;
  const count = depth === "front" ? 4 : 5;
  return Array.from({ length: count }, (_, index) => {
    const spread = index / Math.max(1, count - 1) - 0.5;
    if (depth === "back") {
      return [
        spread * width * 0.82,
        map.bounds.maxHalf * 0.26 + (index % 2) * 0.55,
        map.bounds.minZ - depthOffset * 0.24,
        map.hexSize * (1.15 + (index % 3) * 0.2),
      ];
    }
    if (depth === "side") {
      return [
        map.bounds.maxX + width * 0.18,
        map.bounds.maxHalf * 0.16 + (index % 2) * 0.42,
        spread * depthOffset * 0.8,
        map.hexSize * (1.05 + (index % 2) * 0.22),
      ];
    }
    return [
      spread * width * 0.66,
      map.bounds.maxHalf * 0.11 + (index % 2) * 0.34,
      map.bounds.maxZ + depthOffset * 0.18,
      map.hexSize * (0.94 + (index % 2) * 0.16),
    ];
  });
}

function CloudLayer({ map, depth, dimmed }: { map: HexMap; depth: CloudDepth; dimmed: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const positions = useMemo(() => cloudPositions(map, depth), [depth, map]);
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 8, 5), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: dimmed ? 0x9aa8a8 : 0xf2f4dc,
        transparent: true,
        opacity: depth === "front" ? 0.22 : depth === "side" ? 0.3 : 0.34,
        depthWrite: false,
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
        new THREE.Quaternion(),
        new THREE.Vector3(scale * 1.35, scale * 0.48, scale * 0.72),
      );
      target.setMatrixAt(index, matrix);
    });
    target.instanceMatrix.needsUpdate = true;
  }, [positions]);
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
