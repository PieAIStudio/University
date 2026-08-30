import imported from "../../../../apps/university/src/content/imported.json";
import { describe, expect, it } from "vitest";

import { buildWorldCourseGrid } from "../Maps.js";
import {
  PLANET_CLUSTER_LAYOUT_CONTRACT,
  placePlanetClusters,
  planetCameraDistance,
  type PlanetStudyLayoutInput,
} from "./placement.js";

function realStudyInputs(): PlanetStudyLayoutInput[] {
  return imported.studies.map((study) => ({
    studyId: study.studyId,
    courses: study.courses.map((course, index) => {
      const map = buildWorldCourseGrid({
        courseId: course.courseId,
        title: course.title,
        lessons: course.lessons,
        studyId: study.studyId,
        studyTitle: study.title,
        depth: index,
        prerequisiteCourseIds: [],
        trackId: null,
      });
      return {
        studyId: study.studyId,
        courseId: course.courseId,
        halfX: map.bounds.halfX,
        halfZ: map.bounds.halfZ,
        centerX: (map.bounds.minX + map.bounds.maxX) * 0.5,
        centerZ: (map.bounds.minZ + map.bounds.maxZ) * 0.5,
      };
    }),
  }));
}

function courseGap(
  left: { readonly centerX: number; readonly centerZ: number; readonly radius: number },
  right: { readonly centerX: number; readonly centerZ: number; readonly radius: number },
): number {
  return (
    Math.hypot(right.centerX - left.centerX, right.centerZ - left.centerZ) -
    left.radius -
    right.radius
  );
}

function clusterGap(
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
  it("uses the real imported catalogue: five study clusters and 53 course maps", () => {
    const layout = placePlanetClusters(realStudyInputs());

    expect(layout.clusters).toHaveLength(5);
    expect(layout.courses).toHaveLength(53);
    expect(layout.clusters.reduce((sum, cluster) => sum + cluster.courseCount, 0)).toBe(53);
    expect(layout.bounds.maxHalf).toBeGreaterThan(0);
  });

  it("keeps every course silhouette separated inside its study cluster", () => {
    const layout = placePlanetClusters(realStudyInputs());
    for (const studyId of layout.clusters.map((cluster) => cluster.studyId)) {
      const courses = layout.courses.filter((course) => course.studyId === studyId);
      for (let left = 0; left < courses.length; left += 1) {
        for (let right = left + 1; right < courses.length; right += 1) {
          expect(courseGap(courses[left]!, courses[right]!)).toBeGreaterThanOrEqual(
            PLANET_CLUSTER_LAYOUT_CONTRACT.intraClusterGap - 1e-6,
          );
        }
      }
    }
  });

  it("keeps study clusters apart but close enough to read as one catalogue", () => {
    const layout = placePlanetClusters(realStudyInputs());
    const nearestGaps = layout.clusters.map((cluster, index) =>
      Math.min(
        ...layout.clusters
          .filter((_, otherIndex) => otherIndex !== index)
          .map((other) => clusterGap(cluster, other)),
      ),
    );

    expect(Math.min(...nearestGaps)).toBeGreaterThanOrEqual(
      PLANET_CLUSTER_LAYOUT_CONTRACT.interClusterGap - 1e-6,
    );
    expect(Math.max(...nearestGaps)).toBeLessThanOrEqual(
      PLANET_CLUSTER_LAYOUT_CONTRACT.maxNearestClusterGap,
    );
  });

  it("does not retarget the layout origin when catalogue order or selection changes", () => {
    const input = realStudyInputs();
    const shuffled = [...input].reverse().map((study) => ({
      ...study,
      courses: [...study.courses].reverse(),
    }));
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
