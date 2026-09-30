import { describe, expect, it } from "vitest";
import { compileAnswerKey } from "../grading/answer-key.js";
import { createProgressPort } from "../progress/port.js";
import { createMemoryPersistence } from "../progress/memory.js";
import { emptyProgress, lessonKeyOf } from "../progress/document.js";
import { progressSourceOf } from "../progress/source.js";
import { answerStatsOf } from "../progress/answer-stats.js";
import { allFirstTry } from "../progress/first-try.js";
import { mistakesOf } from "../progress/mistakes.js";
import { mergeProgress } from "../progress/merge.js";
import {
  completedPracticeLessons,
  lessonPracticeQuestions,
  lessonPracticeAttempt,
  pickLessonPractice,
  type PracticeCourse,
  type PracticeLessonBody,
  type LessonPracticeQuestion,
} from "./lesson-practice.js";

const locator = { studyId: "s", courseId: "c", unitId: "u", lessonId: "l" };
const course: PracticeCourse = {
  studyId: "s",
  id: "c",
  title: "A real course",
  units: [
    {
      id: "u",
      lessons: [
        { id: "l", title: "Finished", contentRevision: 1, exerciseIds: ["q"] },
        { id: "unseen", title: "Not studied", contentRevision: 1, exerciseIds: ["new-q"] },
      ],
    },
  ],
};
const body: PracticeLessonBody = {
  id: "l",
  contentRevision: 1,
  exercises: [
    {
      id: "q",
      prompt: "The native question",
      contentRevision: 1,
      answerKey: compileAnswerKey("hello"),
    },
  ],
};
const question: LessonPracticeQuestion = {
  id: "practice-question-l-q-1",
  locator,
  lessonId: "l",
  exerciseId: "q",
  prompt: "The native question",
  answerKey: compileAnswerKey("hello"),
  courseTitle: "A real course",
  lessonTitle: "Finished",
  lessonNumber: 1,
  contentRevision: 1,
  previousMistake: false,
};
const make = () => createProgressPort({ persistence: createMemoryPersistence() });
function finish(port: ReturnType<typeof make>) {
  port.confirmLessonRead(lessonKeyOf(locator), 1);
  const record = lessonPracticeAttempt(question, "hello", "original", 1000)!;
  const { purpose: _purpose, ...original } = record;
  port.recordExerciseAttempt(original);
  port.advanceLesson(lessonKeyOf(locator), 1);
}

