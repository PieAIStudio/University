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
import { CALIBRATION_CATALOGUE } from "./calibration-catalogue.js";

// Frozen geometry calibration; the app owns live-catalogue integration tests.
const calibrationNodes: readonly CourseNode[] = CALIBRATION_CATALOGUE.studies.flatMap((study) =>
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
    ...world.placements.map((entry) => Math.abs(entry.position.x) + entry.radius),
  );
  const verticalHalf = Math.max(
    ...world.placements.map(
      (entry) => (Math.abs(entry.position.z) + entry.radius) * Math.sin(elevation),
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
    const world = placeWorld(calibrationNodes, () => 0, "turing-pact", "catalogue");
    // Against the fixture's own size, not a number written down once. The same
    // claim about what actually ships lives in the app catalogue integration test.
    expect(world.placements).toHaveLength(calibrationNodes.length);

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
    const world = placeWorld(calibrationNodes, () => 0, "turing-pact", "catalogue");
    const plateau = world.placements.find((entry) => entry.node.lessons === 12);
    const highland = world.placements.find((entry) => entry.node.lessons === 41);
    expect(plateau).toBeDefined();
    expect(highland).toBeDefined();
    expect(highland!.grid.bounds.maxHalf).toBeGreaterThan(plateau!.grid.bounds.maxHalf);
    expect(highland!.grid.cells.length).toBeGreaterThan(plateau!.grid.cells.length);
  });

  it("retains the original 3/19/41-lesson footprint calibration without pinning retired course IDs", () => {
    const world = placeWorld(calibrationNodes, () => 0, "turing-pact", "catalogue");
    const byLength = [...world.placements].sort((a, b) => a.node.lessons - b.node.lessons);
    const short = byLength[0]!;
    const medium = courseEntry(world, "product-website");
    const long = courseEntry(world, "foundations-before-zero");
    const medianFootprint = median(world.placements.map((entry) => entry.grid.bounds.maxHalf));
    const frame = worldFrameEnvelope(world);

    // The lower and upper bounds come from the real catalogue's median-sized
    // course: the 3-lesson tail must retain at least 60% of that footprint,
    // while the original 41-lesson sample stays below 1.75× it. The two explicit ratios
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
    const world = placeWorld(calibrationNodes, () => 0, "turing-pact", "catalogue");
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
        const min = (a.radius + b.radius) * WORLD_ISLAND_SEPARATION_GAP;
        // The relaxation is deterministic but uses floating-point vector
        // lengths; allow one sub-micron of arithmetic noise at the exact edge.
        expect(gap).toBeGreaterThanOrEqual(min - 1e-6);
      }
    }
  });

  it("only keeps the large world-scale landmarks on the remote field", () => {
    const world = placeWorld(calibrationNodes, () => 0, "turing-pact", "catalogue");
    /*
     * 2026-09-02: this used to pin four literal asset ids, because the grid had
     * one hard-coded nine-model list and the world projection kept the four
     * largest of them. The library is now generated per biome, so an island's
     * silhouette asset depends on which biome its first unit drew — pinning
     * names here would only pin one seed's luck.
     *
     * What actually has to hold at archipelago scale is the *role*: a course is
     * a few dozen pixels of ground, so only the unit landmark and a thin
     * scatter of canopy survive the projection. Ground punctuation at that size
     * is a wasted instance, and asserting the role is what keeps it out.
     */
    const drawn = world.placements.flatMap((entry) =>
      entry.grid.props.filter((prop) => prop.visibleInCourse !== false),
    );
    expect(drawn.every((prop) => prop.role === "landmark" || prop.role === "canopy")).toBe(true);
    const totalProps = drawn.length;
    expect(totalProps).toBeGreaterThanOrEqual(calibrationNodes.length);
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
    const world = placeWorld(calibrationNodes, () => 0, "turing-pact", "catalogue");
    const cellCounts = world.placements.map((entry) => entry.grid.cells.length);
    const triangles = worldUndersideTriangleCountForIslands(cellCounts);

    expect(world.placements).toHaveLength(calibrationNodes.length);
    expect(
      cellCounts.every((cellCount) => {
        const spikes = worldUndersideSpikeCountForCells(cellCount);
        return spikes >= 3 && spikes <= 5;
      }),
    ).toBe(true);
    expect(triangles).toBeLessThan(2_000);
  });
});
