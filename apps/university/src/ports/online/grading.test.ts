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
  content: "## 先猜一下\n\n这一段会说明为什么产品要先把问题说清楚。\n",
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

function undecidableSubmission(commandId: string) {
  return {
    locator: { ...locator, lessonId: long.id },
    exerciseId: "explain",
    contentRevision: 1,
    answer: "我的理解是另一回事。",
    commandId,
  };
}

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
  it("passes a deterministic answer without calling the metered service", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("tier one must not call the service");
    });
    const readAccessToken = vi.fn(async () => "should-not-be-read");
    const port = createOnlineGradingPort({
      fetchImpl,
      gradingUrl: "https://grading.example.test/api/grade",
      readAccessToken,
    });
    const result = await port.submitExercise({
      locator,
      exerciseId: "product-name-from-readme",
      contentRevision: 1,
      answer: "图灵密约",
      commandId: "c1",
    });
    expect(result.hostGrade?.passed).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(readAccessToken).not.toHaveBeenCalled();
  });

  it("keeps a deterministic wrong answer free too", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("tier one must not call the service");
    });
    const port = createOnlineGradingPort({
      fetchImpl,
      gradingUrl: "https://grading.example.test/api/grade",
      readAccessToken: async () => "should-not-be-read",
    });
    const result = await port.submitExercise({
      locator,
      exerciseId: "product-name-from-readme",
      contentRevision: 1,
      answer: "错",
      commandId: "c2",
    });
    expect(result.hostGrade?.passed).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends only an undecidable answer to the authenticated tier-two service", async () => {
    const readAccessToken = vi.fn(async () => "learner-access-token");
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.headers).toEqual({
        Authorization: "Bearer learner-access-token",
        "Content-Type": "application/json",
      });
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body).toMatchObject({
        answer: "我的理解是另一回事。",
        commandId: "c3",
        contentRevision: 1,
        exerciseId: "explain",
        prompt: "为什么？",
      });
      return new Response(
        JSON.stringify({
          hostGrade: {
            passed: true,
            evaluation: "你的解释抓住了关键关系。",
            extensions: [],
            host: "tier-2",
            learnerAnswer: "我的理解是另一回事。",
            occurredAt: "2026-08-26T00:00:00.000Z",
          },
          balance: {
            availablePowerUnits: "900",
            balancePowerUnits: "1000",
            reservedPowerUnits: "100",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    const port = createOnlineGradingPort({
      fetchImpl,
      gradingUrl: "https://grading.example.test/api/grade",
      readAccessToken,
    });
    const result = await port.submitExercise({
      locator: { ...locator, lessonId: long.id },
      exerciseId: "explain",
      contentRevision: 1,
      answer: "我的理解是另一回事。",
      commandId: "c3",
    });
    expect(result.hostGrade?.passed).toBe(true);
    expect(result.hostGrade?.host).toBe("tier-2");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(readAccessToken).toHaveBeenCalledTimes(1);
  });

  it("falls back to the tier-one clue when the learner is signed out", async () => {
    const port = createOnlineGradingPort({
      gradingUrl: "https://grading.example.test/api/grade",
      readAccessToken: async () => null,
    });

    await expect(
      port.submitExercise(undecidableSubmission("red-signed-out")),
    ).resolves.toMatchObject({
      hostGrade: {
        host: "tier-1",
        passed: false,
        evaluation: expect.stringContaining("再看一眼你刚才读过的这句"),
      },
    });
  });

  it("falls back to the tier-one clue when the service is not configured", async () => {
    const port = createOnlineGradingPort({
      readAccessToken: async () => "learner-access-token",
    });

    await expect(
      port.submitExercise(undecidableSubmission("red-no-service")),
    ).resolves.toMatchObject({
      hostGrade: {
        host: "tier-1",
        passed: false,
        evaluation: expect.stringContaining("再看一眼你刚才读过的这句"),
      },
    });
  });

  it("falls back to the tier-one clue when the metered service reports an insufficient balance", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            code: "insufficient_balance",
            error: "AI 批改余额不足：还剩 50 power units，这次需要 100。",
          }),
          { status: 402, headers: { "Content-Type": "application/json" } },
        ),
    );
    const port = createOnlineGradingPort({
      fetchImpl,
      gradingUrl: "https://grading.example.test/api/grade",
      readAccessToken: async () => "learner-access-token",
    });

    await expect(
      port.submitExercise(undecidableSubmission("red-insufficient")),
    ).resolves.toMatchObject({
      hostGrade: {
        host: "tier-1",
        passed: false,
        evaluation: expect.stringContaining("再看一眼你刚才读过的这句"),
      },
    });
  });

  it("falls back to the tier-one clue when the metered service times out", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("fake timeout");
    });
    const port = createOnlineGradingPort({
      fetchImpl,
      gradingUrl: "https://grading.example.test/api/grade",
      readAccessToken: async () => "learner-access-token",
    });

    await expect(port.submitExercise(undecidableSubmission("red-timeout"))).resolves.toMatchObject({
      hostGrade: {
        host: "tier-1",
        passed: false,
        evaluation: expect.stringContaining("再看一眼你刚才读过的这句"),
      },
    });
  });
});
