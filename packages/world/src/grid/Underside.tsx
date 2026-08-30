import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { HexMap } from "./course-grid.js";

interface UndersideProps {
  readonly map: HexMap;
  readonly dimmed?: boolean;
}

const ROCK_COUNT = 4;

export function Underside({ map, dimmed = false }: UndersideProps) {
  const rocks = useRef<THREE.InstancedMesh>(null);
  const minimumHalf = Math.min(map.bounds.halfX, map.bounds.halfZ);
  const centreX = (map.bounds.minX + map.bounds.maxX) * 0.5;
  const centreZ = (map.bounds.minZ + map.bounds.maxZ) * 0.5;
  const undersideDepth = Math.max(3.8, minimumHalf * 0.52);
  // The cone is an underside silhouette, not a second top surface. Keeping
  // its lip inside the cell cluster leaves gaps between cells reading as air.
  const coneRadius = minimumHalf * 0.24;
  const coneGeometry = useMemo(
    () => new THREE.ConeGeometry(coneRadius, undersideDepth, 8, 1),
    [coneRadius, undersideDepth],
  );
  const rockGeometry = useMemo(() => new THREE.ConeGeometry(0.34, 1.7, 5, 1), []);
  const rockMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: dimmed ? 0x293841 : map.palette.cliff,
        roughness: 0.96,
        flatShading: true,
      }),
    [dimmed, map.palette.cliff],
  );
  const shadowMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        // The underside is shadowed soil, not a second blue world. Mixing the
        // shared shadow swatch towards the cliff swatch keeps the cone dark
        // enough to read while preserving the one-world earthy material rule.
        color: dimmed
          ? 0x121e24
          : new THREE.Color(map.palette.shadow).lerp(new THREE.Color(map.palette.cliff), 0.42),
        roughness: 1,
        flatShading: true,
      }),
    [dimmed, map.palette.shadow],
  );
  const waterMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: map.palette.accent,
        transparent: true,
        opacity: dimmed ? 0.26 : 0.58,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [dimmed, map.palette.accent],
  );
  const waterGeometry = useMemo(() => new THREE.PlaneGeometry(1.15, 3.5), []);

  useLayoutEffect(() => {
    const target = rocks.current;
    if (!target) return;
    const ringRadius = minimumHalf * 0.63;
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < ROCK_COUNT; index += 1) {
      const angle = (index / ROCK_COUNT) * Math.PI * 2 + 0.2;
      const radius = ringRadius * (0.72 + (index % 2) * 0.14);
      const position = new THREE.Vector3(
        centreX + Math.cos(angle) * radius,
        -0.35 - minimumHalf * (0.2 + (index % 2) * 0.05),
        centreZ + Math.sin(angle) * radius,
      );
      matrix.compose(
        position,
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler(0.16 * Math.sin(angle), angle, 0.12 * Math.cos(angle)),
        ),
        new THREE.Vector3(0.76 + (index % 3) * 0.13, 1 + (index % 2) * 0.22, 0.76),
      );
      target.setMatrixAt(index, matrix);
    }
    target.instanceMatrix.needsUpdate = true;
  }, [map, minimumHalf]);
  useEffect(() => () => coneGeometry.dispose(), [coneGeometry]);
  useEffect(() => () => rockGeometry.dispose(), [rockGeometry]);
  useEffect(() => () => waterGeometry.dispose(), [waterGeometry]);
  useEffect(() => () => rockMaterial.dispose(), [rockMaterial]);
  useEffect(() => () => shadowMaterial.dispose(), [shadowMaterial]);
  useEffect(() => () => waterMaterial.dispose(), [waterMaterial]);

  return (
    <group name="hex-grid-underside">
      <mesh
        position={[centreX, -0.24 - undersideDepth * 0.5, centreZ]}
        rotation={[Math.PI, 0, 0]}
        geometry={coneGeometry}
        material={shadowMaterial}
      />
      <instancedMesh
        ref={rocks}
        args={[rockGeometry, rockMaterial, ROCK_COUNT]}
        name="hex-grid-rock-spikes"
      />
      <mesh
        name="hex-grid-waterfall"
        geometry={waterGeometry}
        material={waterMaterial}
        position={[map.bounds.minX * 0.42, -0.42, map.bounds.maxZ * 0.62]}
        scale={[1, Math.min(1.2, minimumHalf / 18), 1]}
        rotation={[0, 0, 0]}
        renderOrder={2}
      />
    </group>
  );
}
