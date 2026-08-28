import { writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { islandBlueprint, sampleIslandSurface } from "./island-blueprint.js";

function coverage(bp: ReturnType<typeof islandBlueprint>, ratio: number) {
  const { halfX, halfZ, maxHalf } = bp.bounds;
  const r = maxHalf * ratio;
  let inside = 0, toured = 0;
  const N = 90;
  for (let i = 0; i < N; i += 1) {
    for (let j = 0; j < N; j += 1) {
      const x = -halfX + (2 * halfX * i) / (N - 1);
      const z = -halfZ + (2 * halfZ * j) / (N - 1);
      if (!sampleIslandSurface(bp, x, z).inside) continue;
      inside += 1;
      let best = Infinity;
      for (const p of bp.centerline) {
        const d = (p.x - x) ** 2 + (p.z - z) ** 2;
        if (d < best) best = d;
      }
      if (Math.sqrt(best) <= r) toured += 1;
    }
  }
  return toured / Math.max(1, inside);
}

describe("probe", () => {
  it("reports route coverage", () => {
    const lines: string[] = [];
    for (const [study, course, n] of [
      ["turing-pact", "foundations-before-zero", 41],
      ["turing-pact", "c-b", 24],
      ["turing-pact", "c-c", 12],
      ["turing-pact", "c-d", 6],
    ] as const) {
      const bp = islandBlueprint({ studyId: study, courseId: course, lessonCount: n });
      const nx = bp.geometryNodes.map((n) => n.x);
      const nz = bp.geometryNodes.map((n) => n.z);
      const spanX = (Math.max(...nx) - Math.min(...nx)) / (2 * bp.bounds.halfX);
      const spanZ = (Math.max(...nz) - Math.min(...nz)) / (2 * bp.bounds.halfZ);
      const nodeCover = (() => {
        const { halfX, halfZ, maxHalf } = bp.bounds;
        const r = maxHalf * 0.28;
        let inside = 0, near = 0;
        const N = 80;
        for (let i = 0; i < N; i += 1) for (let j = 0; j < N; j += 1) {
          const x = -halfX + (2 * halfX * i) / (N - 1);
          const z = -halfZ + (2 * halfZ * j) / (N - 1);
          if (!sampleIslandSurface(bp, x, z).inside) continue;
          inside += 1;
          if (bp.geometryNodes.some((n) => Math.hypot(n.x - x, n.z - z) <= r)) near += 1;
        }
        return near / Math.max(1, inside);
      })();
      const len = bp.centerline.reduce((s, p, i) =>
        i === 0 ? 0 : s + Math.hypot(p.x - bp.centerline[i - 1]!.x, p.z - bp.centerline[i - 1]!.z), 0);
      lines.push(
        [`${course} n=${n} arch=${bp.route.archetype} halfX=${bp.bounds.halfX.toFixed(1)} halfZ=${bp.bounds.halfZ.toFixed(1)}`,
        `len=${len.toFixed(1)} lineCover=${coverage(bp, 0.22).toFixed(3)} nodeCover=${nodeCover.toFixed(3)} spanX=${spanX.toFixed(2)} spanZ=${spanZ.toFixed(2)}`].join(" "),
      );
    }
    writeFileSync("/tmp/route-probe.txt", lines.join("\n"));
  });
});
