import { type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import {
  cellTopColour,
  gridRimWeightsForCells,
  HEX_GEOMETRY_TRIANGLES,
  hexGeometry,
  setGridRimAttribute,
} from "./HexField.js";
import { GRID_SEAM_STRENGTH, type GridCell } from "./course-grid.js";
import { createHexFieldMaterial } from "./hex-field-material.js";
import { hexToWorld } from "./hex.js";
import { WorldPropField } from "./WorldPropField.js";
import { WorldUndersideField } from "./WorldUndersideField.js";
import { gridSurfaceCounts } from "./grid-surface.js";
import type { WorldGridIsland } from "./world-grid-types.js";

interface WorldCellInstance {
  readonly islandIndex: number;
  readonly island: WorldGridIsland;
  readonly cell: GridCell;
}

interface WorldHexTerrainProps {
  readonly instances: readonly WorldCellInstance[];
  readonly rimWeights: Float32Array;
  readonly onPick: (islandIndex: number) => void;
  readonly onHover: (islandIndex: number | null) => void;
}

function cellInstances(islands: readonly WorldGridIsland[]): readonly WorldCellInstance[] {
  return islands.flatMap((island, islandIndex) =>
    island.map.cells.map((cell) => ({ islandIndex, island, cell })),
  );
}

function worldCellMatrix(instance: WorldCellInstance, target: THREE.Matrix4): THREE.Matrix4 {
  const { island, cell } = instance;
  const point = hexToWorld(cell.coord, island.map.hexSize);
  // The remote camera sees more cliff than meadow if the prism is taller than
  // it is wide. Keep a real terrace, but let the top colour own the silhouette.
  const height = Math.max(0.22, cell.topY * 0.58) * island.scale;
  target.compose(
    new THREE.Vector3(
      island.position.x + point.x * island.scale,
      island.position.y + height * 0.5,
      island.position.z + point.z * island.scale,
    ),
    new THREE.Quaternion(),
    new THREE.Vector3(island.map.hexSize * island.scale, height, island.map.hexSize * island.scale),
  );
  return target;
}

function instanceIslandIndex(
  event: ThreeEvent<MouseEvent>,
  instances: readonly WorldCellInstance[],
): number | null {
  const instanceId = event.instanceId;
  return instanceId === undefined ? null : (instances[instanceId]?.islandIndex ?? null);
}

/** All remote cells share one prism geometry, material and instanced draw. */
function WorldHexTerrain({ instances, rimWeights, onPick, onHover }: WorldHexTerrainProps) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const firstMap = instances[0]?.island.map;
  const geometry = useMemo(() => hexGeometry(GRID_SEAM_STRENGTH.land, -0.62), []);
  const material = useMemo(
    () => (firstMap ? createHexFieldMaterial(firstMap, false, "land") : null),
    [firstMap],
  );
  const matrix = useMemo(() => new THREE.Matrix4(), []);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    setGridRimAttribute(geometry, rimWeights);
    instances.forEach((instance, index) => {
      target.setMatrixAt(index, worldCellMatrix(instance, matrix));
      const colour = cellTopColour(instance.island.map, instance.cell);
      if (instance.island.dimmed) colour.multiplyScalar(0.62);
      target.setColorAt(index, colour);
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
    target.computeBoundingSphere();
  }, [geometry, instances, matrix, rimWeights]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material?.dispose(), [material]);

  if (!material || instances.length === 0) return null;
  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, instances.length]}
      name="world-grid-hex-field"
      frustumCulled={false}
      onClick={(event) => {
        const islandIndex = instanceIslandIndex(event, instances);
        if (islandIndex === null) return;
        event.stopPropagation();
        onPick(islandIndex);
      }}
      onPointerOver={(event) => {
        const islandIndex = instanceIslandIndex(event, instances);
        if (islandIndex === null) return;
        event.stopPropagation();
        onHover(islandIndex);
      }}
      onPointerOut={() => onHover(null)}
      userData={{
        worldGridCellCount: instances.length,
        worldGridTriangleCount: instances.length * Number(geometry.userData.gridTriangles ?? 18),
        worldGridDrawModel: "one-instanced-hex-prism",
        worldGridSurfaceCounts: gridSurfaceCounts(instances.map((instance) => instance.cell)),
      }}
    />
  );
}

export interface WorldHexFieldProps {
  readonly islands: readonly WorldGridIsland[];
  readonly onPick: (islandIndex: number) => void;
  readonly onHover: (islandIndex: number | null) => void;
}

/**
 * The world projection of the shared grid pipeline.
 *
 * Course maps keep their four readable layers. The remote map composes either
 * the catalogue's course field or the planet's one-study landmasses into one
 * terrain instance, one soil underside, one spike instance and a small number
 * of cross-catalogue prop batches. Picking resolves the owning island through
 * the terrain instance id.
 */
export function WorldHexField({ islands, onPick, onHover }: WorldHexFieldProps) {
  const instances = useMemo(() => cellInstances(islands), [islands]);
  const rimWeights = useMemo(
    () =>
      new Float32Array(
        islands.flatMap((island) =>
          Array.from(gridRimWeightsForCells(island.map, island.map.cells)),
        ),
      ),
    [islands],
  );
  const cellCount = instances.length;
  const triangleCount = cellCount * HEX_GEOMETRY_TRIANGLES;
  return (
    <group
      name="world-grid-field"
      userData={{
        worldGridIslandCount: islands.length,
        worldGridCellCount: cellCount,
        worldGridTriangleCount: triangleCount,
        worldGridSharedGeometry: true,
        worldGridSurfaceCounts: gridSurfaceCounts(instances.map((instance) => instance.cell)),
      }}
    >
      <WorldHexTerrain
        instances={instances}
        rimWeights={rimWeights}
        onPick={onPick}
        onHover={onHover}
      />
      <WorldUndersideField islands={islands} />
      <WorldPropField islands={islands} />
    </group>
  );
}

export type { WorldGridIsland } from "./world-grid-types.js";
