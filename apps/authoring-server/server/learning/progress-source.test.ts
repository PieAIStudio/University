import { afterEach, describe, expect, it } from "vitest";
import { Rating } from "ts-fsrs";

import { NOT_STARTED, type LessonRef } from "@pieai/university-core";

import { progressSource, type LessonExerciseSnapshot } from "./progress-source.js";
import { SqliteLearningStore } from "./sqlite-learning-store.js";
import { cardContentKey, exerciseContentKey, lessonContentKey } from "./types.js";

const ref: LessonRef = {
  studyId: "turing-pact",
  courseId: "foundations-before-zero",
  unitId: "what-is-an-app",
  lessonId: "you-already-know-apps",
};

const snapshot: LessonExerciseSnapshot = {
  contentRevision: 1,
  exerciseIds: ["name-the-pattern"],
};

let store: SqliteLearningStore | undefined;

afterEach(() => {
  store?.close();
  store = undefined;
});

function openStore(): SqliteLearningStore {
  store = new SqliteLearningStore(":memory:");
  return store;
}

function sourceOf(
  learningStore: SqliteLearningStore,
  current: LessonExerciseSnapshot | null = snapshot,
  studyId = ref.studyId,
) {
  return progressSource({
    getStore: (id) => (id === studyId ? learningStore : null),
    lessonOf: () => current,
  });
}

function passExercises(
  learningStore: SqliteLearningStore,
  lesson: LessonRef = ref,
  current: LessonExerciseSnapshot = snapshot,
): void {
  for (const [index, exerciseId] of current.exerciseIds.entries()) {
    learningStore.recordExerciseAttempt({
      commandId: `pass-${lesson.lessonId}-${exerciseId}-${index}`,
      exerciseKey: exerciseContentKey({
        courseId: lesson.courseId,
        unitId: lesson.unitId,
        lessonId: lesson.lessonId,
        exerciseId,
      }),
      contentRevision: current.contentRevision,
      score: 1,
      maxScore: 1,
    });
  }
}

function confirmRead(
  learningStore: SqliteLearningStore,
  lesson: LessonRef = ref,
  contentRevision = snapshot.contentRevision,
): void {
  learningStore.recordLessonCompletion({
    commandId: `confirm-${lesson.unitId}-${lesson.lessonId}`,
    lessonKey: lessonContentKey({
      courseId: lesson.courseId,
      unitId: lesson.unitId,
      lessonId: lesson.lessonId,
    }),
    contentRevision,
  });
}

describe("the local progress source", () => {
  it("returns NOT_STARTED for an untouched lesson", () => {
    expect(sourceOf(openStore()).completionOf(ref)).toEqual(NOT_STARTED);
  });

  it("reports exercises passed without treating that as a read confirmation", () => {
    const learningStore = openStore();
    passExercises(learningStore);
    expect(sourceOf(learningStore).completionOf(ref)).toEqual({
      exercisesPassed: true,
      readConfirmed: false,
    });
  });

  it("reports both flags true only once the completion event exists as well", () => {
    const learningStore = openStore();
    passExercises(learningStore);
    confirmRead(learningStore);
    expect(sourceOf(learningStore).completionOf(ref)).toEqual({
      exercisesPassed: true,
      readConfirmed: true,
    });
  });

  it("reports a confirmed read without claiming the exercises were passed", () => {
    // The two flags are independent facts. Collapsing them would be the
    // delivery shell's known gap, and this shell is the reason the contract
    // refused to inherit it.
    const learningStore = openStore();
    confirmRead(learningStore);
    expect(sourceOf(learningStore).completionOf(ref)).toEqual({
      exercisesPassed: false,
      readConfirmed: true,
    });
  });

  it("does not treat one passed exercise as the whole lesson", () => {
    const two: LessonExerciseSnapshot = {
      contentRevision: 1,
      exerciseIds: ["name-the-pattern", "say-it-back"],
    };
    const learningStore = openStore();
    passExercises(learningStore, ref, { contentRevision: 1, exerciseIds: ["name-the-pattern"] });
    expect(sourceOf(learningStore, two).completionOf(ref)).toEqual(NOT_STARTED);
  });

  it("keeps two lessons apart when only their unit differs", () => {
    const learningStore = openStore();
    const first: LessonRef = ref;
    const second: LessonRef = { ...ref, unitId: "a-different-unit" };
    const firstLessonKey = lessonContentKey({
      courseId: first.courseId,
      unitId: first.unitId,
      lessonId: first.lessonId,
    });
    const secondLessonKey = lessonContentKey({
      courseId: second.courseId,
      unitId: second.unitId,
      lessonId: second.lessonId,
    });
    const firstCardKey = cardContentKey({
      courseId: first.courseId,
      unitId: first.unitId,
      lessonId: first.lessonId,
      cardId: "shared-card",
    });
    const secondCardKey = cardContentKey({
      courseId: second.courseId,
      unitId: second.unitId,
      lessonId: second.lessonId,
      cardId: "shared-card",
    });

    passExercises(learningStore, first);
    confirmRead(learningStore, first);
    learningStore.recordLessonProgress({
      lessonKey: firstLessonKey,
      contentRevision: snapshot.contentRevision,
      status: "completed",
      progress: 1,
      occurredAt: new Date("2026-08-24T08:00:00.000Z"),
    });
    learningStore.recordReaderMark({
      lessonKey: firstLessonKey,
      contentRevision: snapshot.contentRevision,
      kind: "question",
      quote: { exact: "first unit", prefix: "", suffix: "" },
      createdAt: new Date("2026-08-24T08:01:00.000Z"),
    });
    learningStore.reviewCard({
      commandId: "review-first-unit",
      cardKey: firstCardKey,
      contentRevision: 1,
      rating: Rating.Good,
      reviewedAt: new Date("2026-08-24T08:02:00.000Z"),
    });
    learningStore.ensureCard(secondCardKey, 1, new Date("2026-08-24T08:02:00.000Z"));

    expect(sourceOf(learningStore).completionOf(first)).toEqual({
      exercisesPassed: true,
      readConfirmed: true,
    });
    expect(sourceOf(learningStore).completionOf(second)).toEqual(NOT_STARTED);
    expect(learningStore.getLessonProgress(firstLessonKey)?.status).toBe("completed");
    expect(learningStore.getLessonProgress(secondLessonKey)).toBeNull();
    expect(learningStore.hasLessonCompletion(firstLessonKey, 1)).toBe(true);
    expect(learningStore.hasLessonCompletion(secondLessonKey, 1)).toBe(false);
    expect(learningStore.listReaderMarks({ lessonKey: firstLessonKey })).toHaveLength(1);
    expect(learningStore.listReaderMarks({ lessonKey: secondLessonKey })).toEqual([]);
    expect(learningStore.getCard(firstCardKey)?.reps).toBe(1);
    expect(learningStore.getCard(secondCardKey)?.reps).toBe(0);
  });

  it("uses studyId only to pick the store, never as part of the row key", () => {
    const first = new SqliteLearningStore(":memory:");
    const second = new SqliteLearningStore(":memory:");
    try {
      passExercises(first);
      confirmRead(first);
      const source = progressSource({
        getStore: (studyId) => {
          if (studyId === "turing-pact") return first;
          if (studyId === "university-local") return second;
          return null;
        },
        lessonOf: () => snapshot,
      });
      expect(source.completionOf(ref)).toEqual({
        exercisesPassed: true,
        readConfirmed: true,
      });
      expect(source.completionOf({ ...ref, studyId: "university-local" })).toEqual(NOT_STARTED);
    } finally {
      first.close();
      second.close();
    }
  });
});
