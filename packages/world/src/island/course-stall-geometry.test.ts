import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  createCourseStallGeometry,
  COURSE_STALL_SIZE,
  COURSE_STALL_TRIANGLE_CEILING,
} from "./course-stall-geometry.js";
import { courseStallPlan, isCourseCraftedStall } from "./course-stall-plan.js";
import { islandBlueprint } from "./island-blueprint.js";
import { planIslandDressing } from "./island-dressing.js";
import { islandThemeSelectionForCourse } from "./kenney-recipes.js";
import { COMPOSITION_SOURCE_EXTENTS } from "./island-composition.js";
import { islandDressingFields } from "./island-dressing-render.js";
import { courseLandscapePlan, courseReplacementIds } from "./course-landscape-plan.js";

describe("complete course stall within the original facility envelope", () => {
  it.each([
    [0, 0, 0, 0],
    [-0.025, 0.016, -0.012, 0.028],
  ])("emits closed outward finite parts on four measured supports: %j", (...feet) => {
    const geometry = createCourseStallGeometry(feet);
    try {
      const p = geometry.getAttribute("position"),
        ids = geometry.index!;
      expect(ids.count / 3).toBeLessThanOrEqual(COURSE_STALL_TRIANGLE_CEILING);
      expect(ids.count / 3).toBeGreaterThan(500);
      for (const attribute of Object.values(geometry.attributes))
        expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
      const edges = new Map<string, number>();
      const a = new THREE.Vector3(),
        b = new THREE.Vector3(),
        c = new THREE.Vector3();
      let volume = 0;
      for (let i = 0; i < ids.count; i += 3) {
        a.fromBufferAttribute(p, ids.getX(i));
        b.fromBufferAttribute(p, ids.getX(i + 1));
        c.fromBufferAttribute(p, ids.getX(i + 2));
        const area = b.clone().sub(a).cross(c.clone().sub(a)).lengthSq();
        expect(area).toBeGreaterThan(1e-16);
        volume += a.dot(b.clone().cross(c)) / 6;
        for (const [u, v] of [
          [a, b],
          [b, c],
          [c, a],
        ]) {
          const key = [u!, v!]
            .map((s) =>
              s
                .toArray()
                .map((n) => n.toFixed(7))
                .join(","),
            )
            .sort()
            .join("/");
          edges.set(key, (edges.get(key) ?? 0) + 1);
        }
      }
      expect([...edges.values()].every((n) => n === 2)).toBe(true);
      expect(volume).toBeGreaterThan(0);
      const bounds = geometry.boundingBox!;
      expect(bounds.min.x).toBeCloseTo(-COURSE_STALL_SIZE.x / 2, 6);
      expect(bounds.max.x).toBeCloseTo(COURSE_STALL_SIZE.x / 2, 6);
      expect(bounds.min.z).toBeCloseTo(-0.5, 6);
      expect(bounds.max.z).toBeCloseTo(0.5, 6);
      expect(bounds.max.y).toBeCloseTo(COURSE_STALL_SIZE.y, 6);
      expect(bounds.min.y).toBeCloseTo(Math.min(...feet), 6);
      expect(COURSE_STALL_SIZE).toEqual(COMPOSITION_SOURCE_EXTENTS.stall);
    } finally {
      geometry.dispose();
    }
  });
  it("replaces only a real existing stall and does not render a second donor on it", () => {
    const bp = islandBlueprint({
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      lessonCount: 41,
      themeSelection: islandThemeSelectionForCourse("turing-pact", "foundations-before-zero"),
    });
    const dressing = planIslandDressing(bp, "course");
    const before = JSON.stringify(dressing);
    const stalls = courseStallPlan(bp, dressing);
    expect(stalls.length).toBeGreaterThan(0);
    expect(stalls.map((p) => p.id)).toEqual(
      dressing.placements.filter(isCourseCraftedStall).map((p) => p.id),
    );
    expect(
      islandDressingFields(
        dressing,
        1,
        1,
        courseReplacementIds(courseLandscapePlan(bp, dressing)),
      ).some((field) => field.key === "fantasy-town-kit/stall"),
    ).toBe(false);
    expect(JSON.stringify(dressing)).toBe(before);
    for (const p of stalls) {
      const g = createCourseStallGeometry(p.feet);
      g.dispose();
      expect(p.feet.every((n) => Math.abs(n) < 0.14)).toBe(true);
    }
  });
});
