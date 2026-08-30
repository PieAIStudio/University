import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { HexMap } from "./course-grid.js";

interface UndersideProps {
  readonly map: HexMap;
  readonly dimmed?: boolean;
}

const ROCK_COUNT = 5;

export function Underside({ map, dimmed = false }: UndersideProps) {
  const rocks = useRef<THREE.InstancedMesh>(null);
  const minimumHalf = Math.min(map.bounds.halfX, map.bounds.halfZ);
  const centreX = (map.bounds.minX + map.bounds.maxX) * 0.5;
  const centreZ = (map.bounds.minZ + map.bounds.maxZ) * 0.5;
  const courseFactor = Math.min(1, map.route.length / 41);
  const undersideDepth = Math.max(5.4, minimumHalf * (0.22 + courseFactor * 0.28));
  // The cone is only a dark core. The floating-island read comes from the
  // rock spikes; a wide smooth pyramid was the thing the reference replaced.
  const coneRadius = minimumHalf * (0.14 + courseFactor * 0.1);
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
  const rockGeometry = useMemo(() => new THREE.ConeGeometry(1, 1, 5, 1), []);
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
        side: THREE.DoubleSide,
      }),
    [dimmed, map.palette.shadow],
  );
  const waterMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        // Coral belongs to lesson stones. Water keeps its own cool material
        // so the underside still has the blue counterpoint from the reference.
        color: 0xffffff,
        vertexColors: true,
        transparent: true,
        opacity: dimmed ? 0.3 : 0.68,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      }),
    [dimmed, map.palette.accent],
  );
  const waterfallHeight = 6 + courseFactor * 13;
  const waterfallWidth = 1.7 + courseFactor * 1.75;
  const waterfallScaleY = Math.min(1.15, minimumHalf / 18);
  const waterGeometry = useMemo(() => {
    // One ribbon, no extra draw. Vertical bands plus a taper and a bottom
    // flare give the reference's cheap waterfall shape without a splash mesh.
    const geometry = new THREE.PlaneGeometry(waterfallWidth, waterfallHeight, 6, 8);
    const position = geometry.getAttribute("position");
    const colours = new Float32Array(position.count * 3);
    const bands = [0x4aa7c2, 0x8bd7df, 0x55b8d0, 0x9be0e0, 0x7fd0d8, 0x4aa7c2];
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      const along = (y + waterfallHeight * 0.5) / waterfallHeight;
      const taper = 0.52 + 0.48 * along;
      const flare = along < 0.14 ? ((0.14 - along) / 0.14) * 0.85 : 0;
      const wave = Math.sin(y * 0.42) * waterfallWidth * 0.045;
      position.setX(index, x * (taper + flare) + wave);
      position.setZ(index, (1 - along) * 0.18);
      const band = Math.max(
        0,
        Math.min(bands.length - 1, Math.round((x / waterfallWidth + 0.5) * (bands.length - 1))),
      );
      const colour = new THREE.Color(bands[band]!);
      if (along < 0.12) colour.lerp(new THREE.Color(0xd8f4f6), 0.35 * (1 - along / 0.12));
      colour.toArray(colours, index * 3);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, [waterfallHeight, waterfallWidth]);

  useLayoutEffect(() => {
    const target = rocks.current;
    if (!target) return;
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < ROCK_COUNT; index += 1) {
      const angle = (index / ROCK_COUNT) * Math.PI * 2 + 0.28;
      const radius = minimumHalf * (0.18 + (index % 3) * 0.11);
      const spikeHeight = 4.2 + (index % 3) * 2.1 + courseFactor * 1.4;
      const spikeRadius = 1.05 + (index % 2) * 0.55 + courseFactor * 0.35;
      const topY = -0.15;
      const position = new THREE.Vector3(
        centreX + Math.cos(angle) * radius,
        topY - spikeHeight * 0.5,
        centreZ + Math.sin(angle) * radius,
      );
      matrix.compose(
        position,
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler(Math.PI + 0.12 * Math.sin(angle), angle, 0.08 * Math.cos(angle)),
        ),
        new THREE.Vector3(spikeRadius, spikeHeight, spikeRadius * 0.86),
      );
      target.setMatrixAt(index, matrix);
    }
    target.instanceMatrix.needsUpdate = true;
  }, [centreX, centreZ, courseFactor, map, minimumHalf]);
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
        scale={[1, 1, 0.92]}
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
          map.bounds.maxX * 0.62,
          1.18 - waterfallHeight * waterfallScaleY * 0.5,
          map.bounds.minZ * 0.58,
        ]}
        scale={[1, waterfallScaleY, 1]}
        // Face the fixed course-design camera so the water reads as a broad
        // vertical ribbon instead of an edge-on blue sliver.
        rotation={[0, (65 * Math.PI) / 180, 0]}
        renderOrder={3}
      />
    </group>
  );
}
