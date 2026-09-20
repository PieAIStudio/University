import { expect, it } from "vitest";
import * as THREE from "three";
import { boardPoint } from "./board-projection.js";
it("all raised board faces share a camera-facing plane and project to their own pixel positions", () => {
  for (const width of [320, 855]) {
    const camera = new THREE.PerspectiveCamera(34, width / 620, 0.1, 160);
    camera.position.set(0, 5, 20);
    camera.lookAt(0, 1.5, 0);
    camera.updateMatrixWorld();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    for (const y of [64, 115, 222, 329, 436, 552]) {
      const p = new THREE.Vector3(...boardPoint(camera, width, 620, width * 0.24, y));
      expect(p.clone().sub(camera.position).dot(forward)).toBeCloseTo(20, 7);
      const ndc = p.project(camera);
      expect((1 - ndc.y) * 310).toBeCloseTo(y, 6);
      expect(((ndc.x + 1) * width) / 2).toBeCloseTo(width * 0.24, 6);
    }
  }
});
