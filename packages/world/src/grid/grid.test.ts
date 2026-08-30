import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCourseGrid, type CourseGridLesson } from "./course-grid.js";
import { hexDistance, hexKey, hexNeighbors } from "./hex.js";
import { GRID_CELL_BUDGET, hexRegionIsConnected } from "./grid-outline.js";
import { propCellsAreUnique } from "./grid-props.js";
import { islandGeometryBlueprint } from "../island/island-blueprint.js";

const LESSONS: readonly CourseGridLesson[] = Array.from({ length: 41 }, (_, index) => ({
  lessonId: `lesson-${index + 1}`,
  unitId: `unit-${Math.floor(index / 5) + 1}`,
  unitIndex: Math.floor(index / 5),
  state: index === 0 ? "live" : index < 8 ? "done" : "locked",
}));

function connectedUnitTerritory(map: ReturnType<typeof buildCourseGrid>, unitId: string): boolean {
  const cells = map.cells.filter((cell) => cell.territoryId === unitId);
  if (cells.length <= 1) return true;
  const keys = new Set(cells.map((cell) => cell.key));
  const seen = new Set<string>();
  const queue = [cells[0]!];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (seen.has(current.key)) continue;
    seen.add(current.key);
    for (const neighbor of hexNeighbors(current.coord)) {
      const key = hexKey(neighbor);
      if (keys.has(key) && !seen.has(key)) queue.push(map.cells.find((cell) => cell.key === key)!);
    }
  }
  return seen.size === cells.length;
}

describe("hex grid course data", () => {
  it("gives every lesson exactly one cell", () => {
    const map = buildCourseGrid({
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      seed: "foundations-before-zero/hexgrid-v2",
      lessons: LESSONS,
      routeArchetype: "serpentine",
    });
    expect(map.lessons).toHaveLength(LESSONS.length);
    expect(new Set(map.lessons.map((cell) => cell.lessonId)).size).toBe(LESSONS.length);
    expect(map.lessons.every((cell) => cell.lessonIndex >= 0)).toBe(true);
  });

  it("keeps consecutive lesson cells adjacent", () => {
    const map = buildCourseGrid({
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      seed: "route-adjacency",
      lessons: LESSONS,
      routeArchetype: "switchback",
    });
    for (let index = 1; index < map.lessons.length; index += 1) {
      expect(hexDistance(map.lessons[index - 1]!.coord, map.lessons[index]!.coord)).toBe(1);
    }
  });

  it("snaps real blueprint route intent without losing adjacency", () => {
    const blueprint = islandGeometryBlueprint({
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      lessonCount: LESSONS.length,
      seed: "real-blueprint-route",
      routeArchetype: "serpentine",
    });
    const map = buildCourseGrid({
      studyId: blueprint.studyId,
      courseId: blueprint.courseId,
      seed: blueprint.seed,
      lessons: LESSONS,
      routeArchetype: blueprint.route.archetype,
      routeAnchors: blueprint.geometryNodes,
    });
    expect(map.lessons.map((cell) => cell.key)).toHaveLength(LESSONS.length);
    for (let index = 1; index < map.route.length; index += 1) {
      expect(hexDistance(map.route[index - 1]!, map.route[index]!)).toBe(1);
    }
  });

  it("never places two props in one cell", () => {
    const map = buildCourseGrid({
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      seed: "prop-uniqueness",
      lessons: LESSONS,
    });
    expect(propCellsAreUnique(map.props)).toBe(true);
    expect(
      map.lessons.every((lesson) => map.props.some((prop) => prop.cellKey === lesson.key)),
    ).toBe(true);
  });

  it("keeps the main outline one connected region and detached cells separate", () => {
    const map = buildCourseGrid({
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      seed: "outline-connectivity",
      lessons: LESSONS,
    });
    expect(hexRegionIsConnected(map.mainCells)).toBe(true);
    expect(map.detachedGroups.length).toBeGreaterThanOrEqual(2);
    expect(map.detachedGroups.length).toBeLessThanOrEqual(4);
    for (const detached of map.detachedCells) {
      expect(map.mainCells.some((cell) => hexKey(cell) === hexKey(detached))).toBe(false);
      expect(
        hexNeighbors(detached).some((neighbor) =>
          map.mainCells.some((cell) => hexKey(cell) === hexKey(neighbor)),
        ),
      ).toBe(false);
    }
  });

  it("keeps every unit territory connected", () => {
    const map = buildCourseGrid({
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      seed: "territory-connectivity",
      lessons: LESSONS,
    });
    for (const unitId of new Set(LESSONS.map((lesson) => lesson.unitId))) {
      expect(connectedUnitTerritory(map, unitId)).toBe(true);
    }
  });

  it("stays inside the cell budget", () => {
    for (const lessonCount of [3, 12, 24, 41]) {
      const map = buildCourseGrid({
        studyId: "turing-pact",
        courseId: `course-${lessonCount}`,
        seed: `budget-${lessonCount}`,
        lessons: Array.from({ length: lessonCount }, (_, index) => ({
          lessonId: `lesson-${index}`,
          unitId: `unit-${Math.floor(index / 4)}`,
        })),
      });
      expect(map.cells.length).toBeLessThanOrEqual(GRID_CELL_BUDGET);
    }
  });

  it("is byte-for-byte deterministic for the same course and seed", () => {
    const input = {
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      seed: "deterministic-grid",
      lessons: LESSONS,
      routeArchetype: "horseshoe" as const,
    };
    expect(buildCourseGrid(input)).toEqual(buildCourseGrid(input));
  });

  it("keeps the first six grid modules renderer-free", () => {
    const files = [
      "hex.ts",
      "course-grid.ts",
      "grid-outline.ts",
      "grid-elevation.ts",
      "grid-props.ts",
      "grid-palette.ts",
    ];
    for (const file of files) {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
      expect(source).not.toMatch(/(?:from|import)\s+["'](?:three|@react-three\/fiber)/);
      expect(source).not.toMatch(/\bTHREE\b/);
    }
  });
});
