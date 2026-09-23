import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { courseSprites, SPRITE_WINDOW, type PathLesson } from "./path-overlay";

function lessons(count: number, liveAt: number): PathLesson[] {
  return Array.from({ length: count }, (_, index) => ({
    unitId: `unit-${Math.floor(index / 4)}`,
    unitTitle: `单元 ${Math.floor(index / 4)}`,
    lessonId: `lesson-${index}`,
    chars: 1200,
    position: new THREE.Vector3(0, 0, -index * 4),
    state: index < liveAt ? "done" : index === liveAt ? "live" : "idle",
    kind: "lesson",
  }));
}

describe("courseSprites", () => {
  it("leaves the live stone's face clear for the learner avatar", () => {
    const sprites = courseSprites(lessons(41, 20));
    expect(sprites.some((sprite) => sprite.id === "kind:lesson-20")).toBe(false);
  });

  it("bounds icons to the window around the live stone, not the course length", () => {
    const long = courseSprites(lessons(200, 20)).filter((sprite) => sprite.role === "icon");
    const short = courseSprites(lessons(41, 20)).filter((sprite) => sprite.role === "icon");
    expect(long).toHaveLength(SPRITE_WINDOW * 2);
    expect(short).toHaveLength(long.length);
  });

  it("puts no unit names on the island: they drifted with the live stone (V5 R59)", () => {
    const overlay = courseSprites(lessons(200, 0));
    expect(overlay.every((sprite) => sprite.role === "icon")).toBe(true);
    expect(overlay.length).toBeLessThanOrEqual(SPRITE_WINDOW + 1);
  });
});
