import * as THREE from "three";
import { mergeBufferGeometries } from "three-stdlib";
import { describe, expect, it } from "vitest";
import { clayGeometryView } from "./clay-geometry.js";
import { roundStoneUpper } from "./clay-stone.js";
const at = (p: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, i: number) => [
  p.getX(i),
  p.getY(i),
  p.getZ(i),
];

describe("selective clay stone shoulders", () => {
  it("preserves the support plane, bounded volume, vertex attributes and winding", () => {
    const source = new THREE.BoxGeometry(2, 3, 2);
    source.translate(10, 8, -3);
    const before = source.getAttribute("position").array.slice();
    const view = clayGeometryView(source, "stone"),
      p = view.getAttribute("position");
    expect(view.index!.count).toBe(source.index!.count * 4);
    expect(source.getAttribute("position").array).toEqual(before);
    expect(view.boundingBox!.min.y).toBe(6.5);
    const sourceP = source.getAttribute("position");
    const lower = new Set(Array.from({ length: p.count }, (_, i) => at(p, i).join("/")));
    for (let i = 0; i < sourceP.count; i++)
      if (sourceP.getY(i) <= 7.52) expect(lower.has(at(sourceP, i).join("/"))).toBe(true);
    source.computeBoundingBox();
    const originalBox = source.boundingBox!.clone().expandByScalar(1e-6);
    let volume = 0;
    const a = new THREE.Vector3(),
      b = new THREE.Vector3(),
      c = new THREE.Vector3();
    for (let i = 0; i < view.index!.count; i += 3) {
      a.fromBufferAttribute(p, view.index!.getX(i));
      b.fromBufferAttribute(p, view.index!.getX(i + 1));
      c.fromBufferAttribute(p, view.index!.getX(i + 2));
      expect(originalBox.containsPoint(a)).toBe(true);
      volume += a.dot(b.clone().cross(c)) / 6;
      expect(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()).toBeGreaterThan(1e-12);
    }
    expect(volume).toBeGreaterThan(6);
    expect(volume).toBeLessThan(12);
    expect(view.getAttribute("uv").count).toBe(p.count);
    expect(view.groups.reduce((n, g) => n + g.count, 0)).toBe(view.index!.count);
    source.dispose();
    view.dispose();
  });
  it("does not round spring banks and ruins mixed into the same draw", () => {
    const protectedPart = new THREE.BoxGeometry(2, 2, 2).translate(-4, 4, 0);
    const stone = new THREE.BoxGeometry(2, 2, 2).translate(4, 4, 0);
    const source = mergeBufferGeometries([protectedPart, stone], true)!;
    source.userData.clayStoneRanges = [
      { start: protectedPart.index!.count, count: stone.index!.count },
    ];
    const view = clayGeometryView(source, "stone");
    expect(view.index!.count).toBe(protectedPart.index!.count + stone.index!.count * 4);
    const p = view.getAttribute("position"),
      s = source.getAttribute("position");
    for (let i = 0; i < protectedPart.index!.count; i++)
      expect(at(p, view.index!.getX(i))).toEqual(at(s, source.index!.getX(i)));
    expect(view.groups).toEqual([
      { start: 0, count: 36, materialIndex: 0 },
      { start: 36, count: 144, materialIndex: 1 },
    ]);
    source.userData.clayStoneRanges = [];
    expect(roundStoneUpper(source)).toBeNull();
    source.userData.clayStoneRanges = [{ start: 1, count: 3 }];
    expect(roundStoneUpper(source)).toBeNull();
    protectedPart.dispose();
    stone.dispose();
    source.dispose();
    view.dispose();
  });
  it("preserves the actual surface beneath upper-bank plants, not just the island contact", () => {
    const source = new THREE.BoxGeometry(4, 3, 4, 4, 2, 4);
    source.userData.clayStoneContacts = [{ x: 0.45, z: 0.4, radius: 0.18 }];
    const view = clayGeometryView(source, "stone");
    const ray = new THREE.Raycaster(new THREE.Vector3(0.45, 8, 0.4), new THREE.Vector3(0, -1, 0));
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const originalMesh = new THREE.Mesh(source, material),
      clayMesh = new THREE.Mesh(view, material);
    for (const dx of [-0.17, 0, 0.17])
      for (const dz of [-0.17, 0, 0.17]) {
        ray.ray.origin.set(0.45 + dx, 8, 0.4 + dz);
        const a = ray.intersectObject(originalMesh)[0],
          b = ray.intersectObject(clayMesh)[0];
        expect(a).toBeDefined();
        expect(b).toBeDefined();
        expect(b!.point.y).toBeCloseTo(a!.point.y, 6);
      }
    expect(view.index!.count).toBeLessThan(source.index!.count * 4);
    source.dispose();
    view.dispose();
    material.dispose();
  });
  it("keeps an open border fixed and refuses partial draw ranges", () => {
    const source = new THREE.PlaneGeometry(2, 2);
    const view = roundStoneUpper(source)!;
    const p = view.getAttribute("position"),
      s = source.getAttribute("position");
    const drawn = new Set(Array.from({ length: p.count }, (_, i) => at(p, i).join("/")));
    for (let i = 0; i < s.count; i++) expect(drawn.has(at(s, i).join("/"))).toBe(true);
    source.setDrawRange(3, 3);
    expect(roundStoneUpper(source)).toBeNull();
    source.dispose();
    view.dispose();
  });
});
