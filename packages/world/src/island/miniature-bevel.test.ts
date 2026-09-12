import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { miniatureBevelBox } from "./miniature-bevel.js";

describe("miniature bevel assembly datum", () => {
  it.each([
    [1, 0.075, 0.07],
    [0.19, 0.37, 0.2],
    [0.15, 0.4, 0.032],
  ] as const)("keeps the closed solid inside the original %j box", (...size) => {
    const g = miniatureBevelBox(size);
    try {
      const p = g.getAttribute("position"),
        ids = g.index!;
      expect(ids.count / 3).toBe(44);
      const points = Array.from({ length: p.count }, (_, i) =>
        new THREE.Vector3().fromBufferAttribute(p, i),
      );
      const edges = new Map<string, number>();
      let volume = 0;
      for (let i = 0; i < ids.count; i += 3) {
        const tri = [0, 1, 2].map((j) => points[ids.getX(i + j)]!);
        const n = tri[1]!.clone().sub(tri[0]!).cross(tri[2]!.clone().sub(tri[0]!));
        expect(n.lengthSq()).toBeGreaterThan(1e-16);
        expect(n.dot(tri[0]!.clone().add(tri[1]!).add(tri[2]!))).toBeGreaterThan(0);
        volume += tri[0]!.dot(tri[1]!.clone().cross(tri[2]!)) / 6;
        for (let j = 0; j < 3; j++) {
          const edge = [tri[j]!, tri[(j + 1) % 3]!]
            .map((v) =>
              v
                .toArray()
                .map((s) => s.toFixed(7))
                .join(","),
            )
            .sort()
            .join("/");
          edges.set(edge, (edges.get(edge) ?? 0) + 1);
        }
      }
      expect([...edges.values()].every((n) => n === 2)).toBe(true);
      expect(volume).toBeGreaterThan(size[0] * size[1] * size[2] * 0.8);
      expect(volume).toBeLessThan(size[0] * size[1] * size[2]);
      expect(g.boundingBox!.getSize(new THREE.Vector3()).toArray()).toEqual(size.map(Math.fround));
    } finally {
      g.dispose();
    }
  });
  it("rejects collapsed or excessive chamfers", () => {
    expect(() => miniatureBevelBox([1, 0, 1])).toThrow(RangeError);
    expect(() => miniatureBevelBox([1, 1, 1], 0.6)).toThrow(RangeError);
  });
});
