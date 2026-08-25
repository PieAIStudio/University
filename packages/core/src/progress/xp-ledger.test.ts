import { describe, expect, it } from "vitest";

import { XP_EXERCISE_FIRST_TRY, XP_READ_LESSON } from "./xp.js";
import { createMemoryPersistence } from "./memory.js";
import { createProgressPort } from "./port.js";
import { lessonKey, parseProgress } from "./document.js";

describe("shared XP event ledger", () => {
  it("records one event once and persists the cumulative total", () => {
    const persistence = createMemoryPersistence();
    const port = createProgressPort({ persistence });

    port.addXp("lesson/read", XP_READ_LESSON);
    port.addXp("lesson/read", XP_READ_LESSON);

    expect(port.snapshot().totalXp).toBe(XP_READ_LESSON);
    expect(port.snapshot().xpEvents).toEqual({ "lesson/read": XP_READ_LESSON });
    expect(parseProgress(persistence.raw())).toEqual(port.snapshot());
  });

  it("awards the existing read and first-try scores into the shared total", () => {
    const port = createProgressPort({ persistence: createMemoryPersistence() });
    const locator = {
      studyId: "study",
      courseId: "course",
      unitId: "unit",
      lessonId: "lesson",
    } as const;

    port.confirmLessonRead(lessonKey(locator.studyId, locator.courseId, locator.lessonId), 1);
    port.recordExerciseAttempt({
      commandId: "first-answer",
      locator,
      exerciseId: "exercise",
      contentRevision: 1,
      answer: "answer",
      score: 1,
      maxScore: 1,
      hostGrade: null,
      occurredAt: "2026-08-26T00:00:00.000Z",
    });

    expect(port.snapshot().totalXp).toBe(XP_READ_LESSON + XP_EXERCISE_FIRST_TRY);
  });
});
