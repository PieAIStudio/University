import { describe, expect, it } from "vitest";

import { buildCourseGrid, type CourseGridLesson, type GridCell } from "./course-grid.js";
import {
  GRID_SURFACE_MIN_WATER_COMPONENT,
  GRID_SURFACE_COLOURS,
  gridSurfaceColourGateHolds,
  gridSurfaceColourGateMetrics,
  gridSurfaceColourFor,
  gridSurfaceCounts,
  gridSurfaceConstraintViolations,
  gridSurfaceContractHolds,
  gridSurfaceMixIsValid,
  gridSurfaceRatios,
  gridSurfacesForCells,
  type GridSurfaceCell,
  type GridSurfacePlanningCell,
} from "./grid-surface.js";
import { GRID_BIOMES } from "./grid-theme.js";
import { hexDistance, hexKey, hexNeighbors } from "./hex.js";

const LESSON_SHAPES = [3, 8, 16, 41, 60] as const;
const SEEDS = ["foundations-before-zero", "seed-b", "seed-c", "another-course"] as const;

function lessonsFor(count: number, units: number): readonly CourseGridLesson[] {
  const perUnit = Math.ceil(count / units);
  return Array.from({ length: count }, (_, index) => ({
    lessonId: `lesson-${index + 1}`,
    unitId: `unit-${Math.floor(index / perUnit) + 1}`,
    unitIndex: Math.floor(index / perUnit),
    state: "idle" as const,
  }));
}

function courseOf(lessonCount: number, seed: string): ReturnType<typeof buildCourseGrid> {
  const unitCount = lessonCount <= 3 ? 1 : lessonCount <= 8 ? 2 : lessonCount <= 16 ? 4 : 6;
  return buildCourseGrid({
    studyId: "turing-pact",
    courseId: `surface-${lessonCount}`,
    seed,
    lessons: lessonsFor(lessonCount, unitCount),
  });
}

function fixtureCell(
  q: number,
  r: number,
  surface: GridCell["surface"],
  kind: GridCell["kind"] = "land",
  lessonIndex: number | null = null,
): GridSurfaceCell {
  return {
    coord: { q, r },
    key: hexKey({ q, r }),
    kind,
    lessonIndex,
    unitId: "unit-1",
    surface,
  };
}

function axialDisk(radius: number): GridSurfacePlanningCell[] {
  const cells: GridSurfacePlanningCell[] = [];
  for (let q = -radius; q <= radius; q += 1) {
    for (let r = -radius; r <= radius; r += 1) {
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) > radius) continue;
      const coord = { q, r };
      cells.push({
        coord,
        key: hexKey(coord),
        kind: "land",
        lessonIndex: null,
        unitId: "unit-1",
      });
    }
  }
  return cells;
}

function plannedWithBiome(biomeId: (typeof GRID_BIOMES)[number]["id"]): GridSurfaceCell[] {
  const planningCells = axialDisk(4);
  const biome = GRID_BIOMES.find((entry) => entry.id === biomeId)!;
  const surfaces = gridSurfacesForCells(
    planningCells,
    new Map([["unit-1", biome]]),
    "surface-fixture",
  );
  return planningCells.map((cell) => ({ ...cell, surface: surfaces.get(cell.key)! }));
}

