import { beforeAll, describe, expect, it, vi } from "vitest";

import { compileAnswerKey } from "@pieai/university-core";

import { loadCourse, type Course, type Lesson } from "../../content/library";
import { createOnlineGradingPort } from "./grading";

const lesson: Lesson = {
  id: "you-already-know-apps",
  title: "会使用 App 和会开发 App，差在哪儿？",
  content: "## 先猜一下\n\n产品叫图灵密约。\n",
  contentRevision: 1,
  evidence: [
    {
      kind: "fact",
      sourceCommit: "abc",
      sourcePath: "README.md",
      lineStart: 1,
      lineEnd: 4,
    },
  ],
  assets: [],
  cards: [],
  exercises: [
    {
      id: "product-name-from-readme",
      kind: "short-answer",
      title: "产品中文名",
      prompt: "README 第 1 行里，产品的中文名是哪四个字？",
      answerKey: compileAnswerKey("图灵密约"),
    },
  ],
};

const long: Lesson = {
  ...lesson,
  id: "why-though",
  exercises: [
    {
      id: "explain",
      kind: "explain",
      prompt: "为什么？",
      answerKey: compileAnswerKey("这是一句超过十二个字的参考答案所以第一层判不了"),
    },
  ],
};

const COURSE: Course = {
  id: "foundations-before-zero",
  title: "在开始之前",
  description: "",
  audience: "",
  objectives: [],
  prerequisiteCourseIds: [],
  trackId: null,
  units: [{ id: "what-is-an-app", title: "u", objective: "", lessons: [lesson, long] }],
};

const locator = {
  studyId: "turing-pact",
  courseId: COURSE.id,
  unitId: "what-is-an-app",
  lessonId: lesson.id,
};

/*
  The port finds the lesson from the address rather than being handed one, so
  the package has to be in the session's cache — which is exactly the state the
  reader is in by the time an answer is submitted.
*/
beforeAll(async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ course: COURSE }) }) as Response),
  );
  await loadCourse(locator.studyId, COURSE.id);
  vi.unstubAllGlobals();
});

describe("createOnlineGradingPort", () => {
  it("passes the four-character product name without a host", async () => {
    const port = createOnlineGradingPort({});
    const result = await port.submitExercise({
      locator,
      exerciseId: "product-name-from-readme",
      contentRevision: 1,
      answer: "图灵密约",
      commandId: "c1",
    });
    expect(result.hostGrade?.passed).toBe(true);
  });

  it("does not mark an undecidable sentence wrong", async () => {
    const port = createOnlineGradingPort({});
    const result = await port.submitExercise({
      locator: { ...locator, lessonId: long.id },
      exerciseId: "explain",
      contentRevision: 1,
      answer: "我的理解是另一回事。",
      commandId: "c2",
    });
    expect(result.hostGrade?.passed).toBe(false);
    expect(result.hostGrade?.evaluation).toMatch(/第 1 层判不了|升到第 2 层/);
  });
});
