import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ISLAND_DECORATION_TRIANGLE_CEILING,
  ISLAND_GRASS_BLADE_TRIANGLE_CEILING,
  ISLAND_LANDMARK_MAX_PER_ISLAND,
  ISLAND_LANDMARK_TRIANGLE_CEILING,
  ISLAND_TECHNIQUE_LOCK,
} from "./island-technique-lock.js";
import { createIslandGrassClumpGeometry } from "./island-grass-render.js";

/**
 * The gate ADR-0008 asks for.
 *
 * Two of these assertions look trivial and are not. The recorded grass triangle
 * count is a deliberate tripwire: any rewrite of the blade changes it, the test
 * fails, and whoever is holding the keyboard has to go and amend the ADR with a
 * measurement instead of landing a silent 45x cost. The Kenney ceiling is the
 * same idea pointed at the asset pipeline, where a single over-detailed import
 * would otherwise arrive unnoticed.
 */

function trianglesOf(geometry: { getIndex(): { count: number } | null }): number {
  const index = geometry.getIndex();
  if (!index) throw new Error("expected an indexed geometry");
  return index.count / 3;
}

function glbTriangles(path: string): number {
  const bytes = readFileSync(path);
  if (bytes.subarray(0, 4).toString("utf8") !== "glTF") return 0;
  const jsonLength = bytes.readUInt32LE(12);
  const doc = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8")) as {
    accessors?: { count: number }[];
    meshes?: { primitives?: { indices?: number; attributes?: Record<string, number> }[] }[];
  };
  const accessors = doc.accessors ?? [];
  let triangles = 0;
  for (const mesh of doc.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      if (primitive.indices !== undefined) {
        triangles += (accessors[primitive.indices]?.count ?? 0) / 3;
      } else if (primitive.attributes?.["POSITION"] !== undefined) {
        triangles += (accessors[primitive.attributes["POSITION"]]?.count ?? 0) / 3;
      }
    }
  }
  return triangles;
}

function walkGlb(root: string): string[] {
  const found: string[] = [];
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) visit(full);
      else if (entry.endsWith(".glb")) found.push(full);
    }
  };
  visit(root);
  return found;
}

describe("Island technique lock", () => {
  it("records a source, a budget and dated evidence for every locked element", () => {
    const entries = Object.entries(ISLAND_TECHNIQUE_LOCK);
    expect(entries.length).toBeGreaterThan(0);
    for (const [name, entry] of entries) {
      expect(entry.technique.length, `${name} technique`).toBeGreaterThan(20);
      expect(entry.source.length, `${name} source`).toBeGreaterThan(5);
      expect(entry.budget.length, `${name} budget`).toBeGreaterThan(3);
      for (const rejection of entry.rejected) {
        // A rejection without a measurement is an opinion, and an opinion does
        // not survive the next session. ADR-0008 exists because those did not.
        expect(rejection.why.length, `${name} rejection reason`).toBeGreaterThan(40);
        expect(rejection.on, `${name} rejection date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("keeps the grass blade ceilings ordered by how close the learner stands", () => {
    expect(ISLAND_GRASS_BLADE_TRIANGLE_CEILING.near).toBeGreaterThan(
      ISLAND_GRASS_BLADE_TRIANGLE_CEILING.mid,
    );
    expect(ISLAND_GRASS_BLADE_TRIANGLE_CEILING.mid).toBeGreaterThan(
      ISLAND_GRASS_BLADE_TRIANGLE_CEILING.far,
    );
    expect(ISLAND_GRASS_BLADE_TRIANGLE_CEILING.far).toBe(0);
  });

  it("holds the grass geometry's triangle count still until the ADR is amended", () => {
    /*
     * 45 is the pre-ADR five-leaf clump, and it is over budget on purpose: the
     * lock is being introduced ahead of the rewrite so the rewrite cannot land
     * silently. When the blade becomes a tapered strip this number changes, the
     * test fails, and the change has to arrive with an ADR-0008 amendment and a
     * measurement rather than as a diff nobody reviewed.
     */
    expect(trianglesOf(createIslandGrassClumpGeometry())).toBe(45);
  });

  it("keeps every donor landmark under the landmark ceiling", () => {
    /*
     * The donor media became usable on 2026-08-28. These are the props that give
     * the island a scale hierarchy, so they are allowed to be an order of
     * magnitude heavier than scattered decoration — but only because there are
     * at most six of them on an island, which is the number that actually bounds
     * the frame.
     */
    const root = resolve(
      import.meta.dirname,
      "../../../../apps/university/public/models/elemental-serenity",
    );
    const models = walkGlb(root);
    expect(models.length).toBeGreaterThan(0);
    for (const model of models) {
      expect(glbTriangles(model), model).toBeLessThanOrEqual(ISLAND_LANDMARK_TRIANGLE_CEILING);
    }
    const worst = Math.max(...models.map(glbTriangles));
    expect(worst * ISLAND_LANDMARK_MAX_PER_ISLAND).toBeLessThan(60_000);
  });

  it("keeps every shipped decoration mesh under the ceiling", () => {
    const root = resolve(
      import.meta.dirname,
      "../../../../apps/university/public/kenney/r01",
    );
    const models = walkGlb(root);
    expect(models.length).toBeGreaterThan(0);
    for (const model of models) {
      expect(glbTriangles(model), model).toBeLessThanOrEqual(
        ISLAND_DECORATION_TRIANGLE_CEILING,
      );
    }
  });
});
