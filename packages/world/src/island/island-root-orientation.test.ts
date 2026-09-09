import { describe, expect, it } from "vitest";
import { buildIslandGeometry } from "./island-geometry.js";
import { islandBlueprint, ISLAND_ROUTE_ARCHETYPES } from "./island-blueprint.js";

describe("the floating root is an oriented closed surface, not only paired coordinates", () => {
  it.each([
    ["supaluv", "generated-assets", 3],
    ["supaluv", "ai-cost-and-boundaries", 4],
    ["turing-pact", "foundations-before-zero", 41],
  ] as const)(
    "keeps opposite edge directions across %s/%s (%i lessons)",
    (studyId, courseId, lessonCount) => {
      checkDirections(islandBlueprint({ studyId, courseId, lessonCount }));
    },
  );

  it("preserves an oriented surface across the same 60 route/count/seed combinations", () => {
    for (const routeArchetype of ISLAND_ROUTE_ARCHETYPES) {
      for (const lessonCount of [6, 12, 24, 41]) {
        for (const seed of ["coast", "upland", "grove"]) {
          checkDirections(
            islandBlueprint({
              studyId: "mesh-contract",
              courseId: `course-${lessonCount}`,
              lessonCount,
              routeArchetype,
              seed: `mesh-contract/${routeArchetype}/${lessonCount}/${seed}`,
            }),
          );
        }
      }
    }
  });
});

function checkDirections(blueprint: ReturnType<typeof islandBlueprint>): void {
  const shape = buildIslandGeometry(blueprint, "world");
  try {
    const position = shape.terrain.getAttribute("position");
    const index = shape.terrain.getIndex()!;
    const key = (vertex: number) =>
      [position.getX(vertex), position.getY(vertex), position.getZ(vertex)]
        .map((value) => Math.round(value * 1e5))
        .join(":");
    const edges = new Map<string, number[]>();
    for (let triangle = 0; triangle < index.count; triangle += 3) {
      const ids = [
        key(index.getX(triangle)),
        key(index.getX(triangle + 1)),
        key(index.getX(triangle + 2)),
      ];
      for (let edge = 0; edge < 3; edge++) {
        const a = ids[edge]!,
          b = ids[(edge + 1) % 3]!;
        const ordered = a < b;
        const id = ordered ? `${a}|${b}` : `${b}|${a}`;
        const directions = edges.get(id) ?? [];
        directions.push(ordered ? 1 : -1);
        edges.set(id, directions);
      }
    }
    const broken = [...edges.entries()].filter(
      ([, directions]) => directions.length !== 2 || directions[0]! + directions[1]! !== 0,
    );
    expect(
      broken,
      "an individually flipped fan can look closed yet fold across shared edges",
    ).toEqual([]);
  } finally {
    shape.terrain.dispose();
  }
}
