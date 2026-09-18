import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { toySlab, wordFrameGeometry } from "./geometry.js";

describe("shared toy geometry", () => {
  it("keeps a real word-slot opening, with support around rather than through it", () => {
    const geometry = wordFrameGeometry();
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 3, 0), new THREE.Vector3(0, -1, 0));
    expect(ray.intersectObject(mesh)).toHaveLength(0);
    ray.set(new THREE.Vector3(2, 3, 0), new THREE.Vector3(0, -1, 0));
    expect(ray.intersectObject(mesh).length).toBeGreaterThan(0);
    geometry.dispose();
    material.dispose();
  });
  it("builds bounded, finite plinths with normalized normals", () => {
    for (const [width, depth, height, radius] of [
      [11.1, 8.7, 1.55, 1.65],
      [3.45, 2.2, 0.18, 0.8],
    ]) {
      const geometry = toySlab(width!, depth!, height!, radius!);
      geometry.computeBoundingBox();
      const size = geometry.boundingBox!.getSize(new THREE.Vector3());
      expect(size.x).toBeLessThan(width! + 0.25);
      expect(size.z).toBeLessThan(depth! + 0.25);
      expect(size.y).toBeLessThan(height! + 0.2);
      expect(Array.from(geometry.getAttribute("position").array).every(Number.isFinite)).toBe(true);
      const normals = geometry.getAttribute("normal");
      for (let i = 0; i < normals.count; i++) {
        expect(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i))).toBeCloseTo(1, 4);
      }
      geometry.dispose();
    }
  });
});
