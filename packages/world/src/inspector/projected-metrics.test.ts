import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  measureProjectedGeometry,
  planetProjectionStatus,
  projectedMetric,
  projectedTriangleTotal,
} from "./projected-metrics.js";

describe("actual scene projection accounting", () => {
  it("does not count one prepared peer as the completed multi-domain field", () => {
    const scene = new THREE.Scene();
    const first = new THREE.Group();
    first.name = "domain-planet-first";
    first.userData = { planetAssetsReady: true, representativeLimit: 3 };
    const pending = new THREE.Group();
    pending.name = "domain-planet-pending";
    pending.userData = { planetAssetsReady: false, representativeLimit: 3 };
    scene.add(first, pending);
    const projected = {
      domainGlobe: { instances: 2, triangles: 7936, meshes: 2 },
      atmosphericIslands: { instances: 1, triangles: 1920, meshes: 1 },
      domainRegionTargets: { instances: 1, triangles: 80, meshes: 1 },
    };
    const partial = { projected, ...planetProjectionStatus(scene, projected) };
    expect(partial.planetRepresentativeLimit).toBe(3);
    expect(projectedMetric(partial, "domainGlobe")?.triangles).toBe(7936);
    expect(projectedMetric(partial, "atmosphericIslands")).toBeNull();
    expect(projectedTriangleTotal(partial, ["domainGlobe", "atmosphericIslands"])).toBeNull();
    expect(partial.knownAbsent).toEqual([]);
    pending.userData.planetAssetsReady = true;
    const complete = { projected, ...planetProjectionStatus(scene, projected) };
    expect(complete.incomplete).toEqual([]);
    expect(
      projectedTriangleTotal(complete, ["domainGlobe", "atmosphericIslands", "planetFocus"]),
    ).toBe(9856);
    expect(complete.knownAbsent).toEqual(["planetFocus"]);
  });

  it("distinguishes a ready empty domain from no observed domain owner", () => {
    const scene = new THREE.Scene();
    expect(planetProjectionStatus(scene, {}).knownAbsent).toEqual([]);
    const empty = new THREE.Group();
    empty.name = "domain-planet-empty";
    empty.userData = { planetAssetsReady: true, representativeLimit: 5 };
    scene.add(empty);
    const runtime = { projected: {}, ...planetProjectionStatus(scene, {}) };
    expect(
      projectedTriangleTotal(runtime, ["atmosphericIslands", "domainRegionTargets", "planetFocus"]),
    ).toBe(0);
    expect(projectedMetric(runtime, "domainGlobe")).toBeNull();
  });

  it("counts geometry instances, merged footings and variable trunk batches, not atlas size", () => {
    const scene = new THREE.Scene();
    const cube = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial();
    const crowns = new THREE.InstancedMesh(cube, material, 9);
    crowns.name = "course-tree-crowns";
    const trunks = new THREE.InstancedMesh(cube, material, 3);
    trunks.userData.islandLookTreeTrunkTriangles = 12;
    const secondTrunk = new THREE.InstancedMesh(cube, material, 2);
    secondTrunk.userData.islandLookTreeTrunkTriangles = 12;
    secondTrunk.count = 1;
    const footing = new THREE.Mesh(cube, material);
    footing.name = "lesson-medallion-footing";
    const hidden = new THREE.Mesh(cube, material);
    hidden.name = "course-tree-crowns";
    hidden.visible = false;
    scene.add(crowns, trunks, secondTrunk, footing, hidden);
    expect(measureProjectedGeometry(scene)).toEqual({
      treeCrown: { instances: 9, triangles: 108, meshes: 1 },
      treeTrunk: { instances: 4, triangles: 48, meshes: 2 },
      footing: { instances: 1, triangles: 12, meshes: 1 },
    });
    cube.dispose();
    material.dispose();
  });

  it("recognizes remote-island-terrain as terrain and planet-focus meshes as planetFocus", () => {
    const scene = new THREE.Scene();
    const terrainGeom = new THREE.BufferGeometry();
    terrainGeom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(new Float32Array(9 * 3), 3),
    );
    const material = new THREE.MeshBasicMaterial();
    const terrainMesh = new THREE.Mesh(terrainGeom, material);
    terrainMesh.name = "remote-island-terrain";

    const ringGeom = new THREE.RingGeometry(1, 2, 48); // 48 * 2 = 96 triangles
    const focusMesh = new THREE.Mesh(ringGeom, material);
    focusMesh.name = "planet-study-focus-turing-pact";
    focusMesh.userData.planetSelectedStudy = "turing-pact";

    scene.add(terrainMesh, focusMesh);
    expect(measureProjectedGeometry(scene)).toEqual({
      terrain: { instances: 1, triangles: 3, meshes: 1 },
      planetFocus: { instances: 1, triangles: 96, meshes: 1 },
    });

    terrainGeom.dispose();
    ringGeom.dispose();
    material.dispose();
  });

  it("recognizes remote-props meshes and counts instances and triangles accurately", () => {
    const scene = new THREE.Scene();
    const cube = new THREE.BoxGeometry(); // 12 triangles
    const material = new THREE.MeshBasicMaterial();

    const landmarks = new THREE.InstancedMesh(cube, material, 5);
    landmarks.name = "remote-props-landmarks";
    landmarks.userData.remoteProps = true;

    const trees = new THREE.InstancedMesh(cube, material, 15);
    trees.name = "remote-props-trees";
    trees.userData.remoteProps = true;

    scene.add(landmarks, trees);

    expect(measureProjectedGeometry(scene)).toEqual({
      remoteProps: {
        instances: 20,
        triangles: 20 * 12,
        meshes: 2,
      },
      remoteLandmark: { instances: 5, triangles: 60, meshes: 1 },
      remoteTree: { instances: 15, triangles: 180, meshes: 1 },
    });

    cube.dispose();
    material.dispose();
  });

  it("does not resurrect the retired world tree silhouette metadata path", () => {
    const scene = new THREE.Scene();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial();
    const retired = new THREE.Mesh(geometry, material);
    retired.userData.islandLookWorldTreeSilhouetteTriangles = 12;
    scene.add(retired);

    expect(measureProjectedGeometry(scene)).toEqual({});
    geometry.dispose();
    material.dispose();
  });

  it("keeps an unobserved optional focus unknown until complete absence is certified", () => {
    const partial = {
      projected: {
        domainGlobe: { instances: 1, triangles: 3968, meshes: 1 },
      },
    } as const;
    expect(projectedMetric(partial, "planetFocus")).toBeNull();
    expect(projectedTriangleTotal(partial, ["domainGlobe", "planetFocus"])).toBeNull();

    const completeWithoutFocus = {
      ...partial,
      knownAbsent: ["planetFocus"] as const,
    };
    expect(projectedMetric(completeWithoutFocus, "planetFocus")).toEqual({
      instances: 0,
      triangles: 0,
      meshes: 0,
    });
    expect(projectedTriangleTotal(completeWithoutFocus, ["domainGlobe", "planetFocus"])).toBe(3968);
  });
});

