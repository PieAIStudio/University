import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { measureProjectedGeometry } from "./projected-metrics.js";

describe("actual scene projection accounting", () => {
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
});