describe("V7 native lesson practice", () => {
  it("uses the loaded question's actual revision rather than a larger unrelated lesson-edition number", () => {
    const port = make();
    finish(port);
    const ref = completedPracticeLessons([course], progressSourceOf(port))[0]!;
    const history = port.snapshot();
    history.exerciseAttempts["package-pass"] = {
      ...history.exerciseAttempts.original!,
      commandId: "package-pass",
      contentRevision: 3,
    };
    history.exerciseAttempts["source-mistake"] = lessonPracticeAttempt(
      question,
      "planet",
      "source-mistake",
      2000,
    )!;
    expect(lessonPracticeQuestions([{ ref, body }], history)[0]?.previousMistake).toBe(true);
    history.exerciseAttempts["source-correction"] = lessonPracticeAttempt(
      question,
      "hello",
      "source-correction",
      3000,
    )!;
    expect(lessonPracticeQuestions([{ ref, body }], history)[0]?.previousMistake).toBe(false);
    const nextBody = { ...body, exercises: [{ ...body.exercises[0]!, contentRevision: 2 }] };
    delete history.exerciseAttempts["source-correction"];
    expect(lessonPracticeQuestions([{ ref, body: nextBody }], history)[0]?.previousMistake).toBe(
      false,
    );
  });
  it("a fresh learner gets no questions from the global concept bank", () => {
    expect(completedPracticeLessons([course], progressSourceOf(make()))).toEqual([]);
  });
  it("only a completed current lesson supplies questions and retains the original exercise identity", () => {
    const port = make();
    finish(port);
    const lessons = completedPracticeLessons([course], progressSourceOf(port));
    expect(lessons.map((lesson) => lesson.locator.lessonId)).toEqual(["l"]);
    const questions = lessonPracticeQuestions([{ ref: lessons[0]!, body }], port.snapshot());
    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      locator,
      lessonNumber: 1,
      exerciseId: "q",
      prompt: body.exercises[0]!.prompt,
    });
  });
  it("exercise success without confirmed reading cannot supply a practice question", () => {
    const port = make();
    const { purpose: _purpose, ...record } = lessonPracticeAttempt(question, "hello", "q", 1000)!;
    port.recordExerciseAttempt(record);
    expect(completedPracticeLessons([course], progressSourceOf(port))).toEqual([]);
  });
  it("stale lesson revisions and incomplete exercise metadata stay out", () => {
    const port = make();
    finish(port);
    for (const patch of [{ contentRevision: 2 }, { exerciseIdsComplete: false }]) {
      const changed = {
        ...course,
        units: [{ id: "u", lessons: [{ ...course.units[0]!.lessons[0]!, ...patch }] }],
      };
      expect(completedPracticeLessons([changed], progressSourceOf(port))).toEqual([]);
    }
  });
  it("a returned body from another revision or lesson cannot enter the sitting", () => {
    const port = make();
    finish(port);
    const ref = completedPracticeLessons([course], progressSourceOf(port))[0]!;
    for (const patch of [{ contentRevision: 2 }, { id: "elsewhere" }])
      expect(
        lessonPracticeQuestions([{ ref, body: { ...body, ...patch } }], port.snapshot()),
      ).toEqual([]);
  });
  it("open-ended, empty and undeclared questions are not silently guessed or invented", () => {
    const port = make();
    finish(port);
    const ref = completedPracticeLessons([course], progressSourceOf(port))[0]!;
    for (const exercise of [
      { ...body.exercises[0]!, answerKey: undefined },
      { ...body.exercises[0]!, prompt: " " },
      { ...body.exercises[0]!, id: "not-declared" },
    ]) {
      expect(
        lessonPracticeQuestions(
          [{ ref, body: { ...body, exercises: [exercise] } }],
          port.snapshot(),
        ),
      ).toEqual([]);
    }
  });
  it("duplicate bodies do not duplicate questions", () => {
    const port = make();
    finish(port);
    const ref = completedPracticeLessons([course], progressSourceOf(port))[0]!;
    expect(
      lessonPracticeQuestions(
        [
          { ref, body },
          { ref, body },
        ],
        port.snapshot(),
      ),
    ).toHaveLength(1);
  });
  it("uncorrected mistakes lead; the remaining native questions are actually shuffled", () => {
    const questions = [
      question,
      { ...question, id: "mistake", previousMistake: true },
      { ...question, id: "next" },
    ];
    expect(pickLessonPractice(questions, () => 0).map((q) => q.id)).toEqual([
      "mistake",
      "next",
      question.id,
    ]);
    expect(questions[0]).toBe(question);
  });
  it("empty answers are not attempts; correct answers use the existing fingerprint", () => {
    expect(lessonPracticeAttempt(question, "  ", "empty", 1000)).toBeNull();
    expect(lessonPracticeAttempt(question, "hello", "yes", 1000)?.hostGrade?.passed).toBe(true);
    expect(lessonPracticeAttempt(question, "planet", "no", 1000)?.hostGrade?.passed).toBe(false);
  });
  it("a rehearsal cannot grant XP, finish an unseen level or produce a first-try reward", () => {
    const port = make();
    port.recordExerciseAttempt(lessonPracticeAttempt(question, "hello", "practice", 1000)!);
    expect(port.snapshot().totalXp).toBe(0);
    expect(port.latestExerciseAttempt(locator, "q", 1)).toBeNull();
    expect(allFirstTry(port.snapshot(), locator)).toBe(false);
    expect(completedPracticeLessons([course], progressSourceOf(port))).toEqual([]);
  });
  it("the official lesson summary is unchanged by later rehearsals", () => {
    const port = make();
    finish(port);
    const before = answerStatsOf(port.snapshot(), locator, 1, 1);
    port.recordExerciseAttempt(lessonPracticeAttempt(question, "planet", "practice-no", 2000)!);
    port.recordExerciseAttempt(lessonPracticeAttempt(question, "hello", "practice-yes", 3000)!);
    expect(answerStatsOf(port.snapshot(), locator, 1, 1)).toEqual(before);
    expect(mistakesOf(port.snapshot())[0]?.corrected).toBe(true);
  });
  it("a wrong rehearsal enters the same mistake book but cannot revoke the completed level", () => {
    const port = make();
    finish(port);
    const xp = port.snapshot().totalXp;
    port.recordExerciseAttempt(lessonPracticeAttempt(question, "planet", "wrong", 2000)!);
    expect(mistakesOf(port.snapshot())[0]?.corrected).toBe(false);
    expect(completedPracticeLessons([course], progressSourceOf(port))).toHaveLength(1);
    expect(allFirstTry(port.snapshot(), locator)).toBe(true);
    expect(port.snapshot().totalXp).toBe(xp);
  });
  it("correcting it clears the original mistake without repeating XP or modifying the original verdict", () => {
    const port = make();
    finish(port);
    const xp = port.snapshot().totalXp;
    port.recordExerciseAttempt(lessonPracticeAttempt(question, "planet", "wrong", 2000)!);
    port.recordExerciseAttempt(lessonPracticeAttempt(question, "hello", "correct", 3000)!);
    expect(mistakesOf(port.snapshot())[0]?.corrected).toBe(true);
    expect(port.latestExerciseAttempt(locator, "q", 1)?.commandId).toBe("original");
    expect(port.snapshot().totalXp).toBe(xp);
    expect(Object.keys(port.snapshot().xpEvents)).not.toContain("practice");
  });
  it("the purpose survives merge, persistence and repeated delivery of one operation", () => {
    const persistence = createMemoryPersistence();
    const port = createProgressPort({ persistence });
    const record = lessonPracticeAttempt(question, "hello", "once", 1000)!;
    port.recordExerciseAttempt(record);
    port.recordExerciseAttempt(record);
    const reopened = createProgressPort({ persistence });
    expect(Object.keys(reopened.snapshot().exerciseAttempts)).toEqual(["once"]);
    expect(mergeProgress(emptyProgress(), reopened.snapshot()).exerciseAttempts.once?.purpose).toBe(
      "practice",
    );
    expect(reopened.snapshot().totalXp).toBe(0);
  });
});
