import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { ISLAND_TREE_TRIANGLE_CEILING } from "./island-technique-lock.js";
import {
  COURSE_BUSH_CROWN_DETAIL,
  COURSE_BUSH_CROWN_TRIANGLES,
  COURSE_BUSH_CROWN_TRIANGLES_PER_LOBE,
  COURSE_CROWN_LOBES_PER_BUSH,
  COURSE_CROWN_LOBES_PER_TREE,
  COURSE_TREE_CROWN_DETAIL,
  COURSE_TREE_CROWN_TRIANGLES,
  COURSE_TREE_CROWN_TRIANGLES_PER_LOBE,
  COURSE_TREE_TOTAL_TRIANGLE_CEILING,
  COURSE_TREE_TRUNK_TRIANGLE_CEILING,
  bushCrownLobes,
  createSmoothIcosahedron,
  crownUnionBox,
  icosahedronTriangleCount,
  treeCrownLobes,
  type FoliagePlacement,
} from "./foliage-geometry.js";

const here = dirname(fileURLToPath(import.meta.url));

function unitTree(): FoliagePlacement {
  return { position: { x: 2, y: 1, z: -3 }, height: 1.4, turn: 0.35 };
}

function normalsAreUnit(geometry: THREE.BufferGeometry): void {
  const normal = geometry.getAttribute("normal");
  expect(normal).toBeDefined();
  expect(normal.count).toBeGreaterThan(0);
  for (let index = 0; index < normal.count; index += 1) {
    const length = Math.hypot(normal.getX(index), normal.getY(index), normal.getZ(index));
    expect(Number.isFinite(length), `normal ${index}`).toBe(true);
    expect(length, `normal ${index}`).toBeGreaterThan(0.98);
    expect(length, `normal ${index}`).toBeLessThan(1.02);
  }
}

describe("course crown geometry budgets", () => {
  it("emits the measured icosahedron triangle counts", () => {
    expect(icosahedronTriangleCount(COURSE_TREE_CROWN_DETAIL)).toBe(
      COURSE_TREE_CROWN_TRIANGLES_PER_LOBE,
    );
    expect(icosahedronTriangleCount(COURSE_BUSH_CROWN_DETAIL)).toBe(
      COURSE_BUSH_CROWN_TRIANGLES_PER_LOBE,
    );
    expect(COURSE_CROWN_LOBES_PER_TREE * COURSE_TREE_CROWN_TRIANGLES_PER_LOBE).toBe(
      COURSE_TREE_CROWN_TRIANGLES,
    );
    expect(COURSE_CROWN_LOBES_PER_BUSH * COURSE_BUSH_CROWN_TRIANGLES_PER_LOBE).toBe(
      COURSE_BUSH_CROWN_TRIANGLES,
    );
    expect(COURSE_TREE_TRUNK_TRIANGLE_CEILING + COURSE_TREE_CROWN_TRIANGLES).toBe(
      COURSE_TREE_TOTAL_TRIANGLE_CEILING,
    );
    expect(COURSE_TREE_TOTAL_TRIANGLE_CEILING).toBeLessThanOrEqual(ISLAND_TREE_TRIANGLE_CEILING);
  });

  it("welds vertices so course crown normals are finite and smooth", () => {
    const tree = createSmoothIcosahedron(COURSE_TREE_CROWN_DETAIL);
    const bush = createSmoothIcosahedron(COURSE_BUSH_CROWN_DETAIL);
    expect(tree.getIndex()?.count).toBe(COURSE_TREE_CROWN_TRIANGLES_PER_LOBE * 3);
    expect(bush.getIndex()?.count).toBe(COURSE_BUSH_CROWN_TRIANGLES_PER_LOBE * 3);
    // Welded without split UV seams: detail 1 has 42 vertices, detail 0 has 12 vertices
    expect(tree.getAttribute("position")?.count).toBe(42);
    expect(bush.getAttribute("position")?.count).toBe(12);
    normalsAreUnit(tree);
    normalsAreUnit(bush);
    tree.dispose();
    bush.dispose();
  });
});

describe("crown lobe transforms", () => {
  it("is deterministic and keeps tree proportions under the placement height", () => {
    const placement = unitTree();
    const first = treeCrownLobes(placement);
    const second = treeCrownLobes(placement);
    expect(first).toHaveLength(COURSE_CROWN_LOBES_PER_TREE);
    expect(second.map((lobe) => lobe.position.toArray())).toEqual(
      first.map((lobe) => lobe.position.toArray()),
    );
    const box = crownUnionBox(first);
    const height = placement.height;
    expect(box.max.y).toBeLessThanOrEqual(placement.position.y + height * 1.12);
    expect(box.min.y).toBeGreaterThan(placement.position.y + height * 0.12);
    const radius = Math.max(
      Math.abs(box.max.x - placement.position.x),
      Math.abs(box.min.x - placement.position.x),
      Math.abs(box.max.z - placement.position.z),
      Math.abs(box.min.z - placement.position.z),
    );
    expect(radius).toBeLessThanOrEqual(height * 0.55);
  });

  it("buries a compact bush silhouette that still matches plan.height", () => {
    const placement = unitTree();
    const lobes = bushCrownLobes(placement);
    expect(lobes).toHaveLength(COURSE_CROWN_LOBES_PER_BUSH);
    const box = crownUnionBox(lobes);
    expect(box.min.y).toBeLessThan(placement.position.y);
    expect(box.max.y).toBeLessThanOrEqual(placement.position.y + placement.height * 1.05);
    const radius = Math.max(
      Math.abs(box.max.x - placement.position.x),
      Math.abs(box.min.x - placement.position.x),
      Math.abs(box.max.z - placement.position.z),
      Math.abs(box.min.z - placement.position.z),
    );
    expect(radius).toBeLessThanOrEqual(placement.height * 0.7);
    const visualHeight = box.max.y - placement.position.y;
    expect(visualHeight).toBeGreaterThan(placement.height * 0.7);
  });
});

describe("world foliage source", () => {
  it("keeps the donor trunk silhouette and 12-triangle canopy, with no course cards or emitter", () => {
    const source = readFileSync(resolve(here, "island-foliage-render.tsx"), "utf8");
    expect(source).toMatch(/normalizedTrunkVariants\(tree\.scene, 1\)/);
    expect(source).toMatch(/new THREE\.ConeGeometry\(0\.42, 0\.7, 6\)/);
    expect(source).toMatch(/islandLookWorldTreeSilhouetteTriangles: 12/);
    expect(source).not.toMatch(/MeshSurfaceSampler/);
    expect(source).not.toMatch(/LEAF_MASK/);
    expect(source).not.toMatch(/ShaderMaterial/);
    expect(source).not.toMatch(/useIslandGLTF\(BUSH_SRC\)/);
    expect(source).not.toMatch(/bushEmitter\.glb/);
    expect(source).not.toMatch(/SCRATCH\//);
  });
});
