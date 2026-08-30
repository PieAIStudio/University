import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { CourseNode } from "../course/course.js";
import { placeWorld } from "../Maps.js";
import { GRID_SHARED_SOIL } from "./grid-palette.js";
import { worldGridTargetForLessons } from "./course-grid.js";

interface ImportedCourse {
  readonly courseId: string;
  readonly title: string;
  readonly lessons: number;
}

interface ImportedStudy {
  readonly studyId: string;
  readonly title: string;
  readonly courses: readonly ImportedCourse[];
}

interface ImportedCatalogue {
  readonly studies: readonly ImportedStudy[];
}

const catalogue = JSON.parse(
  readFileSync(
    new URL("../../../../apps/university/src/content/imported.json", import.meta.url),
    "utf8",
  ),
) as ImportedCatalogue;

const catalogueNodes: readonly CourseNode[] = catalogue.studies.flatMap((study) =>
  study.courses.map((course, depth) => ({
    courseId: course.courseId,
    title: course.title,
    lessons: course.lessons,
    studyId: study.studyId,
    studyTitle: study.title,
    depth,
    prerequisiteCourseIds: [],
    trackId: null,
  })),
);

describe("world grid projection", () => {
  it("keeps the remote field near twenty cells for common courses", () => {
    expect(worldGridTargetForLessons(12)).toBe(19);
    expect(worldGridTargetForLessons(41)).toBeGreaterThan(worldGridTargetForLessons(12));
    expect(worldGridTargetForLessons(41)).toBeLessThan(80);
  });

  it("projects all 53 real courses into one deterministic, earthy catalogue", () => {
    const world = placeWorld(catalogueNodes, () => 0, "turing-pact", "catalogue");
    expect(world.placements).toHaveLength(53);

    const topColours = new Set(world.placements.map((entry) => entry.grid.palette.top));
    expect(topColours.size).toBeGreaterThan(1);
    expect(topColours.size).toBeGreaterThanOrEqual(8);
    expect(
      world.placements.every(
        (entry) =>
          entry.grid.palette.cliff === GRID_SHARED_SOIL.cliff &&
          entry.grid.palette.shadow === GRID_SHARED_SOIL.shadow &&
          entry.grid.palette.road === GRID_SHARED_SOIL.road,
      ),
    ).toBe(true);

    const totalCells = world.placements.reduce((sum, entry) => sum + entry.grid.cells.length, 0);
    expect(totalCells).toBeLessThanOrEqual(1_200);
    expect(totalCells * 18).toBeLessThan(22_000);
  });

  it("makes the 41-lesson silhouette wider than a 12-lesson plateau", () => {
    const world = placeWorld(catalogueNodes, () => 0, "turing-pact", "catalogue");
    const plateau = world.placements.find((entry) => entry.node.lessons === 12);
    const highland = world.placements.find((entry) => entry.node.lessons === 41);
    expect(plateau).toBeDefined();
    expect(highland).toBeDefined();
    expect(highland!.grid.bounds.maxHalf).toBeGreaterThan(plateau!.grid.bounds.maxHalf);
    expect(highland!.grid.cells.length).toBeGreaterThan(plateau!.grid.cells.length);
  });

  it("keeps the 53 silhouettes from fusing and from lining up as a grid", () => {
    const world = placeWorld(catalogueNodes, () => 0, "turing-pact", "catalogue");
    const origin = world.placements[0]!;
    expect(Math.hypot(origin.position.x, origin.position.z)).toBeLessThan(0.001);
    expect(world.placements.every((entry) => entry.grid.projection === "world")).toBe(true);

    const uniqueX = new Set(world.placements.map((entry) => Math.round(entry.position.x * 2) / 2))
      .size;
    const uniqueZ = new Set(world.placements.map((entry) => Math.round(entry.position.z * 2) / 2))
      .size;
    expect(uniqueX).toBeGreaterThan(world.placements.length * 0.4);
    expect(uniqueZ).toBeGreaterThan(world.placements.length * 0.4);

    for (let i = 0; i < world.placements.length; i += 1) {
      for (let j = i + 1; j < world.placements.length; j += 1) {
        const a = world.placements[i]!;
        const b = world.placements[j]!;
        const gap = Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
        const min =
          (a.grid.bounds.maxHalf * a.gridScale + b.grid.bounds.maxHalf * b.gridScale) * 1.05;
        expect(gap).toBeGreaterThanOrEqual(min);
      }
    }
  });

  it("only keeps the large world-scale landmarks on the remote field", () => {
    const world = placeWorld(catalogueNodes, () => 0, "turing-pact", "catalogue");
    const worldAssets = new Set(["tree_pineRoundA", "tree_oak", "plant_bushLarge", "rock_largeA"]);
    expect(
      world.placements.every((entry) =>
        entry.grid.props.every((prop) => worldAssets.has(prop.assetId)),
      ),
    ).toBe(true);
    const totalProps = world.placements.reduce((sum, entry) => sum + entry.grid.props.length, 0);
    expect(totalProps).toBeGreaterThanOrEqual(53);
    expect(totalProps).toBeLessThan(160);
    expect(
      world.placements.every(
        (entry) =>
          entry.grid.cells.filter((cell) => cell.kind === "route").length <=
          Math.max(2, Math.round(entry.grid.cells.length * 0.2)),
      ),
    ).toBe(true);
  });
});
