import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { islandBlueprint } from "./island-blueprint.js";
import { sampleIslandTerrainTop } from "./island-geometry.js";
import {
  createRemotePavilionGeometry,
  createRemoteTreeGeometry,
  planRemoteIslandProps,
  planRemotePropsCatalogue,
  REMOTE_PAVILION_TRIANGLES,
  REMOTE_PROPS_PER_ISLAND_MAX,
  REMOTE_PROPS_PER_ISLAND_MIN,
  REMOTE_TREE_TRIANGLES,
} from "./remote-props.js";

describe("remote-props pure planning module", () => {
  it("creates geometries with exact triangle counts", () => {
    const treeGeom = createRemoteTreeGeometry();
    const treeIndex = treeGeom.getIndex();
    expect(treeIndex).not.toBeNull();
    expect(treeIndex!.count / 3).toBe(REMOTE_TREE_TRIANGLES); // 80: trunk + three crowns
    treeGeom.dispose();

    const pavilionGeom = createRemotePavilionGeometry();
    const pavilionIndex = pavilionGeom.getIndex();
    expect(pavilionIndex).not.toBeNull();
    expect(pavilionIndex!.count / 3).toBe(REMOTE_PAVILION_TRIANGLES); // 36
    pavilionGeom.dispose();
  });

  it("plans one focal assembly with trees and natural companions within the miniature cap", () => {
    const bp = islandBlueprint({
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      lessonCount: 12,
    });

    const props = planRemoteIslandProps({
      blueprint: bp,
      islandPosition: new THREE.Vector3(10, 0, -20),
      islandRadius: 3.5,
      lift: 1.0,
      islandId: "test-island",
    });

    expect(props.length).toBeGreaterThanOrEqual(REMOTE_PROPS_PER_ISLAND_MIN);
    expect(props.length).toBeLessThanOrEqual(REMOTE_PROPS_PER_ISLAND_MAX);

    const landmarks = props.filter((p) => p.kind === "landmark");
    const trees = props.filter((p) => p.kind === "tree");

    expect(landmarks).toHaveLength(1);
    expect(trees.length).toBeGreaterThanOrEqual(2);
    expect(trees.length).toBeLessThanOrEqual(5);
    expect(props.filter((p) => p.kind === "accent").length).toBeGreaterThan(4);
  });

  it("embeds all remote supports in the actual worldmesh instead of floating on a centre sample", () => {
    const bp = islandBlueprint({
      studyId: "buzz",
      courseId: "audio-signals",
      lessonCount: 20,
    });
    const islandPos = new THREE.Vector3(5, 2, -15);
    const islandRadius = 4.2;
    const lift = 0.5;

    const props = planRemoteIslandProps({
      blueprint: bp,
      islandPosition: islandPos,
      islandRadius,
      lift,
      islandId: "buzz/audio-signals",
    });

    const islandScale = islandRadius / bp.bounds.maxHalf;

    for (const prop of props) {
      // Extract local blueprint X and Z
      const localX = (prop.position.x - islandPos.x) / islandScale;
      const localZ = (prop.position.z - islandPos.z) / islandScale;

      const expectedSample = sampleIslandTerrainTop(bp, "world", localX, localZ);
      expect(expectedSample.inside).toBe(true);
      const expectedY = islandPos.y + lift + expectedSample.y * islandScale;

      // The base datum is the footprint minimum, not the centre height. Actual
      // emitted feet are checked over the full 60-shape matrix by miniature-layout.
      expect(prop.position.y).toBeLessThanOrEqual(expectedY);
      expect(expectedY - prop.position.y).toBeLessThanOrEqual(islandRadius * 0.06);
    }
  });

  it("keeps deterministic focal identity and orientation when only the instance id changes", () => {
    const bp = islandBlueprint({
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      lessonCount: 12,
    });

    const run1 = planRemoteIslandProps({
      blueprint: bp,
      islandPosition: new THREE.Vector3(0, 0, 0),
      islandRadius: 3.0,
      islandId: "run1",
    });
    const run2 = planRemoteIslandProps({
      blueprint: bp,
      islandPosition: new THREE.Vector3(0, 0, 0),
      islandRadius: 3.0,
      islandId: "run2",
    });

    expect(run1.length).toBe(run2.length);
    const landmark1 = run1.find((p) => p.kind === "landmark")!;
    const landmark2 = run2.find((p) => p.kind === "landmark")!;

    expect(landmark1.rotationY).toBe(landmark2.rotationY);
    expect(landmark1.asset).toBe(landmark2.asset);
    expect(landmark1.position.x).toBeCloseTo(landmark2.position.x, 4);
    expect(landmark1.position.z).toBeCloseTo(landmark2.position.z, 4);
  });

  it("scales to a full 53-course catalogue within the triangle and CPU budget", () => {
    const islands = Array.from({ length: 53 }, (_, i) => {
      const bp = islandBlueprint({
        studyId: `study-${i % 4}`,
        courseId: `course-${i}`,
        lessonCount: 6 + (i % 25),
      });
      return {
        id: `study-${i % 4}/course-${i}`,
        blueprint: bp,
        position: new THREE.Vector3(i * 10, 0, 0),
        radius: 3.2,
      };
    });

    const start = performance.now();
    const plan = planRemotePropsCatalogue(islands);
    const duration = performance.now() - start;

    expect(plan.landmarks).toHaveLength(53); // Exactly 1 per island
    expect(plan.trees.length).toBeGreaterThanOrEqual(53 * 2);
    expect(plan.trees.length).toBeLessThanOrEqual(53 * 5);

    // R44 budgets an actual miniature scene instead of a cone plus pavilion.
    expect(plan.totalTriangles).toBeLessThanOrEqual(53 * 4800);
    process.stdout.write(
      `[remote props] 53 islands: ${duration.toFixed(2)}ms, ${plan.totalTriangles} triangles\n`,
    );
    // Full-footprint cold planning is separate from focus/progress updates.
    // Preserve the interactive 60ms gate on the cached path, not a zero-cost
    // claim about constructing all 53 new landscapes for the first time.
    const warmStart = performance.now();
    const warm = planRemotePropsCatalogue(islands);
    expect(warm.totalTriangles).toBe(plan.totalTriangles);
    expect(performance.now() - warmStart).toBeLessThan(60);
  });

  it.each([6, 24, 41])(
    "keeps %i-lesson marks readable and follows selected island scaling",
    (lessonCount) => {
      const blueprint = islandBlueprint({
        studyId: "turing-pact",
        courseId: "scale-regression",
        lessonCount,
      });
      const position = new THREE.Vector3(7, 2, -9);
      const options = {
        blueprint,
        islandPosition: position,
        islandRadius: 4,
        islandId: "selected",
      };
      const normal = planRemoteIslandProps(options);
      const selected = planRemoteIslandProps({ ...options, scale: 1.045, lift: 0.8, dimmed: true });
      expect(normal.length).toBeGreaterThanOrEqual(3);
      expect(selected).toHaveLength(normal.length);
      normal.forEach((prop, i) => {
        const next = selected[i]!;
        expect(prop.scale / options.islandRadius).toBeGreaterThanOrEqual(
          prop.kind === "accent" ? 0.15 : 0.3,
        );
        expect(next.position.x - position.x).toBeCloseTo((prop.position.x - position.x) * 1.045, 9);
        expect(next.position.z - position.z).toBeCloseTo((prop.position.z - position.z) * 1.045, 9);
        expect(next.position.y - position.y - 0.8).toBeCloseTo(
          (prop.position.y - position.y) * 1.045,
          9,
        );
        expect(next.scale).toBeCloseTo(prop.scale * 1.045, 9);
        expect(next.dimmed).toBe(true);
      });
    },
  );
});
