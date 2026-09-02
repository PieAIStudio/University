import { describe, expect, it } from "vitest";

import { buildCourseGrid } from "./course-grid.js";
import {
  GRID_CANOPY_SPACING,
  canopySpacingHolds,
  gridVisiblePropTarget,
  propClusterFitsCell,
  propClustersAreValid,
  propClusterShapesHold,
  propCellsAreUnique,
  propPlacementSizeBandsHold,
  propsAvoidRoute,
  visiblePropsNearRoute,
} from "./grid-props.js";
import { gridBiomesForUnits } from "./grid-theme.js";
import { hexDistance } from "./hex.js";

function courseOf(lessonCount: number, unitCount: number, seed: string) {
  const perUnit = Math.ceil(lessonCount / unitCount);
  return buildCourseGrid({
    studyId: "turing-pact",
    courseId: `stress-${lessonCount}-${unitCount}`,
    seed,
    lessons: Array.from({ length: lessonCount }, (_, index) => ({
      lessonId: `lesson-${index + 1}`,
      unitId: `unit-${Math.floor(index / perUnit) + 1}`,
      unitIndex: Math.floor(index / perUnit),
    })),
  });
}

/**
 * The shapes a real catalogue actually contains, not one convenient course.
 * Every rule below has to hold for all of them, because the product promise is
 * that an author writes a course and the island is simply *right* — nobody is
 * going to review 53 of them by eye.
 */
const SHAPES = [
  { lessons: 3, units: 1 },
  { lessons: 8, units: 2 },
  { lessons: 16, units: 4 },
  { lessons: 41, units: 6 },
  { lessons: 60, units: 9 },
] as const;

const SEEDS = ["foundations-before-zero", "seed-b", "seed-c", "another-course"] as const;

/*
 * Floors for the learner's three-ring view, per lesson rather than per course.
 *
 * A single global minimum was measured first and it was 24 visible props with
 * 7 above 0.6 world units — both set by the smallest shape in the table, a
 * three-lesson course. The 41-lesson course actually renders 148 and 70, so a
 * flat floor of 24/7 would have let the long courses lose five sixths of their
 * dressing without turning anything red. A floor a passing island can be six
 * times better than is not measuring the island; it is measuring the shortest
 * course in the fixture list.
 *
 * Per-lesson rates hold every shape to the density its own length implies. The
 * constants are the measured minimum rate across SHAPES × SEEDS, rounded down.
 */
const MIN_VISIBLE_PROPS_PER_LESSON = 2.6;
const MIN_VISIBLE_TALL_PROPS_PER_LESSON = 0.9;
/** Short courses still need a floor that a rate alone would round away. */
const MIN_VISIBLE_PROPS_FLOOR = 20;
const MIN_VISIBLE_TALL_PROPS_FLOOR = 6;

