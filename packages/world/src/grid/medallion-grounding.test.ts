import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { buildSurfaceTriangleIndex, type SurfaceTriangle } from "../island/surface-clip.js";
import { visibleGroundHeight } from "../island/island-geometry.js";
import { buildMedallionInlays, groundMedallion } from "./medallion-grounding.js";

function support(height: (x: number, z: number) => number) {
  const triangles: SurfaceTriangle[] = [];
  const coordinates = [-2, -0.5, 0, 0.5, 2];
  for (let row = 1; row < coordinates.length; row += 1) {
    for (let column = 1; column < coordinates.length; column += 1) {
      const x0 = coordinates[column - 1]!;
      const x1 = coordinates[column]!;
      const z0 = coordinates[row - 1]!;
      const z1 = coordinates[row]!;
      for (const [a, b, c] of [
        [
          [x0, z0],
          [x0, z1],
          [x1, z0],
        ],
        [
          [x1, z0],
          [x0, z1],
          [x1, z1],
        ],
      ] as const) {
        triangles.push({
          x0: a[0],
          z0: a[1],
          y0: height(...a),
          i0: -1,
          x1: b[0],
          z1: b[1],
          y1: height(...b),
          i1: -1,
          x2: c[0],
          z2: c[1],
          y2: height(...c),
          i2: -1,
        });
      }
    }
  }
  const surface = buildSurfaceTriangleIndex(triangles, 1);
  return {
    surface,
    heightAt(x: number, z: number) {
      const y = visibleGroundHeight(surface, x, z);
      return { y: y ?? 0, inside: y !== null };
    },
  };
}

describe("bounded medallion grounding", () => {
  it("uses a single measured pose on flat ground and allocates no fallback", () => {
    const ground = support(() => 0);
    const result = groundMedallion({
      ...ground,
      position: new THREE.Vector3(),
      normal: new THREE.Vector3(0, 1, 0),
      radius: 0.62,
      lift: 0,
    });
    expect(result).toMatchObject({ mode: "plane", attempts: 1, lift: 0 });
    expect(result.exposed).toBeCloseTo(0.0124, 5);
    expect(buildMedallionInlays([], ground.surface)).toEqual({
      geometry: null,
      triangleCount: 0,
      ranges: [],
    });
  });

  it("keeps a target and sigil on a drawn ridge that cannot support a rigid disc", () => {
    const ground = support((x) => Math.abs(x) * 2);
    const input = {
      ...ground,
      position: new THREE.Vector3(),
      normal: new THREE.Vector3(0, 1, 0),
      radius: 0.62,
      lift: 0,
    };
    const result = groundMedallion(input);
    expect(result.mode).toBe("inlay");
    expect(result.attempts).toBeLessThanOrEqual(26);
    expect(result).toEqual(groundMedallion(input));
    const inlays = buildMedallionInlays(
      [
        {
          markerIndex: 7,
          position: input.position,
          radius: input.radius,
          sigil: "leaf",
          state: "live",
        },
      ],
      ground.surface,
    );
    expect(inlays.geometry).not.toBeNull();
    expect(inlays.triangleCount).toBeGreaterThan(42);
    expect(inlays.triangleCount).toBeLessThan(1000);
    expect(inlays.ranges).toEqual([{ markerIndex: 7, start: 0, end: inlays.triangleCount }]);
    const position = inlays.geometry!.getAttribute("position");
    const color = inlays.geometry!.getAttribute("color");
    const colors = new Set<string>();
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      const z = position.getZ(index);
      expect([x, y, z].every(Number.isFinite)).toBe(true);
      expect(Math.hypot(x, z)).toBeLessThanOrEqual(0.620001);
      const support = ground.heightAt(x, z);
      expect(support.inside).toBe(true);
      expect(y - support.y).toBeGreaterThanOrEqual(0.00499);
      expect(y - support.y).toBeLessThanOrEqual(0.04001);
      colors.add([color.getX(index), color.getY(index), color.getZ(index)].join(","));
    }
    expect(colors.size, "body, bevel and state engraving remain distinct").toBe(3);
    inlays.geometry!.dispose();
  });
});
