import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ISLAND_COURSE_TERRAIN_TRIANGLES,
  ISLAND_DECORATION_TRIANGLE_CEILING,
  ISLAND_GRASS_BLADE_TRIANGLE_CEILING,
  ISLAND_LANDMARK_MAX_PER_ISLAND,
  ISLAND_LANDMARK_TRIANGLE_CEILING,
  ISLAND_TECHNIQUE_LOCK,
  REMOTE_ISLAND_MAX_BUDGET,
  REMOTE_ISLAND_TERRAIN_TRIANGLES,
  REMOTE_PAVILION_TRIANGLES,
  REMOTE_PROPS_MAX_TRIANGLES_PER_ISLAND,
  REMOTE_TREE_MAX_PER_ISLAND,
  REMOTE_TREE_TRIANGLES,
} from "./island-technique-lock.js";
import { islandBlueprint } from "./island-blueprint.js";
import { buildIslandGeometry } from "./island-geometry.js";
import { createIslandGrassClumpGeometry } from "./island-grass-render.js";
import {
  COURSE_BUSH_CROWN_DETAIL,
  COURSE_TREE_CROWN_DETAIL,
  createSmoothIcosahedron,
} from "./foliage-geometry.js";
import { createRemotePavilionGeometry, createRemoteTreeGeometry } from "./remote-props.js";

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
    meshes?: {
      primitives?: { indices?: number; attributes?: Record<string, number> }[];
    }[];
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

  it("holds course terrain mesh triangles still until the ADR is amended", () => {
    expect(ISLAND_TECHNIQUE_LOCK.terrain.budget).toContain("15234");
    for (const lessonCount of [6, 12, 24, 41] as const) {
      const blueprint = islandBlueprint({
        studyId: "turing-pact",
        courseId: `terrain-${lessonCount}`,
        lessonCount,
        seed: `terrain/${lessonCount}`,
      });
      const shape = buildIslandGeometry(blueprint, "course");
      const index = shape.terrain.getIndex();
      if (!index) throw new Error("expected an indexed course terrain mesh");
      expect(index.count / 3, `${lessonCount}`).toBe(ISLAND_COURSE_TERRAIN_TRIANGLES[lessonCount]);
      shape.terrain.dispose();
    }
  });

  it("holds the grass geometry's triangle count still until the ADR is amended", () => {
    /*
     * 1, since the 2026-08-28 rewrite: the five-leaf clump was 45 and the
     * tripwire fired on the merge exactly as intended, so ADR-0008 carries the
     * amendment and the new measurement. Any future change to this number has
     * to arrive the same way — a fresh measurement in the ADR, not a diff
     * nobody reviewed.
     */
    expect(trianglesOf(createIslandGrassClumpGeometry())).toBe(1);
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
    const root = resolve(import.meta.dirname, "../../../../apps/university/public/kenney/r01");
    const models = walkGlb(root);
    expect(models.length).toBeGreaterThan(0);
    for (const model of models) {
      expect(glbTriangles(model), model).toBeLessThanOrEqual(ISLAND_DECORATION_TRIANGLE_CEILING);
    }
  });

  it("pins the solid foliage technique and helper geometry triangle counts", () => {
    expect(ISLAND_TECHNIQUE_LOCK.tree.technique).toContain("treeTrunks.glb");
    expect(ISLAND_TECHNIQUE_LOCK.tree.technique).toContain("IcosahedronGeometry(1,1)");
    expect(ISLAND_TECHNIQUE_LOCK.tree.technique).toContain("course-only");
    expect(ISLAND_TECHNIQUE_LOCK.tree.technique).toContain("RemotePropsField");
    expect(ISLAND_TECHNIQUE_LOCK.tree.technique).toContain("12-triangle cone trees");
    expect(ISLAND_TECHNIQUE_LOCK.tree.technique).not.toContain("callable");
    expect(ISLAND_TECHNIQUE_LOCK.tree.technique).not.toContain('detail="world"');
    expect(ISLAND_TECHNIQUE_LOCK.tree.budget).toContain("624 tris/tree");
    expect(ISLAND_TECHNIQUE_LOCK.tree.budget).toContain("12 tris/tree");
    expect(ISLAND_TECHNIQUE_LOCK.tree.budget).toContain("0 course GLBs");
    expect(ISLAND_TECHNIQUE_LOCK.tree.budget).not.toContain("396");
    expect(
      ISLAND_TECHNIQUE_LOCK.tree.rejected.some((rejection) =>
        rejection.option.includes("IslandDressing(detail=world)"),
      ),
    ).toBe(true);

    expect(ISLAND_TECHNIQUE_LOCK.bush.technique).toContain("IcosahedronGeometry(1,0)");
    expect(ISLAND_TECHNIQUE_LOCK.bush.technique).toContain("no bushEmitter sampling");
    expect(ISLAND_TECHNIQUE_LOCK.bush.budget).toContain("60 tris/bush");

    const treeLobe = createSmoothIcosahedron(COURSE_TREE_CROWN_DETAIL);
    expect(trianglesOf(treeLobe)).toBe(80);
    treeLobe.dispose();

    const bushLobe = createSmoothIcosahedron(COURSE_BUSH_CROWN_DETAIL);
    expect(trianglesOf(bushLobe)).toBe(20);
    bushLobe.dispose();

    expect(
      ISLAND_TECHNIQUE_LOCK.decoration.rejected.some((rejection) =>
        rejection.option.includes("elemental-serenity rocks.glb"),
      ),
    ).toBe(true);
  });

  it("pins remote catalogue projection geometry and budget constants", () => {
    // 640-triangle continuous shared terrain
    expect(ISLAND_TECHNIQUE_LOCK.terrain.technique).toContain("640-triangle terrain mesh");
    expect(ISLAND_TECHNIQUE_LOCK.terrain.budget).toContain("640 triangles/island");
    const bp = islandBlueprint({
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      lessonCount: 41,
    });
    const worldShape = buildIslandGeometry(bp, "world");
    expect(trianglesOf(worldShape.terrain)).toBe(REMOTE_ISLAND_TERRAIN_TRIANGLES);
    worldShape.terrain.dispose();

    // 12-triangle procedural cone tree silhouette (0 course GLBs)
    const treeGeom = createRemoteTreeGeometry();
    expect(trianglesOf(treeGeom)).toBe(REMOTE_TREE_TRIANGLES);
    treeGeom.dispose();

    // 36-triangle procedural stone pavilion silhouette (12 roof + 24 base, 0 course GLBs)
    const pavilionGeom = createRemotePavilionGeometry();
    expect(trianglesOf(pavilionGeom)).toBe(REMOTE_PAVILION_TRIANGLES);
    pavilionGeom.dispose();

    expect(ISLAND_TECHNIQUE_LOCK.landmark.technique).toContain("RemotePropsField");
    expect(ISLAND_TECHNIQUE_LOCK.landmark.technique).toContain(
      "36-triangle stone pavilion silhouette",
    );
    expect(ISLAND_TECHNIQUE_LOCK.landmark.budget).toContain("36 tris/island");
    expect(ISLAND_TECHNIQUE_LOCK.landmark.budget).toContain("0 course GLBs");

    // Remote props and island max budgets match exact arithmetic
    expect(REMOTE_PROPS_MAX_TRIANGLES_PER_ISLAND).toBe(
      REMOTE_PAVILION_TRIANGLES + REMOTE_TREE_MAX_PER_ISLAND * REMOTE_TREE_TRIANGLES,
    );
    expect(REMOTE_PROPS_MAX_TRIANGLES_PER_ISLAND).toBe(84);
    expect(REMOTE_ISLAND_MAX_BUDGET).toBe(
      REMOTE_ISLAND_TERRAIN_TRIANGLES + REMOTE_PROPS_MAX_TRIANGLES_PER_ISLAND,
    );
    expect(REMOTE_ISLAND_MAX_BUDGET).toBe(724);

    // Technique strings explicitly state truthful scoping and bounding
    expect(ISLAND_TECHNIQUE_LOCK.tree.technique).toContain(
      "props are optional on failed bounded fit",
    );
    expect(ISLAND_TECHNIQUE_LOCK.tree.technique).toContain("no blanket zero-floating promise");
    expect(ISLAND_TECHNIQUE_LOCK.tree.budget).toContain("not whole frame");
    expect(ISLAND_TECHNIQUE_LOCK.terrain.budget).toContain("not whole frame");
    expect(ISLAND_TECHNIQUE_LOCK.landmark.technique).toContain(
      "props are optional on failed bounded fit",
    );
    expect(ISLAND_TECHNIQUE_LOCK.landmark.technique).toContain("no blanket zero-floating promise");
    expect(ISLAND_TECHNIQUE_LOCK.domainPlanet.budget).toContain("5000");
    expect(ISLAND_TECHNIQUE_LOCK.domainPlanet.budget).toContain("7000");
    expect(ISLAND_TECHNIQUE_LOCK.domainPlanet.budget).toContain("8 draws/domain");
    expect(ISLAND_TECHNIQUE_LOCK.domainPlanet.technique).toContain("7 clusters");
    expect(ISLAND_TECHNIQUE_LOCK.domainPlanet.technique).toContain("0.55");
    expect(ISLAND_TECHNIQUE_LOCK.domainPlanet.technique).toContain("no early self-proof");
    expect(ISLAND_TECHNIQUE_LOCK.domainPlanet.budget).toContain("VRAM unmeasured");
  });

  it("keeps production distant draws off course dressing and foliage GLBs", () => {
    const maps = readFileSync(resolve(import.meta.dirname, "../Maps.tsx"), "utf8");
    expect(maps).toMatch(/<RemoteIslandField/);
    expect(maps).toMatch(/placeStudyArchipelago/);
    expect(maps).toMatch(/detail="course"/);
    expect(maps).not.toMatch(/detail=["']world["']/);

    const dressingRender = readFileSync(
      resolve(import.meta.dirname, "island-dressing-render.tsx"),
      "utf8",
    );
    expect(dressingRender).toMatch(/readonly detail: "course"/);
    expect(dressingRender).not.toMatch(/detail:\s*"world"/);

    const foliage = readFileSync(resolve(import.meta.dirname, "island-foliage-render.tsx"), "utf8");
    expect(foliage).not.toMatch(/WorldTreeSilhouette/);
    expect(foliage).not.toMatch(/detail === "world"/);
    expect(foliage).toMatch(/never loads donor trunks/);

    const remoteRender = readFileSync(
      resolve(import.meta.dirname, "remote-island-render.tsx"),
      "utf8",
    );
    expect(remoteRender).not.toMatch(/island-dressing-render/);
    expect(remoteRender).not.toMatch(/island-foliage-render/);
    expect(remoteRender).toMatch(/RemotePropsField/);

    const remoteProps = readFileSync(resolve(import.meta.dirname, "remote-props.ts"), "utf8");
    expect(remoteProps).not.toMatch(/island-dressing-render/);
    expect(remoteProps).not.toMatch(/\.glb/);
    expect(remoteProps).toMatch(/REMOTE_ISLAND_TERRAIN_TRIANGLES = 640/);
    expect(remoteProps).toMatch(/REMOTE_PROPS_MAX_TRIANGLES_PER_ISLAND/);

    const clouds = readFileSync(
      resolve(import.meta.dirname, "../planet/globe-geometry.ts"),
      "utf8",
    );
    expect(clouds).toMatch(/DOMAIN_GLOBE_TRIANGLES_MAX = 5000/);
    expect(clouds).toMatch(/DOMAIN_CLOUD_TRIANGLES_MAX = 7000/);
    expect(clouds).toMatch(/const clusterCount = 7/);
    expect(clouds).toMatch(/makeScale\(1\.4, 0\.55, 0\.9\)/);

    const regions = readFileSync(
      resolve(import.meta.dirname, "../planet/atmospheric-regions.ts"),
      "utf8",
    );
    expect(regions).toMatch(/viewportWidth < 768 \? 3 : 5/);

    const camera = readFileSync(resolve(import.meta.dirname, "../camera/controls.tsx"), "utf8");
    expect(camera).toMatch(/export const COURSE_DISTANCE = 36/);

    expect(ISLAND_TECHNIQUE_LOCK.tree.technique).not.toMatch(/IslandDressing \/ IslandFoliage/);
  });
});
