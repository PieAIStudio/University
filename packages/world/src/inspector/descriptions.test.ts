import { describe, expect, it } from "vitest";

import { islandBlueprint } from "../island/island-blueprint.js";
import { ISLAND_GRASS_LIMITS } from "../island/island-grass.js";
import { islandThemeSelectionForCourse } from "../island/kenney-recipes.js";
import { describeIslandLayer, describeWorldLayer } from "./descriptions.js";

function parameterValue(description: ReturnType<typeof describeIslandLayer>, id: string) {
  return [
    ...description.terrain.parameters,
    ...description.dressing.parameters,
    ...description.lighting.parameters,
  ].find((parameter) => parameter.id === id);
}

describe("map inspector descriptions", () => {
  it("reads the course grass density from the real grass module", () => {
    const blueprint = islandBlueprint({
      studyId: "inspector-test",
      courseId: "course",
      lessonCount: 3,
      themeSelection: islandThemeSelectionForCourse("inspector-test", "course"),
    });
    const description = describeIslandLayer({ blueprint });
    const density = parameterValue(description, "grass-desktop-limit");

    expect(density?.value).toBe(ISLAND_GRASS_LIMITS.course.desktop);
    expect(density?.source.file).toBe("packages/world/src/island/island-grass.ts");
    expect(density?.source.export).toBe("ISLAND_GRASS_LIMITS.course.desktop");
  });

  it("shows the world projection's zero grass budget from the same constant", () => {
    const blueprint = islandBlueprint({
      studyId: "inspector-test",
      courseId: "course",
      lessonCount: 3,
      themeSelection: islandThemeSelectionForCourse("inspector-test", "course"),
    });
    const description = describeWorldLayer({
      islands: [{ blueprint, targetRadius: 4 }],
    });
    const density = description.dressing.parameters.find(
      (parameter) => parameter.id === "grass-desktop-limit",
    );

    expect(density?.value).toBe(ISLAND_GRASS_LIMITS.world.desktop);
    expect(density?.source.export).toBe("ISLAND_GRASS_LIMITS.world.desktop");
  });
});
