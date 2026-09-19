import { describe, expect, it } from "vitest";
import { learningSegments, nearestLearningSegment } from "./segments.js";

const unit = (id: string, count: number) => ({
  id,
  title: id,
  lessons: Array.from({ length: count }, (_, i) => ({ id: `${id}-${i}` })),
});
describe("map learning segments", () => {
  it("balances short tails without crossing units or changing lesson identities", () => {
    const course = { units: [unit("a", 6), unit("b", 11), unit("c", 2)] };
    const segments = learningSegments(course);
    expect(segments.map((s) => s.lessonIds.length)).toEqual([3, 3, 4, 4, 3, 2]);
    expect(segments.flatMap((s) => s.lessonIds)).toEqual(
      course.units.flatMap((u) => u.lessons.map((l) => l.id)),
    );
    expect(new Set(segments.map((s) => s.id)).size).toBe(segments.length);
    expect(segments.at(-1)?.lastIndex).toBe(18);
  });
  it("is stable for 0–100 lessons and does not pad tiny courses", () => {
    for (let count = 0; count <= 100; count += 1) {
      const segments = learningSegments({ units: [unit("a", count)] });
      expect(segments.flatMap((s) => s.lessonIds)).toHaveLength(count);
      expect(
        segments.every((s) => s.lessonIds.length <= 5 && s.lessonIds.length >= Math.min(3, count)),
      ).toBe(true);
    }
    expect(learningSegments({ units: [] })).toEqual([]);
  });
  it("selects the neighbourhood of the next lesson, not the entire map", () => {
    const segments = learningSegments({ units: [unit("a", 15)] });
    expect(nearestLearningSegment(segments, "a-6")?.ordinal).toBe(2);
    expect(nearestLearningSegment(segments, undefined)?.ordinal).toBe(3);
  });
});
