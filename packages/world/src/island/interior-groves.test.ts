import { describe, expect, it } from "vitest";

import { islandBlueprint } from "./island-blueprint.js";
import { islandThemeSelectionForCourse } from "./kenney-recipes.js";
import { planIslandDressing } from "./island-dressing.js";
import { distanceToIslandRoute, islandRouteClearance } from "./island-route-geometry.js";

function plan(studyId: string, courseId: string, lessonCount: number) {
  const blueprint = islandBlueprint({
    studyId,
    courseId,
    lessonCount,
    themeSelection: islandThemeSelectionForCourse(studyId, courseId),
  });
  return { blueprint, dressing: planIslandDressing(blueprint, "course") };
}

const interior = (id: string | undefined) => id?.startsWith("interior-") ?? false;

describe("interior groves", () => {
  /*
    The Owner had approved the island as it was, so interior groves may only
    add. They run after every other natural placement with their own random
    stream; if any of them came before an original placement, the original
    pass would no longer have run untouched.
  */
  it("only ever come after every placement that was already there", () => {
    for (const [study, course, n] of [
      ["ai-literacy", "understanding-ai", 36],
      ["probe", "forty-one", 41],
      ["probe", "twenty-four", 24],
    ] as const) {
      const placements = planIslandDressing(
        islandBlueprint({
          studyId: study,
          courseId: course,
          lessonCount: n,
          themeSelection: islandThemeSelectionForCourse(study, course),
        }),
        "course",
      ).placements;
      const first = placements.findIndex((p) => interior(p.clusterId));
      if (first === -1) continue;
      expect(
        placements
          .slice(first)
          .every(
            (p) =>
              interior(p.clusterId) ||
              p.kind === "landmark" ||
              p.kind === "prop" ||
              !p.id.startsWith("nature-"),
          ),
        course,
      ).toBe(true);
      const lastOriginalNature = placements
        .map((p, i) => (p.id.startsWith("nature-") && !interior(p.clusterId) ? i : -1))
        .reduce((a, b) => Math.max(a, b), -1);
      expect(first, course).toBeGreaterThan(lastOriginalNature);
    }
  });

  it("give a long island's empty far ground a grove, and leave short islands as they were", () => {
    const long = plan("ai-literacy", "understanding-ai", 36).dressing.placements;
    expect(long.some((p) => p.kind === "tree" && interior(p.clusterId))).toBe(true);
    for (const [study, course, n] of [
      ["browser-ai", "search-your-own-photos", 6],
      ["browser-ai", "run-a-real-project-with-ai", 8],
    ] as const)
      expect(
        plan(study, course, n).dressing.placements.some((p) => interior(p.clusterId)),
        course,
      ).toBe(false);
  });

  it("stand clear of the road like every other grove", () => {
    const { blueprint, dressing } = plan("ai-literacy", "understanding-ai", 36);
    const clearance = islandRouteClearance(blueprint);
    for (const p of dressing.placements.filter((p) => interior(p.clusterId)))
      expect(distanceToIslandRoute(blueprint, p), p.id).toBeGreaterThan(clearance);
  });
});
