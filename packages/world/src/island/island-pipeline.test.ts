import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * ADR-0009 says the procedural map is one pipeline: a blueprint compiles into
 * one field, and everything that needs to know what the ground is like reads
 * that field. It exists because three systems were each rolling their own
 * random field, and the measured correlation between where the ground was
 * painted green and where grass actually grew was r = 0.31 across 7,949
 * in-island sample points. A third of the island had the two disagreeing.
 *
 * A document does not stop that from happening again; a failing test does.
 * These are structural assertions, deliberately coarse: they cannot prove a
 * module reads the field correctly, only that it has not quietly grown a
 * second opinion. When one of them fails, the fix is to read the field — or,
 * if there is a real reason not to, to amend ADR-0009 with it.
 */

const ISLAND_DIR = fileURLToPath(new URL(".", import.meta.url));

function sourceOf(file: string): string {
  return readFileSync(join(ISLAND_DIR, file), "utf8");
}

function islandSources(): readonly string[] {
  return readdirSync(ISLAND_DIR).filter(
    (name) =>
      (name.endsWith(".ts") || name.endsWith(".tsx")) &&
      !name.endsWith(".test.ts") &&
      !name.endsWith(".test.tsx"),
  );
}

describe("ADR-0009: the procedural map is one pipeline", () => {
  /**
   * Stage 2 is load-bearing. These are the systems that place or colour things
   * on the island's surface, and each one has to get its answer from the field
   * rather than from its own noise.
   */
  it("keeps every surface consumer reading the compiled field", () => {
    for (const consumer of ["island-grass.ts", "island-dressing.ts", "island-geometry.ts"]) {
      expect(sourceOf(consumer), `${consumer} must read the shared field`).toContain(
        "./island-field.js",
      );
    }
  });

  /**
   * The field is compiled from the canonical continuous sampler, not from a
   * mesh. If it ever starts reading geometry, the three projections stop being
   * projections of the same thing.
   */
  it("compiles the field from the blueprint's sampler, not from a terrain mesh", () => {
    const field = sourceOf("island-field.ts");
    expect(field).toContain("./island-blueprint.js");
    expect(field).not.toMatch(/BufferGeometry|THREE\./);
  });

  /**
   * The second-opinion tripwire. `random.ts` owns the seeded stream and
   * `island-field.ts` owns the raster; a *new* module that grows its own
   * value-noise lattice is stage-2 drift, which is exactly what produced the
   * r = 0.31. Named exceptions carry their reason here rather than in a
   * reviewer's memory.
   */
  it("keeps the noise field in one place", () => {
    const allowed = new Set([
      // Owns the compiled field itself.
      "island-field.ts",
      // Owns the seeded stream every other module draws from.
      "random.ts",
      // Perturbs the authored *outline*, which is stage 1 shape, not stage 2
      // surface. The outline is what the field is compiled from.
      "island-blueprint.ts",
      // Reads the field for placement, and keeps a cached ground-normal raster
      // for the blade's terrain-normal replacement. That raster is derived
      // from the canonical sampler, not a second opinion about the surface.
      "island-grass.ts",
    ]);
    const offenders = islandSources().filter((name) => {
      if (allowed.has(name)) return false;
      return /function\s+(valueNoise|lattice|noise2|fbm)\b/.test(sourceOf(name));
    });
    expect(offenders, "these modules grew their own noise field").toEqual([]);
  });

  /**
   * Stage 3: budget is spent by screen pixels, not world size. The world
   * projection draws an entire island inside roughly forty pixels, so grass
   * there is not a tuning choice — it is a category error. This pins the
   * decision that killed the 569-line underside chassis too.
   */
  it("spends no grass budget at the projection that cannot show it", async () => {
    const { ISLAND_GRASS_LIMITS } = await import("./island-grass.js");
    expect(ISLAND_GRASS_LIMITS.world.desktop).toBe(0);
    expect(ISLAND_GRASS_LIMITS.world.mobile).toBe(0);
  });
});
