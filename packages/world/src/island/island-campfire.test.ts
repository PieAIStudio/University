import * as THREE from "three";
import { describe, expect, it } from "vitest";

import type { IslandDressingPlacement } from "./island-dressing.js";
import {
  CAMP_RAW_BOUNDING_BOX,
  CAMP_REFERENCE_HEIGHT,
  CAMP_SCENE_TRANSFORMED_BOUNDS,
  CAMP_WOOD_RAW_BOUNDING_BOX,
  CAMP_WOOD_SCENE_TRANSFORMED_BOUNDS,
  CAMPFIRE_FLAME_HEIGHT,
  CAMPFIRE_FLAME_TRIANGLES,
  CAMPFIRE_FLAME_WIDTH,
  CAMPFIRE_NORMALIZED_ANCHOR,
  campfireFlameTransform,
  createCampfireFlameGeometry,
  createCampfireMaterial,
  deriveCampfireNormalizedAnchor,
  filterLitCampPlacements,
  isLitCampPlacement,
} from "./island-campfire.js";

function dummyPlacement(overrides: Partial<IslandDressingPlacement> = {}): IslandDressingPlacement {
  return {
    id: "placement-1",
    packId: "elemental-serenity",
    assetId: "camp",
    kind: "landmark",
    x: 10,
    y: 2,
    z: -15,
    turn: 0.5,
    height: 0.32,
    importance: 1,
    ...overrides,
  };
}

describe("Campfire state selection contract", () => {
  it("selects only elemental-serenity camp assets with state lit", () => {
    expect(isLitCampPlacement(dummyPlacement({ assetId: "camp", state: "lit" }))).toBe(true);

    // Reject alternate packs with same asset name
    expect(
      isLitCampPlacement(dummyPlacement({ packId: "nature-kit", assetId: "camp", state: "lit" })),
    ).toBe(false);
    expect(
      isLitCampPlacement(
        dummyPlacement({ packId: "fantasy-town-kit", assetId: "camp", state: "lit" }),
      ),
    ).toBe(false);

    // Idle camp has no flame
    expect(isLitCampPlacement(dummyPlacement({ assetId: "camp", state: "idle" }))).toBe(false);
    expect(isLitCampPlacement(dummyPlacement({ assetId: "camp", state: undefined }))).toBe(false);

    // Unrelated assets must never get flame even if state is somehow set
    expect(isLitCampPlacement(dummyPlacement({ assetId: "tent", state: "lit" }))).toBe(false);
    expect(isLitCampPlacement(dummyPlacement({ assetId: "rocks", state: "lit" }))).toBe(false);
    expect(isLitCampPlacement(dummyPlacement({ assetId: "bridge", state: "lit" }))).toBe(false);
    expect(isLitCampPlacement(dummyPlacement({ assetId: "treeTrunks", state: "lit" }))).toBe(false);
  });

  it("filters a mixed placement list to only lit campfires", () => {
    const placements: IslandDressingPlacement[] = [
      dummyPlacement({ id: "p1", assetId: "camp", state: "lit" }),
      dummyPlacement({ id: "p2", assetId: "camp", state: "idle" }),
      dummyPlacement({ id: "p3", packId: "nature-kit", assetId: "camp", state: "lit" }),
      dummyPlacement({ id: "p4", assetId: "tent", state: "lit" }),
      dummyPlacement({ id: "p5", assetId: "rocks" }),
      dummyPlacement({ id: "p6", assetId: "camp", state: "lit" }),
    ];
    const filtered = filterLitCampPlacements(placements);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((p) => p.id)).toEqual(["p1", "p6"]);
  });
});

