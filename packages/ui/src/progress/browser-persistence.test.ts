// @vitest-environment jsdom

import {
  lessonKeyOf,
  lessonRefKey,
  lessonKey,
  createProgressPort,
  emptyProgress,
  progressSourceOf,
  PROGRESS_STORAGE_KEY,
  recapCardKeyOf,
  type LessonRef,
} from "@pieai/university-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createBrowserPersistence } from "./browser-persistence.js";
import { createBrowserProgressPort } from "./store.js";
import type { ReaderMark } from "@pieai/university-core/domain/reader-marks.js";

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

const COLLISION_FIRST: LessonRef = {
  studyId: "study",
  courseId: "course",
  unitId: "unit-first",
  lessonId: "shared-lesson",
};
const COLLISION_SECOND: LessonRef = { ...COLLISION_FIRST, unitId: "unit-second" };
const EMPTY_LESSON = { contentRevision: 1, exerciseIds: [] } as const;

function courseCardKeyOf(ref: LessonRef, cardId = "shared-card"): string {
  return `${ref.studyId}/${ref.courseId}/${ref.lessonId}/${cardId}`;
}

function markFor(ref: LessonRef, markId: string): ReaderMark {
  return {
    markId,
    lessonKey: lessonRefKey(ref),
    contentRevision: EMPTY_LESSON.contentRevision,
    kind: "question",
    quote: { exact: `来自 ${ref.unitId}`, prefix: "", suffix: "" },
    sectionTitle: null,
    note: null,
    createdAt: "2026-08-24T08:00:00.000Z",
    resolvedAt: null,
  };
}

describe("createBrowserPersistence", () => {
  it("round-trips the raw document under the product key", () => {
    const persistence = createBrowserPersistence();
    persistence.write('{"lessons":{}}');
    expect(persistence.read()).toBe('{"lessons":{}}');
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toBe('{"lessons":{}}');
  });

  it("reads null when nothing is stored, rather than inventing a document", () => {
    expect(createBrowserPersistence().read()).toBeNull();
  });

  it("returns null when the browser refuses to read, so a blocked store is empty not a crash", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(createBrowserPersistence().read()).toBeNull();
  });

  it("swallows a write failure so a full quota does not throw into a lesson", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => createBrowserPersistence().write("{}")).not.toThrow();
  });
});

describe("createBrowserProgressPort", () => {
  it("is the Persistence adapter wired to the one port, not a second store", () => {
    const port = createBrowserProgressPort();
    // Through the key builder, not a hand-typed string: the document's key and
    // the shared four-segment key were interchangeable at call sites once, and
    // a test that types its own string is a test that cannot notice.
    const key = lessonKey("s", "c", "l");
    port.advanceLesson(key, 1);
    const again = createProgressPort({ persistence: createBrowserPersistence() });
    expect(again.lessonState(key).progress).toBe(1);
    expect(again.snapshot().lessons[key]?.progress).toBe(1);
    expect(port.snapshot()).not.toEqual(emptyProgress());
  });

  it("keeps an existing v2 three-part row readable without migration", () => {
    const key = lessonKey("study", "course", "shared-lesson");
    window.localStorage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify({
        ...emptyProgress(),
        lessons: { [key]: { progress: 1, completedAt: 123, attempts: 1 } },
      }),
    );

    const port = createProgressPort({ persistence: createBrowserPersistence() });
    expect(port.lessonState(key)).toMatchObject({ progress: 1, completedAt: 123 });
  });

  it("round-trips the lossy lesson boundary through the browser document", () => {
    const firstKey = lessonKeyOf(COLLISION_FIRST);
    const secondKey = lessonKeyOf(COLLISION_SECOND);
    const firstCardKey = courseCardKeyOf(COLLISION_FIRST);
    const secondCardKey = courseCardKeyOf(COLLISION_SECOND);
    expect(firstKey).toBe(secondKey);
    expect(firstCardKey).toBe(secondCardKey);

    const port = createBrowserProgressPort();
    port.advanceLesson(firstKey, 1);
    port.confirmLessonRead(firstKey, EMPTY_LESSON.contentRevision);
    port.saveReaderMark(markFor(COLLISION_FIRST, "browser-first-mark"));
    port.createRecapCard({
      locator: COLLISION_FIRST,
      contentRevision: EMPTY_LESSON.contentRevision,
      commandId: "browser-first-recap",
      answer: "first browser answer",
    });
    port.dropCards(COLLISION_FIRST.studyId, COLLISION_FIRST.courseId, COLLISION_FIRST.lessonId, [
      "shared-card",
    ]);
    port.gradeCard(firstCardKey, "good");

    const reloaded = createProgressPort({ persistence: createBrowserPersistence() });
    expect(Object.keys(reloaded.snapshot().lessons)).toEqual([firstKey]);
    expect(progressSourceOf(reloaded).completionOf(COLLISION_FIRST, EMPTY_LESSON)).toEqual({
      exercisesPassed: true,
      readConfirmed: true,
    });
    expect(progressSourceOf(reloaded).completionOf(COLLISION_SECOND, EMPTY_LESSON)).toEqual({
      exercisesPassed: true,
      readConfirmed: true,
    });
    expect(
      reloaded
        .readerMarks(COLLISION_FIRST.studyId)
        .filter((mark) => mark.lessonKey === lessonRefKey(COLLISION_SECOND)),
    ).toEqual([]);
    expect(reloaded.recapCard(COLLISION_FIRST)).toMatchObject({
      unitId: COLLISION_FIRST.unitId,
    });
    expect(reloaded.recapCard(COLLISION_SECOND)).toBeNull();
    expect(reloaded.snapshot().cards[firstCardKey]?.fsrs.reps).toBe(1);
    expect(reloaded.snapshot().cards[recapCardKeyOf(COLLISION_FIRST)]).toBeDefined();
    expect(reloaded.snapshot().cards[recapCardKeyOf(COLLISION_SECOND)]).toBeUndefined();
  });
});
