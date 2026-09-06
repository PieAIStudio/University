import * as THREE from "three";

import type {
  InspectorProjectionId,
  InspectorProjectionMetric,
  InspectorRuntimeMetrics,
} from "./types.js";

function projectionId(mesh: THREE.Mesh): InspectorProjectionId | null {
  if (mesh.name === "island-terrain") return "terrain";
  if (mesh.geometry.name === "IslandGrassBladeGeometry") return "grass";
  if (mesh.userData.islandLookTreeTrunkTriangles !== undefined) return "treeTrunk";
  if (mesh.userData.islandLookWorldTreeSilhouetteTriangles !== undefined) return "worldTreeCrown";
  if (mesh.name === "course-tree-crowns") return "treeCrown";
  if (mesh.name === "course-bush-crowns") return "bushCrown";
  if (mesh.name === "island-campfire-flames") return "campfire";
  if (mesh.name === "hex-grid-lesson-plinths") return "medallion";
  if (mesh.name.startsWith("lesson-medallion-engraving-")) return "sigil";
  if (mesh.name === "lesson-medallion-footing") return "footing";
  if (mesh.name === "lesson-medallion-ground-inlays") return "inlay";
  return null;
}

/** Geometry in the visible scene graph; one projection, not shadow/post draws. */
export function measureProjectedGeometry(
  scene: THREE.Object3D,
): InspectorRuntimeMetrics["projected"] {
  const projected: Partial<Record<InspectorProjectionId, InspectorProjectionMetric>> = {};
  scene.traverseVisible((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const id = projectionId(mesh);
    if (!id) return;
    const instances = mesh instanceof THREE.InstancedMesh ? mesh.count : 1;
    if (instances <= 0) return;
    const elements =
      mesh.geometry.index?.count ?? mesh.geometry.getAttribute("position")?.count ?? 0;
    const count = Math.max(
      0,
      Math.min(elements - mesh.geometry.drawRange.start, mesh.geometry.drawRange.count),
    );
    const triangles = Math.floor(count / 3) * instances;
    const previous = projected[id];
    projected[id] = {
      triangles: (previous?.triangles ?? 0) + triangles,
      instances: (previous?.instances ?? 0) + instances,
      meshes: (previous?.meshes ?? 0) + 1,
    };
  });
  return projected;
}
