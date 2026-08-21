import { afterEach, describe, expect, it } from "vitest";

import { NOT_STARTED, type LessonRef } from "@pieai/university-core";

import { progressSource, type LessonExerciseSnapshot } from "./progress-source.js";
import { SqliteLearningStore } from "./sqlite-learning-store.js";
import { exerciseContentKey, lessonContentKey } from "./types.js";

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
    passExercises(learningStore);
    confirmRead(learningStore);
    expect(sourceOf(learningStore).completionOf({ ...ref, unitId: "a-different-unit" })).toEqual(
      NOT_STARTED,
    );
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
