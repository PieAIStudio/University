import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createCourseRuinGeometry, COURSE_RUIN_TRIANGLES } from "./course-ruin-geometry.js";
import type { CourseOutcrop } from "./course-outcrop-plan.js";

const site: CourseOutcrop = {
  id: "masonry",
  feature: "ruin",
  x: 3,
  z: -2,
  radius: 4,
  height: 3,
  baseY: -0.16,
  groundRange: [0, 0.4],
  footprint: [],
  meadow: 0.6,
  turn: 0.7,
};

describe("reserved course masonry", () => {
  it("contains finite closed stones inside the existing rock volume", () => {
    const geometry = createCourseRuinGeometry(site);
    try {
      const p = geometry.getAttribute("position"),
        ids = geometry.index!;
      expect(ids.count / 3).toBe(COURSE_RUIN_TRIANGLES);
      expect(Object.keys(geometry.attributes).sort()).toEqual(["color", "normal", "position"]);
      const points = Array.from({ length: p.count }, (_, i) =>
        new THREE.Vector3().fromBufferAttribute(p, i),
      );
      const key = (i: number) =>
        points[i]!.toArray()
          .map((v) => v.toFixed(5))
          .join(",");
      const edges = new Map<string, number>();
      let volume = 0;
      for (let i = 0; i < ids.count; i += 3) {
        const a = ids.getX(i),
          b = ids.getX(i + 1),
          c = ids.getX(i + 2);
        const normal = points[b]!.clone().sub(points[a]!).cross(points[c]!.clone().sub(points[a]!));
        expect(normal.lengthSq()).toBeGreaterThan(1e-10);
        volume += points[a]!.dot(points[b]!.clone().cross(points[c]!)) / 6;
        for (const [from, to] of [
          [a, b],
          [b, c],
          [c, a],
        ]) {
          const edge = [key(from!), key(to!)].sort().join("/");
          edges.set(edge, (edges.get(edge) ?? 0) + 1);
        }
      }
      expect([...edges.values()].every((n) => n === 2)).toBe(true);
      expect(volume).toBeGreaterThan(0);
      for (const p of points) {
        expect(p.toArray().every(Number.isFinite)).toBe(true);
        expect(Math.hypot(p.x - site.x, p.z - site.z)).toBeLessThanOrEqual(site.radius);
        expect(p.y).toBeGreaterThanOrEqual(site.baseY - 1e-6);
        expect(p.y).toBeLessThanOrEqual(site.groundRange[1] + site.height);
      }
    } finally {
      geometry.dispose();
    }
  });

  it("has a real arch opening, supported piers and a solid crown, not a painted door", () => {
    const geometry = createCourseRuinGeometry(site);
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    const height = site.groundRange[1] + site.height - site.baseY;
    const rotation = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      -site.turn,
    );
    // Geometry uses x*cos-z*sin, z=x*sin+z*cos, i.e. -Y-axis yaw.
    const hits = (x: number, y: number) => {
      const origin = new THREE.Vector3(x * site.radius, y * height, site.radius * 2)
        .applyQuaternion(rotation)
        .add(new THREE.Vector3(site.x, site.baseY, site.z));
      const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(rotation);
      return new THREE.Raycaster(origin, direction).intersectObject(mesh);
    };
    try {
      expect(hits(0, 0.4)).toHaveLength(0);
      expect(hits(0.49, 0.32).length).toBeGreaterThan(0);
      expect(hits(0, 0.87).length).toBeGreaterThan(0);
      const duplicate = createCourseRuinGeometry(site);
      expect(duplicate.getAttribute("position").array).toEqual(
        geometry.getAttribute("position").array,
      );
      duplicate.dispose();
    } finally {
      geometry.dispose();
      material.dispose();
    }
  });
});
