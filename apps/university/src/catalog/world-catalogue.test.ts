import { describe, expect, it } from "vitest";
import {
  buildWorldStudyGrid,
  placeStudyArchipelago,
  placeWorld,
} from "@pieai/university-world/Maps.js";
import type { CourseNode } from "@pieai/university-world/course.js";
import {
  placePlanetClusters,
  PLANET_STUDY_SIZE_CONTRACT,
  type PlanetStudyLayoutInput,
} from "@pieai/university-world/planet.js";
import catalogue from "../content/imported.json";

// The application owns published content and composes the renderer. Frozen
// geometry calibration remains package-local; no renderer test reads an app.
const catalogueNodes: readonly CourseNode[] = catalogue.studies.flatMap((study) =>
  study.courses.map((course, depth) => ({
    courseId: course.courseId,
    title: course.title,
    lessons: course.lessons,
    studyId: study.studyId,
    studyTitle: study.title,
    depth,
    prerequisiteCourseIds: [],
    trackId: null,
  })),
);

function studyInputsFrom(
  studies: readonly {
    readonly studyId: string;
    readonly title: string;
    readonly courses: readonly { readonly lessons: number }[];
  }[],
): PlanetStudyLayoutInput[] {
  return studies.map((study) => {
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

function shippedStudyInputs(): PlanetStudyLayoutInput[] {
  return studyInputsFrom(catalogue.studies);
}
describe("published catalogue reaches the shared renderer", () => {
  /*
    The live half of the split. The contracts above are calibrated on frozen
    shapes; this one is about the catalogue that actually ships, and is what
    catches a locked or unlocked package that stops reaching the planet at all.
  */
  it("places every shipped study as its own reachable cluster", () => {
    const shipped = shippedStudyInputs();
    expect(shipped.length).toBeGreaterThan(0);
    const layout = placePlanetClusters(shipped);
    expect(layout.clusters).toHaveLength(shipped.length);
    expect(new Set(layout.clusters.map((cluster) => cluster.studyId))).toEqual(
      new Set(shipped.map((study) => study.studyId)),
    );
    expect(
      layout.clusters.every(
        (cluster) =>
          cluster.cellCount >= PLANET_STUDY_SIZE_CONTRACT.minCells &&
          cluster.radius >= PLANET_STUDY_SIZE_CONTRACT.minRadius,
      ),
    ).toBe(true);
    expect(Number.isFinite(layout.bounds.maxHalf)).toBe(true);
  });

  /*
    The live half of the split. Everything above calibrates geometry against
    frozen shapes; this is the one that still has to move when a package is
    locked or unlocked, and it is what catches a course that silently fails to
    reach the scene.
  */
  it("projects the shipped catalogue without dropping a course", () => {
    const world = placeWorld(catalogueNodes, () => 0, catalogueNodes[0]!.studyId, "catalogue");
    expect(catalogueNodes.length).toBeGreaterThan(0);
    expect(world.placements).toHaveLength(catalogueNodes.length);
    expect(new Set(world.placements.map((entry) => entry.node.courseId))).toEqual(
      new Set(catalogueNodes.map((node) => node.courseId)),
    );
    expect(world.placements.every((entry) => entry.grid.cells.length > 0)).toBe(true);
  });

  it.each(catalogue.studies)(
    "keeps $studyId's production framing inputs independent of other catalogue series",
    (study) => {
      // V5 M replaced the all-catalogue planar view with domain globes and
      // per-study archipelagos. The former fixed world-design assertion
      // clipped at 48 courses (horizontal coverage 1.101 > 0.93); R39 keeps
      // that receipt rather than tuning the diagnostic shot to hide it.
      // Actual course boundaries are also checked by the ordinary N/S browser
      // overview assertions. Do not restore global-catalogue camera acceptance.
      const own = catalogueNodes.filter((node) => node.studyId === study.studyId);
      const isolated = placeStudyArchipelago(own, () => 0, study.studyId);
      const inCatalogue = placeStudyArchipelago(catalogueNodes, () => 0, study.studyId);
      const signature = (world: ReturnType<typeof placeStudyArchipelago>) =>
        world.placements.map((entry) => ({
          studyId: entry.node.studyId,
          courseId: entry.node.courseId,
          position: entry.position.toArray(),
          radius: entry.radius,
          state: entry.state,
        }));

      expect(inCatalogue.placements).toHaveLength(study.courses.length);
      expect(new Set(inCatalogue.placements.map((entry) => entry.node.courseId))).toEqual(
        new Set(study.courses.map((course) => course.courseId)),
      );
      expect(signature(inCatalogue)).toEqual(signature(isolated));
      expect(inCatalogue.extent).toBe(isolated.extent);
      expect(Number.isFinite(inCatalogue.extent)).toBe(true);
      for (const entry of inCatalogue.placements) {
        expect(Math.hypot(entry.position.x, entry.position.z) + entry.radius).toBeLessThanOrEqual(
          inCatalogue.extent,
        );
      }
    },
  );
});
