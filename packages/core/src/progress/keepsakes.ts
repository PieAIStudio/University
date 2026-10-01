/**
 * Keepsakes: what a high-tier chest leaves in the learner's house (V7
 * amendment one, Owner 2026-10-01).
 *
 * They are earned, never drawn. A keepsake is a fact about the learning record
 * — this segment's last lesson is finished, this challenge was won, this course
 * is done — so the house derives them here instead of storing a second copy
 * that could disagree with the record. Packs are luck and live elsewhere
 * (cosmetic-rewards.ts); the shelf holds only keepsakes.
 *
 * The tiers follow the chest exactly (`lessonRewardTier`): a segment's last
 * lesson opens a blue chest and earns that segment's keepsake, a won challenge
 * opens a purple one, and the course's last lesson opens the gold one. The last
 * segment of a course therefore earns the course keepsake, not a checkpoint one
 * — its chest is gold, not blue.
 */
import {
  learningSegments,
  type LearningSegment,
  type SegmentCourse,
} from "../map-nodes/segments.js";
import { courseChallengeEventId } from "./cosmetic-rewards.js";

export type KeepsakeTier = "checkpoint" | "challenge" | "course";

/** The drawing the house uses; the shapes live in packages/ui. */
export type KeepsakeArt =
  | "paper-plane"
  | "emoji-jar"
  | "red-pen"
  | "lighthouse"
  | "signpost"
  | "trophy";

export interface Keepsake {
  /** Stable across lesson edits inside a unit: course, unit, segment position, tier. */
  readonly id: string;
  readonly tier: KeepsakeTier;
  readonly art: KeepsakeArt;
  /** Interface-catalogue stem: `${copy}.name` and `${copy}.meaning`. */
  readonly copy: string;
  readonly studyId: string;
  readonly courseId: string;
  readonly unitId: string;
  /** The learning segment it came from; absent for the course keepsake. */
  readonly segmentId?: string;
  /** Where 「回到那一段」 goes: the lesson whose chest dropped it. */
  readonly anchorLessonId: string;
}

interface Look {
  readonly art: KeepsakeArt;
  readonly copy: string;
}

/**
 * Keepsakes written for a particular segment. Keyed by
 * `${studyId}/${courseId}/${unitId}#${segment position in unit}/${tier}`, so
 * replacing a lesson inside a segment does not orphan its keepsake. Each one
 * says what that segment taught; the course-writing workflow adds the rest.
 */
const WRITTEN: Readonly<Record<string, Look>> = {
  "ai-literacy/understanding-ai/first-useful-step#1/checkpoint": {
    art: "paper-plane",
    copy: "keepsake.paperPlane",
  },
  "ai-literacy/understanding-ai/first-useful-step#1/challenge": {
    art: "emoji-jar",
    copy: "keepsake.emojiJar",
  },
  "ai-literacy/understanding-ai/first-useful-step#2/checkpoint": {
    art: "red-pen",
    copy: "keepsake.redPen",
  },
};

/** What a chest of this tier leaves when nobody has written a keepsake for it yet. */
const BY_TIER: Readonly<Record<KeepsakeTier, Look>> = {
  checkpoint: { art: "signpost", copy: "keepsake.signpost" },
  challenge: { art: "trophy", copy: "keepsake.trophy" },
  course: { art: "lighthouse", copy: "keepsake.lighthouse" },
};

export interface KeepsakeCourse extends SegmentCourse {
  readonly studyId: string;
  readonly id: string;
}

function positionInUnit(segments: readonly LearningSegment[], segment: LearningSegment): number {
  return segments.filter((s) => s.unitId === segment.unitId && s.ordinal <= segment.ordinal).length;
}

function keepsake(
  course: KeepsakeCourse,
  tier: KeepsakeTier,
  unitId: string,
  slot: string,
  anchorLessonId: string,
  segmentId?: string,
): Keepsake {
  const id = `${course.studyId}/${course.id}/${slot}/${tier}`;
  const look = WRITTEN[id] ?? BY_TIER[tier];
  return {
    id,
    tier,
    art: look.art,
    copy: look.copy,
    studyId: course.studyId,
    courseId: course.id,
    unitId,
    ...(segmentId ? { segmentId } : {}),
    anchorLessonId,
  };
}

/** Every keepsake this course can leave, in path order. */
export function courseKeepsakes(course: KeepsakeCourse): readonly Keepsake[] {
  const segments = learningSegments(course);
  const total = course.units.reduce((sum, unit) => sum + unit.lessons.length, 0);
  const result: Keepsake[] = [];
  for (const segment of segments) {
    const slot = `${segment.unitId}#${positionInUnit(segments, segment)}`;
    // The course's last lesson opens the gold chest, not a blue one.
    if (segment.lastIndex !== total - 1)
      result.push(
        keepsake(course, "checkpoint", segment.unitId, slot, segment.anchorLessonId, segment.id),
      );
    result.push(
      keepsake(course, "challenge", segment.unitId, slot, segment.anchorLessonId, segment.id),
    );
  }
  const last = segments.at(-1);
  if (last) result.push(keepsake(course, "course", last.unitId, "course", last.anchorLessonId));
  return result;
}

export interface KeepsakeRecord {
  /** Both halves of a finished lesson; see `isLessonComplete`. */
  readonly complete: (unitId: string, lessonId: string) => boolean;
  /** Ids present in the progress document's `xpEvents`. */
  readonly hasEvent: (eventId: string) => boolean;
}

/** The keepsakes the record says this learner holds, in path order. */
export function earnedKeepsakes(
  course: KeepsakeCourse,
  record: KeepsakeRecord,
): readonly Keepsake[] {
  return courseKeepsakes(course).filter((item) =>
    item.tier === "challenge"
      ? record.hasEvent(courseChallengeEventId(course.studyId, course.id, item.segmentId!))
      : record.complete(item.unitId, item.anchorLessonId),
  );
}

/**
 * The keepsake the chest now opening leaves, if it is a keepsake chest: the
 * one whose anchor is the lesson just finished, or the challenge just won.
 */
export function keepsakeForLesson(course: KeepsakeCourse, lessonId: string): Keepsake | undefined {
  return courseKeepsakes(course).find(
    (item) => item.tier !== "challenge" && item.anchorLessonId === lessonId,
  );
}

export function keepsakeForChallenge(
  course: KeepsakeCourse,
  segmentId: string,
): Keepsake | undefined {
  return courseKeepsakes(course).find(
    (item) => item.tier === "challenge" && item.segmentId === segmentId,
  );
}
