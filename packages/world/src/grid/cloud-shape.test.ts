import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CLOUD_VOLUME_CONTRACT, createCloudVolumeGeometry } from "../sky/cloud-volume.js";

describe("one cloud-bank source across projections", () => {
  it.each([
    [9, 3, 36],
    [20, 6, 200],
    [24, 6, 240],
    [32, 9, 512],
  ])(
    "keeps %ix%i as one outward-wound, closed connected shell (%i triangles)",
    (width, height, triangles) => {
      const geometry = createCloudVolumeGeometry(width, height);
      const position = geometry.getAttribute("position");
      const indices = geometry.index!;
      const edges = new Map<string, { count: number; direction: number }>();
      const connected = Array.from({ length: position.count }, () => new Set<number>());
      let volume = 0;
      for (const attribute of Object.values(geometry.attributes)) {
        expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
      }
      const vertices = Array.from({ length: position.count }, (_, index) =>
        new THREE.Vector3().fromBufferAttribute(position, index),
      );
      // No disguised independent balls, duplicated seam vertices or merged caps.
      expect(new Set(vertices.map((vertex) => vertex.toArray().join(","))).size).toBe(
        position.count,
      );
      for (let index = 0; index < indices.count; index += 3) {
        const a = indices.getX(index);
        const b = indices.getX(index + 1);
        const c = indices.getX(index + 2);
        const normal = vertices[b]!.clone()
          .sub(vertices[a]!)
          .cross(vertices[c]!.clone().sub(vertices[a]!));
        expect(normal.length()).toBeGreaterThan(1e-5);
        volume += vertices[a]!.dot(vertices[b]!.clone().cross(vertices[c]!)) / 6;
        for (const [from, to] of [
          [a, b],
          [b, c],
          [c, a],
        ]) {
          const key = `${Math.min(from!, to!)}:${Math.max(from!, to!)}`;
          const edge = edges.get(key) ?? { count: 0, direction: 0 };
          edge.count += 1;
          edge.direction += from! < to! ? 1 : -1;
          edges.set(key, edge);
          connected[from!]!.add(to!);
          connected[to!]!.add(from!);
        }
      }
      for (const edge of edges.values()) expect(edge).toEqual({ count: 2, direction: 0 });
      const reached = new Set<number>();
      const pending = [0];
      while (pending.length) {
        const vertex = pending.pop()!;
        if (reached.has(vertex)) continue;
        reached.add(vertex);
        pending.push(...connected[vertex]!);
      }
      expect(reached.size).toBe(position.count);
      expect(volume).toBeGreaterThan(0);
      expect(indices.count / 3).toBe(triangles);
      expect(position.count - edges.size + triangles).toBe(2);
      expect(geometry.groups).toHaveLength(0);
      expect(geometry.userData.cloudVolume).toEqual(CLOUD_VOLUME_CONTRACT);
      geometry.dispose();
    },
  );

  it("has broad shallow shoulders, not pinched beads or a vertical extruded wall", () => {
    const geometry = createCloudVolumeGeometry(32, 9);
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    const rim: number[] = [];
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      const z = position.getZ(index);
      expect(Math.hypot(x, z)).toBeLessThanOrEqual(CLOUD_VOLUME_CONTRACT.horizontalRadiusMax);
      expect(y).toBeLessThanOrEqual(CLOUD_VOLUME_CONTRACT.crownHeightMax);
      expect(y).toBeGreaterThanOrEqual(CLOUD_VOLUME_CONTRACT.undersideHeight - 1e-7);
      if (y === 0) {
        rim.push(Math.hypot(x, z / 0.68));
        // One smooth shared rim normal, not split top/wall normals.
        expect(Math.abs(normal.getY(index))).toBeLessThan(0.75);
      }
    }
    expect(rim).toHaveLength(32);
    const peaks = rim.filter(
      (radius, index) =>
        radius > rim[(index + rim.length - 1) % rim.length]! &&
        radius > rim[(index + 1) % rim.length]!,
    );
    expect(peaks.length).toBeGreaterThanOrEqual(3);
    expect(peaks.length).toBeLessThanOrEqual(5);
    expect(Math.max(...rim) / Math.min(...rim)).toBeLessThan(1.4);
    geometry.dispose();
  });

  it("uses identical shape data for the old form aliases and bounds malformed tessellation inputs", () => {
    const bank = createCloudVolumeGeometry(20, 6, "bank");
    const lobe = createCloudVolumeGeometry(20, 6, "lobe");
    expect(bank.getAttribute("position").array).toEqual(lobe.getAttribute("position").array);
    for (const [width, height] of [
      [NaN, Infinity],
      [-1, -1],
      [1e9, 1e9],
    ]) {
      const geometry = createCloudVolumeGeometry(width!, height!);
      expect(geometry.index!.count / 3).toBeLessThanOrEqual(512);
      expect(Array.from(geometry.getAttribute("position").array).every(Number.isFinite)).toBe(true);
      geometry.dispose();
    }
    bank.dispose();
    lobe.dispose();
  });

  it("keeps course/cloud and globe callers on the shared form and material, with no unused material pair", () => {
    const grid = readFileSync(new URL("./GridCloudLayers.tsx", import.meta.url), "utf8");
    const globe = readFileSync(new URL("../planet/globe-geometry.ts", import.meta.url), "utf8");
    const scene = readFileSync(new URL("../planet/PlanetScene.tsx", import.meta.url), "utf8");
    expect(grid).toContain("CLOUD_VOLUME_CONTRACT.courseSegments");
    expect(grid).toContain("createCloudVolumeGeometry(width, height)");
    expect(grid).toContain("createCloudMaterial(dimmed)");
    expect(grid).not.toContain("createCloudMaterials(");
    expect(grid.match(/<instancedMesh\b/g)).toHaveLength(1);
    expect(globe).toMatch(
      /createCloudVolumeGeometry\(\s*DOMAIN_CLOUD_SEGMENTS\.width,\s*DOMAIN_CLOUD_SEGMENTS\.height,?\s*\)/,
    );
    expect(globe.slice(globe.indexOf("export function createDomainCloudGeometry"))).not.toMatch(
      /IcosahedronGeometry|SphereGeometry/,
    );
    expect(scene).toContain("createCloudMaterial()");
    expect(scene).toContain("material={cloudMaterial}");
    expect(scene).toContain("cloudMaterial.dispose()");
  });
});