describe("grid prop placement", () => {
  it("puts something where the learner is actually standing", () => {
    /*
     * The assertion this whole rewrite exists for.
     *
     * The learner's camera sits on the route at distance 23. The previous
     * implementation planned 287 props, drew 32, and every one of the 32 was
     * chosen for being *far* from the route — so the picture the product
     * actually shipped was bare ground, while every count-based metric read as
     * a full island. A number that can be satisfied by an empty screen is not
     * a guard, so this one is keyed to the only viewpoint that exists.
     */
    for (const shape of SHAPES) {
      for (const seed of SEEDS) {
        const map = courseOf(shape.lessons, shape.units, seed);
        const near = visiblePropsNearRoute(map.props, map.route, 2);
        const label = `${shape.lessons}/${shape.units}/${seed}`;
        expect(near.length, label).toBeGreaterThanOrEqual(
          Math.max(6, Math.round(map.route.length * 0.6)),
        );
      }
    }
  });

  it("never stands a prop on the road or on a lesson tile", () => {
    for (const shape of SHAPES) {
      for (const seed of SEEDS) {
        const map = courseOf(shape.lessons, shape.units, seed);
        const label = `${shape.lessons}/${shape.units}/${seed}`;
        expect(propsAvoidRoute(map.props, map.route), label).toBe(true);
        const lessonKeys = new Set(map.lessons.map((lesson) => lesson.key));
        expect(
          map.props.some((prop) => lessonKeys.has(prop.cellKey)),
          label,
        ).toBe(false);
      }
    }
  });

  it("keeps a tall silhouette away from the tile the learner must click", () => {
    // ADR-0008's node-occlusion ceiling is 5%. A canopy prop on a cell touching
    // a lesson is the one placement that can put geometry between the camera
    // and the control, so it is forbidden by arithmetic rather than by hoping
    // the density curve is kind.
    for (const shape of SHAPES) {
      for (const seed of SEEDS) {
        const map = courseOf(shape.lessons, shape.units, seed);
        const lessons = map.lessons.map((lesson) => lesson.coord);
        const offenders = map.props.filter(
          (prop) =>
            prop.visibleInCourse !== false &&
            (prop.role === "canopy" || prop.role === "landmark") &&
            lessons.some((lesson) => hexDistance(lesson, prop.coord) <= 1),
        );
        expect(
          offenders.map((prop) => prop.cellKey),
          `${shape.lessons}/${seed}`,
        ).toEqual([]);
      }
    }
  });

  it("keeps every cluster separated and inside its cell, at any size", () => {
    for (const shape of SHAPES) {
      for (const seed of SEEDS) {
        const map = courseOf(shape.lessons, shape.units, seed);
        const byCell = new Map<string, (typeof map.props)[number][]>();
        for (const prop of map.props) {
          const cluster = byCell.get(prop.cellKey) ?? [];
          cluster.push(prop);
          byCell.set(prop.cellKey, cluster);
        }
        const offenders = [...byCell.entries()]
          .filter(([, cluster]) => !propClusterFitsCell(cluster))
          .map(([cellKey]) => cellKey);
        expect(offenders, `${shape.lessons}/${seed}`).toEqual([]);
        expect(propCellsAreUnique(map.props), `${shape.lessons}/${seed}`).toBe(true);
        expect(propClustersAreValid(map.props), `${shape.lessons}/${seed}`).toBe(true);
      }
    }
  });

  it("gives each dressed cell one subject and two to four attachments", () => {
    for (const shape of SHAPES) {
      for (const seed of SEEDS) {
        const map = courseOf(shape.lessons, shape.units, seed);
        expect(propClusterShapesHold(map.props), `${shape.lessons}/${seed}`).toBe(true);
      }
    }
  });

  it("keeps tall silhouettes apart so an arm never becomes a hedge", () => {
    for (const shape of SHAPES) {
      for (const seed of SEEDS) {
        const map = courseOf(shape.lessons, shape.units, seed);
        expect(canopySpacingHolds(map.props), `${shape.lessons}/${seed}`).toBe(true);
      }
    }
    expect(GRID_CANOPY_SPACING).toBeGreaterThanOrEqual(2);
  });

  it("gives every unit a landmark, and only one", () => {
    for (const shape of SHAPES) {
      for (const seed of SEEDS) {
        const map = courseOf(shape.lessons, shape.units, seed);
        const landmarks = map.props.filter(
          (prop) => prop.kind === "landmark" && prop.clusterMember === "primary",
        );
        const label = `${shape.lessons}/${shape.units}/${seed}`;
        // ADR-0008 caps landmarks per island at 6; a longer course has more
        // units than that, so the cap is what bounds it, not the unit count.
        expect(landmarks.length, label).toBeLessThanOrEqual(shape.units);
        expect(new Set(landmarks.map((prop) => prop.unitId)).size, label).toBe(landmarks.length);
        expect(
          landmarks.every((prop) => prop.visibleInCourse !== false),
          label,
        ).toBe(true);
      }
    }
  });

  it("draws a bounded number of props however long the course is", () => {
    for (const shape of SHAPES) {
      for (const seed of SEEDS) {
        const map = courseOf(shape.lessons, shape.units, seed);
        const drawn = map.props.filter((prop) => prop.visibleInCourse !== false);
        const label = `${shape.lessons}/${shape.units}/${seed}`;
        expect(drawn.length, label).toBeLessThanOrEqual(
          gridVisiblePropTarget(map.route.length) + shape.units * 5,
        );
      }
    }
  });

  it("dresses a unit in its own biome and nothing else", () => {
    // The whole hypothesis in one assertion: if a cell's props could come from
    // any biome, the island is a scatter with extra steps.
    for (const seed of SEEDS) {
      const map = courseOf(41, 6, seed);
      const unitIds: string[] = [];
      for (const cell of map.cells) {
        if (cell.unitId && !unitIds.includes(cell.unitId)) unitIds.push(cell.unitId);
      }
      const biomes = gridBiomesForUnits(unitIds, seed);
      for (const prop of map.props) {
        if (!prop.unitId) continue;
        const biome = biomes.get(prop.unitId)!;
        const allowed = new Set([
          ...biome.canopy,
          ...biome.understory,
          ...biome.ground,
          biome.landmark,
        ]);
        expect(allowed.has(prop.assetId), `${seed}/${prop.unitId}/${prop.assetId}`).toBe(true);
      }
    }
  });

  it("is identical for the same course and seed", () => {
    const first = courseOf(41, 6, "repeat");
    const second = courseOf(41, 6, "repeat");
    expect(first.props.map((prop) => `${prop.cellKey}/${prop.assetId}/${prop.height}`)).toEqual(
      second.props.map((prop) => `${prop.cellKey}/${prop.assetId}/${prop.height}`),
    );
  });

  it("stands every prop on its own cell's surface", () => {
    // A prop placed at the island's average height sinks into a terrace and
    // shows only the corners poking through the seam. The planner cannot see
    // world Y, so what is asserted here is that every placement names a cell
    // that exists and that the renderer therefore has a height to read.
    for (const shape of SHAPES) {
      const map = courseOf(shape.lessons, shape.units, "grounding");
      const byKey = new Map(map.cells.map((cell) => [cell.key, cell]));
      for (const prop of map.props) {
        const cell = byKey.get(prop.cellKey);
        expect(cell, `${shape.lessons}/${prop.cellKey}`).toBeDefined();
        expect(cell!.kind, `${shape.lessons}/${prop.cellKey}`).not.toBe("detached");
      }
    }
  });

  it("keeps the route-three-ring visibility floor", () => {
    for (const shape of SHAPES) {
      for (const seed of SEEDS) {
        const map = courseOf(shape.lessons, shape.units, seed);
        const near = visiblePropsNearRoute(map.props, map.route, 3);
        const label = `${shape.lessons}/${seed}`;
        const floor = Math.max(
          MIN_VISIBLE_PROPS_FLOOR,
          Math.round(shape.lessons * MIN_VISIBLE_PROPS_PER_LESSON),
        );
        const tallFloor = Math.max(
          MIN_VISIBLE_TALL_PROPS_FLOOR,
          Math.round(shape.lessons * MIN_VISIBLE_TALL_PROPS_PER_LESSON),
        );
        expect(near.length, label).toBeGreaterThanOrEqual(floor);
        expect(near.filter((prop) => prop.height > 0.6).length, label).toBeGreaterThanOrEqual(
          tallFloor,
        );
      }
    }
  });

  it("rejects attachments that are shrunk into invisible pinpricks", () => {
    const map = courseOf(41, 6, "reverse-small");
    const tiny = map.props.map((prop) =>
      prop.clusterMember === "attachment"
        ? { ...prop, height: 0.01, width: 0.01, footprint: 0.01 }
        : prop,
    );
    expect(propPlacementSizeBandsHold(tiny)).toBe(false);
    expect(propClustersAreValid(tiny)).toBe(false);
  });

  it("rejects attachments that overlap their subject", () => {
    const map = courseOf(41, 6, "reverse-overlap");
    const source = map.props.find((prop) => prop.clusterMember === "attachment");
    expect(source).toBeDefined();
    const primary = map.props.find(
      (prop) => prop.cellKey === source?.cellKey && prop.clusterMember === "primary",
    );
    expect(primary).toBeDefined();
    const cluster = map.props
      .filter((prop) => prop.cellKey === source?.cellKey)
      .map((prop) =>
        prop === source ? { ...prop, offsetX: primary!.offsetX, offsetZ: primary!.offsetZ } : prop,
      );
    expect(propClusterFitsCell(cluster)).toBe(false);
    expect(propClustersAreValid(cluster)).toBe(false);
  });

  it("rejects a cluster that crosses its cell boundary", () => {
    const map = courseOf(41, 6, "reverse-cross-cell");
    const source = map.props.find((prop) => prop.clusterMember === "attachment");
    expect(source).toBeDefined();
    const crossing = map.props.map((prop) =>
      prop === source ? { ...prop, offsetX: prop.offsetX + prop.cellDiameter } : prop,
    );
    expect(propClustersAreValid(crossing)).toBe(false);
  });
});
