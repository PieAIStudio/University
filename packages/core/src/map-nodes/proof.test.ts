import { describe, expect, it } from "vitest";
import { createMemoryPersistence } from "../progress/memory.js";
import { createProgressPort } from "../progress/port.js";
import { progressSourceOf } from "../progress/source.js";
import { readCourseProgress, type CourseShape } from "../progress/contract.js";
import { emptyProgress } from "../progress/document.js";
import { mergeProgress } from "../progress/merge.js";

const course: CourseShape = {
  studyId: "study",
  courseId: "course",
  units: [
    {
      unitId: "unit",
      lessons: ["one", "two"].map((lessonId) => ({
        lessonId,
        contentRevision: 2,
        exerciseIds: ["test"],
      })),
    },
  ],
};
const proof = {
  studyId: "study",
  courseId: "course",
  unitId: "unit",
  lessonIds: ["one"],
  contentRevisions: { one: 2 },
  provenAt: 1000,
};

describe("checkpoint proof lifecycle", () => {
  it("advances the recommendation without read completion, cards, grades or XP", () => {
    const storage = createMemoryPersistence();
    const port = createProgressPort({ persistence: storage });
    port.markLessonsProven(proof);
    expect(readCourseProgress(course, progressSourceOf(port))).toMatchObject({
      done: 0,
      skipped: 1,
      complete: false,
      next: { lessonId: "two" },
    });
    expect(port.snapshot().lessons).toEqual({});
    expect(port.snapshot().cards).toEqual({});
    expect(port.snapshot().exerciseAttempts).toEqual({});
    expect(port.snapshot().totalXp).toBe(0);
    const reloaded = createProgressPort({ persistence: storage });
    expect(readCourseProgress(course, progressSourceOf(reloaded)).next?.lessonId).toBe("two");
  });
  it("can prove a course without pretending the lessons were read", () => {
    const port = createProgressPort({ persistence: createMemoryPersistence() });
    port.markLessonsProven({
      ...proof,
      lessonIds: ["one", "two"],
      contentRevisions: { one: 2, two: 2 },
    });
    expect(readCourseProgress(course, progressSourceOf(port))).toEqual({
      done: 0,
      total: 2,
      skipped: 2,
      complete: false,
      proven: true,
      next: null,
    });
  });
  it("invalidates a version-bound proof when that lesson is revised", () => {
    const port = createProgressPort({ persistence: createMemoryPersistence() });
    port.markLessonsProven(proof);
    const updated: CourseShape = {
      ...course,
      units: [
        {
          unitId: "unit",
          lessons: [{ lessonId: "one", contentRevision: 3, exerciseIds: ["test"] }],
        },
      ],
    };
    expect(readCourseProgress(updated, progressSourceOf(port)).next?.lessonId).toBe("one");
    port.markLessonsProven({ ...proof, contentRevisions: { one: 3 }, provenAt: 2000 });
    expect(readCourseProgress(updated, progressSourceOf(port)).next).toBeNull();
    port.markLessonsProven({ ...proof, provenAt: 3000 });
    expect(port.snapshot().provenLessons["study/course/one"]?.contentRevision).toBe(3);
  });
  it("merges newer assessed revisions symmetrically and keeps legacy records", () => {
    const legacy = emptyProgress(),
      latest = emptyProgress();
    legacy.provenLessons["study/course/one"] = {
      lessonKey: "study/course/one",
      unitId: "unit",
      provenAt: 1000,
    };
    latest.provenLessons["study/course/one"] = {
      lessonKey: "study/course/one",
      unitId: "unit",
      provenAt: 2000,
      contentRevision: 2,
    };
    expect(mergeProgress(legacy, latest).provenLessons).toEqual(
      mergeProgress(latest, legacy).provenLessons,
    );
    expect(mergeProgress(legacy, latest).provenLessons["study/course/one"]?.contentRevision).toBe(
      2,
    );
    expect(mergeProgress(legacy, emptyProgress()).provenLessons).toEqual(legacy.provenLessons);
  });
});