describe("grid surface data contract", () => {
  it("keeps every biome mix finite, non-negative, and normalised", () => {
    for (const biome of GRID_BIOMES) {
      expect(gridSurfaceMixIsValid(biome.surfaceMix), biome.id).toBe(true);
    }
    expect(
      GRID_BIOMES.find((biome) => biome.id === "pine-ridge")!.surfaceMix.grass,
    ).toBeGreaterThan(0.9);
    expect(
      GRID_BIOMES.find((biome) => biome.id === "stone-quarry")!.surfaceMix.stone,
    ).toBeGreaterThan(0.5);
    expect(
      GRID_BIOMES.find((biome) => biome.id === "palm-shore")!.surfaceMix.water,
    ).toBeGreaterThan(0.1);
  });

  it("passes the generated 3/8/16/41/60 lesson pressure matrix", () => {
    for (const lessonCount of LESSON_SHAPES) {
      for (const seed of SEEDS) {
        const map = courseOf(lessonCount, seed);
        const label = `${lessonCount}/${seed}`;
        expect(gridSurfaceContractHolds(map.cells), label).toBe(true);
        expect(gridSurfaceConstraintViolations(map.cells), label).toEqual([]);
        expect(
          map.lessons.every((cell) => cell.surface === "grass"),
          label,
        ).toBe(true);
        expect(
          map.cells
            .filter((cell) => cell.surface === "water")
            .every((cell) => cell.kind === "land" && cell.lessonIndex === null),
          label,
        ).toBe(true);
        const ratios = gridSurfaceRatios(map.cells);
        expect(ratios.grass + ratios.stone + ratios.sand + ratios.water).toBeCloseTo(1, 8);
      }
    }
  });

  it("is deterministic and keeps water on the outer island shoulder", () => {
    const first = courseOf(41, "surface-repeat");
    const second = courseOf(41, "surface-repeat");
    expect(first.cells.map((cell) => `${cell.key}/${cell.surface}`)).toEqual(
      second.cells.map((cell) => `${cell.key}/${cell.surface}`),
    );
    const mainKeys = new Set(first.mainCells.map(hexKey));
    for (const cell of first.cells.filter((entry) => entry.surface === "water")) {
      const boundary = first.mainCells.filter((candidate) =>
        hexNeighbors(candidate).some((neighbor) => !mainKeys.has(hexKey(neighbor))),
      );
      const distance = Math.min(...boundary.map((candidate) => hexDistance(cell.coord, candidate)));
      expect(distance, cell.key).toBeLessThanOrEqual(1);
    }
  });

  it("lets the biome mix drive actual terrain roles, including a shore", () => {
    const quarry = plannedWithBiome("stone-quarry");
    const quarryCounts = gridSurfaceCounts(quarry);
    expect(quarryCounts.stone / quarry.length).toBeGreaterThanOrEqual(0.6);
    expect(quarryCounts.sand).toBeGreaterThan(0);

    const shore = plannedWithBiome("palm-shore");
    const shoreCounts = gridSurfaceCounts(shore);
    expect(shoreCounts.water).toBeGreaterThanOrEqual(GRID_SURFACE_MIN_WATER_COMPONENT);
    expect(gridSurfaceContractHolds(shore)).toBe(true);
    expect(gridSurfaceConstraintViolations(shore)).toEqual([]);
  });

  it("keeps the reviewed surface colour strip open", () => {
    const metrics = gridSurfaceColourGateMetrics();
    expect(gridSurfaceColourGateHolds()).toBe(true);
    expect(metrics.minimumPairDistance).toBeGreaterThanOrEqual(0.14);
    expect(metrics.maximumPairDistance).toBeGreaterThanOrEqual(0.35);
    expect(metrics.luminanceSpan).toBeGreaterThanOrEqual(0.16);
    expect(metrics.stoneRouteContrast).toBeGreaterThanOrEqual(2.4);
  });

  it("rejects a surface table whose four colours collapse to one", () => {
    const same = Object.fromEntries(
      Object.keys(GRID_SURFACE_COLOURS).map((surface) => [surface, 0x808080]),
    ) as typeof GRID_SURFACE_COLOURS;
    expect(gridSurfaceColourGateHolds(same)).toBe(false);
  });

  it("keeps the applied surface roles distinct after palette blending", () => {
    const applied = new Set(
      (Object.keys(GRID_SURFACE_COLOURS) as GridCell["surface"][]).map((surface) =>
        gridSurfaceColourFor(0x78925f, surface),
      ),
    );
    expect(applied.size).toBe(4);
  });
});

describe("grid surface reverse tripwires", () => {
  it("rejects a water component broken into one-cell scatter", () => {
    const scattered: GridSurfaceCell[] = [
      fixtureCell(0, 0, "water"),
      fixtureCell(2, 0, "water"),
      fixtureCell(4, 0, "water"),
      fixtureCell(1, 0, "sand"),
      fixtureCell(3, 0, "sand"),
    ];
    const violations = gridSurfaceConstraintViolations(scattered);
    expect(violations.some((violation) => violation.startsWith("water-component:"))).toBe(true);
    expect(gridSurfaceContractHolds(scattered)).toBe(false);
    expect(GRID_SURFACE_MIN_WATER_COMPONENT).toBeGreaterThan(1);
  });

  it("rejects route or lesson cells changed to water", () => {
    const routeWater = [fixtureCell(0, 0, "water", "route", 0)];
    const violations = gridSurfaceConstraintViolations(routeWater);
    expect(violations).toContain("walkability:0,0");
    expect(gridSurfaceContractHolds(routeWater)).toBe(false);
  });

  it("rejects water directly touching grass instead of sand", () => {
    const hardEdge = [fixtureCell(0, 0, "water"), fixtureCell(1, 0, "grass")];
    expect(
      gridSurfaceConstraintViolations(hardEdge).some((violation) =>
        violation.startsWith("water-grass-transition:"),
      ),
    ).toBe(true);
  });
});
