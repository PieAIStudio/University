/**
 * R3F Component for rendering the shared continuous remote island view.
 *
 * Renders all islands in a single draw call with low triangle budget (640 tris per island),
 * handling per-island click (pick) and pointer hover via faceIndex mapping.
 */
import { type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import {
  buildRemoteIslandBatch,
  type RemoteIslandBatch,
  type RemoteIslandPlacement,
} from "./remote-island-field.js";
import { RemotePropsField } from "./remote-props-render.js";

export interface RemoteIslandFieldProps {
  readonly islands: readonly RemoteIslandPlacement[];
  readonly onPick?: (islandIndex: number) => void;
  readonly onHover?: (islandIndex: number | null) => void;
  readonly showProps?: boolean;
}

export function RemoteIslandField({
  islands,
  onPick,
  onHover,
  showProps = true,
}: RemoteIslandFieldProps) {
  const hoveredIsland = useRef<number | null>(null);
  const batch = useMemo<RemoteIslandBatch>(() => buildRemoteIslandBatch(islands), [islands]);

  useEffect(() => () => batch.dispose(), [batch]);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.68,
        metalness: 0,
      }),
    [],
  );

  useEffect(() => () => material.dispose(), [material]);

  if (islands.length === 0 || batch.triangleCount === 0) return null;

  return (
    <group
      name="remote-island-field"
      userData={{
        remoteIslandCount: islands.length,
        ...(import.meta.env.DEV ? { remoteIslandIds: islands.map((island) => island.id) } : {}),
        remoteTriangleCount: batch.triangleCount,
        remoteSharedGeometry: true,
        remoteDrawModel: "one-merged-continuous-mesh",
      }}
    >
      <mesh
        name="remote-island-terrain"
        geometry={batch.geometry}
        material={material}
        frustumCulled={false}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          const faceIndex = event.faceIndex;
          if (typeof faceIndex !== "number" || !Number.isInteger(faceIndex) || faceIndex < 0)
            return;
          const islandIndex = batch.islandIndexForFace(faceIndex);
          if (islandIndex === null) return;
          event.stopPropagation();
          onPick?.(islandIndex);
        }}
        onPointerOver={(event: ThreeEvent<PointerEvent>) => {
          const faceIndex = event.faceIndex;
          if (typeof faceIndex !== "number" || !Number.isInteger(faceIndex) || faceIndex < 0)
            return;
          const islandIndex = batch.islandIndexForFace(faceIndex);
          if (islandIndex === null) return;
          if (islandIndex === hoveredIsland.current) return;
          hoveredIsland.current = islandIndex;
          event.stopPropagation();
          onHover?.(islandIndex);
        }}
        onPointerMove={(event: ThreeEvent<PointerEvent>) => {
          const faceIndex = event.faceIndex;
          if (typeof faceIndex !== "number" || !Number.isInteger(faceIndex) || faceIndex < 0)
            return;
          const islandIndex = batch.islandIndexForFace(faceIndex);
          if (islandIndex === null) return;
          if (islandIndex === hoveredIsland.current) return;
          hoveredIsland.current = islandIndex;
          event.stopPropagation();
          onHover?.(islandIndex);
        }}
        onPointerOut={() => {
          if (hoveredIsland.current !== null) {
            hoveredIsland.current = null;
            onHover?.(null);
          }
        }}
      />
      {showProps ? <RemotePropsField islands={islands} /> : null}
    </group>
  );
}

export { RemotePropsField } from "./remote-props-render.js";
export type { RemotePropsFieldProps } from "./remote-props-render.js";
export type {
  RemoteIslandPlacement,
  RemoteIslandBatch,
  RemoteIslandRange,
  RemoteBaseGeometry,
} from "./remote-island-field.js";
