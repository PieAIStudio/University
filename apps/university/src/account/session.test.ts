import { describe, expect, it, vi } from "vitest";

import {
  createMemoryIdentityPort,
  createMemoryPersistence,
  createMemoryRemoteStore,
  createProgressPort,
  lessonKey,
  type HostExerciseGrade,
} from "@pieai/university-core";
import type { ReaderMark } from "@pieai/university-core/domain/reader-marks.js";

import { bindProgressToIdentity } from "./session";

const LESSON = lessonKey("turing-pact", "foundations-before-zero", "you-already-know-apps");
const LOCATOR = {
  studyId: "turing-pact",
  courseId: "foundations-before-zero",
  unitId: "first-steps",
  lessonId: "you-already-know-apps",
} as const;

const GRADE: HostExerciseGrade = {
  passed: true,
  evaluation: "通过",
  extensions: [],
  host: "test",
  learnerAnswer: "答案",
  occurredAt: "2026-08-27T00:00:00.000Z",
};

function mark(markId: string, exact: string): ReaderMark {
  return {
    markId,
    lessonKey: `${LOCATOR.studyId}/${LOCATOR.courseId}/${LOCATOR.unitId}/${LOCATOR.lessonId}`,
    contentRevision: 1,
    kind: "question",
    quote: { exact, prefix: "", suffix: "" },
    sectionTitle: null,
    note: null,
    createdAt: "2026-08-27T00:01:00.000Z",
    resolvedAt: null,
  };
}

describe("bindProgressToIdentity", () => {
  it("binds the anonymous session to the remote document", async () => {
    const progress = createProgressPort({ persistence: createMemoryPersistence() });
    const identity = createMemoryIdentityPort();
    const remote = createMemoryRemoteStore();
    const stop = bindProgressToIdentity(progress, identity, remote);

    await identity.signInAnonymously();
    await vi.waitFor(() => expect(progress.syncState().userId).toBe("memory:anonymous"));
    progress.advanceLesson(LESSON, 1);
    await progress.flush();

    expect(remote.records.get("memory:anonymous")?.lessons[LESSON]?.progress).toBe(1);
    stop();
  });

  it("merges anonymous cards, answers, and marks when a taken email leads to an existing login", async () => {
    const progress = createProgressPort({ persistence: createMemoryPersistence() });
    const identity = createMemoryIdentityPort();
    const remote = createMemoryRemoteStore();
    const stop = bindProgressToIdentity(progress, identity, remote);

    await identity.signInAnonymously();
    await vi.waitFor(() => expect(progress.syncState().userId).toBe("memory:anonymous"));
    progress.dropCards(LOCATOR.studyId, LOCATOR.courseId, LOCATOR.lessonId, ["from-anonymous"]);
    progress.saveReaderMark(mark("mark-from-anonymous", "匿名批注"));
    progress.recordExerciseAttempt({
      commandId: "answer-from-anonymous",
      locator: LOCATOR,
      exerciseId: "exercise-from-anonymous",
      contentRevision: 1,
      answer: "匿名答案",
      score: 1,
      maxScore: 1,
      hostGrade: GRADE,
      occurredAt: GRADE.occurredAt,
    });
    await progress.flush();

    const existing = createProgressPort({ persistence: createMemoryPersistence() });
    existing.dropCards(LOCATOR.studyId, LOCATOR.courseId, LOCATOR.lessonId, ["from-existing"]);
    existing.saveReaderMark(mark("mark-from-existing", "已有账号批注"));
    existing.recordExerciseAttempt({
      commandId: "answer-from-existing",
      locator: LOCATOR,
      exerciseId: "exercise-from-existing",
      contentRevision: 1,
      answer: "已有账号答案",
      score: 1,
      maxScore: 1,
      hostGrade: GRADE,
      occurredAt: "2026-08-27T00:02:00.000Z",
    });
    const existingUserId = "memory:existing@example.com";
    remote.records.set(existingUserId, existing.snapshot());

    const linkEmail = vi
      .spyOn(identity, "linkEmail")
      .mockRejectedValue(new Error("email already registered"));
    await expect(identity.linkEmail("existing@example.com", "password12")).rejects.toThrow(
      "email already registered",
    );
    expect(identity.status().kind).toBe("anonymous");

    await identity.signInWithEmail("existing@example.com", "password12");
    await vi.waitFor(() => expect(progress.syncState().userId).toBe(existingUserId));
    await progress.flush();

    const merged = remote.records.get(existingUserId);
    expect(
      merged?.cards[`${LOCATOR.studyId}/${LOCATOR.courseId}/${LOCATOR.lessonId}/from-anonymous`],
    ).toBeDefined();
    expect(
      merged?.cards[`${LOCATOR.studyId}/${LOCATOR.courseId}/${LOCATOR.lessonId}/from-existing`],
    ).toBeDefined();
    expect(merged?.exerciseAttempts["answer-from-anonymous"]?.answer).toBe("匿名答案");
    expect(merged?.exerciseAttempts["answer-from-existing"]?.answer).toBe("已有账号答案");
    expect(merged?.readerMarks["mark-from-anonymous"]?.quote.exact).toBe("匿名批注");
    expect(merged?.readerMarks["mark-from-existing"]?.quote.exact).toBe("已有账号批注");
    linkEmail.mockRestore();
    stop();
  });

  it("uploads local progress when the learner signs in", async () => {
    const progress = createProgressPort({ persistence: createMemoryPersistence() });
    const identity = createMemoryIdentityPort();
    const remote = createMemoryRemoteStore();
    progress.advanceLesson(LESSON, 1);

    const stop = bindProgressToIdentity(progress, identity, remote);
    await identity.signInWithEmail("ada@example.com", "password12");
    await vi.waitFor(() => {
      const status = identity.status();
      expect(status.kind).toBe("signed_in");
      if (status.kind !== "signed_in") throw new Error("expected signed_in");
      expect(progress.syncState().userId).toBe(status.user.id);
    });
    await progress.flush();

    const status = identity.status();
    expect(status.kind).toBe("signed_in");
    if (status.kind !== "signed_in") throw new Error("expected signed_in");
    expect(remote.records.get(status.user.id)?.lessons[LESSON]?.progress).toBe(1);
    stop();
  });

  it("keeps local progress after sign-out", async () => {
    const progress = createProgressPort({ persistence: createMemoryPersistence() });
    const identity = createMemoryIdentityPort();
    const remote = createMemoryRemoteStore();
    const stop = bindProgressToIdentity(progress, identity, remote);

    await identity.signInWithEmail("ada@example.com", "password12");
    await vi.waitFor(() => expect(progress.syncState().userId).toBe("memory:ada@example.com"));
    progress.advanceLesson(LESSON, 1);
    await progress.flush();
    await identity.signOut();
    await vi.waitFor(() => expect(progress.syncState().userId).toBeNull());
    await progress.flush();

    expect(progress.snapshot().lessons[LESSON]?.progress).toBe(1);
    stop();
  });
});
