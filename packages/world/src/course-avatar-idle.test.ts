import { expect, it, vi } from "vitest";
import { Vector3 } from "three";
import { courseAvatarIdlePosition } from "./course-avatar-idle.js";
it("waits on sampled ground outside every lesson footprint without modifying those lessons", () => {
  const nodes = [
    { position: new Vector3(0, 1, 0) },
    { position: new Vector3(-3, 1, 0) },
    { position: new Vector3(3, 2, 0) },
  ];
  const before = nodes.map((n) => n.position.toArray());
  const sample = vi.fn((_x: number, _z: number) => ({ y: 4, inside: true }));
  const idle = courseAvatarIdlePosition(nodes, 1, sample)!;
  expect(idle.y).toBe(4);
  expect(nodes.every((n) => Math.hypot(n.position.x - idle.x, n.position.z - idle.z) >= 2.5)).toBe(
    true,
  );
  expect(nodes.map((n) => n.position.toArray())).toEqual(before);
  expect(courseAvatarIdlePosition(nodes, 1, sample)).toEqual(idle);
});
it("does not call water or unavailable ground a valid waiting place", () => {
  expect(
    courseAvatarIdlePosition([{ position: new Vector3() }], 1, () => ({ y: NaN, inside: false })),
  ).toBeNull();
});
