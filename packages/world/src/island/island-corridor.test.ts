import { describe, expect, it } from "vitest";
import {
  islandGeometryBlueprint,
  projectIslandBlueprint,
  routeDistanceAt,
  type IslandGeometryBlueprint,
} from "./island-blueprint.js";

/** Independent four-cell reference: no internal cache/planner imports. */
function referenceDistance(bp: IslandGeometryBlueprint, x: number, z: number) {
  const cell = 1.2;
  const spanX = bp.bounds.halfX * 1.08,
    spanZ = bp.bounds.halfZ * 1.08;
  const countX = Math.max(2, Math.ceil((spanX * 2) / cell) + 1);
  const countZ = Math.max(2, Math.ceil((spanZ * 2) / cell) + 1);
  const gx = Math.max(0, Math.min(countX - 1.0001, (x + spanX) / cell));
  const gz = Math.max(0, Math.min(countZ - 1.0001, (z + spanZ) / cell));
  const ix = Math.floor(gx),
    iz = Math.floor(gz);
  const samples = bp.centerline.filter((_, i) => i % 3 === 0).concat(bp.centerline.at(-1)!);
  const at = (cx: number, cz: number) =>
    Math.fround(
      Math.sqrt(
        Math.min(
          ...samples.map(
            (p) => (p.x - (-spanX + cx * cell)) ** 2 + (p.z - (-spanZ + cz * cell)) ** 2,
          ),
        ),
      ),
    );
  const a = at(ix, iz),
    b = at(ix + 1, iz),
    c = at(ix, iz + 1),
    d = at(ix + 1, iz + 1);
  const near = a + (b - a) * (gx - ix),
    far = c + (d - c) * (gx - ix);
  return near + (far - near) * (gz - iz);
}

describe("one unchanged corridor across explicit projections", () => {
  it.each([6, 24, 80])(
    "preserves the sampled field for %i lessons and semantic projections",
    (lessonCount) => {
      const geometry = islandGeometryBlueprint({
        studyId: "corridor-proof",
        courseId: `length-${lessonCount}`,
        lessonCount,
      });
      const first = projectIslandBlueprint(geometry);
      const second = projectIslandBlueprint(geometry, {
        lessonIds: Array.from({ length: lessonCount }, (_, i) => `renamed-${i}`),
      });
      const changed = {
        ...geometry,
        bounds: { ...geometry.bounds, halfX: geometry.bounds.halfX * 1.13 },
        centerline: geometry.centerline.map((p) => ({ ...p, x: p.x + 2.7, z: p.z - 1.4 })),
      };
      for (const bp of [geometry, first, second, changed]) {
        for (let ix = -4; ix <= 4; ix++)
          for (let iz = -4; iz <= 4; iz++) {
            const x = (ix * bp.bounds.halfX) / 3,
              z = (iz * bp.bounds.halfZ) / 3;
            expect(routeDistanceAt(bp, x, z)).toBe(referenceDistance(bp, x, z));
          }
      }
      // Changed bounds/route must not inherit a cache merely because IDs match.
      expect(routeDistanceAt(changed, 0, 0)).not.toBe(routeDistanceAt(geometry, 0, 0));
    },
  );
});
