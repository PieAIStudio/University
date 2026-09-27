import * as THREE from "three";
import { describe, expect, it } from "vitest";

import {
  bakeMonsterPose,
  bakedMonsterTriangles,
  buildCrownGeometry,
  idleClip,
} from "./monster-pose.js";

/** A two-bone column, two units tall, whose idle bends the upper bone sideways. */
function bendingColumn() {
  const geometry = new THREE.BoxGeometry(0.4, 2, 0.4, 1, 4, 1);
  geometry.translate(0, 1, 0);
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const skinIndex: number[] = [];
  const skinWeight: number[] = [];
  for (let index = 0; index < position.count; index += 1) {
    const upper = position.getY(index) > 1;
    skinIndex.push(upper ? 1 : 0, 0, 0, 0);
    skinWeight.push(1, 0, 0, 0);
  }
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeight, 4));
  const root = new THREE.Bone();
  root.name = "Root";
  const head = new THREE.Bone();
  head.name = "Head";
  head.position.y = 1;
  root.add(head);
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial());
  mesh.add(root);
  mesh.bind(new THREE.Skeleton([root, head]));
  const scene = new THREE.Group();
  scene.add(mesh);
  const bend = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  const idle = new THREE.AnimationClip("Idle", 1, [
    new THREE.QuaternionKeyframeTrack(
      "Head.quaternion",
      [0, 1],
      [...bend.toArray(), ...bend.toArray()],
    ),
  ]);
  const hit = new THREE.AnimationClip("Idle_HitReact_Left", 1, []);
  return { scene, clips: [hit, idle] };
}

describe("a baked monster pose", () => {
  it("picks the standing idle, not a hit reaction named idle", () => {
    const { clips } = bendingColumn();
    expect(idleClip(clips)?.name).toBe("Idle");
    expect(idleClip([new THREE.AnimationClip("Idle_AnimalArmature", 1, [])])?.name).toBe(
      "Idle_AnimalArmature",
    );
    expect(idleClip([new THREE.AnimationClip("Run", 1, [])])).toBeNull();
  });

  it("bakes the idle's bones into plain geometry, one unit tall on the ground", () => {
    const { scene, clips } = bendingColumn();
    const baked = bakeMonsterPose(scene, clips, 0.5);
    expect(baked.parts).toHaveLength(1);
    const geometry = baked.parts[0]!.geometry;
    expect(geometry.getAttribute("skinIndex")).toBeUndefined();
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(box.min.y).toBeCloseTo(0, 5);
    expect(box.max.y).toBeCloseTo(1, 5);
    // Bent over at the middle, the column is now wider than it is tall would suggest.
    expect(box.max.x - box.min.x).toBeGreaterThan(0.4);
    expect(bakedMonsterTriangles(baked)).toBe(geometry.getIndex()!.count / 3);
  });

  it("leaves the loaded model untouched", () => {
    const { scene, clips } = bendingColumn();
    const mesh = scene.children[0] as THREE.SkinnedMesh;
    const before = (mesh.geometry.getAttribute("position").array as Float32Array).slice();
    bakeMonsterPose(scene, clips, 0.5);
    expect(mesh.geometry.getAttribute("position").array).toEqual(before);
    expect(mesh.skeleton.bones[1]!.quaternion.equals(new THREE.Quaternion())).toBe(true);
  });

  it("builds a crown with colour and a base on the ground", () => {
    const crown = buildCrownGeometry();
    crown.computeBoundingBox();
    expect(crown.boundingBox!.min.y).toBeCloseTo(0, 1);
    expect(crown.getAttribute("color")).toBeDefined();
  });
});
