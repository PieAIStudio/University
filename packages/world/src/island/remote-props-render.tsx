/**
 * R3F component for batch rendering lightweight remote props.
 *
 * Renders all catalogue landmark silhouettes and tree cones with 2 global
 * InstancedMesh draw calls, matching the exact worldmesh elevations.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import {
  createRemotePavilionGeometry,
  createRemoteTreeGeometry,
  planRemotePropsCatalogue,
  REMOTE_PAVILION_TRIANGLES,
  REMOTE_TREE_TRIANGLES,
} from "./remote-props.js";
import type { RemoteIslandPlacement } from "./remote-island-field.js";

const DUMMY = new THREE.Object3D();

export interface RemotePropsFieldProps {
  readonly islands: readonly RemoteIslandPlacement[];
}

export function RemotePropsField({ islands }: RemotePropsFieldProps) {
  const landmarkMeshRef = useRef<THREE.InstancedMesh>(null);
  const treeMeshRef = useRef<THREE.InstancedMesh>(null);

  const plan = useMemo(() => planRemotePropsCatalogue(islands), [islands]);

  const pavilionGeometry = useMemo(() => createRemotePavilionGeometry(), []);
  const treeGeometry = useMemo(() => createRemoteTreeGeometry(), []);

  const landmarkMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xb5aba0,
        roughness: 0.85,
        metalness: 0.1,
        flatShading: true,
      }),
    [],
  );

  const treeMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0x588b40,
        roughness: 0.9,
        metalness: 0.05,
        flatShading: true,
      }),
    [],
  );

  useEffect(
    () => () => {
      pavilionGeometry.dispose();
      treeGeometry.dispose();
      landmarkMaterial.dispose();
      treeMaterial.dispose();
    },
    [pavilionGeometry, treeGeometry, landmarkMaterial, treeMaterial],
  );

  useLayoutEffect(() => {
    const landmarkMesh = landmarkMeshRef.current;
    if (landmarkMesh && plan.landmarks.length > 0) {
      plan.landmarks.forEach((landmark, index) => {
        DUMMY.position.copy(landmark.position);
        DUMMY.rotation.set(0, landmark.rotationY, 0);
        DUMMY.scale.setScalar(landmark.scale);
        DUMMY.updateMatrix();
        landmarkMesh.setMatrixAt(index, DUMMY.matrix);
        landmarkMesh.setColorAt(index, new THREE.Color().setScalar(landmark.dimmed ? 0.62 : 1));
      });
      landmarkMesh.instanceMatrix.needsUpdate = true;
      if (landmarkMesh.instanceColor) landmarkMesh.instanceColor.needsUpdate = true;
    }

    const treeMesh = treeMeshRef.current;
    if (treeMesh && plan.trees.length > 0) {
      plan.trees.forEach((tree, index) => {
        DUMMY.position.copy(tree.position);
        DUMMY.rotation.set(0, tree.rotationY, 0);
        DUMMY.scale.setScalar(tree.scale);
        DUMMY.updateMatrix();
        treeMesh.setMatrixAt(index, DUMMY.matrix);
        treeMesh.setColorAt(index, new THREE.Color().setScalar(tree.dimmed ? 0.62 : 1));
      });
      treeMesh.instanceMatrix.needsUpdate = true;
      if (treeMesh.instanceColor) treeMesh.instanceColor.needsUpdate = true;
    }
  }, [plan]);

  if (plan.totalProps === 0) return null;

  return (
    <group
      name="remote-props"
      userData={{
        remoteProps: true,
        remotePropCount: plan.totalProps,
        remoteLandmarkCount: plan.landmarks.length,
        remoteTreeCount: plan.trees.length,
        remoteTriangleCount: plan.totalTriangles,
      }}
    >
      {plan.landmarks.length > 0 ? (
        <instancedMesh
          ref={landmarkMeshRef}
          name="remote-props-landmarks"
          args={[pavilionGeometry, landmarkMaterial, plan.landmarks.length]}
          castShadow={false}
          frustumCulled={false}
          userData={{
            remoteProps: true,
            remotePropsKind: "landmark",
            remoteTrianglesPerInstance: REMOTE_PAVILION_TRIANGLES,
          }}
        />
      ) : null}
      {plan.trees.length > 0 ? (
        <instancedMesh
          ref={treeMeshRef}
          name="remote-props-trees"
          args={[treeGeometry, treeMaterial, plan.trees.length]}
          castShadow={false}
          frustumCulled={false}
          userData={{
            remoteProps: true,
            remotePropsKind: "tree",
            remoteTrianglesPerInstance: REMOTE_TREE_TRIANGLES,
          }}
        />
      ) : null}
    </group>
  );
}
