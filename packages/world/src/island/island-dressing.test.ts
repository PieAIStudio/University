import { describe, expect, it } from "vitest";

import { islandBlueprint, sampleIslandSurface } from "./island-blueprint.js";
import {
  COMPOSITION_SCALES,
  footprintSamplePoints,
  orientedFootprintFor,
} from "./island-composition.js";
import {
  distanceToIslandRoute,
  islandDressingSafetyZones,
  planIslandDressing,
} from "./island-dressing.js";
import { isIslandFoliagePlacement } from "./island-foliage-render.js";
import { sampleIslandTerrainTop } from "./island-geometry.js";
import { islandFieldFor, sampleIslandField } from "./island-field.js";
import { islandThemeSelectionForCourse, recipeById, type IslandRecipe } from "./kenney-recipes.js";

const selection = islandThemeSelectionForCourse("turing-pact", "foundations-before-zero");
const r01 = recipeById("R01-forest-academy") as IslandRecipe;
const WORLD_MINOR_ASSETS = new Set(["lantern", "wall", "wall-corner"]);
const ROOF_ASSETS = new Set(["roof", "roof-gable"]);
const ACADEMY_ASSETS = new Set(["wall", "wall-doorway-square", "roof-gable"]);
const CAMP_ASSETS = new Set(["camp", "tent"]);

function academyPlacements(plan: ReturnType<typeof planIslandDressing>) {
  return plan.placements.filter((placement) => placement.assemblyId === "summit-academy-building");
}

function campPlacements(plan: ReturnType<typeof planIslandDressing>) {
  return plan.placements.filter((placement) => placement.assemblyId === "roadside-camp");
}

function makeBlueprint(unitIds?: readonly string[]) {
  return islandBlueprint({
    studyId: "turing-pact",
    courseId: "foundations-before-zero",
    lessonIds: Array.from({ length: 41 }, (_, index) => `lesson-${index + 1}`),
    unitIds,
    routeArchetype: "switchback",
    themeSelection: selection,
  });
}

