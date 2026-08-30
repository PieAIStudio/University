import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { hash } from "../island/random.js";
import { GRID_SHARED_SOIL } from "./grid-palette.js";
import {
  WORLD_UNDERSIDE_CONTRACT,
  worldUndersideDepthForCells,
  worldUndersideSpikeCountForCells,
  worldUndersideTriangleCountForIslands,
} from "./world-underside.js";
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
    // Three points are the minimum floating-island read; larger silhouettes
    // earn up to two more. The count is driven by the same cell field, never
    // by a per-course decoration table.
    const count = worldUndersideSpikeCountForCells(island.map.cells.length);
    const centreX = (island.map.bounds.minX + island.map.bounds.maxX) * 0.5;
    const centreZ = (island.map.bounds.minZ + island.map.bounds.maxZ) * 0.5;
    return Array.from({ length: count }, (_, index) => {
      const seed = `${island.id}/world-underside/${index}`;
      const span = count <= 1 ? 0 : index / (count - 1) - 0.5;
      const angle = Math.PI * 0.5 + span * Math.PI * 0.82 + (hash(`${seed}/angle`) - 0.5) * 0.16;
      const radialX = Math.max(
        0.35,
        island.map.bounds.halfX * (0.56 + hash(`${seed}/radial-x`) * 0.16),
      );
      const radialZ = Math.max(
        0.35,
        island.map.bounds.halfZ * (0.56 + hash(`${seed}/radial-z`) * 0.16),
      );
      return {
        island,
        x: centreX + Math.cos(angle) * radialX,
        z: centreZ + Math.sin(angle) * radialZ,
        depth: 0.76 + hash(`${seed}/depth`) * 0.54,
        radius: 0.2 + hash(`${seed}/radius`) * 0.12,
        turn: hash(`${seed}/turn`) * Math.PI * 2,
      };
    });
  });
}

/**
 * The remote projection's cheap floating-island underside.
 *
 * The top field owns the actual silhouette. One deeper tapered soil cone and
 * a single instanced spike field are enough to make that silhouette float
 * while keeping the underside shared across every course and every palette.
 */
export function WorldUndersideField({ islands }: WorldUndersideFieldProps) {
  const baseMesh = useRef<THREE.InstancedMesh>(null);
  const spikeMesh = useRef<THREE.InstancedMesh>(null);
  const baseGeometry = useMemo(
    () => new THREE.ConeGeometry(1, 1, WORLD_UNDERSIDE_CONTRACT.baseSegments, 1, true),
    [],
  );
  const spikeGeometry = useMemo(
    () => new THREE.ConeGeometry(1, 1, WORLD_UNDERSIDE_CONTRACT.spikeSegments, 1, true),
    [],
  );
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
      const depth = worldUndersideDepthForCells(island.map.cells.length);
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
  const triangleCount = worldUndersideTriangleCountForIslands(
    islands.map((island) => island.map.cells.length),
  );
  return (
    <group
      name="world-grid-underside"
      userData={{
        worldUndersideCount: islands.length,
        worldUndersideBaseInstances: islands.length,
        worldUndersideSpikeInstances: spikes.length,
        worldUndersideDrawBatches: WORLD_UNDERSIDE_CONTRACT.drawBatches,
        worldUndersideTriangleCount: triangleCount,
      }}
    >
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
