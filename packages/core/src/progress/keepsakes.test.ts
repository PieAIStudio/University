import { describe, expect, it } from "vitest";
import { courseChallengeEventId, lessonRewardTier } from "./cosmetic-rewards.js";
import {
  courseKeepsakes,
  earnedKeepsakes,
  keepsakeForChallenge,
  keepsakeForLesson,
  type KeepsakeCourse,
} from "./keepsakes.js";
import { learningSegments } from "../map-nodes/segments.js";

const lessons = (...ids: string[]) => ids.map((id) => ({ id }));
const understanding: KeepsakeCourse = {
  studyId: "ai-literacy",
  id: "understanding-ai",
  units: [
    {
      id: "first-useful-step",
      title: "先让它帮上一点忙",
      lessons: lessons("l1", "l2", "l3", "l4", "l5", "l6"),
    },
    { id: "read-the-answer", title: "看懂回答", lessons: lessons("r1", "r2", "r3") },
  ],
};

describe("keepsakes follow the chest", () => {
  it("leaves one per blue and purple chest and one for the gold chest", () => {
    const all = courseKeepsakes(understanding);
    expect(all.map((k) => `${k.tier}:${k.anchorLessonId}`)).toEqual([
      "checkpoint:l3",
      "challenge:l3",
      "checkpoint:l6",
      "challenge:l6",
      // The course's last segment ends on its gold chest, not a blue one.
      "challenge:r3",
      "course:r3",
    ]);
    expect(new Set(all.map((k) => k.id)).size).toBe(all.length);
  });

  it("matches lessonRewardTier exactly: a keepsake anchor is never a wood chest", () => {
    const segments = learningSegments(understanding);
    const ends = new Set(segments.map((s) => s.lastIndex));
    const ids = understanding.units.flatMap((u) => u.lessons.map((l) => l.id));
    for (const [index, id] of ids.entries()) {
      const tier = lessonRewardTier(index, ids.length, ends.has(index));
      const dropped = keepsakeForLesson(understanding, id);
      if (tier === "wood") expect(dropped, id).toBeUndefined();
      else expect(dropped?.tier, id).toBe(tier === "legendary" ? "course" : "checkpoint");
    }
  });

  it("uses a written keepsake where one exists and its tier's otherwise", () => {
    const all = courseKeepsakes(understanding);
    const art = (tier: string, anchor: string) =>
      all.find((k) => k.tier === tier && k.anchorLessonId === anchor)?.art;
    expect(art("checkpoint", "l3")).toBe("paper-plane");
    expect(art("challenge", "l3")).toBe("emoji-jar");
    expect(art("checkpoint", "l6")).toBe("red-pen");
    expect(art("challenge", "l6")).toBe("trophy");
    expect(art("course", "r3")).toBe("lighthouse");
  });

  it("keeps an id when a lesson inside the segment is replaced", () => {
    const replaced: KeepsakeCourse = {
      ...understanding,
      units: [
        { ...understanding.units[0]!, lessons: lessons("l1", "new-l2", "l3", "l4", "l5", "l6") },
        understanding.units[1]!,
      ],
    };
    expect(courseKeepsakes(replaced).map((k) => k.id)).toEqual(
      courseKeepsakes(understanding).map((k) => k.id),
    );
  });
});

describe("earned keepsakes come from the record, not from storage", () => {
  it("holds a checkpoint when its last lesson is finished and a challenge when it was won", () => {
    const finished = new Set(["l1", "l2", "l3"]);
    const segment = learningSegments(understanding)[0]!;
    const events = new Set([courseChallengeEventId("ai-literacy", "understanding-ai", segment.id)]);
    const earned = earnedKeepsakes(understanding, {
      complete: (_unit, lesson) => finished.has(lesson),
      hasEvent: (id) => events.has(id),
    });
    expect(earned.map((k) => k.art)).toEqual(["paper-plane", "emoji-jar"]);
  });

  it("holds nothing on a fresh record", () => {
    expect(
      earnedKeepsakes(understanding, { complete: () => false, hasEvent: () => false }),
    ).toEqual([]);
  });

  it("names the challenge keepsake by its segment", () => {
    const segment = learningSegments(understanding)[1]!;
    expect(keepsakeForChallenge(understanding, segment.id)?.anchorLessonId).toBe("l6");
  });
});
