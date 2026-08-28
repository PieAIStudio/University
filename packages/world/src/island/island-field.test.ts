import { describe, expect, it } from "vitest";

import { islandBlueprint, routeDistanceAt, sampleIslandSurface } from "./island-blueprint.js";
import {
  compileIslandField,
  DEFAULT_ISLAND_FIELD_RESOLUTION,
  islandFieldFor,
  sampleIslandField,
  sampleIslandFieldChannel,
} from "./island-field.js";

const blueprint = islandBlueprint({
  studyId: "turing-pact",
  courseId: "foundations-before-zero",
  lessonCount: 41,
  routeArchetype: "switchback",
});

function pearson(first: readonly number[], second: readonly number[]): number {
  const firstMean = first.reduce((sum, value) => sum + value, 0) / first.length;
  const secondMean = second.reduce((sum, value) => sum + value, 0) / second.length;
  let numerator = 0;
  let firstVariance = 0;
  let secondVariance = 0;
  for (let index = 0; index < first.length; index += 1) {
    const firstDelta = first[index]! - firstMean;
    const secondDelta = second[index]! - secondMean;
    numerator += firstDelta * secondDelta;
    firstVariance += firstDelta * firstDelta;
    secondVariance += secondDelta * secondDelta;
  }
  return numerator / Math.sqrt(firstVariance * secondVariance);
}

describe("Island field", () => {
  it("compiles deterministic plain data with the requested packed layout", () => {
    const first = compileIslandField(blueprint, { resolution: 48 });
    const second = compileIslandField(blueprint, { resolution: 48 });

    expect(first).toEqual(second);
    expect(first.resolution).toBe(48);
    expect(first.extent).toBe(blueprint.bounds.maxHalf);
    expect(first.height).toHaveLength(48 * 48);
    expect(first.mask).toHaveLength(48 * 48 * 4);
    expect(first.ao).toHaveLength(48 * 48);
    expect(first.height.every(Number.isFinite)).toBe(true);
    expect(first.mask.every((value) => value >= 0 && value <= 255)).toBe(true);
    expect(first.ao.every((value) => value >= 0 && value <= 255)).toBe(true);
  });

  it("caches one field per blueprint and resolution", () => {
    const first = islandFieldFor(blueprint, { resolution: 48 });
    const second = islandFieldFor(blueprint, { resolution: 48 });
    const differentResolution = islandFieldFor(blueprint, { resolution: 49 });

    expect(second).toBe(first);
    expect(differentResolution).not.toBe(first);
    expect(islandFieldFor(blueprint)).toBe(islandFieldFor(blueprint));
    expect(islandFieldFor(blueprint).resolution).toBe(DEFAULT_ISLAND_FIELD_RESOLUTION);
  });

  it("keeps height and route R on their existing canonical sources", () => {
    const field = compileIslandField(blueprint, { resolution: 64 });
    const cell = (field.extent * 2) / (field.resolution - 1);
    const routeBand = blueprint.route.roadWidth / 2 + blueprint.route.shoulderWidth;
    let checkedHeight = false;
    let checkedRoute = false;

    for (const zIndex of [12, 24, 36, 48]) {
      for (const xIndex of [12, 24, 36, 48]) {
        const x = -field.extent + xIndex * cell;
        const z = -field.extent + zIndex * cell;
        const surface = sampleIslandSurface(blueprint, x, z);
        const index = zIndex * field.resolution + xIndex;
        if (surface.inside) {
          expect(field.height[index]).toBeCloseTo(surface.y, 4);
          checkedHeight = true;
        }
      }
    }

    for (const point of blueprint.centerline) {
      const xIndex = Math.round((point.x + field.extent) / cell);
      const zIndex = Math.round((point.z + field.extent) / cell);
      if (xIndex < 0 || xIndex >= field.resolution || zIndex < 0 || zIndex >= field.resolution) {
        continue;
      }
      const x = -field.extent + xIndex * cell;
      const z = -field.extent + zIndex * cell;
      const expected = 1 - smoothstep(routeBand, routeBand + 1.1, routeDistanceAt(blueprint, x, z));
      const actual = field.mask[(zIndex * field.resolution + xIndex) * 4]! / 255;
      expect(actual).toBeCloseTo(expected, 2);
      checkedRoute = true;
      break;
    }

    expect(checkedHeight).toBe(true);
    expect(checkedRoute).toBe(true);
  });

  it("makes meadow density terrain-led and bakes non-flat sky openness", () => {
    const field = compileIslandField(blueprint, { resolution: 64 });
    const lowlands: number[] = [];
    const meadows: number[] = [];
    const ao = Array.from(field.ao);
    for (let zIndex = 4; zIndex < field.resolution - 4; zIndex += 2) {
      for (let xIndex = 4; xIndex < field.resolution - 4; xIndex += 2) {
        const x = -field.extent + (xIndex / (field.resolution - 1)) * field.extent * 2;
        const z = -field.extent + (zIndex / (field.resolution - 1)) * field.extent * 2;
        const sample = sampleIslandField(field, x, z);
        if (!sample.inside || sample.shore > 0.8) continue;
        lowlands.push(-sample.height);
        meadows.push(sample.grass);
      }
    }

    expect(lowlands.length).toBeGreaterThan(100);
    expect(pearson(lowlands, meadows)).toBeGreaterThan(0.35);
    expect(Math.max(...meadows) - Math.min(...meadows)).toBeGreaterThan(0.2);
    expect(Math.min(...ao)).toBeLessThan(Math.max(...ao));
    expect(Math.min(...ao)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ao)).toBeLessThanOrEqual(255);
  });

  it("bilinearly samples all packed channels and returns water outside", () => {
    const field = compileIslandField(blueprint, { resolution: 48 });
    const centre = sampleIslandField(
      field,
      blueprint.centerline[10]!.x,
      blueprint.centerline[10]!.z,
    );
    const outside = sampleIslandField(field, field.extent * 0.99, field.extent * 0.99);

    expect(centre.inside).toBe(true);
    expect(centre.route).toBeGreaterThan(0.3);
    expect(centre.ao).toBeGreaterThan(0);
    expect(outside.inside).toBe(false);
    expect(outside.shore).toBeGreaterThan(0.9);
    expect(sampleIslandFieldChannel(field, "grass", NaN, 0)).toBe(0);
  });
});

function smoothstep(from: number, to: number, value: number): number {
  const amount = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return amount * amount * (3 - 2 * amount);
}
