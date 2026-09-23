import { describe, expect, it } from "vitest";

import { islandBlueprint } from "./island-blueprint.js";
import { islandThemeSelectionForCourse } from "./kenney-recipes.js";
import { distanceToIslandRoute, islandRouteClearance } from "./island-route-geometry.js";
import { courseStandingFootprints } from "../course/learning-sites.js";
import { planCourseVignettes, VIGNETTE_LIMIT, VIGNETTE_MODELS } from "./course-vignettes.js";

describe("course vignettes (R59-08)", () => {
  for (const lessonCount of [8, 36]) {
    const blueprint = islandBlueprint({
      studyId: "ai-literacy",
      courseId: `vignettes-${lessonCount}`,
      lessonCount,
      themeSelection: islandThemeSelectionForCourse("ai-literacy", "understanding-ai"),
    });
    const standing = courseStandingFootprints(blueprint).map((o) => ({
      x: o.x,
      z: o.z,
      radius: o.r,
    }));
    const vignettes = planCourseVignettes(blueprint, standing);

    it(`fills a ${lessonCount}-lesson island with small scenes, within its limit`, () => {
      expect(vignettes.length).toBeGreaterThan(lessonCount < 20 ? 1 : 25);
      expect(vignettes.length).toBeLessThanOrEqual(VIGNETTE_LIMIT);
      const kinds = new Set(vignettes.map((v) => v.kind));
      expect(kinds.size).toBeGreaterThanOrEqual(3);
      for (const v of vignettes)
        for (const p of v.props) expect(VIGNETTE_MODELS[p.model]).toBeDefined();
      // eslint-disable-next-line no-console
      console.info(
        `[vignettes ${lessonCount}]`,
        vignettes.length,
        [...kinds].map((k) => `${k}:${vignettes.filter((v) => v.kind === k).length}`).join(" "),
        vignettes.reduce((n, v) => n + v.props.length, 0),
      );
    });

    it(`keeps every scene off the road, the stones and whatever stands (${lessonCount})`, () => {
      const clearance = islandRouteClearance(blueprint);
      for (const v of vignettes) {
        expect(distanceToIslandRoute(blueprint, v)).toBeGreaterThan(clearance);
        // Every prop, not the group's circle: a fence run is long and thin.
        for (const p of v.props) {
          expect(distanceToIslandRoute(blueprint, p), v.kind).toBeGreaterThan(clearance);
          for (const n of blueprint.nodes)
            expect(Math.hypot(n.x - p.x, n.z - p.z)).toBeGreaterThan(blueprint.route.nodeRadius);
          for (const o of standing)
            expect(Math.hypot(o.x - p.x, o.z - p.z), v.kind).toBeGreaterThan(o.radius * 0.8);
        }
      }
      const groups = vignettes.filter((v) => v.kind !== "fence");
      for (const [i, a] of groups.entries())
        for (const b of groups.slice(i + 1))
          expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(a.radius + b.radius);
    });

    it(`is the same set of scenes every time (${lessonCount})`, () => {
      expect(planCourseVignettes(blueprint, standing)).toEqual(vignettes);
    });
  }
});
