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
  const courseFactor = Math.min(1, map.route.length / 41);
  const undersideDepth = Math.max(5.4, minimumHalf * (0.35 + courseFactor * 0.55));
  // The cone is an underside silhouette, not a second top surface. Keeping
  // its lip inside the cell cluster leaves gaps between cells reading as air.
  const coneRadius = minimumHalf * (0.3 + courseFactor * 0.28);
  const frontX = Math.sin((65 * Math.PI) / 180);
  const frontZ = Math.cos((65 * Math.PI) / 180);
  const coneGeometry = useMemo(() => {
    // Leave the upper cap open. A closed cap becomes a floating brown plate
    // when the aerial camera looks through the intentional gaps between
    // cells; the sloped faces alone keep the underside reading as one
    // tapered island. Per-vertex soil shades make the eight facets visible
    // without introducing a second course-specific material family.
    const geometry = new THREE.ConeGeometry(coneRadius, undersideDepth, 8, 1, true);
    const position = geometry.getAttribute("position");
    const colour = new Float32Array(position.count * 3);
    const cliff = new THREE.Color(map.palette.cliff);
    const shadow = new THREE.Color(map.palette.shadow);
    const shade = new THREE.Color();
    for (let index = 0; index < position.count; index += 1) {
      const angle = Math.atan2(position.getZ(index), position.getX(index));
      const facet = 0.08 + (Math.sin(angle * 2.5 + 0.7) + 1) * 0.08;
      shade.copy(cliff).lerp(shadow, facet);
      shade.toArray(colour, index * 3);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colour, 3));
    return geometry;
  }, [coneRadius, map.palette.cliff, map.palette.shadow, undersideDepth]);
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
        color: 0xffffff,
        vertexColors: true,
        roughness: 1,
        flatShading: true,
      }),
    [dimmed, map.palette.shadow],
  );
  const waterMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        // Coral belongs to lesson stones. Water keeps its own cool material
        // so the underside still has the blue counterpoint from the reference.
        color: 0x4fa8c4,
        transparent: true,
        opacity: dimmed ? 0.26 : 0.58,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      }),
    [dimmed, map.palette.accent],
  );
  const waterfallHeight = 4 + courseFactor * 10;
  const waterfallWidth = 1.2 + courseFactor * 1.4;
  const waterfallScaleY = Math.min(1.2, minimumHalf / 18);
  const waterGeometry = useMemo(
    () => new THREE.PlaneGeometry(waterfallWidth, waterfallHeight),
    [waterfallHeight, waterfallWidth],
  );

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
        position={[
          centreX + frontX * minimumHalf * 0.18,
          -undersideDepth * 0.5,
          centreZ + frontZ * minimumHalf * 0.18,
        ]}
        rotation={[Math.PI, 0, 0]}
        scale={[1.08, 1, 1.02]}
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
        position={[
          map.bounds.maxX * 0.67,
          1.18 - waterfallHeight * waterfallScaleY * 0.5,
          map.bounds.minZ * 0.71,
        ]}
        scale={[1, waterfallScaleY, 1]}
        rotation={[0, 0, 0]}
        renderOrder={3}
      />
    </group>
  );
}
