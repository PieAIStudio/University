import { afterEach, describe, expect, it, vi } from "vitest";

import { lessonRefKey, type LessonRef } from "./contract.js";
import { createIdentityPort, createMemoryIdentityPort } from "../ports/identity.js";
import type { ReaderMark } from "../domain/reader-marks.js";
import type { HostExerciseGrade } from "../ports/grading.js";
import {
  emptyProgress,
  lessonKey,
  lessonKeyOf,
  parseProgress,
  recapCardKeyOf,
} from "./document.js";
import { createMemoryPersistence, createMemoryRemoteStore } from "./memory.js";
import { createProgressPort } from "./port.js";
import { progressSourceOf } from "./source.js";

const LESSON = lessonKey("turing-pact", "foundations-before-zero", "you-already-know-apps");
const CARDS = ["what-is-an-app", "files-on-a-screen"] as const;
const COLLISION_FIRST: LessonRef = {
  studyId: "turing-pact",
  courseId: "foundations-before-zero",
  unitId: "unit-first",
  lessonId: "shared-lesson",
};
const COLLISION_SECOND: LessonRef = { ...COLLISION_FIRST, unitId: "unit-second" };
const EMPTY_LESSON = { contentRevision: 1, exerciseIds: [] } as const;

function courseCardKeyOf(ref: LessonRef, cardId = "shared-card"): string {
  return `${ref.studyId}/${ref.courseId}/${ref.lessonId}/${cardId}`;
}

