import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { CourseNode } from "../course/course.js";
import { WORLD_ISLAND_SEPARATION_GAP } from "../course/layout.js";
import { islandLookCameraForShot } from "../island/island-look.js";
import { buildWorldStudyGrid, placeWorld } from "../Maps.js";
import { GRID_SHARED_SOIL } from "./grid-palette.js";
import {
  worldGridFootprintForLessons,
  worldGridTargetForLessons,
  worldGridTargetForStudy,
  WORLD_STUDY_GRID_CONTRACT,
} from "./course-grid.js";
import {
  worldUndersideSpikeCountForCells,
  worldUndersideTriangleCountForIslands,
} from "./world-underside.js";

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

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

function courseEntry(
  world: ReturnType<typeof placeWorld>,
  courseId: string,
): ReturnType<typeof placeWorld>["placements"][number] {
  const entry = world.placements.find((candidate) => candidate.node.courseId === courseId);
  if (!entry) throw new Error(`Missing real catalogue course ${courseId}`);
  return entry;
}

function worldFrameEnvelope(world: ReturnType<typeof placeWorld>) {
  const camera = islandLookCameraForShot(
    "world-design",
    { halfX: world.extent, halfZ: world.extent },
    { width: 1440, height: 900 },
  );
  const verticalFov = (camera.fov * Math.PI) / 180;
  const aspect = 1440 / 900;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
  const frameHorizontalHalf = camera.distance * Math.tan(horizontalFov / 2);
  const frameVerticalHalf = camera.distance * Math.tan(verticalFov / 2);
  const elevation = Math.PI / 2 - camera.polar;
  const horizontalHalf = Math.max(
    ...world.placements.map(
      (entry) => Math.abs(entry.position.x) + entry.grid.bounds.maxHalf * entry.gridScale,
    ),
  );
  const verticalHalf = Math.max(
    ...world.placements.map(
      (entry) =>
        (Math.abs(entry.position.z) + entry.grid.bounds.maxHalf * entry.gridScale) *
        Math.sin(elevation),
    ),
  );
  return {
    horizontalCoverage: horizontalHalf / frameHorizontalHalf,
    verticalCoverage: verticalHalf / frameVerticalHalf,
    frameHorizontalHalf,
  };
}