describe("Campfire scale and anchor contract", () => {
  it("derives fire anchor from normalized camp.glb model geometry", () => {
    const derived = deriveCampfireNormalizedAnchor();
    expect(derived.x).toBeCloseTo(CAMPFIRE_NORMALIZED_ANCHOR.x, 5);
    expect(derived.y).toBeCloseTo(CAMPFIRE_NORMALIZED_ANCHOR.y, 5);
    expect(derived.z).toBeCloseTo(CAMPFIRE_NORMALIZED_ANCHOR.z, 5);

    // Normalized wood pit center relative to bounding box center and base
    expect(CAMPFIRE_NORMALIZED_ANCHOR.x).toBeGreaterThan(0.03);
    expect(CAMPFIRE_NORMALIZED_ANCHOR.x).toBeLessThan(0.05);
    expect(CAMPFIRE_NORMALIZED_ANCHOR.z).toBeGreaterThan(-0.02);
    expect(CAMPFIRE_NORMALIZED_ANCHOR.z).toBeLessThan(0.0);

    // Coal bed height is within the wood log vertical envelope (0.22 to 1.0)
    expect(CAMPFIRE_NORMALIZED_ANCHOR.y).toBeGreaterThan(0.6);
    expect(CAMPFIRE_NORMALIZED_ANCHOR.y).toBeLessThan(0.7);

    // Raw model dimensions sanity check (2.70 x 0.73 x 2.50)
    expect(CAMP_SCENE_TRANSFORMED_BOUNDS.size.x).toBeCloseTo(2.7, 1);
    expect(CAMP_SCENE_TRANSFORMED_BOUNDS.size.y).toBeCloseTo(0.73, 2);
    expect(CAMP_SCENE_TRANSFORMED_BOUNDS.size.z).toBeCloseTo(2.5, 1);

    // Wood pit bounds within total camp bounds
    expect(CAMP_WOOD_SCENE_TRANSFORMED_BOUNDS.size.x).toBeLessThan(
      CAMP_SCENE_TRANSFORMED_BOUNDS.size.x,
    );
    expect(CAMP_WOOD_SCENE_TRANSFORMED_BOUNDS.size.z).toBeLessThan(
      CAMP_SCENE_TRANSFORMED_BOUNDS.size.z,
    );
  });

  it("verifies matrix-aware glTF measurements against node-transformed scene bounds", () => {
    // Accessor 0 (Rocks) transformed by Node 0 matrix
    const a0_min = new THREE.Vector3(-3.1736729, -2.808712, -0.509893);
    const a0_max = new THREE.Vector3(3.1003899, 3.015656, 0.836373);
    const n0_t = new THREE.Vector3(-5.6266961, 0.0767696, -6.9719725);
    const n0_q = new THREE.Quaternion(-0.7071069, 0, 0, 0.7071066);
    const n0_s = new THREE.Vector3(0.4297005, 0.4297005, 0.4297005);
    const m0 = new THREE.Matrix4().compose(n0_t, n0_q, n0_s);
    const b0 = new THREE.Box3(a0_min, a0_max).applyMatrix4(m0);

    // Accessor 4 (Wood) transformed by Node 1 matrix
    const a1_min = new THREE.Vector3(-0.864386, -0.791158, -0.5024658);
    const a1_max = new THREE.Vector3(0.81271, 0.794104, 0.045118);
    const n1_t = new THREE.Vector3(-5.5876737, 0.5413535, -7.0230389);
    const n1_q = new THREE.Quaternion(-0.7071069, 0, 0, 0.7071066);
    const n1_s = new THREE.Vector3(1.0307534, 1.0307535, 1.0307535);
    const m1 = new THREE.Matrix4().compose(n1_t, n1_q, n1_s);
    const b1 = new THREE.Box3(a1_min, a1_max).applyMatrix4(m1);

    const sceneTotal = b0.clone().union(b1);

    // Authoritative check that recorded bounds match transformed glTF scene nodes
    expect(sceneTotal.min.x).toBeCloseTo(CAMP_RAW_BOUNDING_BOX.min.x, 3);
    expect(sceneTotal.min.y).toBeCloseTo(CAMP_RAW_BOUNDING_BOX.min.y, 3);
    expect(sceneTotal.min.z).toBeCloseTo(CAMP_RAW_BOUNDING_BOX.min.z, 3);
    expect(sceneTotal.max.x).toBeCloseTo(CAMP_RAW_BOUNDING_BOX.max.x, 3);
    expect(sceneTotal.max.y).toBeCloseTo(CAMP_RAW_BOUNDING_BOX.max.y, 3);
    expect(sceneTotal.max.z).toBeCloseTo(CAMP_RAW_BOUNDING_BOX.max.z, 3);

    expect(b1.min.x).toBeCloseTo(CAMP_WOOD_RAW_BOUNDING_BOX.min.x, 3);
    expect(b1.max.x).toBeCloseTo(CAMP_WOOD_RAW_BOUNDING_BOX.max.x, 3);
  });

  it("enforces modest flame dimensions (0.35m - 0.50m height, fitting pit footprint)", () => {
    expect(CAMPFIRE_FLAME_HEIGHT).toBeGreaterThanOrEqual(0.35);
    expect(CAMPFIRE_FLAME_HEIGHT).toBeLessThanOrEqual(0.5);

    // At height 0.32m, camp pit footprint is ~1.18m, inner wood pit is ~0.76m.
    // Flame width 0.26m is ~34% of inner wood pit diameter.
    expect(CAMPFIRE_FLAME_WIDTH).toBeLessThan(0.76 * 0.5);
    expect(CAMPFIRE_FLAME_WIDTH).toBeGreaterThan(0.15);
  });

  it("computes exact transformed geometry bounds, scaling with placement.height", () => {
    const geom = createCampfireFlameGeometry();

    // 1. Standard placement at reference camp height (0.32m)
    const placementStandard = dummyPlacement({
      x: 5,
      y: 1,
      z: 8,
      turn: Math.PI * 0.5,
      height: CAMP_REFERENCE_HEIGHT,
    });
    const matrixStandard = campfireFlameTransform(placementStandard, 1, 1);

    const transformedStandard = geom.clone().applyMatrix4(matrixStandard);
    transformedStandard.computeBoundingBox();
    const boxStandard = transformedStandard.boundingBox!;
    const sizeStandard = boxStandard.getSize(new THREE.Vector3());

    // Assert transformed geometry bounds match truthful dimensions directly
    expect(sizeStandard.y).toBeCloseTo(CAMPFIRE_FLAME_HEIGHT, 2);
    expect(sizeStandard.x).toBeGreaterThanOrEqual(CAMPFIRE_FLAME_WIDTH * 0.85);
    expect(sizeStandard.x).toBeLessThanOrEqual(CAMPFIRE_FLAME_WIDTH * 1.05);
    expect(sizeStandard.z).toBeGreaterThanOrEqual(CAMPFIRE_FLAME_WIDTH * 0.85);
    expect(sizeStandard.z).toBeLessThanOrEqual(CAMPFIRE_FLAME_WIDTH * 1.05);

    // 2. Scaled placement: camp height = 0.48m (1.5x) with turn = 0
    const placementScaled = dummyPlacement({
      x: 5,
      y: 1,
      z: 8,
      turn: 0,
      height: 0.48,
    });
    const matrixScaled = campfireFlameTransform(placementScaled, 1, 1);

    const transformedScaled = geom.clone().applyMatrix4(matrixScaled);
    transformedScaled.computeBoundingBox();
    const boxScaled = transformedScaled.boundingBox!;
    const sizeScaled = boxScaled.getSize(new THREE.Vector3());

    // Proportional scaling with placement.height
    expect(sizeScaled.y).toBeCloseTo(CAMPFIRE_FLAME_HEIGHT * 1.5, 2);
    expect(sizeScaled.x).toBeCloseTo(CAMPFIRE_FLAME_WIDTH * 1.5, 1);
    expect(sizeScaled.z).toBeCloseTo(CAMPFIRE_FLAME_WIDTH * 1.5, 1);

    geom.dispose();
    transformedStandard.dispose();
    transformedScaled.dispose();
  });
});

