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
      hostGrade: {
        passed: true,
        outcome: "pass",
        evaluation: "正确",
        extensions: [],
        host: "tier-1",
        learnerAnswer: "answer",
        occurredAt: "2026-08-26T00:00:00.000Z",
      },
      occurredAt: "2026-08-26T00:00:00.000Z",
    });

    expect(port.snapshot().totalXp).toBe(XP_READ_LESSON + XP_EXERCISE_FIRST_TRY);
  });

  it("does not grant first-try XP for an ungraded or undecided result", () => {
    for (const hostGrade of [
      null,
      {
        outcome: "undecided" as const,
        passed: false,
        evaluation: "暂时无法判断",
        extensions: [],
        host: "tier-1",
        learnerAnswer: "answer",
        occurredAt: "2026-08-26T00:00:00.000Z",
      },
    ]) {
      const port = createProgressPort({ persistence: createMemoryPersistence() });
      port.recordExerciseAttempt({
        commandId: "uncertain",
        locator: { studyId: "s", courseId: "c", unitId: "u", lessonId: "l" },
        exerciseId: "e",
        contentRevision: 1,
        answer: "answer",
        score: 1,
        maxScore: 1,
        hostGrade,
        occurredAt: "2026-08-26T00:00:00.000Z",
      });
      expect(port.snapshot().totalXp).toBe(0);
    }
  });
});
