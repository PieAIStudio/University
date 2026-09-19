import { describe, expect, it, vi } from "vitest";
import {
  createMemoryPersistence,
  createProgressPort,
  PERSONAL_STUDY_ID,
  PERSONAL_UNIT_ID,
  PERSONAL_LESSON_ID,
  personalCourseId,
  type LessonRef,
} from "@pieai/university-core";
import type { ContentPort } from "@pieai/university-ui/content/port.js";
import type { LessonView } from "@pieai/university-ui/view/lesson-view.js";

const mock = vi.hoisted(() => ({ body: {} as unknown }));
vi.mock("./api.js", async (original) => ({
  ...(await original<object>()),
  personalAccountScope: () => "guest-content-test",
  readPersonalJson: async () => mock.body,
}));
import { createPersonalContentPort } from "./content.js";

const ref: LessonRef = {
  studyId: PERSONAL_STUDY_ID,
  courseId: personalCourseId("abcdef012345-0123456789abcdef0123"),
  unitId: PERSONAL_UNIT_ID,
  lessonId: PERSONAL_LESSON_ID,
};
const grade = {
  outcome: "pass" as const,
  passed: true,
  evaluation: "The final work preserves the new location.",
  extensions: [],
  host: "test-grader",
  learnerAnswer: "current final work",
  occurredAt: "2026-09-18T10:00:00Z",
};
describe("private lesson progress projection", () => {
  it("restores the learner's exact current-revision grade after reload without altering the native body", async () => {
    const persistence = createMemoryPersistence();
    let progress = createProgressPort({ persistence });
    mock.body = {
      lesson: {
        id: ref.lessonId,
        contentRevision: 1,
        exercises: [
          {
            id: "make",
            kind: "explain",
            title: "Make",
            prompt: "Write a reminder",
            contentRevision: 1,
          },
        ],
        cards: [],
      },
    } as unknown as LessonView;
    progress.recordExerciseAttempt({
      commandId: "graded-task",
      locator: ref,
      exerciseId: "make",
      contentRevision: 1,
      answer: grade.learnerAnswer,
      score: 1,
      maxScore: 1,
      hostGrade: grade,
      occurredAt: grade.occurredAt,
    });
    progress = createProgressPort({ persistence });
    const content = createPersonalContentPort({} as ContentPort, progress);
    const restored = await content.lesson(ref);
    expect(restored.lesson.exercises[0]?.hostGrade).toEqual(grade);
    expect(restored.lesson.exercises[0]?.latestSubmission?.answer).toBe(grade.learnerAnswer);
    expect((mock.body as LessonView).lesson.exercises[0]?.hostGrade).toBeUndefined();
    expect(Object.keys(progress.snapshot().cards)).toEqual([]);
    // A new exercise revision may not borrow the earlier successful work.
    mock.body = {
      ...(mock.body as LessonView),
      lesson: {
        ...restored.lesson,
        contentRevision: 2,
        exercises: restored.lesson.exercises.map((exercise) => ({
          ...exercise,
          contentRevision: 2,
        })),
      },
    };
    expect((await content.lesson(ref)).lesson.exercises[0]?.hostGrade).toBeNull();
  });

  it("leaves ordinary course loading with its original content port", async () => {
    const lesson = vi.fn().mockResolvedValue({ lesson: { id: "ordinary" } });
    const content = createPersonalContentPort(
      { lesson } as unknown as ContentPort,
      createProgressPort({ persistence: createMemoryPersistence() }),
    );
    const normal = { ...ref, studyId: "ordinary-study" };
    expect(await content.lesson(normal)).toEqual({ lesson: { id: "ordinary" } });
    expect(lesson).toHaveBeenCalledWith(normal, undefined);
  });
});
