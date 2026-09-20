import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { islandBlueprint } from "./island-blueprint.js";
import { buildIslandGeometry } from "./island-geometry.js";
import {
  buildCliffGarden,
  CLIFF_GARDEN_MAX_PLANTS,
  CLIFF_GARDEN_TRIANGLE_BUDGET,
  CLIFF_GARDEN_MIN_UP,
  cliffPlantClearsHost,
} from "./cliff-garden.js";
import shapes from "./kenney-rock-shapes.json" with { type: "json" };

describe("actual mineral ledges own their plants", () => {
  it("has traceable, finite and closed stone inputs with an explicit small fern", () => {
    expect(shapes.license).toBe("CC0-1.0");
    expect(shapes.assets.map((a) => a.id)).toEqual([
      "rock_largeA",
      "rock_largeD",
      "rock_largeF",
      "plant_flatShort",
      "plant_bush",
      "mushroom_tan",
    ]);
    for (const asset of shapes.assets) {
      expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(asset.vertices.flat().every(Number.isFinite)).toBe(true);
      expect(asset.vertices.every((p) => Math.hypot(p[0]!, p[2]!) <= 1 + 1e-6)).toBe(true);
      const edges = new Map<string, number>();
      let volume = 0;
      for (const face of asset.faces) {
        expect(face.every((i) => Number.isInteger(i) && i >= 0 && i < asset.vertices.length)).toBe(
          true,
        );
        const [a, b, c] = face.map(
          (i) => new THREE.Vector3(...(asset.vertices[i]! as [number, number, number])),
        );
        expect(b!.clone().sub(a!).cross(c!.clone().sub(a!)).length()).toBeGreaterThan(1e-8);
        volume += a!.dot(b!.clone().cross(c!)) / 6;
        for (let i = 0; i < 3; i++) {
          const edge = [face[i]!, face[(i + 1) % 3]!].sort((a, b) => a - b).join("/");
          edges.set(edge, (edges.get(edge) ?? 0) + 1);
        }
      }
      if (asset.id.startsWith("rock_") || asset.id === "mushroom_tan") {
        expect([...edges.values()].every((n) => n === 2)).toBe(true);
        expect(volume).toBeGreaterThan(0);
      }
      if (asset.id === "mushroom_tan") {
        expect(asset.sha256).toBe(
          "455cbacdcdac82cc20420c3f21eaba3ff2fbceadb2e13d35a39d52130dba5a80",
        );
        expect(asset.faces).toHaveLength(48);
        expect(asset.faceMaterials).toHaveLength(asset.faces.length);
        expect(asset.materialRoles).toEqual(["stem", "cap"]);
        expect(asset.faceMaterials!.filter((slot) => slot === 1)).toHaveLength(16);
        expect(asset.faceMaterials!.filter((slot) => slot === 0)).toHaveLength(32);
      }
    }
  });

  it.each([6, 12, 36, 80])(
    "keeps every complete foot inside its emitted support for %i lessons",
    (lessonCount) => {
      const bp = islandBlueprint({
        studyId: "ledge-seats",
        courseId: `length-${lessonCount}`,
        lessonCount,
      });
      const shape = buildIslandGeometry(bp, "course");
      const garden = buildCliffGarden(shape.terrain, bp.seed, shape.scale);
      const repeat = buildCliffGarden(shape.terrain, bp.seed, shape.scale);
      try {
        expect(garden.seats.length).toBeGreaterThan(0);
        expect(garden.seats.length).toBeLessThanOrEqual(CLIFF_GARDEN_MAX_PLANTS);
        expect(garden.geometry!.index!.count / 3).toBeLessThanOrEqual(CLIFF_GARDEN_TRIANGLE_BUDGET);
        expect(repeat.seats).toEqual(garden.seats);
        expect(repeat.geometry!.getAttribute("position").array).toEqual(
          garden.geometry!.getAttribute("position").array,
        );
        const position = shape.terrain.getAttribute("position"),
          indices = shape.terrain.getIndex()!;
        for (const seat of garden.seats) {
          const triangle = new THREE.Triangle(
            ...([0, 1, 2].map((i) =>
              new THREE.Vector3().fromBufferAttribute(position, indices.getX(seat.face + i)),
            ) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]),
          );
          const normal = triangle.getNormal(new THREE.Vector3());
          expect(normal.distanceTo(seat.normal)).toBeLessThan(1e-6);
          expect(normal.y).toBeGreaterThanOrEqual(CLIFF_GARDEN_MIN_UP);
          expect(seat.radius).toBeLessThan(seat.inradius);
          expect(seat.crownRadius).toBeGreaterThan(seat.radius);
          expect(seat.crownRadius).toBeLessThanOrEqual(1.8 * shape.scale);
          const x = new THREE.Vector3(0, 0, 1).cross(normal).normalize();
          const z = normal.clone().cross(x).normalize();
          for (let i = 0; i < 16; i++) {
            const foot = seat.center
              .clone()
              .addScaledVector(x, Math.cos((i * Math.PI) / 8) * seat.radius)
              .addScaledVector(z, Math.sin((i * Math.PI) / 8) * seat.radius);
            const bary = triangle.getBarycoord(foot, new THREE.Vector3());
            expect(bary).not.toBeNull();
            expect(Math.min(...bary!.toArray())).toBeGreaterThanOrEqual(-1e-6);
            expect(Math.abs(foot.clone().sub(triangle.a).dot(normal))).toBeLessThan(1e-5);
          }
        }
        for (const attr of Object.values(garden.geometry!.attributes))
          expect(Array.from(attr.array).every(Number.isFinite)).toBe(true);
      } finally {
        garden.geometry?.dispose();
        repeat.geometry?.dispose();
        shape.terrain.dispose();
      }
    },
  );

  it("omits unsupported decoration and rejects invalid scale", () => {
    const geometry = new THREE.BufferGeometry();
    expect(buildCliffGarden(geometry, "empty", 1)).toEqual({ geometry: null, seats: [] });
    expect(() => buildCliffGarden(geometry, "invalid", 0)).toThrow(RangeError);
    geometry.dispose();
  });

  it("permits the deliberate root embed but rejects rock slicing the leaf interior", () => {
    const plant = new THREE.BufferGeometry();
    plant.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, -0.012, 0, 0.3, 0.7, 0, -0.3, 0.7, 0], 3),
    );
    plant.setIndex([0, 1, 2]);
    const host = new THREE.BufferGeometry();
    const root = new THREE.Vector3();
    try {
      host.setAttribute(
        "position",
        new THREE.Float32BufferAttribute([-2, 0, -2, 2, 0, -2, 0, 0, 2], 3),
      );
      host.setIndex([0, 1, 2]);
      expect(cliffPlantClearsHost(host, plant, root, 1)).toBe(true);
      // The obstacle is smaller than the leaf: its edges cross the blade,
      // while the blade perimeter never touches the obstacle's triangle.
      host.setAttribute(
        "position",
        new THREE.Float32BufferAttribute([-0.02, 0.4, -0.05, 0.02, 0.4, -0.05, 0, 0.4, 0.05], 3),
      );
      expect(cliffPlantClearsHost(host, plant, root, 1)).toBe(false);
    } finally {
      plant.dispose();
      host.dispose();
    }
  });

  it("accepts an inclined crevice but not a vertical or downward support", () => {
    const terrain = new THREE.BufferGeometry();
    const sample = (z: number, inverted = false) => {
      terrain.setAttribute(
        "position",
        new THREE.Float32BufferAttribute([-2, -3, 0, 2, -3, 0, 0, -6, z], 3),
      );
      terrain.setIndex(inverted ? [0, 2, 1] : [0, 1, 2]);
      terrain.userData.cliffTopology = { gardenFaces: [0] };
      return buildCliffGarden(terrain, "inclined-crevice", 1);
    };
    const supported = sample(-1.2);
    try {
      expect(supported.seats).toHaveLength(1);
      expect(supported.seats[0]!.normal.y).toBeLessThan(0.5);
      expect(supported.seats[0]!.normal.y).toBeGreaterThan(CLIFF_GARDEN_MIN_UP);
      expect(supported.seats[0]!.radius).toBeLessThan(supported.seats[0]!.inradius);
    } finally {
      supported.geometry?.dispose();
    }
    for (const result of [sample(0), sample(-0.5), sample(-1.2, true)]) {
      expect(result.seats).toEqual([]);
      expect(result.geometry).toBeNull();
    }
    terrain.dispose();
  });
});
