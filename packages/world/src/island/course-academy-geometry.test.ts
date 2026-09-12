import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  createCourseAcademyGeometry,
  COURSE_ACADEMY_TRIANGLE_CEILING,
  COURSE_ACADEMY_SIZE,
} from "./course-academy-geometry.js";
import { courseAcademyPlan } from "./course-academy-plan.js";
import { islandBlueprint } from "./island-blueprint.js";
import { planIslandDressing } from "./island-dressing.js";
import { islandThemeSelectionForCourse } from "./kenney-recipes.js";
import { courseLandscapePlan, courseReplacementIds } from "./course-landscape-plan.js";
import { islandDressingFields } from "./island-dressing-render.js";
describe("a complete academy owns the original assembly, not new world positions", () => {
  it("has real doorway depth, finite outward parts, a measured foundation and bounded roof", () => {
    const g = createCourseAcademyGeometry(-0.06);
    try {
      expect(g.index!.count / 3).toBeLessThanOrEqual(COURSE_ACADEMY_TRIANGLE_CEILING);
      expect(g.index!.count / 3).toBeGreaterThan(1000);
      const p = g.attributes.position!,
        ids = g.index!;
      const a = new THREE.Vector3(),
        b = new THREE.Vector3(),
        c = new THREE.Vector3();
      let volume = 0;
      for (let i = 0; i < ids.count; i += 3) {
        a.fromBufferAttribute(p, ids.getX(i));
        b.fromBufferAttribute(p, ids.getX(i + 1));
        c.fromBufferAttribute(p, ids.getX(i + 2));
        expect(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()).toBeGreaterThan(1e-16);
        volume += a.dot(b.clone().cross(c)) / 6;
      }
      expect(volume).toBeGreaterThan(0);
      for (const attr of Object.values(g.attributes))
        expect(Array.from(attr.array).every(Number.isFinite)).toBe(true);
      const box = g.boundingBox!;
      expect(box.max.y).toBeLessThanOrEqual(COURSE_ACADEMY_SIZE.y);
      expect(box.max.x - box.min.x).toBeLessThanOrEqual(COURSE_ACADEMY_SIZE.x);
      expect(box.max.z - box.min.z).toBeLessThanOrEqual(COURSE_ACADEMY_SIZE.z);
      expect(box.min.y).toBeCloseTo(-0.06, 6);
      const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
        mesh = new THREE.Mesh(g, mat);
      mesh.updateMatrixWorld();
      const ray = new THREE.Raycaster(new THREE.Vector3(0, 0.5, 2), new THREE.Vector3(0, 0, -1));
      const hits = ray.intersectObject(mesh);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0]!.distance).toBeGreaterThan(2.3);
      mat.dispose();
    } finally {
      g.dispose();
    }
  });
  it("replaces all five proven members together and retains incomplete assemblies as donors", () => {
    const bp = islandBlueprint({
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      lessonCount: 41,
      themeSelection: islandThemeSelectionForCourse("turing-pact", "foundations-before-zero"),
    });
    const dressing = planIslandDressing(bp, "course"),
      before = JSON.stringify(dressing);
    const academies = courseAcademyPlan(bp, dressing);
    expect(academies).toHaveLength(1);
    const ids = courseReplacementIds(courseLandscapePlan(bp, dressing));
    for (const id of academies[0]!.sourceIds) expect(ids.has(id)).toBe(true);
    expect(
      islandDressingFields(dressing, 1, 1, ids).some((f) => /wall|roof-gable/.test(f.key)),
    ).toBe(false);
    const partial = {
      ...dressing,
      placements: dressing.placements.filter((p) => p.id !== academies[0]!.sourceIds[0]),
    };
    expect(courseAcademyPlan(bp, partial)).toHaveLength(0);
    expect(JSON.stringify(dressing)).toBe(before);
  });
});
