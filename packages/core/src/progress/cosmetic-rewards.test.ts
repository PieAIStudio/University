import { describe, expect, it } from "vitest";
import {
  cosmeticRewardRules,
  courseChallengeEventId,
  lessonRewardTier,
  type CosmeticRewardCourse,
} from "./cosmetic-rewards.js";

function course(count = 6): CosmeticRewardCourse {
  return {
    studyId: "study",
    id: "course",
    units: [
      {
        id: "unit",
        title: "Unit",
        lessons: Array.from({ length: count }, (_, index) => ({
          id: `l${index}`,
          contentRevision: 2,
          exerciseIds: ["question"],
          conceptIds: index < 2 ? ["prompt", "token"] : [],
        })),
      },
    ],
  };
}
describe("the cosmetic metadata comes from the same course producer", () => {
  it("shares the map's position tier, without silently giving wood chests a pack", () => {
    expect(lessonRewardTier(0, 6, false)).toBe("wood");
    expect(lessonRewardTier(2, 6, true)).toBe("rare");
    expect(lessonRewardTier(5, 6, true)).toBe("legendary");
    expect(lessonRewardTier(-1, 0, false)).toBe("wood");
    const rules = cosmeticRewardRules([course()]);
    expect(
      rules.find((r) => r.id === "lesson:study/course/l0")?.requirements[0]?.[0]?.perfect,
    ).toBe(true);
    expect(
      rules.find((r) => r.id === "lesson:study/course/l2")?.requirements[0]?.[0]?.perfect,
    ).toBeUndefined();
    expect(
      rules.find((r) => r.id === "lesson:study/course/l5")?.requirements[0]?.[0]?.perfect,
    ).toBeUndefined();
  });
  it("keeps gate, challenge and set identities independent from lesson revision", () => {
    const input = course();
    const before = JSON.stringify(input);
    const rules = cosmeticRewardRules([input]);
    const gates = rules.filter((r) => r.id.startsWith("gate:"));
    expect(gates).toHaveLength(2);
    expect(gates.every((r) => r.requirements.length === 3)).toBe(true);
    expect(rules.find((r) => r.kind === "challenge")?.eventId).toBe(
      courseChallengeEventId("study", "course", "unit--l0--l2"),
    );
    expect(JSON.stringify(input)).toBe(before);
    const newer = {
      ...input,
      units: input.units.map((u) => ({
        ...u,
        lessons: u.lessons.map((l) => ({ ...l, contentRevision: 3 })),
      })),
    };
    expect(cosmeticRewardRules([newer]).map((r) => r.id)).toEqual(rules.map((r) => r.id));
  });
  it("deduplicates concept alternatives and excludes gifted access from mastery requirements", () => {
    const set = cosmeticRewardRules([course()]).find((r) => r.kind === "set")!;
    expect(set.itemId).toBe("avatar-set-band");
    expect(set.requirements).toHaveLength(1);
    expect(set.requirements[0]?.map((r) => r.lessonKey)).toEqual([
      "study/course/l0",
      "study/course/l1",
    ]);
  });
  it("emits no made-up set for courses with no concept links and no answers/prose", () => {
    const input = course(1);
    const empty = {
      ...input,
      units: input.units.map((u) => ({
        ...u,
        lessons: u.lessons.map((l) => ({
          ...l,
          conceptIds: [],
          content: "secret prose",
          answer: "do not export",
        })),
      })),
    };
    const rules = cosmeticRewardRules([empty]);
    expect(rules.some((r) => r.kind === "set")).toBe(false);
    expect(JSON.stringify(rules)).not.toMatch(/secret prose|do not export|content"/);
    expect(rules[0]?.requirements[0]?.[0]).toEqual({
      lessonKey: "study/course/l0",
      unitId: "unit",
      contentRevision: 2,
      exerciseIds: ["question"],
    });
  });
  it("fails closed on missing current exercise identities or duplicate reward identities", () => {
    const input = course();
    const incomplete = {
      ...input,
      units: input.units.map((u) => ({
        ...u,
        lessons: u.lessons.map((l) => ({ ...l, exerciseIdsComplete: false })),
      })),
    };
    expect(() => cosmeticRewardRules([incomplete])).toThrow(/complete current lesson shape/);
    expect(() => cosmeticRewardRules([input, input])).toThrow(/duplicate/);
  });
});