describe("world grid projection", () => {
  it("keeps the remote field near twenty cells for common courses", () => {
    expect(worldGridTargetForLessons(12)).toBe(19);
    expect(worldGridTargetForLessons(41)).toBeGreaterThan(worldGridTargetForLessons(12));
    expect(worldGridTargetForLessons(41)).toBeLessThan(80);
  });

  it("sizes one study landmass from volume with visible and bounded endpoints", () => {
    const oneCourse = buildWorldStudyGrid({
      studyId: "general",
      studyTitle: "通用课",
      courseCount: 1,
      lessonCount: 1,
    });
    const realSmall = buildWorldStudyGrid({
      studyId: "general",
      studyTitle: "通用课",
      courseCount: 1,
      lessonCount: 19,
    });
    const realLarge = buildWorldStudyGrid({
      studyId: "turing-pact",
      studyTitle: "TuringPact",
      courseCount: 31,
      lessonCount: 362,
    });

    expect(worldGridTargetForStudy(1, 1)).toBeGreaterThanOrEqual(
      WORLD_STUDY_GRID_CONTRACT.minCells,
    );
    expect(oneCourse.cells.length).toBeGreaterThanOrEqual(WORLD_STUDY_GRID_CONTRACT.minCells);
    expect(realSmall.cells.length).toBeGreaterThan(oneCourse.cells.length);
    expect(realLarge.cells.length).toBeGreaterThan(realSmall.cells.length);
    expect(realLarge.cells.length).toBeLessThanOrEqual(WORLD_STUDY_GRID_CONTRACT.maxCells);
    expect(worldGridTargetForStudy(31, 362)).toBeLessThanOrEqual(
      WORLD_STUDY_GRID_CONTRACT.maxCells - 4,
    );
  });

  it("projects every real course into one deterministic, earthy catalogue", () => {
    const world = placeWorld(catalogueNodes, () => 0, "turing-pact", "catalogue");
    // Against the catalogue's own size, not a number written down once: the
    // thing worth catching is a course that gets dropped, and a literal only
    // catches that until someone publishes or retires one.
    expect(world.placements).toHaveLength(catalogueNodes.length);

    const topColours = new Set(world.placements.map((entry) => entry.grid.palette.top));
    expect(topColours.size).toBeGreaterThan(1);
    expect(topColours.size).toBeGreaterThanOrEqual(8);
    expect(
      world.placements.every(
        (entry) =>
          entry.grid.palette.cliff === GRID_SHARED_SOIL.cliff &&
          entry.grid.palette.shadow === GRID_SHARED_SOIL.shadow &&
          entry.grid.palette.rim === GRID_SHARED_SOIL.rim &&
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

  it("lets the real catalogue dominate the fixed frame without losing its boundary", () => {
    const world = placeWorld(catalogueNodes, () => 0, "turing-pact", "catalogue");
    const envelope = worldFrameEnvelope(world);

    // Dominance is geometric screen occupancy, not a sea-pixel quota. Both
    // axes must read as a field of islands, so a camera cannot pass by filling
    // only its long axis.
    expect(envelope.horizontalCoverage).toBeGreaterThanOrEqual(0.8);
    expect(envelope.verticalCoverage).toBeGreaterThanOrEqual(0.54);

    // The opposing half of the contract: a close camera that crops the outer
    // silhouettes is not a valid fix, even if it makes the centre look busy.
    expect(envelope.horizontalCoverage).toBeLessThanOrEqual(0.93);
    expect(envelope.verticalCoverage).toBeLessThanOrEqual(0.82);
  });

  it("makes real course length legible while keeping both ends usable", () => {
    const world = placeWorld(catalogueNodes, () => 0, "turing-pact", "catalogue");
    const short = courseEntry(world, "generated-assets");
    const medium = courseEntry(world, "product-website");
    const long = courseEntry(world, "foundations-before-zero");
    const medianFootprint = median(world.placements.map((entry) => entry.grid.bounds.maxHalf));
    const frame = worldFrameEnvelope(world);

    // The lower and upper bounds come from the real catalogue's median-sized
    // course: the 3-lesson tail must retain at least 60% of that footprint,
    // while the 41-lesson outlier stays below 1.75× it. The two explicit ratios
    // make the length signal visible instead of merely non-zero.
    expect(short.grid.bounds.maxHalf).toBeGreaterThanOrEqual(medianFootprint * 0.6);
    expect(long.grid.bounds.maxHalf).toBeLessThanOrEqual(medianFootprint * 1.75);
    expect(medium.grid.bounds.maxHalf).toBeGreaterThan(short.grid.bounds.maxHalf * 1.5);
    expect(long.grid.bounds.maxHalf).toBeGreaterThan(short.grid.bounds.maxHalf * 2);

    // At the fixed desktop shot the long island remains a landmark, not a
    // frame-filling blob; neighbour clearance is checked separately below.
    expect(long.grid.bounds.maxHalf * long.gridScale).toBeLessThan(
      frame.frameHorizontalHalf * 0.22,
    );
    expect(worldGridFootprintForLessons(short.node.lessons)).toBeLessThan(
      worldGridFootprintForLessons(medium.node.lessons),
    );
    expect(worldGridFootprintForLessons(medium.node.lessons)).toBeLessThan(
      worldGridFootprintForLessons(long.node.lessons),
    );
  });

  it("keeps the silhouettes from fusing and from lining up as a grid", () => {
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
          (a.grid.bounds.maxHalf * a.gridScale + b.grid.bounds.maxHalf * b.gridScale) *
          WORLD_ISLAND_SEPARATION_GAP;
        // The relaxation is deterministic but uses floating-point vector
        // lengths; allow one sub-micron of arithmetic noise at the exact edge.
        expect(gap).toBeGreaterThanOrEqual(min - 1e-6);
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
    expect(totalProps).toBeGreaterThanOrEqual(catalogueNodes.length);
    expect(totalProps).toBeLessThan(160);
    expect(
      world.placements.every(
        (entry) =>
          entry.grid.cells.filter((cell) => cell.kind === "route").length <=
          Math.max(2, Math.round(entry.grid.cells.length * 0.2)),
      ),
    ).toBe(true);
  });

  it("keeps the actual island underside instanced and under its budget", () => {
    const world = placeWorld(catalogueNodes, () => 0, "turing-pact", "catalogue");
    const cellCounts = world.placements.map((entry) => entry.grid.cells.length);
    const triangles = worldUndersideTriangleCountForIslands(cellCounts);

    expect(world.placements).toHaveLength(catalogueNodes.length);
    expect(
      cellCounts.every((cellCount) => {
        const spikes = worldUndersideSpikeCountForCells(cellCount);
        return spikes >= 3 && spikes <= 5;
      }),
    ).toBe(true);
    expect(triangles).toBeLessThan(2_000);
  });
});
