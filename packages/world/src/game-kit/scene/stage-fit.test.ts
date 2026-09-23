import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { fitStage, stagePitch, type ArenaBox } from "./stage-fit.js";

const box: ArenaBox = { min: [-5.2, 0, -5.6], max: [5.2, 1.6, 4.8] };

function projected(aspect: number) {
  const fit = fitStage(box, aspect, { top: 0.2, bottom: 0.03, side: 0.03 });
  const camera = new THREE.PerspectiveCamera(fit.fov, aspect, 0.1, 400);
  camera.position.copy(fit.position);
  camera.lookAt(fit.target);
  camera.updateMatrixWorld();
  const points: THREE.Vector3[] = [];
  for (const x of [box.min[0], box.max[0]])
    for (const y of [box.min[1], box.max[1]])
      for (const z of [box.min[2], box.max[2]])
        points.push(new THREE.Vector3(x, y, z).project(camera));
  return points;
}

describe("stage fit", () => {
  it.each([
    ["a wide screen", 1.7],
    ["a laptop", 1.4],
    ["a square", 1],
    ["a phone", 0.62],
  ])("keeps the whole arena below the HUD band on %s", (_label, aspect) => {
    const points = projected(aspect);
    for (const p of points) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(0.94 + 1e-6);
      expect(p.y).toBeLessThanOrEqual(0.6 + 0.02);
      expect(p.y).toBeGreaterThanOrEqual(-0.94 - 0.02);
    }
    // And uses the band: the arena is not a speck in the middle.
    const width = Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x));
    const height = Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y));
    expect(Math.max(width / 1.88, height / 1.54)).toBeGreaterThan(0.9);
  });

  it("looks down more steeply on a tall stage", () => {
    expect(stagePitch(0.6)).toBeGreaterThan(stagePitch(1.6));
  });
});
