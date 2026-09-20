import { describe, expect, it } from "vitest";
import { compileAnswerKey, compileChoiceAnswerKey } from "../grading/answer-key.js";
import {
  judgeCheckpointAnswer,
  planCheckpoint,
  settleCheckpoint,
  type CheckpointLesson,
} from "./checkpoint.js";

const lessons: CheckpointLesson[] = ["a", "b", "c"].map((id) => ({
  id,
  title: id,
  contentRevision: 2,
  exercises: [{ id: `${id}-test`, prompt: id, answerKey: compileChoiceAnswerKey("yes") }],
}));
const answers = (wrong = "") =>
  lessons.map((lesson) => ({
    lessonId: lesson.id,
    exerciseId: `${lesson.id}-test`,
    answer: lesson.id === wrong ? "no" : "yes",
  }));

describe("coverage checkpoints", () => {
  it("can assess a translated closed option without admitting open prose answers", () => {
    const exercise = {
      id: "translated",
      prompt:
        'Should you "ask again" or "check the original announcement"? Please copy one option.',
      answerKey: compileAnswerKey("check the original announcement"),
    };
    const sample = { ...lessons[0]!, exercises: [exercise] };
    const plan = planCheckpoint([sample]);
    expect(plan.questions).toHaveLength(1);
    expect(plan.questions[0]?.options?.map((option) => option.text)).toEqual([
      "ask again",
      "check the original announcement",
    ]);
    expect(plan.questions[0]?.prompt).not.toContain("Please copy");
    expect(
      settleCheckpoint(plan, [
        { lessonId: sample.id, exerciseId: exercise.id, answer: "check the original announcement" },
      ])?.proven,
    ).toEqual([sample.id]);
    expect(
      judgeCheckpointAnswer("ask again or check the original announcement", exercise.answerKey),
    ).toBe("wrong");
    expect(
      planCheckpoint([
        {
          ...sample,
          exercises: [{ ...exercise, prompt: "Explain your full reasoning in your own words." }],
        },
      ]).questions,
    ).toHaveLength(0);
    expect(
      planCheckpoint([
        {
          ...sample,
          exercises: [
            { ...exercise, answerKey: compileAnswerKey("an answer that is not among the options") },
          ],
        },
      ]).questions,
    ).toHaveLength(0);
  });
  it("covers each lesson instead of awarding untested lessons from a random sample", () => {
    const plan = planCheckpoint(lessons);
    expect(plan.questions).toHaveLength(3);
    expect(settleCheckpoint(plan, answers())?.proven).toEqual(["a", "b", "c"]);
    expect(settleCheckpoint(plan, answers("b"))).toMatchObject({
      proven: ["a", "c"],
      needsPractice: ["b"],
      complete: false,
    });
  });
  it("offers literal Chinese choices without turning quoted context into another choice", () => {
    const plan = planCheckpoint([
      {
        ...lessons[0]!,
        exercises: [
          {
            id: "copy",
            prompt: "AI 说“写得好”，你该“听夸奖”还是“查时区”？请抄写一个选项。",
            answerKey: compileAnswerKey("查时区"),
          },
        ],
      },
    ]);
    expect(plan.questions[0]?.options).toEqual([
      { id: "听夸奖", text: "听夸奖" },
      { id: "查时区", text: "查时区" },
    ]);
    expect(plan.questions[0]?.prompt).not.toContain("抄写");
    expect(
      settleCheckpoint(plan, [{ lessonId: "a", exerciseId: "copy", answer: "查时区" }])?.proven,
    ).toEqual(["a"]);
  });
  it("does not prove a lesson whose open task was not assessed", () => {
    const plan = planCheckpoint([
      ...lessons,
      {
        id: "open",
        title: "Open task",
        contentRevision: 1,
        exercises: [{ id: "make", prompt: "Create" }],
      },
    ]);
    expect(plan.unavailable.map((item) => item.lessonId)).toEqual(["open"]);
    expect(settleCheckpoint(plan, answers())).toMatchObject({
      complete: false,
      untested: ["open"],
      proven: ["a", "b", "c"],
    });
  });
  it("needs all exercises of each lesson, not just one of two", () => {
    const plan = planCheckpoint([
      {
        ...lessons[0]!,
        exercises: [
          ...lessons[0]!.exercises,
          { id: "extra", prompt: "extra", answerKey: compileAnswerKey("time") },
        ],
      },
    ]);
    expect(plan.questions).toHaveLength(2);
    expect(settleCheckpoint(plan, answers().slice(0, 1))).toBeNull();
  });
  it("rejects blanks, unknown identities, duplicate receipts and answer lists", () => {
    const plan = planCheckpoint(lessons);
    expect(settleCheckpoint(plan, [...answers().slice(0, 2), answers()[0]!])).toBeNull();
    expect(
      settleCheckpoint(
        plan,
        answers().map((answer) => ({ ...answer, answer: "" })),
      ),
    ).toBeNull();
    expect(
      settleCheckpoint(
        plan,
        answers().map((answer) => ({ ...answer, exerciseId: "unknown" })),
      ),
    ).toBeNull();
    expect(judgeCheckpointAnswer("Yes", compileChoiceAnswerKey("yes"))).toBe("wrong");
    expect(judgeCheckpointAnswer("图像、声音、文字", compileAnswerKey("图像"))).toBe("wrong");
    expect(judgeCheckpointAnswer(" 图像。", compileAnswerKey("图像"))).toBe("correct");
    expect(judgeCheckpointAnswer("[]", compileAnswerKey("[]"))).toBe("correct");
  });
  it("changes identity when task, answer or revision changes", () => {
    const baseline = planCheckpoint(lessons).fingerprint;
    expect(
      planCheckpoint(lessons.map((lesson) => ({ ...lesson, contentRevision: 3 }))).fingerprint,
    ).not.toBe(baseline);
    expect(
      planCheckpoint(
        lessons.map((lesson) => ({
          ...lesson,
          exercises: [{ ...lesson.exercises[0]!, prompt: "changed" }],
        })),
      ).fingerprint,
    ).not.toBe(baseline);
  });
});
