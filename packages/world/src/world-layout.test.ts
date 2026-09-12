import { describe, expect, it } from "vitest";
import { radiusForLessons, WORLD_ISLAND_SEPARATION_GAP } from "./course/layout.js";
import { layoutWorldArchipelago, type WorldLayoutIsland } from "./world-layout.js";

function fixture(count: number, seed: string, sizes: readonly number[]): WorldLayoutIsland[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `${seed}/course-${index}`,
    studyId: seed,
    radius: radiusForLessons(sizes[index % sizes.length]!) * 1.2,
  }));
}

describe("ordered archipelago shoals", () => {
  it.each([0, 1, 2, 3, 6, 7, 8, 20, 31, 53])(
    "packs %i entries without orphan tails, fused silhouettes or a lost course",
    (count) => {
      for (const seed of ["shoal-a", "shoal-b", "shoal-c"]) {
        for (const sizes of [[1], [12], [3, 6, 24, 41, 80]]) {
          const input = fixture(count, seed, sizes);
          const original = structuredClone(input);
          const layout = layoutWorldArchipelago(input);
          expect(layout).toEqual(layoutWorldArchipelago(input));
          expect(input).toEqual(original);
          expect([...layout.positions.keys()]).toEqual(input.map((entry) => entry.key));
          expect(layout.groups.flatMap((group) => group.keys)).toEqual(
            input.map((entry) => entry.key),
          );
          expect(Number.isFinite(layout.extent)).toBe(true);
          for (const group of layout.groups) {
            expect(group.keys.length).toBeGreaterThanOrEqual(Math.min(count, 3));
            expect(group.keys.length).toBeLessThanOrEqual(6);
            const members = group.keys.map((key) => input.find((entry) => entry.key === key)!);
            const anchor = members.find((entry) => entry.key === group.anchorKey)!;
            expect(anchor.radius).toBe(Math.max(...members.map((entry) => entry.radius)));
            // A group needs a geometric neighbour graph, not just shared metadata.
            const reached = new Set([anchor.key]);
            for (let pass = 0; pass < members.length; pass += 1) {
              for (const entry of members) {
                for (const peer of members.filter((other) => reached.has(other.key))) {
                  const a = layout.positions.get(entry.key)!;
                  const b = layout.positions.get(peer.key)!;
                  if (Math.hypot(a.x - b.x, a.z - b.z) - entry.radius - peer.radius <= 3.5) {
                    reached.add(entry.key);
                  }
                }
              }
            }
            expect(reached.size, `${seed}, sizes=${sizes}, group=${group.keys}`).toBe(
              members.length,
            );
          }
          for (const [index, entry] of input.entries()) {
            const a = layout.positions.get(entry.key)!;
            expect([a.x, a.y, a.z].every(Number.isFinite)).toBe(true);
            if (index === 0) expect([a.x, a.y, a.z]).toEqual([0, 0, 0]);
            expect(Math.hypot(a.x, a.z) + entry.radius).toBeLessThan(layout.extent);
            const group = layout.groups.find((item) => item.keys.includes(entry.key))!;
            for (const peer of input.slice(index + 1)) {
              const b = layout.positions.get(peer.key)!;
              const minimum = (entry.radius + peer.radius) * WORLD_ISLAND_SEPARATION_GAP;
              expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(minimum - 1e-6);
              // Preserve a foreshortened near-view hit/caption corridor too.
              expect(Math.hypot(a.x - b.x, (a.z - b.z) * Math.sqrt(0.35))).toBeGreaterThanOrEqual(
                3.5 - 1e-6,
              );
              if (!group.keys.includes(peer.key)) {
                expect(Math.hypot(a.x - b.x, a.z - b.z) - minimum).toBeGreaterThanOrEqual(
                  5.2 - 1e-6,
                );
              } else {
                const near = a.z >= b.z ? entry : peer;
                const far = a.z >= b.z ? peer : entry;
                if (far.radius >= near.radius * 1.25) {
                  const side = Math.abs(a.x - b.x - (a.z - b.z) * 0.16);
                  const down = Math.abs(a.z - b.z) * 0.59;
                  expect(
                    side >= far.radius * 0.5 + near.radius * 0.7 + 0.45 - 1e-6 ||
                      down >= far.radius * 1.35 * 0.81 + near.radius * 0.75 + 0.9 - 1e-6,
                    `${entry.key}/${peer.key}: a large rear root must leave the foreground miniature legible`,
                  ).toBe(true);
                }
              }
            }
          }
        }
      }
    },
  );

  it("never groups the end of one real study with the beginning of another", () => {
    const input = [
      ...fixture(7, "alpha", [41, 12]),
      ...fixture(2, "beta", [6]),
      ...fixture(1, "gamma", [3]),
    ];
    const layout = layoutWorldArchipelago(input);
    for (const group of layout.groups) {
      expect(
        new Set(group.keys.map((key) => input.find((entry) => entry.key === key)!.studyId)).size,
      ).toBe(1);
    }
  });

  it("varies the open fans and keeps a broad directional composition, not repeated rings or a grid", () => {
    const input = fixture(31, "directional", [12]);
    const layout = layoutWorldArchipelago(input);
    const points = [...layout.positions.values()];
    expect(new Set(points.map((point) => Math.round(point.x * 2))).size).toBeGreaterThan(
      input.length * 0.4,
    );
    expect(new Set(points.map((point) => Math.round(point.z * 2))).size).toBeGreaterThan(
      input.length * 0.4,
    );
    const anchors = layout.groups.map((group) => layout.positions.get(group.anchorKey)!);
    const radialBands = new Set(
      anchors.map((point) => Math.round(Math.hypot(point.x, point.z) / 3)),
    );
    expect(radialBands.size).toBeGreaterThan(3);
    const meanX = anchors.reduce((sum, point) => sum + point.x, 0) / anchors.length;
    const meanZ = anchors.reduce((sum, point) => sum + point.z, 0) / anchors.length;
    const covariance = anchors.reduce(
      (sum, point) => sum + (point.x - meanX) * (point.z - meanZ),
      0,
    );
    const varianceX = anchors.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
    const varianceZ = anchors.reduce((sum, point) => sum + (point.z - meanZ) ** 2, 0);
    expect(covariance / Math.sqrt(varianceX * varianceZ)).toBeGreaterThan(0.2);
  });
});
