import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { hash } from "../island/random.js";
import { GRID_SHARED_SOIL } from "./grid-palette.js";
import type { WorldGridIsland } from "./world-grid-types.js";

interface WorldUndersideFieldProps {
  readonly islands: readonly WorldGridIsland[];
}

interface SpikePlacement {
  readonly island: WorldGridIsland;
  readonly x: number;
  readonly z: number;
  readonly depth: number;
  readonly radius: number;
  readonly turn: number;
}

function spikePlacements(islands: readonly WorldGridIsland[]): readonly SpikePlacement[] {
  return islands.flatMap((island) => {
    // Small islands get one readable point; highlands get a three-point
    // silhouette. The count is driven by the same cell field, never by a
    // per-course decoration table.
    const count = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(island.map.cells.length) / 3)));
    const centreX = (island.map.bounds.minX + island.map.bounds.maxX) * 0.5;
    const centreZ = (island.map.bounds.minZ + island.map.bounds.maxZ) * 0.5;
    return Array.from({ length: count }, (_, index) => {
      const seed = `${island.id}/world-underside/${index}`;
      return {
        island,
        x: centreX + (hash(`${seed}/x`) * 2 - 1) * Math.max(0.35, island.map.bounds.halfX * 0.62),
        z: centreZ + (hash(`${seed}/z`) * 2 - 1) * Math.max(0.35, island.map.bounds.halfZ * 0.62),
        depth: 0.32 + hash(`${seed}/depth`) * 0.38,
        radius: 0.18 + hash(`${seed}/radius`) * 0.14,
        turn: hash(`${seed}/turn`) * Math.PI * 2,
      };
    });
  });
}

/**
 * The remote projection's cheap floating-island underside.
 *
 * The top field owns the actual silhouette. One tapered soil cone and a
 * single instanced spike field are enough to make that silhouette float while
 * keeping the underside shared across every course and every palette.
 */
export function WorldUndersideField({ islands }: WorldUndersideFieldProps) {
  const baseMesh = useRef<THREE.InstancedMesh>(null);
  const spikeMesh = useRef<THREE.InstancedMesh>(null);
  const baseGeometry = useMemo(() => new THREE.ConeGeometry(1, 1, 6, 1, true), []);
  const spikeGeometry = useMemo(() => new THREE.ConeGeometry(1, 1, 5, 1, true), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: GRID_SHARED_SOIL.cliff,
        roughness: 0.96,
        metalness: 0,
        flatShading: true,
      }),
    [],
  );
  const spikes = useMemo(() => spikePlacements(islands), [islands]);

  useLayoutEffect(() => {
    const target = baseMesh.current;
    if (!target) return;
    const matrix = new THREE.Matrix4();
    islands.forEach((island, index) => {
      const centreX = (island.map.bounds.minX + island.map.bounds.maxX) * 0.5;
      const centreZ = (island.map.bounds.minZ + island.map.bounds.maxZ) * 0.5;
      const depth = Math.min(1.6, 0.55 + Math.sqrt(island.map.cells.length) * 0.055);
      const scale = island.scale;
      matrix.compose(
        new THREE.Vector3(
          island.position.x + centreX * scale,
          island.position.y - depth * scale * 0.5,
          island.position.z + centreZ * scale,
        ),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0)),
        new THREE.Vector3(
          Math.max(0.85, island.map.bounds.halfX * 0.72) * scale,
          depth * scale,
          Math.max(0.85, island.map.bounds.halfZ * 0.72) * scale,
        ),
      );
      target.setMatrixAt(index, matrix);
    });
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, [islands]);

  useLayoutEffect(() => {
    const target = spikeMesh.current;
    if (!target) return;
    const matrix = new THREE.Matrix4();
    spikes.forEach((spike, index) => {
      const scale = spike.island.scale;
      const topY = spike.island.position.y - 0.08 * scale;
      matrix.compose(
        new THREE.Vector3(
          spike.island.position.x + spike.x * scale,
          topY - spike.depth * scale * 0.5,
          spike.island.position.z + spike.z * scale,
        ),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, spike.turn, 0)),
        new THREE.Vector3(spike.radius * scale, spike.depth * scale, spike.radius * scale),
      );
      target.setMatrixAt(index, matrix);
    });
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, [spikes]);

  useEffect(() => () => baseGeometry.dispose(), [baseGeometry]);
  useEffect(() => () => spikeGeometry.dispose(), [spikeGeometry]);
  useEffect(() => () => material.dispose(), [material]);

  if (islands.length === 0) return null;
  return (
    <group name="world-grid-underside" userData={{ worldUndersideCount: islands.length }}>
      <instancedMesh
        ref={baseMesh}
        args={[baseGeometry, material, islands.length]}
        name="world-grid-soil-cones"
        frustumCulled={false}
      />
      <instancedMesh
        ref={spikeMesh}
        args={[spikeGeometry, material, Math.max(1, spikes.length)]}
        name="world-grid-soil-spikes"
        frustumCulled={false}
      />
    </group>
  );
}
