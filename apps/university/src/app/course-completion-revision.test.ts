import { describe, expect, it } from "vitest";
import { emptyProgress, parseProgress } from "@pieai/university-core";
import { courseCompletionRevision } from "./course-completion-revision.js";

describe("appearance must not regenerate the learning map", () => {
  it("ignores preference/cache snapshot identity but observes real read progress", () => {
    const before = emptyProgress();
    const after = parseProgress(JSON.stringify(before));
    after.account = {
      ...after.account,
      preferences: { ...after.account.preferences, worldStyle: "clay", theme: "dark" },
    };
    expect(courseCompletionRevision(after)).toBe(courseCompletionRevision(before));
    after.lessons["study/course/lesson"] = {
      progress: 0.5,
      readConfirmed: true,
      completedAt: null,
      attempts: 1,
    };
    expect(courseCompletionRevision(after)).not.toBe(courseCompletionRevision(before));
  });
  it("observes exercise evidence changes even when the lesson progress number is unchanged", () => {
    const first = emptyProgress();
    const next = {
      ...first,
      exerciseAttempts: {
        proof: {
          commandId: "proof",
          locator: { studyId: "s", courseId: "c", unitId: "u", lessonId: "l" },
          exerciseId: "e",
          contentRevision: 1,
          answer: "test answer",
          score: 0,
          maxScore: 1,
          hostGrade: null,
          occurredAt: "2026-09-18T12:00:00Z",
        },
      },
    };
    expect(courseCompletionRevision(next)).not.toBe(courseCompletionRevision(first));
  });
});
