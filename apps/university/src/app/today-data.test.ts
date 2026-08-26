import { afterEach, describe, expect, it } from "vitest";

import {
  createMemoryPersistence,
  createProgressPort,
  lessonKey,
  type ProgressPort,
} from "@pieai/university-core";
import type { ShelfStudy } from "@pieai/university-ui/content/port.js";

import { nextLessonOf } from "./today-data";

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
        status: "active",
        isDefault: true,
        prerequisiteCourseIds: [],
        trackId: null,
        units: [
          {
            id: REF.unitId,
            title: "Unit",
            objective: "",
            status: "active",
            lessons: [
              {
                id: REF.lessonId,
                title: "Lesson",
                status: "active",
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
