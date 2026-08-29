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

  it("does not grow the overlay when a course has more units than the window", () => {
    const overlay = courseSprites(lessons(200, 0));
    const icons = overlay.filter((sprite) => sprite.role === "icon");
    const units = overlay.filter((sprite) => sprite.role === "unit");
    expect(icons.length).toBeLessThanOrEqual(SPRITE_WINDOW + 1);
    expect(units.length).toBeLessThanOrEqual(icons.length);
    expect(overlay.length).toBeLessThanOrEqual(SPRITE_WINDOW * 3);
  });
});
