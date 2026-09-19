import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { islandBlueprint } from "../island/island-blueprint.js";
import { planIslandDressing } from "../island/island-dressing.js";
import { courseLandscapePlan } from "../island/course-landscape-plan.js";
import { buildCourseLandscapeGeometry } from "../island/course-landscape-geometry.js";
import { islandThemeSelectionForCourse } from "../island/kenney-recipes.js";
import { clayGeometryView } from "./clay-geometry.js";

describe("clay views of actual procedural landscape", () => {
  it.each(["arc", "horseshoe", "loop-around-hill", "switchback", "serpentine"] as const)(
    "%s retains scenery support and bounded buffers on short, long and stress islands",
    (routeArchetype) => {
      let checked = 0,
        supports = 0;
      const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
      const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
      try {
        for (const lessonCount of [6, 24, 41, 80]) {
          const bp = islandBlueprint({
            studyId: "landscape-matrix",
            courseId: "site-0",
            lessonCount,
            routeArchetype,
            themeSelection: islandThemeSelectionForCourse("turing-pact", "foundations-before-zero"),
          });
          const plan = courseLandscapePlan(bp, planIslandDressing(bp, "course"));
          const geometry = buildCourseLandscapeGeometry(plan);
          try {
            if (!geometry.rock) continue;
            const source = geometry.rock,
              positions = source.getAttribute("position").array.slice();
            const indices = source.index!.array.slice();
            const view = clayGeometryView(source, "stone");
            try {
              checked++;
              expect(source.getAttribute("position").array).toEqual(positions);
              expect(source.index!.array).toEqual(indices);
              expect(view.index!.count).toBeLessThanOrEqual(source.index!.count * 4);
              const original = new THREE.Mesh(source, material),
                drawn = new THREE.Mesh(view, material);
              const contacts = source.userData.clayStoneContacts as {
                x: number;
                z: number;
                radius: number;
              }[];
              expect(contacts.length).toBe(
                (plan.canopy?.length ?? 0) + plan.flora.filter((p) => p.supportId).length,
              );
              source.computeBoundingBox();
              const top = source.boundingBox!.max.y + 10;
              for (const p of contacts) {
                for (const [dx, dz] of [
                  [0, 0],
                  [0.7, 0],
                  [-0.7, 0],
                  [0, 0.7],
                  [0, -0.7],
                ]) {
                  ray.ray.origin.set(p.x + dx! * p.radius, top, p.z + dz! * p.radius);
                  const before = ray.intersectObject(original)[0],
                    after = ray.intersectObject(drawn)[0];
                  expect(before).toBeDefined();
                  expect(after).toBeDefined();
                  expect(after!.point.y).toBeCloseTo(before!.point.y, 5);
                  supports++;
                }
              }
            } finally {
              view.dispose();
            }
          } finally {
            geometry.dispose();
          }
        }
        expect(checked).toBeGreaterThan(0);
        expect(supports).toBeGreaterThan(0);
      } finally {
        material.dispose();
      }
    },
  );
});
