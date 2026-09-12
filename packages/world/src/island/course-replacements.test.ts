import { describe, expect, it } from "vitest";
import { islandBlueprint, ISLAND_ROUTE_ARCHETYPES } from "./island-blueprint.js";
import { planIslandDressing, type IslandDressingPlan } from "./island-dressing.js";
import { courseLandscapePlan, courseReplacementIds } from "./course-landscape-plan.js";
import { courseGroundStones, isCourseGroundStone } from "./course-ground-stone.js";
import { courseStallPlan, isCourseCraftedStall } from "./course-stall-plan.js";
import { islandDressingFields } from "./island-dressing-render.js";
import { isIslandFoliagePlacement } from "./island-foliage-render.js";
import { islandThemeSelectionForCourse } from "./kenney-recipes.js";

const selection = islandThemeSelectionForCourse("turing-pact", "foundations-before-zero");
describe("one drawn owner for every semantic dressing placement", () => {
  it.each(ISLAND_ROUTE_ARCHETYPES)(
    "retains exactly one donor or fitted procedural body: %s",
    (routeArchetype) => {
      const bp = islandBlueprint({
        studyId: "turing-pact",
        courseId: "foundations-before-zero",
        lessonCount: 41,
        themeSelection: selection,
        routeArchetype,
      });
      const plan = planIslandDressing(bp, "course");
      const before = JSON.stringify(plan);
      const replacement = courseReplacementIds(courseLandscapePlan(bp, plan));
      const fields = islandDressingFields(plan, 1, 1, replacement);
      const donors = fields.reduce((sum, f) => sum + f.at.length, 0);
      const sources = plan.placements.filter((p) => !isIslandFoliagePlacement(p));
      expect(donors + replacement.size).toBe(sources.length);
      for (const p of sources) {
        const drawn = fields
          .flatMap((f) => f.at)
          .filter(
            (at) =>
              at.position.x === p.x &&
              at.position.y === p.y &&
              at.position.z === p.z &&
              at.turn === p.turn,
          );
        expect(drawn.length, p.id).toBe(replacement.has(p.id) ? 0 : 1);
      }
      expect(JSON.stringify(plan)).toBe(before);
    },
  );

  it("retains both eligible donor kinds when terrain/support fitting rejects the replacement", () => {
    const bp = islandBlueprint({
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      lessonCount: 41,
      themeSelection: selection,
    });
    const original = planIslandDressing(bp, "course");
    const stone = original.placements.find(isCourseGroundStone)!;
    const stall = original.placements.find(isCourseCraftedStall)!;
    expect(stone).toBeTruthy();
    expect(stall).toBeTruthy();
    const rejected: IslandDressingPlan = {
      ...original,
      placements: [
        { ...stone, x: 10000, z: 10000 },
        { ...stall, x: 20000, z: 20000 },
      ],
    };
    const stones = courseGroundStones(bp, rejected),
      stalls = courseStallPlan(bp, rejected);
    expect(stones).toHaveLength(0);
    expect(stalls).toHaveLength(0);
    const ids = courseReplacementIds({
      outcrops: [],
      flora: [],
      stones,
      stalls,
      spring: null,
      search: {},
    });
    expect(islandDressingFields(rejected, 1, 1, ids).reduce((n, f) => n + f.at.length, 0)).toBe(2);
    // A caller without a landscape plan must not drop eligible donors either.
    expect(islandDressingFields(rejected, 1).reduce((n, f) => n + f.at.length, 0)).toBe(2);
  });
});
