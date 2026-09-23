import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { islandBlueprint } from "./island-blueprint.js";
import { buildIslandGeometry } from "./island-geometry.js";
import { buildCoastLip, COAST_LIP_TRIANGLE_CEILING } from "./course-coast-lip.js";

describe("course coast lip", () => {
  for (const lessonCount of [4, 8, 36]) {
    it(`rolls over the rendered edge of a ${lessonCount}-lesson island and stays in budget`, () => {
      const blueprint = islandBlueprint({
        studyId: "s",
        courseId: `lip-${lessonCount}`,
        lessonCount,
      });
      const shape = buildIslandGeometry(blueprint, "course");
      const lip = buildCoastLip(shape.terrain, blueprint.seed);
      expect(lip).not.toBeNull();
      const triangles = lip!.getIndex()!.count / 3;
      expect(triangles).toBeLessThanOrEqual(COAST_LIP_TRIANGLE_CEILING);
      // It starts on the meadow's own last ring, never above it.
      const ring = shape.terrain.userData.cliffTopology.ringIndices[0] as number[];
      const position = shape.terrain.getAttribute("position");
      const topOfEdge = Math.max(...ring.map((i) => position.getY(i)));
      lip!.computeBoundingBox();
      expect(lip!.boundingBox!.max.y).toBeLessThanOrEqual(topOfEdge + 1e-6);
      for (const name of ["position", "color", "normal"])
        expect(lip!.getAttribute(name), name).toBeDefined();
      expect(new THREE.Box3().copy(lip!.boundingBox!).isEmpty()).toBe(false);
      lip!.dispose();
      shape.terrain.dispose();
    });
  }

  it("is the same coast every time: no random state", () => {
    const blueprint = islandBlueprint({ studyId: "s", courseId: "lip-same", lessonCount: 12 });
    const a = buildIslandGeometry(blueprint, "course");
    const b = buildIslandGeometry(blueprint, "course");
    const lipA = buildCoastLip(a.terrain, blueprint.seed)!;
    const lipB = buildCoastLip(b.terrain, blueprint.seed)!;
    expect(Array.from(lipA.getAttribute("position").array)).toEqual(
      Array.from(lipB.getAttribute("position").array),
    );
    for (const g of [lipA, lipB, a.terrain, b.terrain]) g.dispose();
  });
});