function markFor(ref: LessonRef, markId: string): ReaderMark {
  return {
    markId,
    lessonKey: lessonRefKey(ref),
    contentRevision: 1,
    kind: "question",
    quote: { exact: `来自 ${ref.unitId}`, prefix: "", suffix: "" },
    sectionTitle: null,
    note: null,
    createdAt: "2026-08-24T08:00:00.000Z",
    resolvedAt: null,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

function learnOneLesson(port: ReturnType<typeof createProgressPort>) {
  port.advanceLesson(LESSON, 1);
  port.dropCards("turing-pact", "foundations-before-zero", "you-already-know-apps", CARDS);
}

function spyConsole() {
  return {
    log: vi.spyOn(console, "log").mockImplementation(() => undefined),
    info: vi.spyOn(console, "info").mockImplementation(() => undefined),
    warn: vi.spyOn(console, "warn").mockImplementation(() => undefined),
    error: vi.spyOn(console, "error").mockImplementation(() => undefined),
    debug: vi.spyOn(console, "debug").mockImplementation(() => undefined),
  };
}

function expectConsoleClean(spies: ReturnType<typeof spyConsole>) {
  expect(spies.log).not.toHaveBeenCalled();
  expect(spies.info).not.toHaveBeenCalled();
  expect(spies.warn).not.toHaveBeenCalled();
  expect(spies.error).not.toHaveBeenCalled();
  expect(spies.debug).not.toHaveBeenCalled();
}

describe("one cloud progress document across devices", () => {
  it("1. no backend configured: a lesson still saves locally and the console stays quiet", async () => {
    const spies = spyConsole();
    const identity = createIdentityPort(null);
    const persistence = createMemoryPersistence();
    const port = createProgressPort({ persistence });

    expect(identity.status().kind).toBe("unconfigured");
    learnOneLesson(port);

    const stored = parseProgress(persistence.raw());
    expect(stored.lessons[LESSON]?.progress).toBe(1);
    expect(stored.lessons[LESSON]?.completedAt).not.toBeNull();
    expect(Object.keys(stored.cards)).toHaveLength(2);
    expect(identity.status().kind).toBe("unconfigured");
    expect(port.syncState().userId).toBeNull();
    expectConsoleClean(spies);

    await identity.signInWithEmail("nobody@example.com", "not-a-real-password");
    expect(identity.status().kind).toBe("unconfigured");
    expect(await identity.readAccessToken()).toBeNull();
    expectConsoleClean(spies);
  });

  it("2. backend configured but nobody signed in: identical to the unconfigured path", () => {
    const spies = spyConsole();
    const identity = createMemoryIdentityPort();
    const persistence = createMemoryPersistence();
    const port = createProgressPort({ persistence });

    expect(identity.status().kind).toBe("signed_out");
    learnOneLesson(port);

    expect(parseProgress(persistence.raw()).lessons[LESSON]?.progress).toBe(1);
    expect(port.syncState().userId).toBeNull();
    expect(port.snapshot()).toEqual(parseProgress(persistence.raw()));
    expectConsoleClean(spies);
  });

  it("3. sign-in uploads local progress instead of overwriting it", async () => {
    const persistence = createMemoryPersistence();
    const port = createProgressPort({ persistence });
    const identity = createMemoryIdentityPort();
    const remote = createMemoryRemoteStore();

    learnOneLesson(port);
    const localBefore = structuredClone(port.snapshot());

    remote.records.set("memory:ada@example.com", emptyProgress());
    await identity.signInWithEmail("ada@example.com", "password12");
    const status = identity.status();
    expect(status.kind).toBe("signed_in");
    if (status.kind !== "signed_in") throw new Error("expected signed_in");

    await port.bindAccount(status.user.id, remote);

    expect(port.snapshot().lessons[LESSON]?.progress).toBe(1);
    expect(remote.records.get(status.user.id)?.lessons[LESSON]?.progress).toBe(1);
    expect(Object.keys(port.snapshot().cards)).toEqual(Object.keys(localBefore.cards));
    expect(port.snapshot().lessons[LESSON]?.completedAt).toBe(
      localBefore.lessons[LESSON]?.completedAt,
    );
  });

  it("4. two machines that forked merge by the documented rules", async () => {
    const remote = createMemoryRemoteStore();
    const userId = "memory:ada@example.com";

    const phone = createProgressPort({ persistence: createMemoryPersistence() });
    phone.advanceLesson(LESSON, 1);
    phone.dropCards("turing-pact", "foundations-before-zero", "you-already-know-apps", [
      "only-on-phone",
    ]);
    await phone.bindAccount(userId, remote);

    const laptop = createProgressPort({ persistence: createMemoryPersistence() });
    const other = lessonKey("turing-pact", "foundations-before-zero", "app-is-a-pile-of-files");
    laptop.advanceLesson(other, 1);
    laptop.dropCards("turing-pact", "foundations-before-zero", "app-is-a-pile-of-files", [
      "only-on-laptop",
    ]);
    laptop.advanceLesson(LESSON, 0.4);
    await laptop.bindAccount(userId, remote);

    const merged = laptop.snapshot();
    expect(merged.lessons[LESSON]?.progress).toBe(1);
    expect(merged.lessons[other]?.progress).toBe(1);
    expect(
      merged.cards["turing-pact/foundations-before-zero/you-already-know-apps/only-on-phone"],
    ).toBeDefined();
    expect(
      merged.cards["turing-pact/foundations-before-zero/app-is-a-pile-of-files/only-on-laptop"],
    ).toBeDefined();
    expect(remote.records.get(userId)?.lessons[LESSON]?.progress).toBe(1);
  });

  it("5. signed in and offline, a lesson still saves, and coming back online pushes it", async () => {
    const persistence = createMemoryPersistence();
    const port = createProgressPort({ persistence });
    const remote = createMemoryRemoteStore();
    const userId = "memory:ada@example.com";

    remote.goOffline();
    await port.bindAccount(userId, remote);

    learnOneLesson(port);
    await port.flush();

    expect(port.snapshot().lessons[LESSON]?.progress).toBe(1);
    expect(parseProgress(persistence.raw()).lessons[LESSON]?.progress).toBe(1);
    expect(remote.records.get(userId)?.lessons[LESSON]).toBeUndefined();
    expect(port.syncState().status).toBe("offline");
    expect(port.syncState().dirty).toBe(true);

    remote.goOnline();
    await port.flush();

    expect(port.syncState().status).toBe("idle");
    expect(port.syncState().dirty).toBe(false);
    expect(remote.records.get(userId)?.lessons[LESSON]?.progress).toBe(1);
  });

  it("6. sign-out keeps local progress: wiping it would throw away the lesson they just finished", async () => {
    const persistence = createMemoryPersistence();
    const port = createProgressPort({ persistence });
    const identity = createMemoryIdentityPort();
    const remote = createMemoryRemoteStore();

    await identity.signInWithEmail("ada@example.com", "password12");
    const status = identity.status();
    if (status.kind !== "signed_in") throw new Error("expected signed_in");
    await port.bindAccount(status.user.id, remote);
    learnOneLesson(port);
    await port.flush();

    await identity.signOut();
    await port.bindAccount(null, null);

    expect(identity.status().kind).toBe("signed_out");
    expect(port.snapshot().lessons[LESSON]?.progress).toBe(1);
    expect(parseProgress(persistence.raw()).lessons[LESSON]?.progress).toBe(1);
    expect(port.syncState().userId).toBeNull();
    expect(port.syncState().status).toBe("idle");
    expect(remote.records.get(status.user.id)?.lessons[LESSON]?.progress).toBe(1);
  });

  it("7. carries marks and AI answers from one computer to another", async () => {
    const remote = createMemoryRemoteStore();
    const userId = "memory:ada@example.com";
    const locator: LessonRef = {
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      unitId: "first-steps",
      lessonId: "you-already-know-apps",
    };
    const mark: ReaderMark = {
      markId: "mark-from-phone",
      lessonKey: `${locator.studyId}/${locator.courseId}/${locator.unitId}/${locator.lessonId}`,
      contentRevision: 3,
      kind: "question",
      quote: { exact: "这是什么", prefix: "", suffix: "？" },
      sectionTitle: "先建立模型",
      note: null,
      createdAt: "2026-08-24T08:00:00.000Z",
      resolvedAt: null,
    };
    const hostGrade: HostExerciseGrade = {
      passed: true,
      evaluation: "结构完整。",
      extensions: [],
      host: "clipboard-host",
      learnerAnswer: "我的答案",
      occurredAt: "2026-08-24T08:01:00.000Z",
    };

    const phone = createProgressPort({ persistence: createMemoryPersistence() });
    phone.saveReaderMark(mark);
    phone.recordExerciseAttempt({
      commandId: "answer-from-phone",
      locator,
      exerciseId: "explain-the-model",
      contentRevision: 3,
      answer: "我的答案",
      score: 1,
      maxScore: 1,
      hostGrade,
      occurredAt: hostGrade.occurredAt,
    });
    await phone.bindAccount(userId, remote);

    const laptop = createProgressPort({ persistence: createMemoryPersistence() });
    await laptop.bindAccount(userId, remote);

    expect(laptop.readerMarks(locator.studyId)).toEqual([mark]);
    expect(laptop.latestExerciseAttempt(locator, "explain-the-model", 3)).toMatchObject({
      commandId: "answer-from-phone",
      answer: "我的答案",
      hostGrade,
    });
  });

  it("8. keeps a cloud deletion tombstone so an old device cannot resurrect a mark", async () => {
    const remote = createMemoryRemoteStore();
    const userId = "memory:ada@example.com";
    const mark: ReaderMark = {
      markId: "mark-to-delete",
      lessonKey: "turing-pact/foundations-before-zero/first-steps/lesson",
      contentRevision: 1,
      kind: "highlight",
      quote: { exact: "保留", prefix: "", suffix: "" },
      sectionTitle: null,
      note: null,
      createdAt: "2026-08-24T08:00:00.000Z",
      resolvedAt: null,
    };
    const phone = createProgressPort({ persistence: createMemoryPersistence() });
    phone.saveReaderMark(mark);
    await phone.bindAccount(userId, remote);

    const laptop = createProgressPort({ persistence: createMemoryPersistence() });
    await laptop.bindAccount(userId, remote);
    laptop.deleteReaderMark("turing-pact", mark.markId);
    await laptop.flush();

    const returningPhone = createProgressPort({ persistence: createMemoryPersistence() });
    await returningPhone.bindAccount(userId, remote);
    expect(returningPhone.readerMarks("turing-pact")).toEqual([]);
    expect(returningPhone.snapshot().readerMarks[mark.markId]?.deletedAt).not.toBeNull();
  });

  it("9. characterizes a cross-unit collision after a cloud row round-trip", async () => {
    const remote = createMemoryRemoteStore();
    const userId = "memory:lesson-identity-cloud";
    const firstKey = lessonKeyOf(COLLISION_FIRST);
    const secondKey = lessonKeyOf(COLLISION_SECOND);
    const firstCardKey = courseCardKeyOf(COLLISION_FIRST);
    const secondCardKey = courseCardKeyOf(COLLISION_SECOND);

    expect(firstKey).toBe(secondKey);
    expect(firstCardKey).toBe(secondCardKey);

    const writer = createProgressPort({ persistence: createMemoryPersistence() });
    writer.advanceLesson(firstKey, 1);
    writer.confirmLessonRead(firstKey, EMPTY_LESSON.contentRevision);
    writer.saveReaderMark(markFor(COLLISION_FIRST, "cloud-first-mark"));
    writer.createRecapCard({
      locator: COLLISION_FIRST,
      contentRevision: EMPTY_LESSON.contentRevision,
      commandId: "cloud-first-recap",
      answer: "first unit answer",
    });
    writer.dropCards(COLLISION_FIRST.studyId, COLLISION_FIRST.courseId, COLLISION_FIRST.lessonId, [
      "shared-card",
    ]);
    writer.gradeCard(firstCardKey, "good");
    await writer.bindAccount(userId, remote);

    const reader = createProgressPort({ persistence: createMemoryPersistence() });
    await reader.bindAccount(userId, remote);
    const row = remote.records.get(userId);

    expect(Object.keys(row?.lessons ?? {})).toEqual([firstKey]);
    expect(progressSourceOf(reader).completionOf(COLLISION_FIRST, EMPTY_LESSON)).toEqual({
      exercisesPassed: true,
      readConfirmed: true,
    });
    expect(progressSourceOf(reader).completionOf(COLLISION_SECOND, EMPTY_LESSON)).toEqual({
      exercisesPassed: true,
      readConfirmed: true,
    });
    expect(
      reader
        .readerMarks(COLLISION_FIRST.studyId)
        .filter((mark) => mark.lessonKey === lessonRefKey(COLLISION_SECOND)),
    ).toEqual([]);
    expect(reader.recapCard(COLLISION_FIRST)).toMatchObject({ unitId: COLLISION_FIRST.unitId });
    expect(reader.recapCard(COLLISION_SECOND)).toBeNull();
    expect(row?.cards[firstCardKey]?.fsrs.reps).toBe(1);
    expect(row?.cards[recapCardKeyOf(COLLISION_FIRST)]).toBeDefined();
    expect(row?.cards[recapCardKeyOf(COLLISION_SECOND)]).toBeUndefined();
  });

  it("10. characterizes the same collision when two offline copies merge", async () => {
    const remote = createMemoryRemoteStore();
    const userId = "memory:lesson-identity-offline";
    const firstKey = lessonKeyOf(COLLISION_FIRST);
    const firstCardKey = courseCardKeyOf(COLLISION_FIRST);
    const first = createProgressPort({ persistence: createMemoryPersistence() });
    const second = createProgressPort({ persistence: createMemoryPersistence() });

    await first.bindAccount(userId, remote);
    await second.bindAccount(userId, remote);
    remote.goOffline();

    first.advanceLesson(firstKey, 1);
    first.confirmLessonRead(firstKey, EMPTY_LESSON.contentRevision);
    first.saveReaderMark(markFor(COLLISION_FIRST, "offline-first-mark"));
    first.createRecapCard({
      locator: COLLISION_FIRST,
      contentRevision: EMPTY_LESSON.contentRevision,
      commandId: "offline-first-recap",
      answer: "first offline answer",
    });
    first.dropCards(COLLISION_FIRST.studyId, COLLISION_FIRST.courseId, COLLISION_FIRST.lessonId, [
      "shared-card",
    ]);
    first.gradeCard(firstCardKey, "good");

    second.advanceLesson(lessonKeyOf(COLLISION_SECOND), 0.4);
    second.saveReaderMark(markFor(COLLISION_SECOND, "offline-second-mark"));
    second.createRecapCard({
      locator: COLLISION_SECOND,
      contentRevision: EMPTY_LESSON.contentRevision,
      commandId: "offline-second-recap",
      answer: "second offline answer",
    });
    second.dropCards(
      COLLISION_SECOND.studyId,
      COLLISION_SECOND.courseId,
      COLLISION_SECOND.lessonId,
      ["shared-card"],
    );

    await first.flush();
    await second.flush();
    expect(first.syncState().status).toBe("offline");
    expect(second.syncState().status).toBe("offline");

    remote.goOnline();
    await first.flush();
    await second.flush();

    const row = remote.records.get(userId);
    expect(Object.keys(row?.lessons ?? {})).toEqual([firstKey]);
    expect(Object.keys(row?.readerMarks ?? {}).sort()).toEqual([
      "offline-first-mark",
      "offline-second-mark",
    ]);
    expect(Object.keys(row?.cards ?? {}).sort()).toEqual(
      [firstCardKey, recapCardKeyOf(COLLISION_FIRST), recapCardKeyOf(COLLISION_SECOND)].sort(),
    );
    expect(row?.cards[firstCardKey]?.fsrs.reps).toBe(1);
    expect(progressSourceOf(second).completionOf(COLLISION_SECOND, EMPTY_LESSON)).toEqual({
      exercisesPassed: true,
      readConfirmed: true,
    });
  });
});
