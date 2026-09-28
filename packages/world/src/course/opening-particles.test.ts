import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { OpeningParticles } from "./opening-particles.js";

function drawnLoot(particles: OpeningParticles) {
  return particles.group.children.filter(
    (object): object is THREE.InstancedMesh => object instanceof THREE.InstancedMesh,
  );
}

function expectSettled(particles: OpeningParticles) {
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  for (const mesh of drawnLoot(particles)) {
    for (let index = 0; index < mesh.count; index += 1) {
      mesh.getMatrixAt(index, matrix);
      expect(matrix.elements.every(Number.isFinite)).toBe(true);
      // A pooled unused slot is the zero-scale matrix. Do not decompose a
      // singular transform: Three can leave the previous scale output intact.
      if ([0, 1, 2, 4, 5, 6, 8, 9, 10].every((at) => matrix.elements[at] === 0)) continue;
      matrix.decompose(position, rotation, scale);
      expect(mesh.name).not.toBe("opening-confetti");
      expect(position.y, `${mesh.name}[${index}] ${JSON.stringify(matrix.elements)}`).toBeCloseTo(
        0.02,
        5,
      );
    }
  }
  const sparks = particles.group.children.find((object) => object instanceof THREE.Points);
  expect((sparks as THREE.Points).geometry.drawRange.count).toBe(0);
}

describe("opening particle time", () => {
  it("settles after 1.5 real seconds even with slow frames, then stays still", () => {
    const particles = new OpeningParticles(7);
    try {
      particles.spray(80, 1, 0.65, 0xffffff, true);
      particles.rain(20);
      particles.firework();
      for (let index = 0; index < 15; index += 1) particles.update(0.1);
      expectSettled(particles);
      const matrices = drawnLoot(particles).map((mesh) => Array.from(mesh.instanceMatrix.array));
      particles.update(1);
      expect(drawnLoot(particles).map((mesh) => Array.from(mesh.instanceMatrix.array))).toEqual(
        matrices,
      );
    } finally {
      particles.dispose();
    }
  });

  it("catches up a long interruption without exploding or retaining expired sparks", () => {
    const particles = new OpeningParticles(11);
    try {
      particles.spray(80, 1.36, 0.65, 0xffffff, true);
      particles.rain(60);
      particles.firework();
      particles.update(60);
      expectSettled(particles);
    } finally {
      particles.dispose();
    }
  });
});
