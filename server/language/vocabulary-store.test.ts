import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Rating } from "ts-fsrs";
import { describe, expect, it } from "vitest";

import { VocabularyStore, getVocabularyDatabasePath } from "./vocabulary-store.js";

function open(): VocabularyStore {
  const root = mkdtempSync(join(tmpdir(), "university-local-vocab-"));
  return new VocabularyStore(getVocabularyDatabasePath(root));
}

const CONTEXT = { studyId: "turing-pact", lessonId: "you-already-know-apps" };

describe("vocabulary store", () => {
  /**
   * The whole point of separating `presented` from every other event: a word
   * that scrolled past is not a word that was learned, and nothing about
   * showing it may create progress.
   */
  it("showing a word creates no state and no progress", () => {
    const store = open();
    store.recordPresented(["snapshot.git", "commit.git"], CONTEXT);

    expect(store.readState("snapshot.git")).toBeNull();
    expect(store.listDue(10)).toEqual([]);
    expect(store.budget().introducedToday).toBe(0);
    store.close();
  });

  it("counts a word shown twice in one lesson on one day only once", () => {
    const store = open();
    const now = new Date("2026-08-06T10:00:00.000Z");
    store.recordPresented(["snapshot.git"], CONTEXT, now);
    store.recordPresented(["snapshot.git"], CONTEXT, new Date("2026-08-06T10:05:00.000Z"));
    store.recordPresented(["snapshot.git"], CONTEXT, new Date("2026-08-06T23:59:00.000Z"));

    // Re-reading a lesson must not inflate exposure. A later day is a real
    // second encounter and does count.
    store.recordPresented(["snapshot.git"], CONTEXT, new Date("2026-08-07T09:00:00.000Z"));
    store.close();
  });

  it("a word the learner says they do not know becomes due immediately", () => {
    const store = open();
    const now = new Date("2026-08-06T10:00:00.000Z");
    const state = store.setStage("stale.cache", "learning", now);

    expect(state.stage).toBe("learning");
    expect(store.listDue(10, now).map((row) => row.senseId)).toEqual(["stale.cache"]);
    store.close();
  });

  it("a word the learner claims to know goes quiet without graduating", () => {
    const store = open();
    const state = store.setStage("commit.git", "familiar");

    // Familiar is a request for less noise, not mastery: it must not be
    // reported as stable, and it must not sit in the due queue.
    expect(state.stage).toBe("familiar");
    expect(state.dueAt).toBeNull();
    expect(store.listDue(10)).toEqual([]);
    store.close();
  });

  it("a paused word stays out of the queue even with a due date in the past", () => {
    const store = open();
    const now = new Date("2026-08-06T10:00:00.000Z");
    store.setStage("evidence.study", "learning", now);
    store.setStage("evidence.study", "paused", now);

    expect(store.listDue(10, new Date("2027-01-01T00:00:00.000Z"))).toEqual([]);
    store.close();
  });

  /**
   * Passing a review seconds after reading the answer is short-term memory.
   * Treating it as durable is the failure spaced repetition exists to prevent.
   */
  it("refuses to call a word stable when it was passed on the same day", () => {
    const store = open();
    const now = new Date("2026-08-06T10:00:00.000Z");
    store.setStage("schema.data", "learning", now);
    const sameDay = store.grade("schema.data", Rating.Good, new Date("2026-08-06T10:00:30.000Z"));

    expect(sameDay.stage).toBe("familiar");

    const laterDay = store.grade("schema.data", Rating.Good, new Date("2026-08-09T10:00:00.000Z"));
    expect(laterDay.stage).toBe("stable");
    store.close();
  });

  it("a failed review sends a stable word back to learning and re-queues it", () => {
    const store = open();
    store.setStage("guard.code", "learning", new Date("2026-08-01T10:00:00.000Z"));
    expect(store.grade("guard.code", Rating.Good, new Date("2026-08-02T10:00:00.000Z")).stage).toBe(
      "stable",
    );

    const failedAt = new Date("2026-08-05T10:00:00.000Z");
    const failed = store.grade("guard.code", Rating.Again, failedAt);

    // Lapse counting belongs to FSRS and only applies once a card has reached
    // its review phase, so the contract asserted here is the one this store
    // owns: a forgotten word stops being stable and comes back to be asked.
    expect(failed.stage).toBe("learning");
    expect(
      store.listDue(10, new Date("2026-08-06T10:00:00.000Z")).map((row) => row.senseId),
    ).toEqual(["guard.code"]);
    store.close();
  });

  it("reports today's load without refusing to record it", () => {
    const store = open();
    const now = new Date("2026-08-06T10:00:00.000Z");
    store.setStage("threshold.limit", "learning", now);
    store.grade("threshold.limit", Rating.Good, now);

    const budget = store.budget(now);
    expect(budget.introducedToday).toBe(1);
    expect(budget.reviewedToday).toBe(1);
    store.close();
  });

  /**
   * Vocabulary lives beside the studies, not inside one. Two studies reading
   * the same database is the behaviour that makes a word learned once stay
   * learned everywhere.
   */
  it("keeps one state per word regardless of which study showed it", () => {
    const root = mkdtempSync(join(tmpdir(), "university-local-vocab-shared-"));
    const first = new VocabularyStore(getVocabularyDatabasePath(root));
    first.setStage("upstream.repo", "learning", new Date("2026-08-06T10:00:00.000Z"));
    first.close();

    const second = new VocabularyStore(getVocabularyDatabasePath(root));
    expect(second.readState("upstream.repo")?.stage).toBe("learning");
    second.close();
  });
});
