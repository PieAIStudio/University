import { afterEach, describe, expect, it } from "vitest";

import {
  captureLearningReturn,
  clearLearningReturn,
  continueLearningView,
  parseLearningReturn,
  readLearningReturn,
} from "./continue-learning.js";

afterEach(() => {
  clearLearningReturn();
});

describe("continue-learning handoff", () => {
  it("captures only a legitimate internal lesson and ignores arbitrary returnTo URLs", () => {
    captureLearningReturn({
      kind: "lesson",
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      unitId: "what-is-an-app",
      lessonId: "you-already-know-apps",
    });
    expect(readLearningReturn()).toEqual({
      kind: "lesson",
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      unitId: "what-is-an-app",
      lessonId: "you-already-know-apps",
    });
    expect(
      parseLearningReturn({
        returnTo: "https://evil.example/phish?token=secret",
        kind: "lesson",
        studyId: "turing-pact",
        courseId: "foundations-before-zero",
        unitId: "what-is-an-app",
        lessonId: "you-already-know-apps",
      }),
    ).toBeNull();
    expect(parseLearningReturn("https://evil.example/auth?code=secret")).toBeNull();
    expect(
      parseLearningReturn({
        kind: "lesson",
        studyId: "../etc",
        courseId: "foundations-before-zero",
        unitId: "what-is-an-app",
        lessonId: "you-already-know-apps",
      }),
    ).toBeNull();
  });

  it("does not replace a stored lesson when the current view is not a course", () => {
    captureLearningReturn({
      kind: "course",
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
    });
    captureLearningReturn({ kind: "me" });
    expect(readLearningReturn()).toEqual({
      kind: "course",
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
    });
  });

  it("never persists auth parameters or answer data", () => {
    expect(
      parseLearningReturn({
        kind: "lesson",
        studyId: "turing-pact",
        courseId: "foundations-before-zero",
        unitId: "what-is-an-app",
        lessonId: "you-already-know-apps",
        answer: "private",
      }),
    ).toBeNull();
    expect(
      parseLearningReturn({
        kind: "lesson",
        studyId: "turing-pact",
        courseId: "foundations-before-zero",
        unitId: "what-is-an-app",
        lessonId: "you-already-know-apps",
        access_token: "secret",
      }),
    ).toBeNull();
    captureLearningReturn({
      kind: "lesson",
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      unitId: "what-is-an-app",
      lessonId: "you-already-know-apps",
    });
    expect(readLearningReturn()).toEqual({
      kind: "lesson",
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      unitId: "what-is-an-app",
      lessonId: "you-already-know-apps",
    });
    if (typeof sessionStorage !== "undefined") {
      const stored = sessionStorage.getItem("university.account.continue-learning.v1");
      expect(stored).toContain("you-already-know-apps");
      expect(stored).not.toMatch(/access_token|password|answer|code=/);
    }
  });

  it("falls back to the actual next lesson without a stored return", () => {
    expect(
      continueLearningView(null, {
        studyId: "turing-pact",
        courseId: "foundations-before-zero",
        unitId: "what-is-an-app",
        lessonId: "you-already-know-apps",
      }),
    ).toEqual({
      kind: "lesson",
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      unitId: "what-is-an-app",
      lessonId: "you-already-know-apps",
    });
    expect(continueLearningView(null, null)).toEqual({ kind: "catalog" });
  });

  it("does not return to a retired course or reuse another account's settlement", () => {
    const captured = {
      kind: "settled",
      studyId: "old",
      courseId: "gone",
      unitId: "u",
      lessonId: "l",
    } as const;
    const next = { studyId: "live", courseId: "available", unitId: "u", lessonId: "l" };
    expect(continueLearningView(captured, next, (target) => target.studyId === "live")).toEqual({
      kind: "lesson",
      ...next,
    });
    expect(continueLearningView(captured, null, () => false)).toEqual({ kind: "catalog" });
    expect(continueLearningView(captured, null, () => true)).toEqual({
      ...captured,
      kind: "lesson",
    });
  });
});
