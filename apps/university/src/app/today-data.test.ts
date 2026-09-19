import { afterEach, describe, expect, it } from "vitest";

import {
  createMemoryPersistence,
  createProgressPort,
  lessonKey,
  RECAP_CARD_ID,
  PERSONAL_STUDY_ID,
  PERSONAL_CARD_ID,
  PERSONAL_LESSON_ID,
  PERSONAL_UNIT_ID,
  personalCourseId,
  type ProgressPort,
} from "@pieai/university-core";
import type { ShelfStudy } from "@pieai/university-ui/content/port.js";

import { nextLessonOf, todayCardLocatorOf } from "./today-data";

const REF = {
  studyId: "study",
  courseId: "course",
  unitId: "unit",
  lessonId: "lesson",
} as const;

const STUDIES: readonly ShelfStudy[] = [
  {
    id: REF.studyId,
    title: "Study",
    courses: [
      {
        id: REF.courseId,
        title: "Course",
        description: "",
        audience: "",
        objectives: [],
        isDefault: true,
        prerequisiteCourseIds: [],
        trackId: null,
        units: [
          {
            id: REF.unitId,
            title: "Unit",
            objective: "我能说出使用 App 和开发 App 的差别。",
            lessons: [
              {
                id: REF.lessonId,
                title: "Lesson",
                contentRevision: 2,
                cardCount: 0,
                exerciseCount: 1,
                exerciseIds: ["exercise"],
                contentChars: 1,
                progress: null,
              },
            ],
          },
        ],
      },
    ],
  },
];

let progress: ProgressPort;

afterEach(() => progress.resetAll());

describe("nextLessonOf", () => {
  it("does not turn old aggregate progress into completion after a new read confirmation", () => {
    progress = createProgressPort({ persistence: createMemoryPersistence() });
    const key = lessonKey(REF.studyId, REF.courseId, REF.lessonId);
    progress.advanceLesson(key, 1);
    progress.confirmLessonRead(key, 2);

    expect(nextLessonOf(STUDIES, REF, progress)?.progress).toMatchObject({
      contentRevision: 2,
      status: "in-progress",
      progress: 1,
      readConfirmed: true,
    });
  });
});

describe("todayCardLocatorOf", () => {
  it("can review private native cards after reload without public shelf entries", () => {
    const persistence = createMemoryPersistence();
    progress = createProgressPort({ persistence });
    const courseId = personalCourseId("abcdef012345-0123456789abcdef0123");
    progress.dropCards(PERSONAL_STUDY_ID, courseId, PERSONAL_LESSON_ID, [PERSONAL_CARD_ID]);
    const stored = Object.values(progress.snapshot().cards)[0]!;
    progress = createProgressPort({ persistence });
    const due = progress.dueCards(stored.dueAt)[0]!;
    expect(todayCardLocatorOf([], due)).toMatchObject({
      kind: "course-card",
      studyId: PERSONAL_STUDY_ID,
      courseId,
      unitId: PERSONAL_UNIT_ID,
      lessonId: PERSONAL_LESSON_ID,
      cardId: PERSONAL_CARD_ID,
    });
    expect(todayCardLocatorOf([], { ...due, courseId: "understanding-ai" })).toBeNull();
  });
  it("projects a due recap card with the existing unit capability sentence", () => {
    progress = createProgressPort({ persistence: createMemoryPersistence() });
    progress.createRecapCard({
      locator: REF,
      contentRevision: 2,
      commandId: "11111111-1111-4111-8111-111111111111",
      answer: "我会解释它。",
    });
    const stored = progress.recapCard(REF);
    expect(stored).not.toBeNull();
    const due = progress.dueCards(stored!.dueAt)[0];
    expect(due).toBeDefined();

    expect(todayCardLocatorOf(STUDIES, due!)).toEqual({
      kind: "recap-card",
      ...REF,
      cardId: RECAP_CARD_ID,
      front: "我能说出使用 App 和开发 App 的差别。",
      contentRevision: 2,
    });
  });
});
