import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { ISLAND_ROUTE_ARCHETYPES, islandBlueprint } from "./island-blueprint.js";
import { miniatureLayoutFor, miniatureMetrics } from "./miniature-layout.js";
import { createMiniatureAsset } from "./miniature-assets.js";
import { islandThemeSelectionForCourse, KENNEY_ISLAND_RECIPES } from "./kenney-recipes.js";
import { miniatureStyleFor } from "./miniature-style.js";
import { sampleIslandTerrainTop } from "./island-geometry.js";
import { planRemotePropsCatalogue } from "./remote-props.js";
import { buildMiniatureSurfaces, mergeMiniatureProps } from "./miniature-batch.js";

describe("reference-led miniature landscapes", () => {
  it("assigns distinct named dioramas from the existing recipe, not course-name guesses", () => {
    const kinds = new Set<string>();
    for (const recipe of KENNEY_ISLAND_RECIPES) {
      const blueprint = islandBlueprint({
        studyId: "reference",
        courseId: "same-course",
        lessonCount: 24,
        themeSelection: {
          naturalBasePackId: recipe.base.packId,
          accentPackIds: recipe.accentPackIds,
          recipeId: recipe.id,
        },
      });
      const first = miniatureLayoutFor(blueprint);
      expect(miniatureLayoutFor(blueprint)).toBe(first);
      expect(first.styleId).toBe(miniatureStyleFor(blueprint).id);
      expect(first.props.length).toBeGreaterThan(2);
      const style = miniatureStyleFor(blueprint);
      // A waterfall/grove can use the water or canopy as its focal subject;
      // a named windmill/ruin/crystal scene must actually contain that asset.
      if (style.focal !== "stone")
        expect(
          first.props.filter((prop) => prop.role === "landmark"),
          recipe.id,
        ).toHaveLength(1);
      else
        expect(
          first.pool !== null || first.props.filter((prop) => prop.role === "tree").length >= 2,
          recipe.id,
        ).toBe(true);
      expect(first.triangles).toBeLessThanOrEqual(4800);
      kinds.add(first.styleId);
    }
    expect(kinds.size).toBe(9);
  });

  it.each(ISLAND_ROUTE_ARCHETYPES)(
    "keeps actual feet grounded and complete on %s across lengths and seeds",
    (routeArchetype) => {
      for (const seed of ["miniature/meadow", "miniature/valley", "miniature/shoulder"]) {
        for (const lessonCount of [6, 12, 24, 41]) {
          const blueprint = islandBlueprint({
            studyId: "turing-pact",
            courseId: "reference-matrix",
            seed,
            lessonCount,
            routeArchetype,
            themeSelection: islandThemeSelectionForCourse("turing-pact", "foundations-before-zero"),
          });
          const layout = miniatureLayoutFor(blueprint);
          expect(layout.props.length).toBeGreaterThan(2);
          expect(layout.props.length).toBeLessThanOrEqual(26);
          expect(layout.triangles).toBeLessThanOrEqual(4800);
          expect(layout.props.filter((p) => p.role === "landmark").length).toBeLessThanOrEqual(1);
          const m = blueprint.bounds.maxHalf;
          for (const prop of layout.props) {
            if (prop.role === "tree" && prop.z > -0.08)
              expect(Math.abs(prop.x)).toBeGreaterThanOrEqual(0.23 + prop.supportRadius);
            expect([prop.x, prop.y, prop.z, prop.size, prop.turn].every(Number.isFinite)).toBe(
              true,
            );
            const geometry = createMiniatureAsset(prop.asset);
            const positions = geometry.getAttribute("position");
            const local = new THREE.Vector3();
            let feet = 0;
            for (let i = 0; i < positions.count; i++) {
              if (positions.getY(i) > 0.025) continue;
              local
                .fromBufferAttribute(positions, i)
                .multiplyScalar(prop.size)
                .applyAxisAngle(THREE.Object3D.DEFAULT_UP, prop.turn)
                .add(new THREE.Vector3(prop.x, prop.y, prop.z));
              const surface = sampleIslandTerrainTop(blueprint, "world", local.x * m, local.z * m);
              expect(surface.inside, `${seed}/${lessonCount}/${prop.asset}`).toBe(true);
              expect(local.y - surface.y / m, `${prop.asset} actual foot gap`).toBeLessThanOrEqual(
                0.018,
              );
              expect(surface.y / m - local.y, `${prop.asset} bounded bury`).toBeLessThanOrEqual(
                0.06,
              );
              feet++;
            }
            expect(feet).toBeGreaterThan(0);
            expect(miniatureMetrics(prop.asset).triangles).toBeLessThanOrEqual(600);
            geometry.dispose();
          }
        }
      }
    },
  );

  it("merges real geometry counts, preserves pick ownership and stays in the declared batch budget", () => {
    const islands = KENNEY_ISLAND_RECIPES.map((recipe, index) => ({
      id: recipe.id,
      radius: 3,
      position: new THREE.Vector3(index * 12, 0, 0),
      blueprint: islandBlueprint({
        studyId: "reference",
        courseId: recipe.id,
        lessonCount: 24,
        themeSelection: {
          naturalBasePackId: recipe.base.packId,
          accentPackIds: recipe.accentPackIds,
          recipeId: recipe.id,
        },
      }),
    }));
    const plan = planRemotePropsCatalogue(islands);
    const all = [...plan.trees, ...plan.landmarks, ...plan.accents];
    const merged = mergeMiniatureProps(all);
    const surfaces = buildMiniatureSurfaces(plan);
    expect(merged.index!.count / 3).toBe(plan.totalTriangles);
    expect(merged.userData.miniatureRanges).toHaveLength(all.length);
    const boxes = merged.userData.miniatureSceneryBounds as {
      islandId: string;
      min: number[];
      max: number[];
    }[];
    expect(boxes).toHaveLength(plan.trees.length + plan.landmarks.length);
    for (const box of boxes) {
      expect([...box.min, ...box.max].every(Number.isFinite)).toBe(true);
      for (let axis = 0; axis < 3; axis++) expect(box.max[axis]).toBeGreaterThan(box.min[axis]!);
      expect(islands.some((island) => island.id === box.islandId)).toBe(true);
    }
    expect(merged.userData.miniatureRanges.at(-1).end).toBe(plan.totalTriangles);
    expect(plan.water.length).toBeGreaterThan(0);
    let total = merged.index!.count / 3;
    for (const geometry of Object.values(surfaces)) {
      expect(Array.from(geometry.getAttribute("position").array).every(Number.isFinite)).toBe(true);
      total += (geometry.index?.count ?? 0) / 3;
      geometry.dispose();
    }
    expect(total).toBeLessThanOrEqual(islands.length * 6000);
    merged.dispose();
  });
});
