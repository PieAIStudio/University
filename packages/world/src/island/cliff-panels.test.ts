import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { appendCliffPanel } from "./cliff-panels.js";

describe("natural mineral shoulder cuts", () => {
  it("keeps an exact boundary but avoids mirrored upper/lower chamfers", () => {
    const colour = new THREE.Color(0.4, 0.5, 0.6);
    const boundary = [
      { x: 2, y: 0, z: 10, colour },
      { x: -2, y: 0, z: 10, colour },
      { x: -2, y: -4, z: 10, colour },
      { x: 2, y: -4, z: 10, colour },
    ];
    const positions: number[] = [],
      colors: number[] = [],
      indices: number[] = [],
      garden: number[] = [];
    const stats = { bevelled: 0, divided: 0, plain: 0 };
    const emitted = appendCliffPanel(
      boundary,
      colour,
      1,
      positions,
      colors,
      indices,
      { x: 0, z: 0 },
      garden,
      stats,
      undefined,
      0.15,
    );
    expect(stats).toEqual({ bevelled: 1, divided: 0, plain: 0 });
    expect(indices.length / 3).toBe(12);
    for (const [i, vertex] of emitted.entries()) {
      const p = boundary[i]!;
      expect(positions.slice(vertex * 3, vertex * 3 + 3)).toEqual([p.x, p.y, p.z]);
    }
    // First two triangles contain the paired inner upper corners. Equal
    // heights recreate the stamped octagonal-column shape of the rejected run.
    expect(Math.abs(positions[2 * 3 + 1]! - positions[4 * 3 + 1]!)).toBeGreaterThan(0.1);
    expect(positions.every(Number.isFinite)).toBe(true);
    expect(colors).toHaveLength(positions.length);
    expect(garden).toEqual([0, 3]);
    const corners = [0, 1, 2, 3].map((i) =>
      new THREE.Vector3().fromArray(positions, (i * 9 + 2) * 3),
    );
    const mean = corners.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(0.25);
    const normal = corners[1]!
      .clone()
      .sub(corners[0]!)
      .cross(corners[2]!.clone().sub(corners[0]!))
      .normalize();
    const fracture = new THREE.Vector3().fromArray(positions, 8 * 3).sub(mean);
    const relief = Math.abs(fracture.dot(normal));
    expect(relief, "broad mineral face, not a repeated gemstone peak").toBeLessThan(0.14);
    expect(relief).toBeGreaterThan(0.02);
    fracture.addScaledVector(normal, -fracture.dot(normal));
    expect(
      fracture.length(),
      "fracture is not stamped into the centre of every stone",
    ).toBeGreaterThan(0.15);
  });
});
