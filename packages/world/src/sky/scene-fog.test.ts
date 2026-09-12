import { expect, it } from "vitest";
import * as THREE from "three";
import { bindSceneFog } from "./scene-fog.js";

it("does not let an old projection cleanup erase the already committed next fog", () => {
  const scene = new THREE.Scene();
  const course = new THREE.FogExp2(0x88aacc, 0.003),
    world = new THREE.FogExp2(0x778899, 0.004);
  const releaseCourse = bindSceneFog(scene, course);
  const releaseWorld = bindSceneFog(scene, world);
  releaseCourse();
  releaseCourse();
  expect(scene.fog).toBe(world);
  releaseWorld();
  expect(scene.fog).toBeNull();
});

it("restores only still-live owners and preserves an externally assigned fog", () => {
  const scene = new THREE.Scene(),
    original = new THREE.Fog(0x334455, 1, 100);
  scene.fog = original;
  const a = new THREE.FogExp2(0x8899aa, 0.001),
    b = new THREE.FogExp2(0x88aaaa, 0.002);
  const releaseA = bindSceneFog(scene, a),
    releaseB = bindSceneFog(scene, b);
  releaseB();
  expect(scene.fog).toBe(a);
  releaseA();
  expect(scene.fog).toBe(original);
  const release = bindSceneFog(scene, a);
  scene.fog = b;
  release();
  expect(scene.fog).toBe(b);
});
