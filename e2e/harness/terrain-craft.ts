import { islandBlueprint } from "../../packages/world/src/island/island-blueprint.js";
import { islandThemeSelectionForCourse } from "../../packages/world/src/island/kenney-recipes.js";
import { planIslandDressing } from "../../packages/world/src/island/island-dressing.js";
import { courseStallPlan } from "../../packages/world/src/island/course-stall-plan.js";
import { courseAcademyPlan } from "../../packages/world/src/island/course-academy-plan.js";

/** Select a test specimen that actually exercises cloth as well as the
 * academy materials. A recipe permits a stall; terrain clearance can still
 * correctly reject its crafted replacement. Never change the product's
 * grounding rules just to keep an old screenshot's specimen alive. */
export function terrainCraftCoverage(studyId: string, courseId: string, lessonCount = 41) {
  const blueprint = islandBlueprint({
    studyId,
    courseId,
    lessonCount,
    themeSelection: islandThemeSelectionForCourse(studyId, courseId),
  });
  const dressing = planIslandDressing(blueprint, "course");
  return {
    stalls: courseStallPlan(blueprint, dressing).length,
    academies: courseAcademyPlan(blueprint, dressing).length,
  };
}
