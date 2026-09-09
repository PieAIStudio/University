import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
  CAMPFIRE_SIM_MAX_STEP,
  CAMPFIRE_STATES,
  CAMPFIRE_WOOD_COAL_HEIGHT_FRACTION,
  advanceCampfireSimTime,
  campfireFlameTransform,
  campfireFlickerScale,
  createCampfireFlameGeometry,
  createCampfireMaterial,
  deriveCampfireNormalizedAnchor,
  filterLitCampPlacements,
  glbJsonFromBytes,
  isCampfireState,
  isLitCampPlacement,
  kitNormalizedFireAnchor,
  measureCampfireGlbBounds,
} from "./island-campfire.js";

const CAMP_GLB = resolve(
  import.meta.dirname,
  "../../../../apps/university/public/models/elemental-serenity/camp.glb",
);

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
    expect(CAMPFIRE_STATES).toEqual(["lit", "idle"]);
    expect(isCampfireState("lit")).toBe(true);
    expect(isCampfireState("idle")).toBe(true);
    expect(isCampfireState("burning")).toBe(false);
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
  it("derives fire anchor from kit-normalised wood pit geometry", () => {
    const derived = deriveCampfireNormalizedAnchor();
    expect(derived.x).toBeCloseTo(CAMPFIRE_NORMALIZED_ANCHOR.x, 5);
    expect(derived.y).toBeCloseTo(CAMPFIRE_NORMALIZED_ANCHOR.y, 5);
    expect(derived.z).toBeCloseTo(CAMPFIRE_NORMALIZED_ANCHOR.z, 5);

    const kit = kitNormalizedFireAnchor(
      CAMP_SCENE_TRANSFORMED_BOUNDS,
      CAMP_WOOD_SCENE_TRANSFORMED_BOUNDS,
      CAMPFIRE_WOOD_COAL_HEIGHT_FRACTION,
    );
    expect(CAMPFIRE_NORMALIZED_ANCHOR.x).toBeCloseTo(kit.x, 8);
    expect(CAMPFIRE_NORMALIZED_ANCHOR.y).toBeCloseTo(kit.y, 8);
    expect(CAMPFIRE_NORMALIZED_ANCHOR.z).toBeCloseTo(kit.z, 8);

    expect(CAMPFIRE_NORMALIZED_ANCHOR.x).toBeGreaterThan(0.03);
    expect(CAMPFIRE_NORMALIZED_ANCHOR.x).toBeLessThan(0.05);
    expect(CAMPFIRE_NORMALIZED_ANCHOR.z).toBeGreaterThan(-0.02);
    expect(CAMPFIRE_NORMALIZED_ANCHOR.z).toBeLessThan(0.0);

    const woodMinY =
      (CAMP_WOOD_SCENE_TRANSFORMED_BOUNDS.min.y - CAMP_SCENE_TRANSFORMED_BOUNDS.min.y) /
      CAMP_SCENE_TRANSFORMED_BOUNDS.size.y;
    const woodMaxY =
      (CAMP_WOOD_SCENE_TRANSFORMED_BOUNDS.max.y - CAMP_SCENE_TRANSFORMED_BOUNDS.min.y) /
      CAMP_SCENE_TRANSFORMED_BOUNDS.size.y;
    expect(CAMPFIRE_NORMALIZED_ANCHOR.y).toBeGreaterThan(woodMinY);
    expect(CAMPFIRE_NORMALIZED_ANCHOR.y).toBeLessThan(woodMaxY);

    expect(CAMP_SCENE_TRANSFORMED_BOUNDS.size.x).toBeCloseTo(2.7, 1);
    expect(CAMP_SCENE_TRANSFORMED_BOUNDS.size.y).toBeCloseTo(0.73, 2);
    expect(CAMP_SCENE_TRANSFORMED_BOUNDS.size.z).toBeCloseTo(2.5, 1);

    expect(CAMP_WOOD_SCENE_TRANSFORMED_BOUNDS.size.x).toBeLessThan(
      CAMP_SCENE_TRANSFORMED_BOUNDS.size.x,
    );
    expect(CAMP_WOOD_SCENE_TRANSFORMED_BOUNDS.size.z).toBeLessThan(
      CAMP_SCENE_TRANSFORMED_BOUNDS.size.z,
    );
  });

  it("matches constants to the decoded local camp.glb node transforms", () => {
    const document = glbJsonFromBytes(new Uint8Array(readFileSync(CAMP_GLB)));
    expect(document).not.toBeNull();
    const measured = measureCampfireGlbBounds(document!);
    expect(measured).not.toBeNull();

    expect(measured!.scene.min.x).toBeCloseTo(CAMP_RAW_BOUNDING_BOX.min.x, 4);
    expect(measured!.scene.min.y).toBeCloseTo(CAMP_RAW_BOUNDING_BOX.min.y, 4);
    expect(measured!.scene.min.z).toBeCloseTo(CAMP_RAW_BOUNDING_BOX.min.z, 4);
    expect(measured!.scene.max.x).toBeCloseTo(CAMP_RAW_BOUNDING_BOX.max.x, 4);
    expect(measured!.scene.max.y).toBeCloseTo(CAMP_RAW_BOUNDING_BOX.max.y, 4);
    expect(measured!.scene.max.z).toBeCloseTo(CAMP_RAW_BOUNDING_BOX.max.z, 4);

    expect(measured!.wood.min.x).toBeCloseTo(CAMP_WOOD_RAW_BOUNDING_BOX.min.x, 4);
    expect(measured!.wood.max.x).toBeCloseTo(CAMP_WOOD_RAW_BOUNDING_BOX.max.x, 4);
    expect(measured!.wood.min.y).toBeCloseTo(CAMP_WOOD_RAW_BOUNDING_BOX.min.y, 4);
    expect(measured!.wood.max.y).toBeCloseTo(CAMP_WOOD_RAW_BOUNDING_BOX.max.y, 4);

    const fromFile = kitNormalizedFireAnchor(measured!.scene, measured!.wood);
    expect(fromFile.x).toBeCloseTo(CAMPFIRE_NORMALIZED_ANCHOR.x, 5);
    expect(fromFile.y).toBeCloseTo(CAMPFIRE_NORMALIZED_ANCHOR.y, 5);
    expect(fromFile.z).toBeCloseTo(CAMPFIRE_NORMALIZED_ANCHOR.z, 5);
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

describe("Campfire world transform from kit-normalised origin", () => {
  it("places the flame origin at the yaw-rotated kit anchor, not the camp origin", () => {
    const placement = dummyPlacement({
      x: 4,
      y: 1.2,
      z: -3,
      turn: 0.7,
      height: CAMP_REFERENCE_HEIGHT,
      state: "lit",
    });
    const matrix = campfireFlameTransform(placement);
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    matrix.decompose(position, quaternion, scale);

    const campHeight = placement.height;
    const local = new THREE.Vector3(
      CAMPFIRE_NORMALIZED_ANCHOR.x * campHeight,
      CAMPFIRE_NORMALIZED_ANCHOR.y * campHeight,
      CAMPFIRE_NORMALIZED_ANCHOR.z * campHeight,
    ).applyAxisAngle(new THREE.Vector3(0, 1, 0), placement.turn);
    expect(position.x).toBeCloseTo(placement.x + local.x, 6);
    expect(position.y).toBeCloseTo(placement.y + local.y, 6);
    expect(position.z).toBeCloseTo(placement.z + local.z, 6);
    expect(position.x).not.toBeCloseTo(placement.x, 3);
    expect(scale.y).toBeCloseTo(CAMPFIRE_FLAME_HEIGHT, 6);
  });
});

describe("Campfire sim time does not chase wall-clock on resume", () => {
  it("freezes while paused or reduced-motion and skips hitch deltas", () => {
    let time = 0;
    time = advanceCampfireSimTime(time, 0.016);
    expect(time).toBeCloseTo(0.016, 8);
    const playing = time;
    time = advanceCampfireSimTime(time, 4.2, { paused: true });
    expect(time).toBe(playing);
    time = advanceCampfireSimTime(time, 4.2, { reducedMotion: true });
    expect(time).toBe(playing);
    time = advanceCampfireSimTime(time, 4.2);
    expect(time).toBe(playing);
    expect(4.2).toBeGreaterThan(CAMPFIRE_SIM_MAX_STEP);
    time = advanceCampfireSimTime(time, 0.016);
    expect(time).toBeCloseTo(playing + 0.016, 8);
    expect(campfireFlickerScale(playing, 0)).toBe(campfireFlickerScale(playing, 0));
    expect(campfireFlickerScale(0, 0)).toBe(1 + 0.038 * Math.sin(0) + 0.018 * Math.cos(0));
  });

  it("keeps the renderer on accumulated delta, not elapsed wall clock", () => {
    const source = readFileSync(resolve(import.meta.dirname, "island-campfire-render.tsx"), "utf8");
    expect(source).not.toMatch(/getElapsedTime/);
    expect(source).toMatch(/advanceCampfireSimTime/);
    expect(source).toMatch(/campfireFlickerScale/);
    expect(source).not.toMatch(/PointLight|spotLight|castShadow=\{true\}/);
  });
});