it("separates domain surfaces, clouds, island batches and invisible submitted hit volumes", () => {
  const scene = new THREE.Scene();
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshBasicMaterial();
  const names = [
    "domain-globe-programming",
    "domain-clouds-programming",
    "domain-atmosphere-programming",
    "domain-course-islands-programming",
  ];
  for (const name of names) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    scene.add(mesh);
  }
  const targets = new THREE.InstancedMesh(geometry, material, 30);
  targets.name = "domain-region-targets-programming";
  scene.add(targets);
  const hidden = new THREE.Group();
  hidden.visible = false;
  const old = new THREE.Mesh(geometry, material);
  old.name = "domain-globe-old";
  hidden.add(old);
  scene.add(hidden);
  const measured = measureProjectedGeometry(scene);
  expect(measured?.domainGlobe).toEqual({ triangles: 12, meshes: 1, instances: 1 });
  expect(measured?.domainClouds?.triangles).toBe(12);
  expect(measured?.domainAtmosphere?.triangles).toBe(12);
  expect(measured?.atmosphericIslands?.triangles).toBe(12);
  expect(measured?.domainRegionTargets).toEqual({ triangles: 360, meshes: 1, instances: 30 });
  expect(measured?.remoteProps).toBeUndefined();
  geometry.dispose();
  material.dispose();
});
