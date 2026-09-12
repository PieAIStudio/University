import * as THREE from "three";
import { expect, it } from "vitest";
import { islandBlueprint, ISLAND_ROUTE_ARCHETYPES } from "./island-blueprint.js";
import { planIslandDressing } from "./island-dressing.js";
import { islandThemeSelectionForCourse } from "./kenney-recipes.js";
import { createMiniatureAsset } from "./miniature-assets.js";
import { toFoliageRenderPlacement } from "./island-foliage-render.js";
import { sampleIslandTerrainTop } from "./island-geometry.js";

it("seats the actual complete-tree feet on terrain at all preview scales", () => {
  const sources = {
    fir: createMiniatureAsset("fir", "course"),
    broadleaf: createMiniatureAsset("broadleaf", "course"),
  };
  const point = new THREE.Vector3(),
    up = new THREE.Vector3(0, 1, 0);
  let trees = 0;
  try {
    for (const routeArchetype of ISLAND_ROUTE_ARCHETYPES)
      for (const seed of [0, 1, 2]) {
        const blueprint = islandBlueprint({
          studyId: "tree-roots",
          courseId: `root-${seed}`,
          lessonCount: seed === 0 ? 6 : seed === 1 ? 24 : 41,
          routeArchetype,
          themeSelection: islandThemeSelectionForCourse("turing-pact", "foundations-before-zero"),
        });
        const plan = planIslandDressing(blueprint, "course");
        for (const tree of plan.placements.filter(
          (p) => p.kind === "tree" && p.id.startsWith("nature-"),
        )) {
          trees++;
          expect(tree.foliageRootOffset).toBeLessThanOrEqual(0);
          expect(tree.foliageRootOffset).toBeGreaterThanOrEqual(-0.261);
          for (const scale of [0.35, 1, 2]) {
            const p = toFoliageRenderPlacement(tree, scale);
            const positions = sources[p.treeForm].getAttribute("position");
            for (let i = 0; i < positions.count; i++) {
              if (Math.abs(positions.getY(i)) > 1e-7) continue;
              point
                .fromBufferAttribute(positions, i)
                .multiplyScalar(p.height)
                .applyAxisAngle(up, p.turn)
                .add(p.position);
              const ground =
                sampleIslandTerrainTop(blueprint, "course", point.x / scale, point.z / scale).y *
                scale;
              expect(point.y - ground).toBeLessThanOrEqual(-0.009 * scale + 1e-6);
              expect(ground - point.y).toBeLessThanOrEqual(0.271 * scale + 1e-6);
            }
          }
        }
      }
    expect(trees).toBeGreaterThan(50);
  } finally {
    sources.fir.dispose();
    sources.broadleaf.dispose();
  }
}, 60000);
