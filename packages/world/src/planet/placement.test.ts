import imported from "../../../../apps/university/src/content/imported.json";
import { describe, expect, it } from "vitest";

import { buildWorldStudyGrid } from "../Maps.js";
import {
  PLANET_CLUSTER_LAYOUT_CONTRACT,
  PLANET_STUDY_SIZE_CONTRACT,
  placePlanetClusters,
  planetCameraDistance,
  type PlanetStudyLayoutInput,
} from "./placement.js";

function realStudyInputs(): PlanetStudyLayoutInput[] {
  return imported.studies.map((study) => {
    const lessonCount = study.courses.reduce((sum, course) => sum + course.lessons, 0);
    const map = buildWorldStudyGrid({
      studyId: study.studyId,
      studyTitle: study.title,
      courseCount: study.courses.length,
      lessonCount,
    });
    return {
      studyId: study.studyId,
      courseCount: study.courses.length,
      lessonCount,
      cellCount: map.cells.length,
      halfX: map.bounds.halfX,
      halfZ: map.bounds.halfZ,
      centerX: (map.bounds.minX + map.bounds.maxX) * 0.5,
      centerZ: (map.bounds.minZ + map.bounds.maxZ) * 0.5,
    };
  });
}

function circleGap(
  left: { readonly centerX: number; readonly centerZ: number; readonly radius: number },
  right: { readonly centerX: number; readonly centerZ: number; readonly radius: number },
): number {
  return (
    Math.hypot(right.centerX - left.centerX, right.centerZ - left.centerZ) -
    left.radius -
    right.radius
  );
}

describe("placePlanetClusters", () => {
  it("uses one measured landmass per real study, not one map per course", () => {
    const inputs = realStudyInputs();
    const layout = placePlanetClusters(inputs);

    expect(layout.clusters).toHaveLength(5);
    expect(layout.clusters.map((cluster) => cluster.courseCount).sort((a, b) => a - b)).toEqual([
      1, 5, 7, 9, 31,
    ]);
    expect(layout.clusters.reduce((sum, cluster) => sum + cluster.cellCount, 0)).toBe(
      inputs.reduce((sum, study) => sum + study.cellCount, 0),
    );
    expect(layout.clusters.reduce((sum, cluster) => sum + cluster.cellCount, 0)).toBeLessThan(
      1_092,
    );
    expect(layout.clusters.every((cluster) => cluster.cellCount > 0)).toBe(true);
    expect(layout.bounds.maxHalf).toBeGreaterThan(0);
  });

  it("keeps each study landmass separate while preserving one catalogue field", () => {
    const layout = placePlanetClusters(realStudyInputs());
    const nearestGaps = layout.clusters.map((cluster, index) =>
      Math.min(
        ...layout.clusters
          .filter((_, otherIndex) => otherIndex !== index)
          .map((other) => circleGap(cluster, other)),
      ),
    );

    expect(Math.min(...nearestGaps)).toBeGreaterThanOrEqual(
      PLANET_CLUSTER_LAYOUT_CONTRACT.interClusterGap - 1e-6,
    );
    expect(Math.max(...nearestGaps)).toBeLessThanOrEqual(
      PLANET_CLUSTER_LAYOUT_CONTRACT.maxNearestClusterGap,
    );
  });

  it("keeps the one-course floor clickable and the 31-course study from owning the frame", () => {
    const layout = placePlanetClusters(realStudyInputs());
    const general = layout.clusters.find((cluster) => cluster.studyId === "general");
    const turing = layout.clusters.find((cluster) => cluster.studyId === "turing-pact");
    expect(general).toBeDefined();
    expect(turing).toBeDefined();

    expect(general!.cellCount).toBeGreaterThanOrEqual(PLANET_STUDY_SIZE_CONTRACT.minCells);
    expect(general!.radius).toBeGreaterThanOrEqual(PLANET_STUDY_SIZE_CONTRACT.minRadius);
    expect(turing!.cellCount).toBeLessThanOrEqual(PLANET_STUDY_SIZE_CONTRACT.maxCells);
    expect(turing!.radius / layout.bounds.maxHalf).toBeLessThanOrEqual(
      PLANET_STUDY_SIZE_CONTRACT.maxLargestFieldShare,
    );
  });

  it("does not retarget the layout origin when catalogue order or selection changes", () => {
    const input = realStudyInputs();
    const shuffled = [...input].reverse();
    const forward = placePlanetClusters(input);
    const reversed = placePlanetClusters(shuffled);

    expect(reversed).toEqual(forward);
    // Selection is intentionally absent from the pure layout API. This is the
    // regression guard for the old pointer-to-origin retargeting bug.
    expect(placePlanetClusters(input)).toEqual(forward);
  });
});

describe("planetCameraDistance", () => {
  it("fits the measured bounds in both desktop and narrow mobile frames", () => {
    const bounds = placePlanetClusters(realStudyInputs()).bounds;
    for (const [aspect, fov] of [
      [1440 / 810, 34],
      [390 / 844, 42],
    ] as const) {
      const distance = planetCameraDistance(bounds, aspect, fov);
      const halfVertical = (fov * Math.PI) / 360;
      const halfHorizontal = Math.atan(Math.tan(halfVertical) * aspect);
      const visibleRadius = distance * Math.tan(Math.min(halfVertical, halfHorizontal));
      expect(visibleRadius).toBeGreaterThanOrEqual(
        Math.hypot(bounds.halfX, bounds.halfZ) * PLANET_CLUSTER_LAYOUT_CONTRACT.cameraPadding -
          1e-6,
      );
    }
  });
});