describe("Island dressing", () => {
  it("builds a deterministic, curated R01 composition inside the island", () => {
    const blueprint = makeBlueprint();
    const first = planIslandDressing(blueprint, "course");
    const second = planIslandDressing(blueprint, "course");
    expect(first).toEqual(second);
    expect(first.placements.length).toBeGreaterThan(45);
    expect(first.placements.some((placement) => placement.packId === "nature-kit")).toBe(true);
    expect(first.placements.some((placement) => placement.packId === "fantasy-town-kit")).toBe(
      true,
    );
    // Filled capacity is not a quality metric: solid crowns need separated
    // groves and facility aprons rather than the former seven-props quota.
    const trees = first.placements.filter((placement) => placement.kind === "tree");
    expect(trees.length).toBeGreaterThan(15);
    expect(trees.length).toBeLessThanOrEqual(70);
    expect(new Set(trees.map((placement) => placement.clusterId)).size).toBeGreaterThanOrEqual(2);
    expect(trees.every((placement) => placement.clusterId?.startsWith("grove-"))).toBe(true);
    const outpostIds = new Set(
      first.placements.map((placement) => placement.outpostId).filter(Boolean),
    );
    expect(outpostIds.size).toBeGreaterThanOrEqual(3);
    expect(outpostIds.size).toBeLessThanOrEqual(6);
    const accentPlacements = first.placements.filter(
      (placement) => placement.packId === "fantasy-town-kit" && !placement.outpostId,
    );
    expect(r01.accentPackIds).toEqual(["fantasy-town-kit"]);
    expect(new Set(accentPlacements.map((placement) => placement.packId))).toEqual(
      new Set(r01.accentPackIds),
    );

    const academy = academyPlacements(first);
    expect(academy).toHaveLength(5);
    expect(new Set(academy.map((placement) => placement.assetId))).toEqual(ACADEMY_ASSETS);
    expect(academy.filter((placement) => placement.assetId === "wall")).toHaveLength(3);

    const expectedHeights = [
      ["fountain-round", 0.48, 0.62],
      ["stall", 1.25, 1.55],
      ["wall-doorway-square", 2.1, 2.5],
      ["wall", 2.1, 2.5],
      ["wall-corner", 2.1, 2.5],
      ["roof", 1.35, 1.6],
      ["roof-gable", 1.2, 1.4],
      ["lantern", 1.1, 1.5],
    ] as const;
    for (const [assetId, minimum, maximum] of expectedHeights) {
      const placements = first.placements.filter(
        (placement) => placement.assetId === assetId && !placement.outpostId,
      );
      if (placements.length === 0) continue;
      expect(
        placements.every((placement) => placement.height >= minimum),
        assetId,
      ).toBe(true);
      expect(
        placements.every((placement) => placement.height <= maximum),
        assetId,
      ).toBe(true);
    }

    for (const placement of first.placements) {
      const surface = sampleIslandSurface(blueprint, placement.x, placement.z);
      const renderedTop = sampleIslandTerrainTop(blueprint, "course", placement.x, placement.z);
      expect(surface.inside, placement.id).toBe(true);
      if (!placement.assemblyId) {
        expect(placement.y, placement.id).toBeCloseTo(renderedTop.y + (placement.lift ?? 0), 8);
      }
      expect(placement.height).toBeGreaterThan(0);
      expect(distanceToIslandRoute(blueprint, placement)).toBeGreaterThan(
        blueprint.route.roadWidth / 2,
      );
      expect(
        Math.hypot(placement.x - blueprint.hero.x, placement.z - blueprint.hero.z),
      ).toBeGreaterThanOrEqual(blueprint.hero.radius + 1.4);
      if (
        placement.assemblyId === "summit-academy-building" &&
        ROOF_ASSETS.has(placement.assetId)
      ) {
        expect(placement.lift, placement.id).toBe(COMPOSITION_SCALES.academyWall.height);
        expect(placement.y, placement.id).toBeGreaterThan(surface.y);
      } else if (!placement.assemblyId) {
        expect(placement.lift ?? 0, placement.id).toBe(0);
      }
      if (placement.packId === "fantasy-town-kit") {
        expect(surface.radial, placement.id).toBeLessThanOrEqual(0.92);
      }
    }
  });

  it("derives conservative grass aprons from the same authored placements", () => {
    const plan = planIslandDressing(makeBlueprint(), "course");
    const zones = islandDressingSafetyZones(plan);
    expect(zones.length).toBeGreaterThan(0);
    expect(zones.every((zone) => zone.kind === "landmark" && zone.radius > 0)).toBe(true);
    expect(zones).toEqual(islandDressingSafetyZones(plan));
  });

  it("biases natural dressing through the shared meadow and rock channels", () => {
    const blueprint = makeBlueprint();
    const field = islandFieldFor(blueprint);
    const natural = planIslandDressing(blueprint, "course").placements.filter(
      (placement) =>
        placement.kind === "tree" || placement.kind === "bush" || placement.kind === "rock",
    );
    const foliage = natural.filter(
      (placement) => placement.kind === "tree" || placement.kind === "bush",
    );
    const rocks = natural.filter((placement) => placement.kind === "rock");
    const average = (placements: typeof natural, channel: "grass" | "rock") =>
      placements.reduce(
        (sum, placement) => sum + sampleIslandField(field, placement.x, placement.z)[channel],
        0,
      ) / Math.max(1, placements.length);

    expect(natural.length).toBeGreaterThan(0);
    expect(foliage.length).toBeGreaterThan(0);
    expect(rocks.length).toBeGreaterThan(0);
    expect(foliage.every(isIslandFoliagePlacement)).toBe(true);
    expect(rocks.every((placement) => placement.packId === "nature-kit")).toBe(true);
    expect(average(foliage, "grass")).toBeGreaterThan(average(rocks, "grass"));
    expect(average(rocks, "rock")).toBeGreaterThan(average(foliage, "rock"));
    for (const placement of natural) {
      const sample = sampleIslandField(field, placement.x, placement.z);
      expect(sample.inside, placement.id).toBe(true);
      expect(sample.shore, placement.id).toBeLessThanOrEqual(0.975);
      const footprint = Math.max(0.12, placement.height * 0.14);
      expect(
        blueprint.nodes.every(
          (node) =>
            Math.hypot(placement.x - node.x, placement.z - node.z) >=
            blueprint.route.nodeRadius + footprint,
        ),
        placement.id,
      ).toBe(true);
    }
  });

  it("builds four to six grouped route outposts outside every lesson node", () => {
    const blueprint = makeBlueprint();
    const plan = planIslandDressing(blueprint, "course");
    const outposts = new Map<string, Array<(typeof plan.placements)[number]>>();
    for (const placement of plan.placements) {
      if (!placement.outpostId) continue;
      const entries = outposts.get(placement.outpostId) ?? [];
      entries.push(placement);
      outposts.set(placement.outpostId, entries);
      const footprint =
        placement.kind === "landmark"
          ? Math.max(0.42, placement.height * 0.22)
          : Math.max(0.2, placement.height * 0.18);
      expect(
        blueprint.nodes.every(
          (node) =>
            Math.hypot(placement.x - node.x, placement.z - node.z) >=
            blueprint.route.nodeRadius + footprint + 0.62,
        ),
        placement.id,
      ).toBe(true);
    }
    expect(outposts.size).toBeGreaterThanOrEqual(4);
    expect(outposts.size).toBeLessThanOrEqual(6);
    expect([...outposts.values()].every((placements) => placements.length >= 2)).toBe(true);
    expect(new Set([...outposts.values()].map(([placement]) => placement.segment)).size).toBe(3);
  });

  it("keeps at least three grouped outposts across the supported route shapes", () => {
    for (const [index, routeArchetype] of (
      ["arc", "horseshoe", "loop-around-hill", "switchback", "serpentine"] as const
    ).entries()) {
      const blueprint = islandBlueprint({
        studyId: "turing-pact",
        courseId: `outpost-route-${index}`,
        lessonCount: 41,
        routeArchetype,
        themeSelection: selection,
      });
      const plan = planIslandDressing(blueprint, "course");
      const outposts = new Map<string, Array<(typeof plan.placements)[number]>>();
      for (const placement of plan.placements) {
        if (!placement.outpostId) continue;
        const entries = outposts.get(placement.outpostId) ?? [];
        entries.push(placement);
        outposts.set(placement.outpostId, entries);
      }
      expect(outposts.size, routeArchetype).toBeGreaterThanOrEqual(3);
      expect(outposts.size, routeArchetype).toBeLessThanOrEqual(6);
      expect(
        [...outposts.values()].every((placements) => placements.length >= 2),
        routeArchetype,
      ).toBe(true);
    }
  });

  it("keeps the authored courtyard inside route and radial clearances", () => {
    for (const routeArchetype of [
      "arc",
      "horseshoe",
      "loop-around-hill",
      "switchback",
      "serpentine",
    ] as const) {
      const blueprint = islandBlueprint({
        studyId: "turing-pact",
        courseId: "foundations-before-zero",
        lessonCount: 41,
        routeArchetype,
        themeSelection: selection,
      });
      const plan = planIslandDressing(blueprint, "course");
      const accentPlacements = plan.placements.filter(
        (placement) => placement.packId === "fantasy-town-kit" && !placement.outpostId,
      );
      const academy = academyPlacements(plan);
      if (academy.length > 0) {
        expect(new Set(academy.map((placement) => placement.assetId))).toEqual(ACADEMY_ASSETS);
      } else {
        expect(accentPlacements.some((placement) => ACADEMY_ASSETS.has(placement.assetId))).toBe(
          false,
        );
      }
      for (const placement of accentPlacements) {
        const surface = sampleIslandSurface(blueprint, placement.x, placement.z);
        const label = `${routeArchetype}/${placement.id}`;
        expect(surface.inside, label).toBe(true);
        expect(surface.radial, label).toBeLessThanOrEqual(0.92);
        expect(distanceToIslandRoute(blueprint, placement)).toBeGreaterThan(
          blueprint.route.roadWidth / 2,
        );
        expect(
          Math.hypot(placement.x - blueprint.hero.x, placement.z - blueprint.hero.z),
        ).toBeGreaterThanOrEqual(blueprint.hero.radius + 1.4);
      }
    }
  });

  it("stages the academy kit as arrival, journey, and summit beats", () => {
    const blueprint = makeBlueprint();
    const accents = planIslandDressing(blueprint, "course").placements.filter(
      (placement) => placement.packId === "fantasy-town-kit" && !placement.outpostId,
    );
    const segments = new Map<string, typeof accents>();
    for (const placement of accents) {
      const segment = placement.segment;
      expect(segment).toBeDefined();
      const entries = segments.get(segment!) ?? [];
      entries.push(placement);
      segments.set(segment!, entries);
    }
    const arrival = planIslandDressing(blueprint, "course").placements.filter(
      (placement) => placement.segment === "arrival",
    );
    expect(arrival.some(({ assetId }) => assetId === "camp")).toBe(true);
    for (const lamp of accents.filter((placement) => placement.assetId === "lantern")) {
      const host = planIslandDressing(blueprint, "course").placements.find(
        (placement) => placement.id === lamp.companionOf,
      );
      expect(host, lamp.id).toBeDefined();
      expect(host?.segment).toBe(lamp.segment);
      expect(Math.hypot(lamp.x - host!.x, lamp.z - host!.z)).toBeLessThan(3.5);
    }
    expect(segments.get("journey")?.some(({ assetId }) => assetId === "fountain-round")).toBe(true);
    const academy = academyPlacements(planIslandDressing(blueprint, "course"));
    if (academy.length > 0) {
      expect(academy.every((placement) => placement.segment === "summit")).toBe(true);
      expect(academy.some((placement) => placement.assetId === "roof-gable")).toBe(true);
      expect(academy.some((placement) => placement.assetId === "wall-doorway-square")).toBe(true);
    }

    const nearestRouteFraction = (placement: (typeof accents)[number]) => {
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      blueprint.centerline.forEach((point, index) => {
        const distance = Math.hypot(placement.x - point.x, placement.z - point.z);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });
      return nearestIndex / Math.max(1, blueprint.centerline.length - 1);
    };
    const averageFraction = (segment: string) => {
      const entries = segments.get(segment) ?? [];
      return (
        entries.reduce((sum, placement) => sum + nearestRouteFraction(placement), 0) /
        entries.length
      );
    };
    if ((segments.get("arrival") ?? []).length > 0) {
      expect(averageFraction("arrival")).toBeLessThan(0.3);
    }
    if ((segments.get("journey") ?? []).length > 0) {
      expect(averageFraction("journey")).toBeGreaterThan(0.25);
      expect(averageFraction("journey")).toBeLessThan(0.75);
    }
    if ((segments.get("summit") ?? []).length > 0) {
      expect(averageFraction("summit")).toBeGreaterThan(0.7);
    }
  });

  it("makes the world plan a semantic subset, not a second random island", () => {
    const blueprint = makeBlueprint();
    const course = planIslandDressing(blueprint, "course");
    const world = planIslandDressing(blueprint, "world");
    const courseById = new Map(course.placements.map((placement) => [placement.id, placement]));
    expect(world.placements.length).toBeGreaterThan(4);
    expect(world.placements.length).toBeLessThanOrEqual(8);
    if (course.placements.some((placement) => ROOF_ASSETS.has(placement.assetId))) {
      expect(world.placements.some((placement) => ROOF_ASSETS.has(placement.assetId))).toBe(true);
    }
    if (course.placements.some((placement) => placement.assetId === "fountain-round")) {
      expect(world.placements.some((placement) => placement.assetId === "fountain-round")).toBe(
        true,
      );
    }
    expect(world.placements.some((placement) => placement.kind === "tree")).toBe(true);
    expect(
      world.placements.filter((placement) => placement.kind === "tree").length,
    ).toBeLessThanOrEqual(2);
    expect(world.placements.every((placement) => !WORLD_MINOR_ASSETS.has(placement.assetId))).toBe(
      true,
    );
    expect(
      world.placements.every((placement) => ["landmark", "tree"].includes(placement.kind)),
    ).toBe(true);
    for (const placement of world.placements) {
      expect(courseById.get(placement.id)).toEqual(placement);
      expect(placement.importance).toBeGreaterThanOrEqual(0.76);
    }
  });

  it("does not turn unit boundaries into physical landscape boundaries", () => {
    const oneUnit = makeBlueprint(Array.from({ length: 41 }, () => "unit-a"));
    const manyUnits = makeBlueprint(
      Array.from({ length: 41 }, (_, index) => `unit-${Math.floor(index / 6) + 1}`),
    );
    expect(planIslandDressing(oneUnit, "course")).toEqual(planIslandDressing(manyUnits, "course"));
  });

  it("refuses a recipe that does not match the blueprint physical-pack budget", () => {
    const blueprint = makeBlueprint();
    const starport = recipeById("R03-starport") as IslandRecipe;
    expect(() => planIslandDressing(blueprint, "course", starport)).toThrow(/does not match/);
  });

  it("places camp as tent plus lit fire with one elevation and facing clearance", () => {
    const plan = planIslandDressing(makeBlueprint(), "course");
    const camp = campPlacements(plan);
    expect(camp.length).toBe(2);
    expect(new Set(camp.map((placement) => placement.assetId))).toEqual(CAMP_ASSETS);
    const fire = camp.find((placement) => placement.assetId === "camp");
    const tent = camp.find((placement) => placement.assetId === "tent");
    expect(fire?.state).toBe("lit");
    const bases = camp.map((placement) => placement.y - (placement.lift ?? 0));
    expect(new Set(bases.map((value) => value.toFixed(5))).size).toBe(1);
    expect(Math.hypot(fire!.x - tent!.x, fire!.z - tent!.z)).toBeGreaterThan(2.2);
  });

  it("omits a bridge unless the whole assembly is present", () => {
    const plan = planIslandDressing(makeBlueprint(), "course");
    const bridges = plan.placements.filter((placement) => placement.assemblyId === "route-bridge");
    if (bridges.length === 0) {
      expect(plan.placements.some((placement) => placement.assetId === "bridge")).toBe(false);
      return;
    }
    expect(bridges.every((placement) => placement.assetId === "bridge")).toBe(true);
  });

  it("keeps academy roofs on the shared wall datum when the building is present", () => {
    const plan = planIslandDressing(makeBlueprint(), "course");
    const academy = academyPlacements(plan);
    expect(academy).toHaveLength(5);
    const bases = academy.map((placement) => placement.y - (placement.lift ?? 0));
    expect(new Set(bases.map((value) => value.toFixed(5))).size).toBe(1);
    const roofs = academy.filter((placement) => ROOF_ASSETS.has(placement.assetId));
    expect(
      roofs.every((placement) => placement.lift === COMPOSITION_SCALES.academyWall.height),
    ).toBe(true);
  });

  it("keeps transformed assembly footprints inside the island and off the path", () => {
    const blueprint = makeBlueprint();
    const plan = planIslandDressing(blueprint, "course");
    const grouped = plan.placements.filter(
      (placement) =>
        placement.assemblyId === "summit-academy-building" ||
        placement.assemblyId === "roadside-camp",
    );
    expect(grouped).toHaveLength(7);
    for (const placement of grouped) {
      const footprint = orientedFootprintFor(
        placement.assetId,
        placement.height,
        placement.x,
        placement.z,
        placement.turn,
      );
      for (const sample of footprintSamplePoints(footprint)) {
        const surface = sampleIslandSurface(blueprint, sample.x, sample.z);
        expect(surface.inside, `${placement.id}-foot`).toBe(true);
        expect(distanceToIslandRoute(blueprint, sample)).toBeGreaterThan(
          blueprint.route.roadWidth / 2,
        );
      }
    }
  });

  it("keeps rocks inside the coast margin across short and long courses", () => {
    for (const lessonCount of [6, 24, 41]) {
      const blueprint = islandBlueprint({
        studyId: "turing-pact",
        courseId: `rock-count-${lessonCount}`,
        lessonCount,
        routeArchetype: "switchback",
        themeSelection: selection,
      });
      const field = islandFieldFor(blueprint);
      const plan = planIslandDressing(blueprint, "course");
      const rocks = plan.placements.filter((placement) => placement.kind === "rock");
      expect(rocks.length, `${lessonCount}`).toBeGreaterThan(0);
      for (const rock of rocks) {
        const sample = sampleIslandField(field, rock.x, rock.z);
        expect(sample.inside, rock.id).toBe(true);
        expect(sample.shore, rock.id).toBeLessThanOrEqual(0.975);
      }
    }
  });

  it("stays deterministic on 6/24/41 lesson routes", () => {
    for (const lessonCount of [6, 24, 41]) {
      for (const routeArchetype of [
        "arc",
        "horseshoe",
        "loop-around-hill",
        "switchback",
        "serpentine",
      ] as const) {
        const blueprint = islandBlueprint({
          studyId: "turing-pact",
          courseId: `compose-${routeArchetype}-${lessonCount}`,
          lessonCount,
          routeArchetype,
          themeSelection: selection,
        });
        const first = planIslandDressing(blueprint, "course");
        const second = planIslandDressing(blueprint, "course");
        expect(first).toEqual(second);
        const academy = academyPlacements(first);
        if (academy.length > 0) {
          expect(new Set(academy.map((placement) => placement.assetId))).toEqual(ACADEMY_ASSETS);
        }
        const camp = campPlacements(first);
        if (camp.length > 0) {
          expect(new Set(camp.map((placement) => placement.assetId))).toEqual(CAMP_ASSETS);
        }
      }
    }
  });

  it("reports bounded searches, actual members and useful fallbacks without rerolling on camera changes", () => {
    const blueprint = makeBlueprint();
    const plan = planIslandDressing(blueprint, "course");
    expect(planIslandDressing(blueprint, "course")).toBe(plan);
    expect(plan.decisions).toHaveLength(3);
    for (const decision of plan.decisions!) {
      expect(decision.attempts).toBeLessThanOrEqual(300);
      const rejected = Object.values(decision.rejections).reduce((sum, count) => sum + count, 0);
      if (decision.status === "placed") {
        expect(decision.members.length).toBeGreaterThan(0);
        expect(
          decision.members.every((id) => plan.placements.some((placement) => placement.id === id)),
        ).toBe(true);
        expect(rejected).toBe(decision.attempts - 1);
      } else {
        expect(decision.members).toEqual([]);
        expect(decision.fallback).toBeDefined();
        expect(rejected).toBeGreaterThan(0);
      }
    }
  });
});
