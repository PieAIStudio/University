import { describe, expect, it } from "vitest";

import type { LessonRef } from "@pieai/university-core";

import {
  ANSWER_DRAFT_MAX_ENTRIES,
  ANSWER_DRAFT_TTL_MS,
  readAnswerDraft,
  writeAnswerDraft,
  type AnswerDraftIdentity,
  type AnswerDraftStorage,
} from "./answer-draft.js";

const LOCATOR: LessonRef = {
  studyId: "study-a",
  courseId: "course-a",
  unitId: "unit-a",
  lessonId: "lesson-a",
};

function identity(overrides: Partial<AnswerDraftIdentity> = {}): AnswerDraftIdentity {
  return {
    accountScope: "local-guest",
    locator: LOCATOR,
    exerciseId: "shared-exercise-id",
    contentRevision: 1,
    ...overrides,
  };
}

function memoryStorage(): AnswerDraftStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe("answer draft recovery", () => {
  it("restores an unsubmitted answer after a fresh reader mount", () => {
    const storage = memoryStorage();
    expect(writeAnswerDraft(storage, identity(), "还没提交的答案", 1_000)).toMatchObject({
      status: "saved",
    });

    expect(readAnswerDraft(storage, identity(), 1_001)).toEqual({
      status: "restored",
      answer: "还没提交的答案",
      updatedAt: 1_000,
    });
  });

  it("distinguishes unavailable storage and a failed save", () => {
    expect(writeAnswerDraft(null, identity(), "仍留在编辑器里", 1_000)).toEqual({
      status: "unavailable",
    });

    const failing = memoryStorage();
    failing.setItem = () => {
      throw new Error("quota full");
    };
    expect(writeAnswerDraft(failing, identity(), "仍留在编辑器里", 1_000)).toEqual({
      status: "failed",
      reason: "write-failed",
    });
  });

  it("never restores another account's answer", () => {
    const storage = memoryStorage();
    writeAnswerDraft(storage, identity({ accountScope: "account:ada" }), "Ada 的答案", 1_000);

    expect(readAnswerDraft(storage, identity({ accountScope: "account:lin" }), 1_001)).toEqual({
      status: "missing",
    });
  });

  it("never restores an answer from another content revision", () => {
    const storage = memoryStorage();
    writeAnswerDraft(storage, identity({ contentRevision: 3 }), "第三版答案", 1_000);

    expect(readAnswerDraft(storage, identity({ contentRevision: 4 }), 1_001)).toEqual({
      status: "missing",
    });
  });

  it("separates reused exercise ids across courses and the full lesson locator", () => {
    const storage = memoryStorage();
    writeAnswerDraft(storage, identity(), "A 课程答案", 1_000);

    expect(
      readAnswerDraft(storage, identity({ locator: { ...LOCATOR, courseId: "course-b" } }), 1_001),
    ).toEqual({ status: "missing" });
    expect(
      readAnswerDraft(storage, identity({ locator: { ...LOCATOR, lessonId: "lesson-b" } }), 1_001),
    ).toEqual({ status: "missing" });
  });

  it("removes an empty draft immediately", () => {
    const storage = memoryStorage();
    writeAnswerDraft(storage, identity(), "先写一点", 1_000);

    expect(writeAnswerDraft(storage, identity(), "", 1_001)).toEqual({ status: "cleared" });
    expect(readAnswerDraft(storage, identity(), 1_002)).toEqual({ status: "missing" });
  });

  it("expires old drafts and bounds the retained entry count", () => {
    const storage = memoryStorage();
    writeAnswerDraft(storage, identity(), "会过期", 1_000);
    expect(readAnswerDraft(storage, identity(), 1_000 + ANSWER_DRAFT_TTL_MS + 1)).toEqual({
      status: "missing",
    });

    for (let index = 0; index < ANSWER_DRAFT_MAX_ENTRIES + 5; index += 1) {
      writeAnswerDraft(
        storage,
        identity({ exerciseId: `exercise-${index}` }),
        `answer-${index}`,
        10_000 + index,
      );
    }
    expect(readAnswerDraft(storage, identity({ exerciseId: "exercise-0" }), 20_000)).toEqual({
      status: "missing",
    });
    expect(
      readAnswerDraft(
        storage,
        identity({ exerciseId: `exercise-${ANSWER_DRAFT_MAX_ENTRIES + 4}` }),
        20_000,
      ),
    ).toMatchObject({ status: "restored" });
  });
});
