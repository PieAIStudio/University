import { describe, expect, it } from "vitest";
import { checkpointGapsForUnitSizes } from "../course/learning-sites.js";
import { islandBlueprint } from "./island-blueprint.js";
import { planIslandDressing } from "./island-dressing.js";
import { islandThemeSelectionForCourse } from "./kenney-recipes.js";
import {
  searchAcademyPlacement,
  searchAssemblyPlacement,
  SUMMIT_ACADEMY_ASSEMBLY,
  type AssemblySearchReport,
} from "./island-composition.js";
import { islandFieldFor } from "./island-field.js";
import { sampleIslandTerrainTop } from "./island-geometry.js";
import { islandRouteIndexNear } from "./island-route-geometry.js";
import { courseAcademyPlan } from "./course-academy-plan.js";

const packByAsset = new Map<string, "fantasy-town-kit">([
  ["wall", "fantasy-town-kit"],
  ["roof-gable", "fantasy-town-kit"],
  ["wall-doorway-square", "fantasy-town-kit"],
]);

function inspectorBlueprint() {
  const studyId = "browser-ai";
  const courseId = "e2e-terrain-8";
  return islandBlueprint({
    studyId,
    courseId,
    lessonCount: 41,
    checkpointGaps: checkpointGapsForUnitSizes([41]),
    themeSelection: islandThemeSelectionForCourse(studyId, courseId),
  });
}

describe("V7 gated island landmarks", () => {
  it("keeps the complete summit academy on the expanded inspector island", () => {
    const blueprint = inspectorBlueprint();
    const plan = planIslandDressing(blueprint, "course");
    const academy = plan.decisions?.find((entry) => entry.assemblyId === "summit-academy-building");
    expect(academy, JSON.stringify(academy)).toMatchObject({ status: "placed" });
    expect(academy!.attempts).toBeLessThanOrEqual(200 + 37 * 2 * 33);
    expect(academy!.slope).toBeLessThanOrEqual(SUMMIT_ACADEMY_ASSEMBLY.maxGroundSlope);
    expect(academy!.span).toBeLessThanOrEqual(SUMMIT_ACADEMY_ASSEMBLY.maxElevationSpan);
    expect(
      plan.placements.filter((entry) => entry.assemblyId === "summit-academy-building"),
    ).toHaveLength(5);
    expect(courseAcademyPlan(blueprint, plan)).toHaveLength(1);
  });

  it("preserves the original successful search and emits one decision", () => {
    const blueprint = islandBlueprint({
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      lessonCount: 41,
      themeSelection: islandThemeSelectionForCourse("turing-pact", "foundations-before-zero"),
    });
    const context = {
      blueprint,
      field: islandFieldFor(blueprint),
      packByAsset,
      heightAt: (x: number, z: number) => sampleIslandTerrainTop(blueprint, "course", x, z).y,
    };
    const near = islandRouteIndexNear(
      blueprint,
      blueprint.zones.find((zone) => zone.id === "summit")!,
    );
    if (near === null) throw new Error("The canonical academy needs a summit route anchor");
    const seedKey = `${blueprint.seed}/${blueprint.layoutRevision}/assembly/academy`;
    const original = searchAssemblyPlacement(SUMMIT_ACADEMY_ASSEMBLY, context, {
      seedKey,
      fractions: [near / Math.max(1, blueprint.centerline.length - 1), 0.9, 0.84, 0.96],
    });
    expect(original).not.toBeNull();
    const reports: AssemblySearchReport[] = [];
    expect(
      searchAcademyPlacement(
        { ...context, onSearchResult: (report) => reports.push(report) },
        seedKey,
      ),
    ).toEqual(original);
    expect(reports).toHaveLength(1);
    expect(reports[0]!.status).toBe("placed");
  });

  it("still rejects unsafe ground and reports one bounded omission", () => {
    const blueprint = inspectorBlueprint();
    const reports: AssemblySearchReport[] = [];
    expect(
      searchAcademyPlacement(
        {
          blueprint,
          field: islandFieldFor(blueprint),
          packByAsset,
          heightAt: (x: number) => x * 0.5,
          onSearchResult: (report) => reports.push(report),
        },
        blueprint.seed,
      ),
    ).toBeNull();
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ status: "omitted", members: [] });
    expect(reports[0]!.attempts).toBeLessThanOrEqual(200 + 37 * 2 * 33);
  });
});
