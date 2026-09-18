import { describe, expect, it } from "vitest";
import { islandBlueprint } from "./island-blueprint.js";
import { buildIslandGeometry } from "./island-geometry.js";
import { islandThemeSelectionForCourse } from "./kenney-recipes.js";

describe("buildIslandGeometry in world detail", () => {
  it.each([6, 12, 24, 41, 80])(
    "measures CPU time and triangle counts for %i lessons in world mode",
    (lessonCount) => {
      const blueprint = islandBlueprint({
        studyId: "turing-pact",
        courseId: "foundations-before-zero",
        lessonCount,
        routeArchetype: "switchback",
        themeSelection: islandThemeSelectionForCourse("turing-pact", "foundations-before-zero"),
      });

      // Measure actual single run directly without 3-runs-best masking
      const singleStart = performance.now();
      const shape = buildIslandGeometry(blueprint, "world");
      const singleRunMs = performance.now() - singleStart;

      try {
        process.stdout.write(
          `\n[world-detail-measure] lessons=${lessonCount} singleRunMs=${singleRunMs.toFixed(3)}ms totalTris=${shape.counts.total} topTris=${shape.counts.topTriangles} routeTris=${shape.counts.routeTriangles} cliffTris=${shape.counts.cliffTriangles}\n`,
        );

        expect(shape.counts.routeTriangles).toBe(0);
        expect(shape.counts.total).toBeLessThanOrEqual(1600);
        expect(singleRunMs).toBeLessThan(30);
      } finally {
        shape.terrain.dispose();
      }
    },
  );
});

describe("50-island catalogue world detail generation", () => {
  it("measures actual CPU time and distribution for 50 distinct world islands", () => {
    const durations: number[] = [];
    const start = performance.now();
    const shapes = Array.from({ length: 50 }, (_, i) => {
      const bp = islandBlueprint({
        studyId: `study-${i % 5}`,
        courseId: `course-${i}`,
        lessonCount: 6 + (i % 30),
      });
      const t0 = performance.now();
      const s = buildIslandGeometry(bp, "world");
      durations.push(performance.now() - t0);
      return s;
    });
    const totalMs = performance.now() - start;

    const min = Math.min(...durations);
    const max = Math.max(...durations);
    const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
    const sorted = [...durations].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    const p90 = sorted[Math.floor(sorted.length * 0.9)]!;
    const p95 = sorted[Math.floor(sorted.length * 0.95)]!;

    process.stdout.write(
      `\n[50-islands-distribution] min=${min.toFixed(2)}ms max=${max.toFixed(2)}ms mean=${mean.toFixed(2)}ms median=${median.toFixed(2)}ms p90=${p90.toFixed(2)}ms p95=${p95.toFixed(2)}ms total=${totalMs.toFixed(2)}ms totalTris=${shapes.reduce((acc, s) => acc + s.counts.total, 0)}\n`,
    );

    for (const shape of shapes) {
      shape.terrain.dispose();
    }
    expect(totalMs).toBeLessThan(500); // 50 islands build in < 500ms total
  });
});
