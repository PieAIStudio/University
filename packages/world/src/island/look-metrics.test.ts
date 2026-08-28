import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { islandBlueprint } from "./island-blueprint.js";
import { planIslandDressing } from "./island-dressing.js";
import {
  islandLookCameraForShot,
  islandLookDebugFromSearch,
  islandLookSceneSource,
} from "./island-look.js";
import { ISLAND_LOOK_CONTRACT } from "./look-contract.js";
import {
  measureIslandCodeMetrics,
  measureIslandImageData,
  measureKeyToFillRatio,
} from "./look-metrics.js";
import { islandThemeSelectionForCourse } from "./kenney-recipes.js";

const STUDY_ID = "turing-pact";
const COURSE_ID = "foundations-before-zero";

function blueprint(detailSeed = COURSE_ID) {
  return islandBlueprint({
    studyId: STUDY_ID,
    courseId: COURSE_ID,
    lessonCount: 41,
    seed: detailSeed,
    themeSelection: islandThemeSelectionForCourse(STUDY_ID, COURSE_ID),
  });
}

describe("island look judge", () => {
  it("keeps the fixed URL controls DEV-testable without changing the production fallback", () => {
    expect(
      islandLookDebugFromSearch("?shot=course-near&post=off&seed=foundations-before-zero&freeze=1"),
    ).toEqual({
      shot: "course-near",
      post: false,
      seed: COURSE_ID,
      freeze: true,
    });
    expect(islandLookDebugFromSearch("?shot=course-near", false)).toEqual({
      shot: null,
      post: true,
      seed: null,
      freeze: false,
    });
  });

  it("returns the same numeric pose for the same shot input", () => {
    const input = { halfX: 48, halfZ: 92 };
    const viewport = { width: 1440, height: 900 };
    const first = islandLookCameraForShot("course-design", input, viewport);
    const second = islandLookCameraForShot("course-design", input, viewport);
    expect(first).toEqual(second);
    expect(first.polar).toBeCloseTo(THREE.MathUtils.degToRad(68));
    expect(first.azimuth).toBeCloseTo(THREE.MathUtils.degToRad(65));
    expect(first.fov).toBe(34);
    expect(first.distance).toBeGreaterThan(34);

    const near = islandLookCameraForShot("course-near", input, viewport);
    expect(near.distance).toBe(36);
    expect(near.polar).toBeCloseTo(THREE.MathUtils.degToRad(68));
  });

  it("measures the same blueprint and dressing outputs that the renderer consumes", () => {
    const courseBlueprint = blueprint();
    const coursePlan = planIslandDressing(courseBlueprint, "course");
    const worldPlan = planIslandDressing(courseBlueprint, "world");
    const report = measureIslandCodeMetrics({
      detail: "course",
      blueprints: [courseBlueprint],
      dressingPlans: [coursePlan],
      nodePositions: courseBlueprint.nodes,
    });
    const worldReport = measureIslandCodeMetrics({
      detail: "world",
      blueprints: [courseBlueprint],
      dressingPlans: [worldPlan],
      nodePositions: [],
    });

    expect(report.lessonNodeCount).toBe(41);
    expect(report.coursePropCount).toBe(coursePlan.placements.length);
    expect(report.propsPerLessonNode).toBeCloseTo(coursePlan.placements.length / 41);
    expect(report.layerDistribution).toEqual({
      terrainPatches: courseBlueprint.terrainPatches.length,
      routeSamples: courseBlueprint.centerline.length,
      dressingProps: coursePlan.placements.length,
      lessonNodes: 41,
    });
    expect(worldReport.worldPropsPerIsland).toBe(worldPlan.placements.length);
  });

  it("keeps world judge data at the same identity-only LOD as the renderer", () => {
    const worldSource = islandLookSceneSource("world", [blueprint()]);
    expect(worldSource.dressingPlans).toHaveLength(1);
    expect(worldSource.dressingPlans[0]?.detail).toBe("world");
    expect(worldSource.dressingPlans[0]?.placements).toHaveLength(0);
  });

  it("uses one key/fill calculation and exposes the threshold separately", () => {
    const scene = new THREE.Scene();
    scene.add(new THREE.DirectionalLight(0xffffff, 2.1));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x000000, 1.35));
    scene.add(new THREE.AmbientLight(0xffffff, 0.22));
    expect(measureKeyToFillRatio(scene)).toBeCloseTo(2.1 / (1.35 + 0.22));
    expect(ISLAND_LOOK_CONTRACT.keyToFillMin).toBe(3);
  });

  it("computes CIELAB L* and HSL metrics from image data without an image library", () => {
    const data = new Uint8ClampedArray(4 * 4 * 4);
    for (let index = 0; index < 16; index += 1) {
      const offset = index * 4;
      data[offset] = index < 8 ? 30 : 230;
      data[offset + 1] = index < 8 ? 80 : 190;
      data[offset + 2] = index < 8 ? 35 : 220;
      data[offset + 3] = 255;
    }
    const report = measureIslandImageData(data, 4, 4);
    expect(report.colorSpace.lightness).toBe("CIELAB L* D65 from sRGB");
    expect(report.colorSpace.hueAndSaturation).toBe("HSL from sRGB");
    expect(report.sampledPixels).toBe(16);
    expect(report.lightnessP98).toBeGreaterThan(report.lightnessP2);
  });
});