describe("Campfire low-poly geometry and material contract", () => {
  it("generates a shared low-poly flame geometry with visible luminous colors", () => {
    const geom = createCampfireFlameGeometry();
    const index = geom.getIndex();
    expect(index).not.toBeNull();
    const tris = index!.count / 3;
    expect(tris).toBe(CAMPFIRE_FLAME_TRIANGLES);
    expect(tris).toBeLessThanOrEqual(30);

    const posAttr = geom.getAttribute("position");
    const colAttr = geom.getAttribute("color");
    const normAttr = geom.getAttribute("normal");

    expect(posAttr).toBeDefined();
    expect(colAttr).toBeDefined();
    expect(normAttr).toBeDefined();

    geom.computeBoundingBox();
    const box = geom.boundingBox!;
    expect(box.min.y).toBeCloseTo(0, 3);
    expect(box.max.y).toBeCloseTo(1, 3);

    // Max horizontal diameter normalized to 1.0 (radius <= 0.5)
    expect(box.max.x).toBeLessThanOrEqual(0.51);
    expect(box.min.x).toBeGreaterThanOrEqual(-0.51);
    expect(box.max.z).toBeLessThanOrEqual(0.51);
    expect(box.min.z).toBeGreaterThanOrEqual(-0.51);

    // Check that outer base vertices convey luminous color (white-gold coals in linear RGB)
    for (let i = 0; i < 6; i += 1) {
      expect(colAttr.getX(i)).toBeGreaterThan(0.9); // R
      expect(colAttr.getY(i)).toBeGreaterThan(0.9); // G
      expect(colAttr.getZ(i)).toBeGreaterThan(0.5); // B (linear representation of 0xfff8c0)
    }

    // Check that exterior front ribbon vertices sit on the outside (z > 0.3) with luminous color
    const frontStart = 13; // 6 base + 6 mid + 1 apex
    for (let i = frontStart; i < frontStart + 5; i += 1) {
      expect(posAttr.getZ(i)).toBeGreaterThan(0.3);
      expect(colAttr.getX(i)).toBeGreaterThan(0.65);
    }

    geom.dispose();
  });

  it("creates unlit emissive basic material with vertex colors", () => {
    const mat = createCampfireMaterial() as THREE.MeshBasicMaterial;
    expect(mat.isMeshBasicMaterial).toBe(true);
    expect(mat.vertexColors).toBe(true);
    expect(mat.toneMapped).toBe(true);
    expect(mat.side).toBe(THREE.DoubleSide);
    mat.dispose();
  });
});
