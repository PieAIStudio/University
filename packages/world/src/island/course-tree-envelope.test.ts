import { expect, it } from "vitest";
import { courseTreeEnvelopesClear, courseTreeIsFir } from "./course-tree-envelope.js";
import { islandBlueprint, ISLAND_ROUTE_ARCHETYPES } from "./island-blueprint.js";
import { planIslandDressing } from "./island-dressing.js";
import { islandThemeSelectionForCourse } from "./kenney-recipes.js";
it("rejects overlapping solids but accepts a short tree beside a tall tapered crown", () => {
  const a = { x: 0, y: 0, z: 0, height: 5, form: "fir" as const };
  expect(courseTreeEnvelopesClear(a, { ...a, x: 0.5 })).toBe(false);
  expect(courseTreeEnvelopesClear(a, { ...a, x: 2.8, height: 2 })).toBe(true);
});
it.each(ISLAND_ROUTE_ARCHETYPES)(
  "keeps all emitted natural tree envelopes disjoint: %s",
  (routeArchetype) => {
    const bp = islandBlueprint({
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      lessonCount: 41,
      routeArchetype,
      themeSelection: islandThemeSelectionForCourse("turing-pact", "foundations-before-zero"),
    });
    const trees = planIslandDressing(bp, "course")
      .placements.filter((p) => p.kind === "tree" && p.id.startsWith("nature-"))
      .map((p) => ({
        x: p.x,
        y: p.y + (p.foliageRootOffset ?? 0),
        z: p.z,
        height: p.height,
        form: courseTreeIsFir(p.foliageShapeSeed!, p.x, p.z)
          ? ("fir" as const)
          : ("broadleaf" as const),
      }));
    expect(trees.length).toBeGreaterThan(0);
    trees.forEach((a, i) =>
      trees.slice(i + 1).forEach((b) => expect(courseTreeEnvelopesClear(a, b)).toBe(true)),
    );
  },
);
