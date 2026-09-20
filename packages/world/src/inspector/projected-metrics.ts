import * as THREE from "three";

import type {
  InspectorProjectionId,
  InspectorProjectionMetric,
  InspectorRuntimeMetrics,
} from "./types.js";

function projectionId(mesh: THREE.Mesh): InspectorProjectionId | null {
  if (mesh.name.startsWith("domain-globe-")) return "domainGlobe";
  if (mesh.name.startsWith("domain-clouds-")) return "domainClouds";
  if (mesh.name.startsWith("domain-atmosphere-")) return "domainAtmosphere";
  if (mesh.name.startsWith("domain-course-islands-")) return "atmosphericIslands";
  if (mesh.name.startsWith("domain-region-targets-")) return "domainRegionTargets";
  if (mesh.name === "island-terrain" || mesh.name === "remote-island-terrain") return "terrain";
  if (mesh.geometry.name === "IslandGrassBladeGeometry") return "grass";
  if (mesh.userData.islandLookTreeTrunkTriangles !== undefined) return "treeTrunk";
  if (mesh.name === "course-tree-crowns") return "treeCrown";
  if (mesh.name === "course-fir-trees" || mesh.name === "course-broadleaf-trees")
    return "courseTrees";
  if (["course-rock-outcrops", "course-garden-flora", "course-coastal-spring"].includes(mesh.name))
    return "courseLandscape";
  if (mesh.name === "course-cliff-garden") return "cliffGarden";
  if (mesh.name === "course-bush-crowns") return "bushCrown";
  if (mesh.name === "island-campfire-flames") return "campfire";
  if (mesh.name === "hex-grid-lesson-plinths") return "medallion";
  if (mesh.name.startsWith("lesson-medallion-engraving-")) return "sigil";
  if (mesh.name === "lesson-medallion-footing") return "footing";
  if (mesh.name === "lesson-medallion-ground-inlays") return "inlay";
  if (
    mesh.name === "planet-focus" ||
    mesh.name.startsWith("planet-study-focus-") ||
    mesh.userData.planetSelectedStudy !== undefined
  ) {
    return "planetFocus";
  }
  if (
    mesh.name === "remote-props" ||
    mesh.name.startsWith("remote-props-") ||
    mesh.userData.remoteProps !== undefined
  ) {
    return "remoteProps";
  }
  return null;
}

/**
 * Read one projection without turning an omitted sample into a zero.
 * `knownAbsent` is only valid when the caller has completed the scene load and
 * deliberately certified that an optional projection is not present.
 */
export function projectedMetric(
  runtime: InspectorRuntimeMetrics | undefined,
  id: InspectorProjectionId,
): InspectorProjectionMetric | null {
  if (runtime?.incomplete?.includes(id)) return null;
  const measured = runtime?.projected?.[id];
  if (measured !== undefined) return measured;
  if (runtime?.knownAbsent?.includes(id)) {
    return { instances: 0, triangles: 0, meshes: 0 };
  }
  return null;
}

/** Completeness for asynchronous peers, separate from the visible partial mesh sum. */
export function planetProjectionStatus(
  scene: THREE.Object3D,
  projected: InspectorRuntimeMetrics["projected"],
): Pick<InspectorRuntimeMetrics, "knownAbsent" | "incomplete" | "planetRepresentativeLimit"> {
  const asynchronous: readonly InspectorProjectionId[] = [
    "atmosphericIslands",
    "domainRegionTargets",
  ];
  let domains = 0;
  let complete = true;
  const limits = new Set<number>();
  scene.traverseVisible((object) => {
    if (!object.name.startsWith("domain-planet-")) return;
    domains += 1;
    complete = complete && object.userData.planetAssetsReady === true;
    if (object.userData.representativeLimit !== undefined)
      limits.add(object.userData.representativeLimit);
  });
  const limit = limits.size === 1 ? [...limits][0] : undefined;
  const ready = domains > 0 && complete;
  return {
    incomplete: ready ? [] : asynchronous,
    knownAbsent: ready
      ? [...asynchronous, "planetFocus" as const].filter((id) => projected?.[id] === undefined)
      : [],
    ...(limit === 3 || limit === 5 ? { planetRepresentativeLimit: limit } : {}),
  };
}

/** Sum a complete projection set; any unobserved member keeps the result null. */
export function projectedTriangleTotal(
  runtime: InspectorRuntimeMetrics | undefined,
  ids: readonly InspectorProjectionId[],
): number | null {
  if (!runtime) return null;
  let total = 0;
  for (const id of ids) {
    const metric = projectedMetric(runtime, id);
    if (metric === null) return null;
    total += metric.triangles;
  }
  return total;
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
    if (id === "remoteProps") {
      const kind =
        mesh.name === "remote-props-landmarks"
          ? "remoteLandmark"
          : mesh.name === "remote-props-trees"
            ? "remoteTree"
            : null;
      if (kind) {
        const previousKind = projected[kind];
        const placements = Number.isInteger(mesh.userData.remotePlacementCount)
          ? (mesh.userData.remotePlacementCount as number)
          : instances;
        projected[kind] = {
          triangles: (previousKind?.triangles ?? 0) + triangles,
          instances: (previousKind?.instances ?? 0) + placements,
          meshes: (previousKind?.meshes ?? 0) + 1,
        };
      }
    }
  });
  return projected;
}
