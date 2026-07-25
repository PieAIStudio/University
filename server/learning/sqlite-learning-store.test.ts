import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { DatabaseSync } from "node:sqlite";
import { Rating, State, type Grade } from "ts-fsrs";
import { describe, expect, it } from "vitest";

import { SqliteLearningStore } from "./sqlite-learning-store.js";
import {
  cardContentKey,
  exerciseContentKey,
  knowledgeCardContentKey,
  lessonContentKey,
  type CardContentKey,
  type ExerciseContentKey,
  type LessonContentKey,
  type ReviewContentKey,
} from "./types.js";

const NOW = new Date("2026-07-20T12:00:00.000Z");
const TOMORROW = new Date("2026-07-21T12:00:00.000Z");
const DAY_AFTER_TOMORROW = new Date("2026-07-22T12:00:00.000Z");
const YESTERDAY = new Date("2026-07-19T12:00:00.000Z");
const COURSE_ID = "founder-engineer";
const UNIT_ID = "system-boundaries";
const LESSON_ID = "source-integrity";

function cardKey(cardId: string, courseId = COURSE_ID): CardContentKey {
  return cardContentKey({ courseId, unitId: UNIT_ID, lessonId: LESSON_ID, cardId });
}

function lessonKey(lessonId: string, courseId = COURSE_ID): LessonContentKey {
  return lessonContentKey({ courseId, unitId: UNIT_ID, lessonId });
}

function exerciseKey(exerciseId: string, courseId = COURSE_ID): ExerciseContentKey {
  return exerciseContentKey({
    courseId,
    unitId: UNIT_ID,
    lessonId: LESSON_ID,
    exerciseId,
  });
}

const LEGACY_CARD_KEY = cardContentKey({
  courseId: "legacy-course",
  unitId: "legacy-unit",
  lessonId: "legacy-lesson",
  cardId: "legacy-card",
});

function temporaryDatabase(name = "learning.sqlite"): string {
  return join(mkdtempSync(join(tmpdir(), "university-local-learning-")), name);
}

function createVersionOneDatabase(
  path: string,
  schedulerVersion: string,
  schedulerConfigHash: string,
): void {
  const database = new DatabaseSync(path);
  database.exec(`
    CREATE TABLE schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    ) STRICT;
    INSERT INTO schema_migrations(version, applied_at) VALUES (1, 0);

    CREATE TABLE card_state (
      card_id TEXT PRIMARY KEY,
      content_revision INTEGER NOT NULL CHECK(content_revision > 0),
      due_at INTEGER NOT NULL,
      stability REAL NOT NULL,
      difficulty REAL NOT NULL,
      elapsed_days INTEGER NOT NULL,
      scheduled_days INTEGER NOT NULL,
      learning_steps INTEGER NOT NULL,
      reps INTEGER NOT NULL,
      lapses INTEGER NOT NULL,
      state INTEGER NOT NULL CHECK(state BETWEEN 0 AND 3),
      last_review_at INTEGER,
      scheduler_version TEXT NOT NULL,
      scheduler_config_hash TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE review_event (
      event_id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      content_revision INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 4),
      reviewed_at INTEGER NOT NULL,
      previous_due_at INTEGER NOT NULL,
      resulting_due_at INTEGER NOT NULL,
      scheduler_version TEXT NOT NULL,
      scheduler_config_hash TEXT NOT NULL,
      payload_json TEXT NOT NULL CHECK(json_valid(payload_json))
    ) STRICT;
    CREATE TABLE lesson_progress (
      lesson_id TEXT PRIMARY KEY,
      content_revision INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('not-started', 'in-progress', 'completed')),
      progress REAL NOT NULL CHECK(progress >= 0 AND progress <= 1),
      updated_at INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE exercise_attempt (
      attempt_id TEXT PRIMARY KEY,
      exercise_id TEXT NOT NULL,
      content_revision INTEGER NOT NULL,
      score REAL NOT NULL,
      max_score REAL NOT NULL CHECK(max_score > 0),
      response_json TEXT CHECK(response_json IS NULL OR json_valid(response_json)),
      occurred_at INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE learning_session (
      session_id TEXT PRIMARY KEY,
      started_at INTEGER NOT NULL,
      ended_at INTEGER CHECK(ended_at IS NULL OR ended_at >= started_at)
    ) STRICT;
    CREATE TABLE learner_setting (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL CHECK(json_valid(value_json)),
      updated_at INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE sync_outbox (
      outbox_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      aggregate_id TEXT NOT NULL,
      payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
      created_at INTEGER NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      synced_at INTEGER
    ) STRICT;
  `);
  database
    .prepare(`
      INSERT INTO card_state (
        card_id, content_revision, due_at, stability, difficulty, elapsed_days,
        scheduled_days, learning_steps, reps, lapses, state, last_review_at,
        scheduler_version, scheduler_config_hash, updated_at
      ) VALUES ('legacy-card', 1, ?, 0, 0, 0, 0, 0, 0, 0, 0, NULL, ?, ?, ?)
    `)
    .run(NOW.getTime(), schedulerVersion, schedulerConfigHash, NOW.getTime());
  database.close();
}

function createVersionTwoDatabase(path: string): void {
  const current = new SqliteLearningStore(path);
  current.close();
  const database = new DatabaseSync(path);
  database.exec(`
    DROP INDEX lesson_progress_event_session_idx;
    DROP INDEX lesson_progress_event_lesson_idx;
    DROP TABLE lesson_progress_event;
    DROP INDEX review_event_session_idx;
    DROP INDEX exercise_attempt_session_idx;
    DROP INDEX learning_session_one_open_idx;
    DROP TABLE retrieval_attempt;
    ALTER TABLE review_event DROP COLUMN session_id;
    ALTER TABLE exercise_attempt DROP COLUMN session_id;
    ALTER TABLE learning_session DROP COLUMN host;
    ALTER TABLE learning_session DROP COLUMN objective;
    DELETE FROM schema_migrations;
    INSERT INTO schema_migrations(version, applied_at) VALUES (2, 0);
  `);
  database.close();
}

function createVersionThreeDatabase(path: string): void {
  const current = new SqliteLearningStore(path);
  current.close();
  const database = new DatabaseSync(path);
  database.exec(`
    DROP INDEX lesson_progress_event_session_idx;
    DROP INDEX lesson_progress_event_lesson_idx;
    DROP TABLE lesson_progress_event;
    DROP INDEX review_event_session_idx;
    DROP INDEX exercise_attempt_session_idx;
    DROP INDEX learning_session_one_open_idx;
    ALTER TABLE review_event DROP COLUMN session_id;
    ALTER TABLE exercise_attempt DROP COLUMN session_id;
    ALTER TABLE learning_session DROP COLUMN host;
    ALTER TABLE learning_session DROP COLUMN objective;
    DELETE FROM schema_migrations;
    INSERT INTO schema_migrations(version, applied_at) VALUES (3, 0);
  `);
  database.close();
}

describe("SqliteLearningStore", () => {
  it("keeps identical local IDs isolated by their course, unit, and lesson scope", () => {
    const path = temporaryDatabase();
    const store = new SqliteLearningStore(path);
    const firstCard = cardKey("shared-card", "founder-engineer");
    const secondCard = cardKey("shared-card", "architecture-course");

    store.reviewCard({
      commandId: "review-first-scope",
      cardKey: firstCard,
      contentRevision: 1,
      rating: Rating.Good,
      reviewedAt: NOW,
    });
    store.ensureCard(secondCard, 1, NOW);
    expect(store.getCard(firstCard)?.reps).toBe(1);
    expect(store.getCard(secondCard)?.reps).toBe(0);

    store.recordLessonProgress({
      lessonKey: lessonKey("shared-lesson", "founder-engineer"),
      contentRevision: 1,
      status: "completed",
      progress: 1,
      occurredAt: NOW,
    });
    store.recordLessonProgress({
      lessonKey: lessonKey("shared-lesson", "architecture-course"),
      contentRevision: 1,
      status: "in-progress",
      progress: 0.5,
      occurredAt: NOW,
    });
    store.recordExerciseAttempt({
      commandId: "attempt-first-scope",
      exerciseKey: exerciseKey("shared-exercise", "founder-engineer"),
      contentRevision: 1,
      score: 1,
      maxScore: 1,
      occurredAt: NOW,
    });
    store.recordExerciseAttempt({
      commandId: "attempt-second-scope",
      exerciseKey: exerciseKey("shared-exercise", "architecture-course"),
      contentRevision: 1,
      score: 0,
      maxScore: 1,
      occurredAt: NOW,
    });
    store.close();

    const database = new DatabaseSync(path, { readOnly: true });
    expect(
      (database.prepare("SELECT COUNT(*) AS count FROM card_state").get() as { count: number })
        .count,
    ).toBe(2);
    expect(
      (database.prepare("SELECT COUNT(*) AS count FROM lesson_progress").get() as { count: number })
        .count,
    ).toBe(2);
    expect(
      (
        database.prepare("SELECT COUNT(*) AS count FROM exercise_attempt").get() as {
          count: number;
        }
      ).count,
    ).toBe(2);
    database.close();
  });

  it("rejects a bare or malformed value even if TypeScript branding is bypassed", () => {
    const store = new SqliteLearningStore(":memory:");
    expect(() => store.ensureCard("bare-card" as CardContentKey, 1, NOW)).toThrow(
      /Invalid review content key/,
    );
    expect(() =>
      store.recordLessonProgress({
        lessonKey: "course/unit/UPPERCASE" as LessonContentKey,
        contentRevision: 1,
        status: "not-started",
        progress: 0,
        occurredAt: NOW,
      }),
    ).toThrow(/stable lowercase kebab-case/);
    expect(() =>
      store.recordExerciseAttempt({
        commandId: "malformed-exercise",
        exerciseKey: "course/unit/lesson" as ExerciseContentKey,
        contentRevision: 1,
        score: 1,
        maxScore: 1,
        occurredAt: NOW,
      }),
    ).toThrow(/Invalid scoped content key/);
    store.close();
  });

  it("creates a due card and persists one complete deterministic scheduler profile", () => {
    const path = temporaryDatabase();
    const store = new SqliteLearningStore(path);
    const authBoundary = cardKey("auth-boundary");
    const card = store.ensureCard(authBoundary, 1, NOW);

    expect(card.state).toBe(State.New);
    expect(card.due).toEqual(NOW);
    expect(card.contentRevision).toBe(1);
    expect(card.schedulerVersion).toContain("v5.4.1");
    expect(card.schedulerConfigHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(store.listDueCards(NOW).map((item) => item.cardKey)).toEqual([authBoundary]);
    store.close();

    const database = new DatabaseSync(path, { readOnly: true });
    const profile = database.prepare("SELECT * FROM scheduler_profile").get() as {
      scheduler_version: string;
      parameters_json: string;
      scheduler_config_hash: string;
    };
    expect(profile.scheduler_version).toContain("v5.4.1");
    expect(JSON.parse(profile.parameters_json)).toMatchObject({
      request_retention: 0.9,
      enable_fuzz: false,
      enable_short_term: true,
    });
    expect(profile.scheduler_config_hash).toBe(card.schedulerConfigHash);
    database.close();
  });

  it.each([Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as Grade[])(
    "persists rating %s as one event and one card projection",
    (rating) => {
      const store = new SqliteLearningStore(":memory:");
      const scheduledCard = cardKey(`card-${rating}`);
      const receipt = store.reviewCard({
        commandId: `review-card-${rating}`,
        cardKey: scheduledCard,
        contentRevision: 3,
        rating,
        reviewedAt: NOW,
      });

      expect(receipt.state.reps).toBe(1);
      expect(receipt.state.contentRevision).toBe(3);
      expect(receipt.state.last_review).toEqual(NOW);
      expect(store.reviewEventCount()).toBe(1);
      store.close();
    },
  );

  it("returns the original review receipt for a repeated command without advancing FSRS twice", () => {
    const store = new SqliteLearningStore(":memory:");
    const stableCard = cardKey("stable-card");
    const command = {
      commandId: "review-stable-card-1",
      cardKey: stableCard,
      contentRevision: 1,
      rating: Rating.Good,
      reviewedAt: NOW,
    } as const;
    const first = store.reviewCard(command);
    store.reviewCard({
      commandId: "review-stable-card-2",
      cardKey: stableCard,
      contentRevision: 1,
      rating: Rating.Good,
      reviewedAt: TOMORROW,
    });
    const retry = store.reviewCard(command);

    expect(retry).toEqual(first);
    expect(retry.state.reps).toBe(1);
    expect(store.getCard(stableCard)?.reps).toBe(2);
    expect(store.reviewEventCount()).toBe(2);
    expect(() => store.reviewCard({ ...command, rating: Rating.Easy })).toThrow(
      /Command ID conflict/,
    );
    store.close();
  });

  it("replays append-only reviews to verify or rebuild card projections", () => {
    const path = temporaryDatabase();
    const store = new SqliteLearningStore(path);
    const replayedCard = cardKey("replayed-card");
    const untouchedCard = cardKey("unreviewed-card");

    store.reviewCard({
      commandId: "replay-first-review",
      cardKey: replayedCard,
      contentRevision: 1,
      rating: Rating.Good,
      reviewedAt: NOW,
    });
    const reviewed = store.reviewCard({
      commandId: "replay-second-review",
      cardKey: replayedCard,
      contentRevision: 1,
      rating: Rating.Hard,
      reviewedAt: TOMORROW,
    }).state;
    const revisionAdvanced = store.ensureCard(replayedCard, 2, DAY_AFTER_TOMORROW);
    const untouched = store.ensureCard(untouchedCard, 4, NOW);

    expect(store.rebuildCardStateFromReviewEvents()).toEqual({
      replayedEventCount: 2,
      eventBackedCardCount: 1,
      rebuiltCardCount: 0,
      untouchedCardCount: 1,
    });

    const admin = new DatabaseSync(path);
    admin
      .prepare("UPDATE card_state SET due_at = 0, reps = 99 WHERE card_id = ?")
      .run(replayedCard);
    admin.close();

    expect(store.rebuildCardStateFromReviewEvents()).toEqual({
      replayedEventCount: 2,
      eventBackedCardCount: 1,
      rebuiltCardCount: 1,
      untouchedCardCount: 1,
    });
    expect(store.getCard(replayedCard)).toEqual({
      ...reviewed,
      contentRevision: revisionAdvanced.contentRevision,
      updatedAt: revisionAdvanced.updatedAt,
    });
    expect(store.getCard(untouchedCard)).toEqual(untouched);
    store.close();
  });

  it("restores a missing projection from its complete review history", () => {
    const path = temporaryDatabase();
    const store = new SqliteLearningStore(path);
    const missingCard = cardKey("missing-projection-card");
    const expected = store.reviewCard({
      commandId: "review-missing-projection-card",
      cardKey: missingCard,
      contentRevision: 3,
      rating: Rating.Good,
      reviewedAt: NOW,
    }).state;

    const admin = new DatabaseSync(path);
    admin.prepare("DELETE FROM card_state WHERE card_id = ?").run(missingCard);
    admin.close();

    expect(store.getCard(missingCard)).toBeNull();
    expect(store.rebuildCardStateFromReviewEvents()).toEqual({
      replayedEventCount: 1,
      eventBackedCardCount: 1,
      rebuiltCardCount: 1,
      untouchedCardCount: 0,
    });
    expect(store.getCard(missingCard)).toEqual(expected);
    store.close();
  });

  it("schedules, reviews, replays, and reopens a knowledge card in the shared FSRS", () => {
    const path = temporaryDatabase("knowledge-card.sqlite");
    const store = new SqliteLearningStore(path);
    const knowledgeCard = knowledgeCardContentKey({
      noteId: "source-snapshots",
      cardId: "immutable-commit",
    });
    const initial = store.ensureCard(knowledgeCard, 1, NOW);
    expect(initial.state).toBe(State.New);
    expect(store.getCard(knowledgeCard)).toEqual(initial);

    const firstInput = {
      commandId: "review-knowledge-card-first",
      cardKey: knowledgeCard,
      contentRevision: 1,
      rating: Rating.Good,
      reviewedAt: NOW,
    } as const;
    const first = store.reviewCard(firstInput);
    const reviewed = store.reviewCard({
      commandId: "review-knowledge-card-second",
      cardKey: knowledgeCard,
      contentRevision: 1,
      rating: Rating.Hard,
      reviewedAt: TOMORROW,
    }).state;
    expect(reviewed.reps).toBe(2);

    expect(store.reviewCard(firstInput)).toEqual(first);
    expect(store.rebuildCardStateFromReviewEvents()).toEqual({
      replayedEventCount: 2,
      eventBackedCardCount: 1,
      rebuiltCardCount: 0,
      untouchedCardCount: 0,
    });

    const admin = new DatabaseSync(path);
    admin.prepare("UPDATE card_state SET reps = 99 WHERE card_id = ?").run(knowledgeCard);
    admin.close();
    expect(store.rebuildCardStateFromReviewEvents()).toEqual({
      replayedEventCount: 2,
      eventBackedCardCount: 1,
      rebuiltCardCount: 1,
      untouchedCardCount: 0,
    });
    expect(store.getCard(knowledgeCard)).toEqual(reviewed);
    store.close();

    const reopened = new SqliteLearningStore(path);
    expect(reopened.getCard(knowledgeCard)).toEqual(reviewed);
    expect(reopened.reviewEventCount()).toBe(2);
    reopened.close();
  });

  it("rolls every projection repair back when one replay write fails", () => {
    const path = temporaryDatabase();
    const store = new SqliteLearningStore(path);
    const firstCard = cardKey("alpha-replay-card");
    const secondCard = cardKey("zulu-replay-card");
    for (const [card, commandId] of [
      [firstCard, "review-alpha-replay"],
      [secondCard, "review-zulu-replay"],
    ] as const) {
      store.reviewCard({
        commandId,
        cardKey: card,
        contentRevision: 1,
        rating: Rating.Good,
        reviewedAt: NOW,
      });
    }

    const admin = new DatabaseSync(path);
    admin
      .prepare("UPDATE card_state SET reps = 99 WHERE card_id IN (?, ?)")
      .run(firstCard, secondCard);
    admin.exec(`
      CREATE TRIGGER fail_second_projection_rebuild
      BEFORE UPDATE ON card_state
      WHEN NEW.card_id LIKE '%/zulu-replay-card'
      BEGIN
        SELECT RAISE(ABORT, 'forced replay projection failure');
      END;
    `);
    admin.close();

    expect(() => store.rebuildCardStateFromReviewEvents()).toThrow(
      /forced replay projection failure/,
    );
    expect(store.getCard(firstCard)?.reps).toBe(99);
    expect(store.getCard(secondCard)?.reps).toBe(99);
    expect(store.reviewEventCount()).toBe(2);
    store.close();
  });

  it("rejects replay when an event no longer matches the scheduler profile", () => {
    const path = temporaryDatabase();
    const store = new SqliteLearningStore(path);
    const protectedCard = cardKey("profile-protected-card");
    const expected = store.reviewCard({
      commandId: "review-profile-protected-card",
      cardKey: protectedCard,
      contentRevision: 1,
      rating: Rating.Easy,
      reviewedAt: NOW,
    }).state;

    const admin = new DatabaseSync(path);
    admin
      .prepare("UPDATE review_event SET scheduler_config_hash = ? WHERE card_id = ?")
      .run(`sha256:${"0".repeat(64)}`, protectedCard);
    admin.close();

    expect(() => store.rebuildCardStateFromReviewEvents()).toThrow(
      /Review event scheduler metadata mismatch/,
    );
    expect(store.getCard(protectedCard)).toEqual(expected);
    store.close();
  });

  it("makes content revision changes explicit and monotonic", () => {
    const store = new SqliteLearningStore(":memory:");
    const revisionedCard = cardKey("revisioned-card");
    store.ensureCard(revisionedCard, 2, NOW);

    expect(() => store.ensureCard(revisionedCard, 1, TOMORROW)).toThrow(/cannot move backward/);
    expect(() =>
      store.reviewCard({
        commandId: "implicit-revision-change",
        cardKey: revisionedCard,
        contentRevision: 3,
        rating: Rating.Good,
        reviewedAt: TOMORROW,
      }),
    ).toThrow(/call ensureCard explicitly/);

    expect(store.ensureCard(revisionedCard, 3, TOMORROW).contentRevision).toBe(3);
    expect(store.getCard(revisionedCard)?.reps).toBe(0);
    store.close();
  });

  it("rejects review timestamps that move card state backward", () => {
    const store = new SqliteLearningStore(":memory:");
    const timeCard = cardKey("time-card");
    store.reviewCard({
      commandId: "review-now",
      cardKey: timeCard,
      contentRevision: 1,
      rating: Rating.Good,
      reviewedAt: NOW,
    });

    expect(() =>
      store.reviewCard({
        commandId: "review-yesterday",
        cardKey: timeCard,
        contentRevision: 1,
        rating: Rating.Good,
        reviewedAt: YESTERDAY,
      }),
    ).toThrow(/Review time cannot move backward/);
    expect(store.reviewEventCount()).toBe(1);
    expect(store.getCard(timeCard)?.reps).toBe(1);
    store.close();
  });

  it("keeps review read, scheduling, event and projection in one rollback boundary", () => {
    const path = temporaryDatabase();
    const store = new SqliteLearningStore(path);
    const rollbackCard = cardKey("rollback-card");
    store.ensureCard(rollbackCard, 1, NOW);
    const admin = new DatabaseSync(path);
    admin.exec(`
      CREATE TRIGGER fail_card_projection
      BEFORE UPDATE ON card_state
      BEGIN
        SELECT RAISE(ABORT, 'forced projection failure');
      END;
    `);
    admin.close();

    expect(() =>
      store.reviewCard({
        commandId: "rollback-review",
        cardKey: rollbackCard,
        contentRevision: 1,
        rating: Rating.Good,
        reviewedAt: NOW,
      }),
    ).toThrow(/forced projection failure/);
    expect(store.reviewEventCount()).toBe(0);
    expect(store.getCard(rollbackCard)?.reps).toBe(0);
    store.close();
  });

  it("deduplicates the same review command across two open connections", () => {
    const path = temporaryDatabase();
    const firstConnection = new SqliteLearningStore(path);
    const secondConnection = new SqliteLearningStore(path);
    const sharedCard = cardKey("shared-card");
    const input = {
      commandId: "cross-connection-review",
      cardKey: sharedCard,
      contentRevision: 1,
      rating: Rating.Easy,
      reviewedAt: NOW,
    } as const;

    const first = firstConnection.reviewCard(input);
    const second = secondConnection.reviewCard(input);

    expect(second).toEqual(first);
    expect(firstConnection.reviewEventCount()).toBe(1);
    expect(secondConnection.getCard(sharedCard)?.reps).toBe(1);
    firstConnection.close();
    secondConnection.close();
  });

  it("rejects an opening scheduler configuration that differs from the stored profile", () => {
    const path = temporaryDatabase();
    const store = new SqliteLearningStore(path);
    const profileCard = cardKey("profile-card");
    store.ensureCard(profileCard, 1, NOW);
    store.close();

    expect(() => new SqliteLearningStore(path, { request_retention: 0.85 })).toThrow(
      /Scheduler profile mismatch/,
    );
    const reopened = new SqliteLearningStore(path);
    expect(reopened.getCard(profileCard)).not.toBeNull();
    reopened.close();
  });

  it("prevents older lesson revisions and timestamps from overwriting newer progress", () => {
    const path = temporaryDatabase();
    const store = new SqliteLearningStore(path);
    const authArchitecture = lessonKey("auth-architecture");
    store.recordLessonProgress({
      lessonKey: authArchitecture,
      contentRevision: 2,
      status: "in-progress",
      progress: 0.5,
      occurredAt: NOW,
    });

    expect(() =>
      store.recordLessonProgress({
        lessonKey: authArchitecture,
        contentRevision: 1,
        status: "completed",
        progress: 1,
        occurredAt: TOMORROW,
      }),
    ).toThrow(/cannot move backward/);
    expect(() =>
      store.recordLessonProgress({
        lessonKey: authArchitecture,
        contentRevision: 3,
        status: "completed",
        progress: 1,
        occurredAt: YESTERDAY,
      }),
    ).toThrow(/time cannot move backward/);
    store.close();

    const database = new DatabaseSync(path, { readOnly: true });
    expect(
      database.prepare("SELECT content_revision, status, progress FROM lesson_progress").get(),
    ).toEqual({ content_revision: 2, status: "in-progress", progress: 0.5 });
    database.close();
  });

  it("enforces coherent lesson status and monotonic progress within one revision", () => {
    const path = temporaryDatabase();
    const store = new SqliteLearningStore(path);
    const progressKey = lessonKey("progress-contract");

    for (const invalid of [
      { status: "not-started" as const, progress: 0.1 },
      { status: "in-progress" as const, progress: 0 },
      { status: "in-progress" as const, progress: 1 },
      { status: "completed" as const, progress: 0.9 },
    ]) {
      expect(() =>
        store.recordLessonProgress({
          lessonKey: progressKey,
          contentRevision: 1,
          ...invalid,
          occurredAt: NOW,
        }),
      ).toThrow(/lesson/i);
    }

    store.recordLessonProgress({
      lessonKey: progressKey,
      contentRevision: 1,
      status: "in-progress",
      progress: 0.6,
      occurredAt: NOW,
    });
    expect(() =>
      store.recordLessonProgress({
        lessonKey: progressKey,
        contentRevision: 1,
        status: "in-progress",
        progress: 0.4,
        occurredAt: TOMORROW,
      }),
    ).toThrow(/progress cannot move backward/);
    expect(() =>
      store.recordLessonProgress({
        lessonKey: progressKey,
        contentRevision: 1,
        status: "not-started",
        progress: 0,
        occurredAt: TOMORROW,
      }),
    ).toThrow(/status cannot move backward/);
    store.recordLessonProgress({
      lessonKey: progressKey,
      contentRevision: 1,
      status: "completed",
      progress: 1,
      occurredAt: TOMORROW,
    });
    expect(store.getLessonProgress(progressKey)).toEqual({
      lessonKey: progressKey,
      contentRevision: 1,
      status: "completed",
      progress: 1,
      updatedAt: TOMORROW,
    });
    expect(store.getLessonProgress(lessonKey("not-recorded"))).toBeNull();
    expect(() =>
      store.recordLessonProgress({
        lessonKey: progressKey,
        contentRevision: 1,
        status: "in-progress",
        progress: 0.9,
        occurredAt: TOMORROW,
      }),
    ).toThrow(/status cannot move backward/);
    store.close();

    const database = new DatabaseSync(path, { readOnly: true });
    expect(database.prepare("SELECT status, progress FROM lesson_progress").get()).toEqual({
      status: "completed",
      progress: 1,
    });
    database.close();
  });

  it("deduplicates exercise attempts and rejects command reuse with different input", () => {
    const path = temporaryDatabase();
    const store = new SqliteLearningStore(path);
    const traceAuthFlow = exerciseKey("trace-auth-flow");
    const first = store.recordExerciseAttempt({
      commandId: "attempt-auth-flow",
      exerciseKey: traceAuthFlow,
      contentRevision: 1,
      score: 4,
      maxScore: 5,
      response: { answer: "session service", confidence: 0.8 },
      occurredAt: NOW,
    });
    const retry = store.recordExerciseAttempt({
      commandId: "attempt-auth-flow",
      exerciseKey: traceAuthFlow,
      contentRevision: 1,
      score: 4,
      maxScore: 5,
      response: { confidence: 0.8, answer: "session service" },
      occurredAt: NOW,
    });

    expect(retry).toBe(first);
    expect(() =>
      store.recordExerciseAttempt({
        commandId: "attempt-auth-flow",
        exerciseKey: traceAuthFlow,
        contentRevision: 1,
        score: 5,
        maxScore: 5,
        occurredAt: NOW,
      }),
    ).toThrow(/Command ID conflict/);
    store.close();

    const database = new DatabaseSync(path, { readOnly: true });
    expect(
      (
        database.prepare("SELECT COUNT(*) AS count FROM exercise_attempt").get() as {
          count: number;
        }
      ).count,
    ).toBe(1);
    database.close();
  });

  it("persists pre-reveal retrieval attempts for course and knowledge cards", () => {
    const path = temporaryDatabase("retrieval.sqlite");
    const store = new SqliteLearningStore(path);
    const sessionId = store.startSession(NOW);
    const courseCard = cardKey("retrieval-course-card");
    const knowledgeCard = knowledgeCardContentKey({
      noteId: "sqlite-events",
      cardId: "append-only",
    });
    const courseReceipt = store.recordRetrievalAttempt({
      commandId: "retrieve-course-card",
      cardKey: courseCard,
      contentRevision: 2,
      answer: "The source snapshot is immutable.",
      startedAt: NOW,
      revealedAt: new Date(NOW.getTime() + 12_345),
      durationMs: 12_345,
      usedHint: false,
      confidence: 0.75,
      sessionId,
    });
    const knowledgeReceipt = store.recordRetrievalAttempt({
      commandId: "retrieve-knowledge-card",
      cardKey: knowledgeCard,
      contentRevision: 1,
      answer: "Keep the learner response separate from the later FSRS rating.",
      startedAt: TOMORROW,
      revealedAt: new Date(TOMORROW.getTime() + 5_000),
      usedHint: true,
    });

    expect(courseReceipt).toMatchObject({
      commandId: "retrieve-course-card",
      cardKey: courseCard,
      contentRevision: 2,
      durationMs: 12_345,
      usedHint: false,
      confidence: 0.75,
      sessionId,
    });
    expect(knowledgeReceipt.cardKey).toBe(knowledgeCard);
    expect(knowledgeReceipt.durationMs).toBe(5_000);
    expect(store.getRetrievalAttempt(courseReceipt.attemptId)).toEqual(courseReceipt);
    expect(store.getRetrievalAttemptByCommandId("retrieve-course-card")).toEqual(courseReceipt);
    expect(store.getRetrievalAttemptByCommandId("missing-retrieval-command")).toBeNull();
    expect(() => store.getRetrievalAttemptByCommandId(" ")).toThrow(/Command ID/);
    expect(store.retrievalAttemptCount()).toBe(2);
    expect(store.reviewEventCount()).toBe(0);
    store.close();

    const reopened = new SqliteLearningStore(path);
    expect(reopened.getRetrievalAttempt(courseReceipt.attemptId)).toEqual(courseReceipt);
    expect(reopened.getRetrievalAttempt("missing-attempt")).toBeNull();
    expect(reopened.retrievalAttemptCount()).toBe(2);
    expect(reopened.reviewEventCount()).toBe(0);
    reopened.close();
  });

  it("keeps one real host session open and summarizes only its persisted events", () => {
    const path = temporaryDatabase("session-summary.sqlite");
    const store = new SqliteLearningStore(path);
    const sessionId = store.startSession(NOW, {
      host: "  grok  ",
      objective: "  Understand immutable source snapshots  ",
    });
    expect(store.getOpenSession()).toEqual({
      sessionId,
      startedAt: NOW,
      host: "grok",
      objective: "Understand immutable source snapshots",
    });

    const sessionCard = cardKey("session-card");
    store.recordRetrievalAttempt({
      commandId: "session-retrieval",
      cardKey: sessionCard,
      contentRevision: 1,
      answer: "Use a committed source snapshot.",
      startedAt: NOW,
      revealedAt: new Date(NOW.getTime() + 2_000),
      usedHint: false,
    });
    store.reviewCard({
      commandId: "session-review",
      cardKey: sessionCard,
      contentRevision: 1,
      rating: Rating.Good,
      reviewedAt: NOW,
    });
    store.recordExerciseAttempt({
      commandId: "session-exercise",
      exerciseKey: exerciseKey("session-exercise"),
      contentRevision: 1,
      score: 3,
      maxScore: 4,
      occurredAt: NOW,
    });
    store.recordLessonProgress({
      lessonKey: lessonKey("session-lesson"),
      contentRevision: 1,
      status: "in-progress",
      progress: 0.5,
      occurredAt: NOW,
    });

    expect(store.getSessionSummary(sessionId)).toEqual({
      sessionId,
      startedAt: NOW,
      host: "grok",
      objective: "Understand immutable source snapshots",
      reviewCount: 1,
      retrievalAttemptCount: 1,
      exerciseAttemptCount: 1,
      lessonProgressEventCount: 1,
      exerciseScore: 3,
      exerciseMaxScore: 4,
    });
    const ended = store.endSession(sessionId, TOMORROW);
    expect(ended).toMatchObject({
      sessionId,
      startedAt: NOW,
      endedAt: TOMORROW,
      reviewCount: 1,
      retrievalAttemptCount: 1,
      exerciseAttemptCount: 1,
      lessonProgressEventCount: 1,
      exerciseScore: 3,
      exerciseMaxScore: 4,
    });
    expect(store.getOpenSession()).toBeNull();
    expect(store.listSessions()).toEqual([
      {
        sessionId,
        startedAt: NOW,
        endedAt: TOMORROW,
        host: "grok",
        objective: "Understand immutable source snapshots",
      },
    ]);
    store.close();

    const database = new DatabaseSync(path, { readOnly: true });
    for (const table of [
      "review_event",
      "retrieval_attempt",
      "exercise_attempt",
      "lesson_progress_event",
    ]) {
      expect(
        (database.prepare(`SELECT session_id FROM ${table}`).get() as { session_id: string })
          .session_id,
      ).toBe(sessionId);
    }
    database.close();
  });

  it("allows at most one open session across connections while preserving the old Date call", () => {
    const path = temporaryDatabase("one-open-session.sqlite");
    const first = new SqliteLearningStore(path);
    const second = new SqliteLearningStore(path);
    const firstSession = first.startSession(NOW);
    expect(() => second.startSession({ host: "grok" })).toThrow(/already open/);
    expect(() => first.endSession(firstSession, YESTERDAY)).toThrow(/earlier/);
    expect(first.getOpenSession()?.sessionId).toBe(firstSession);
    first.endSession(firstSession, TOMORROW);
    const secondSession = second.startSession(TOMORROW, { host: "claude-code" });
    expect(second.getSession(secondSession)).toMatchObject({
      sessionId: secondSession,
      startedAt: TOMORROW,
      host: "claude-code",
    });
    expect(() => second.startSession({ objective: "another" })).toThrow(/already open/);
    second.endSession(secondSession, DAY_AFTER_TOMORROW);
    expect(second.listSessions(2).map((session) => session.sessionId)).toEqual([
      secondSession,
      firstSession,
    ]);
    expect(() => second.listSessions(0)).toThrow(/between 1 and 1000/);
    first.close();
    second.close();
  });

  it("does not move an idempotent retrieval to a later session", () => {
    const store = new SqliteLearningStore(":memory:");
    const input = {
      commandId: "stable-session-retrieval",
      cardKey: cardKey("stable-session-retrieval"),
      contentRevision: 1,
      answer: "original answer",
      startedAt: NOW,
      revealedAt: TOMORROW,
      usedHint: false,
    } as const;
    const firstSession = store.startSession(NOW, { host: "grok" });
    const first = store.recordRetrievalAttempt(input);
    expect(first.sessionId).toBe(firstSession);
    store.endSession(firstSession, TOMORROW);
    const secondSession = store.startSession(TOMORROW, { host: "grok" });
    expect(store.recordRetrievalAttempt(input)).toEqual(first);
    expect(store.getSessionSummary(secondSession)?.retrievalAttemptCount).toBe(0);
    store.close();
  });

  it("deduplicates identical retrieval commands and rejects changed payloads", () => {
    const path = temporaryDatabase("retrieval-idempotency.sqlite");
    const firstConnection = new SqliteLearningStore(path);
    const secondConnection = new SqliteLearningStore(path);
    const input = {
      commandId: "retrieve-idempotently",
      cardKey: cardKey("idempotent-retrieval"),
      contentRevision: 1,
      answer: "A canonical answer from the learner",
      startedAt: NOW,
      revealedAt: new Date(NOW.getTime() + 4_000),
      usedHint: false,
      confidence: 0.5,
    } as const;

    const first = firstConnection.recordRetrievalAttempt(input);
    const retry = secondConnection.recordRetrievalAttempt({ ...input, durationMs: 4_000 });
    expect(retry).toEqual(first);
    expect(firstConnection.retrievalAttemptCount()).toBe(1);
    expect(() =>
      secondConnection.recordRetrievalAttempt({ ...input, answer: "A changed answer" }),
    ).toThrow(/Command ID conflict/);
    expect(firstConnection.retrievalAttemptCount()).toBe(1);
    firstConnection.close();
    secondConnection.close();
  });

  it("strictly validates retrieval identity, answer, timing, flags, confidence, and session", () => {
    const store = new SqliteLearningStore(":memory:");
    const valid = {
      commandId: "validate-retrieval",
      cardKey: cardKey("validated-retrieval"),
      contentRevision: 1,
      answer: "valid answer",
      startedAt: NOW,
      revealedAt: TOMORROW,
      usedHint: false,
    } as const;

    expect(() =>
      store.recordRetrievalAttempt({
        ...valid,
        cardKey: "bare-card" as ReviewContentKey,
      }),
    ).toThrow(/Invalid review content key/);
    expect(() => store.recordRetrievalAttempt({ ...valid, contentRevision: 0 })).toThrow(
      /positive integer/,
    );
    expect(() => store.recordRetrievalAttempt({ ...valid, answer: "   " })).toThrow(
      /Retrieval answer/,
    );
    expect(() =>
      store.recordRetrievalAttempt({ ...valid, startedAt: new Date("invalid") }),
    ).toThrow(/valid date/);
    expect(() =>
      store.recordRetrievalAttempt({ ...valid, startedAt: TOMORROW, revealedAt: NOW }),
    ).toThrow(/must not be earlier/);
    expect(() => store.recordRetrievalAttempt({ ...valid, durationMs: 1 })).toThrow(/must equal/);
    expect(() =>
      store.recordRetrievalAttempt({ ...valid, usedHint: "no" as unknown as boolean }),
    ).toThrow(/must be a boolean/);
    expect(() => store.recordRetrievalAttempt({ ...valid, confidence: 1.01 })).toThrow(
      /between 0 and 1/,
    );
    expect(() => store.recordRetrievalAttempt({ ...valid, sessionId: "missing-session" })).toThrow(
      /Learning session not found/,
    );
    expect(store.retrievalAttemptCount()).toBe(0);
    store.close();
  });

  it("rolls a retrieval insert back when its append-only write fails", () => {
    const path = temporaryDatabase("retrieval-rollback.sqlite");
    const store = new SqliteLearningStore(path);
    const admin = new DatabaseSync(path);
    admin.exec(`
      CREATE TRIGGER fail_retrieval_insert
      BEFORE INSERT ON retrieval_attempt
      BEGIN
        SELECT RAISE(ABORT, 'forced retrieval failure');
      END;
    `);
    admin.close();

    expect(() =>
      store.recordRetrievalAttempt({
        commandId: "rollback-retrieval",
        cardKey: cardKey("rollback-retrieval"),
        contentRevision: 1,
        answer: "This must not survive.",
        startedAt: NOW,
        revealedAt: TOMORROW,
        usedHint: false,
      }),
    ).toThrow(/forced retrieval failure/);
    expect(store.retrievalAttemptCount()).toBe(0);
    store.close();
  });

  it("migrates a file-backed version-two database through append-only retrieval to schema four", () => {
    const path = temporaryDatabase("schema-two.sqlite");
    createVersionTwoDatabase(path);

    const migrated = new SqliteLearningStore(path);
    const receipt = migrated.recordRetrievalAttempt({
      commandId: "post-migration-retrieval",
      cardKey: knowledgeCardContentKey({ noteId: "migration-note", cardId: "schema-three" }),
      contentRevision: 1,
      answer: "Schema three adds retrieval attempts.",
      startedAt: NOW,
      revealedAt: TOMORROW,
      usedHint: false,
    });
    expect(migrated.getRetrievalAttempt(receipt.attemptId)).toEqual(receipt);
    migrated.close();

    const database = new DatabaseSync(path, { readOnly: true });
    expect(
      (
        database.prepare("SELECT MAX(version) AS version FROM schema_migrations").get() as {
          version: number;
        }
      ).version,
    ).toBe(4);
    expect(
      (
        database.prepare("SELECT COUNT(*) AS count FROM retrieval_attempt").get() as {
          count: number;
        }
      ).count,
    ).toBe(1);
    database.close();
  });

  it("migrates schema three sessions transactionally to metadata and event ownership", () => {
    const path = temporaryDatabase("schema-three.sqlite");
    createVersionThreeDatabase(path);
    const legacy = new DatabaseSync(path);
    legacy
      .prepare("INSERT INTO learning_session(session_id, started_at, ended_at) VALUES (?, ?, NULL)")
      .run("legacy-open-session", NOW.getTime());
    legacy.close();

    const migrated = new SqliteLearningStore(path);
    expect(migrated.getOpenSession()).toEqual({
      sessionId: "legacy-open-session",
      startedAt: NOW,
    });
    expect(() => migrated.startSession({ host: "grok" })).toThrow(/already open/);
    migrated.recordLessonProgress({
      lessonKey: lessonKey("migrated-progress"),
      contentRevision: 1,
      status: "completed",
      progress: 1,
      occurredAt: TOMORROW,
    });
    expect(migrated.getSessionSummary("legacy-open-session")?.lessonProgressEventCount).toBe(1);
    migrated.close();

    const database = new DatabaseSync(path, { readOnly: true });
    expect(
      (
        database.prepare("SELECT MAX(version) AS version FROM schema_migrations").get() as {
          version: number;
        }
      ).version,
    ).toBe(4);
    expect(database.prepare("PRAGMA table_info(learning_session)").all()).toHaveLength(5);
    database.close();
  });

  it("rolls schema-three migration back instead of inventing ends for multiple open sessions", () => {
    const path = temporaryDatabase("schema-three-open-conflict.sqlite");
    createVersionThreeDatabase(path);
    const legacy = new DatabaseSync(path);
    legacy.exec(`
      INSERT INTO learning_session(session_id, started_at, ended_at)
      VALUES ('first-open', 1, NULL), ('second-open', 2, NULL);
    `);
    legacy.close();

    expect(() => new SqliteLearningStore(path)).toThrow(/found 2 open learning sessions/);
    const database = new DatabaseSync(path, { readOnly: true });
    expect(
      (
        database.prepare("SELECT MAX(version) AS version FROM schema_migrations").get() as {
          version: number;
        }
      ).version,
    ).toBe(3);
    expect(database.prepare("PRAGMA table_info(learning_session)").all()).toHaveLength(3);
    expect(
      (
        database.prepare("SELECT COUNT(*) AS count FROM learning_session").get() as {
          count: number;
        }
      ).count,
    ).toBe(2);
    database.close();
  });

  it("rolls schema-two migration back when retrieval schema creation fails", () => {
    const path = temporaryDatabase("schema-two-conflict.sqlite");
    createVersionTwoDatabase(path);
    const conflicting = new DatabaseSync(path);
    conflicting.exec("CREATE TABLE retrieval_attempt (blocker TEXT) STRICT;");
    conflicting.close();

    expect(() => new SqliteLearningStore(path)).toThrow(/retrieval_attempt already exists/);

    const database = new DatabaseSync(path, { readOnly: true });
    expect(
      (
        database.prepare("SELECT MAX(version) AS version FROM schema_migrations").get() as {
          version: number;
        }
      ).version,
    ).toBe(2);
    expect(database.prepare("PRAGMA table_info(retrieval_attempt)").all()).toHaveLength(1);
    database.close();
  });

  it("migrates a populated schema-one database and removes the uncontracted outbox", () => {
    const profilePath = temporaryDatabase("profile.sqlite");
    const profileStore = new SqliteLearningStore(profilePath);
    profileStore.close();
    const profileDatabase = new DatabaseSync(profilePath, { readOnly: true });
    const profile = profileDatabase.prepare("SELECT * FROM scheduler_profile").get() as {
      scheduler_version: string;
      scheduler_config_hash: string;
    };
    profileDatabase.close();

    const path = temporaryDatabase("legacy.sqlite");
    createVersionOneDatabase(path, profile.scheduler_version, profile.scheduler_config_hash);
    const migrated = new SqliteLearningStore(path);
    expect(migrated.getCard(LEGACY_CARD_KEY)?.contentRevision).toBe(1);
    migrated.reviewCard({
      commandId: "first-post-migration-review",
      cardKey: LEGACY_CARD_KEY,
      contentRevision: 1,
      rating: Rating.Good,
      reviewedAt: NOW,
    });
    migrated.close();

    const database = new DatabaseSync(path, { readOnly: true });
    expect(
      (
        database.prepare("SELECT MAX(version) AS version FROM schema_migrations").get() as {
          version: number;
        }
      ).version,
    ).toBe(4);
    expect(
      database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sync_outbox'")
        .get(),
    ).toBeUndefined();
    expect(
      (
        database.prepare("SELECT COUNT(*) AS count FROM scheduler_profile").get() as {
          count: number;
        }
      ).count,
    ).toBe(1);
    expect(
      (database.prepare("SELECT command_id FROM review_event").get() as { command_id: string })
        .command_id,
    ).toBe("first-post-migration-review");
    database.close();
  });

  it("refuses to drop a non-empty version-one outbox and rolls the migration back", () => {
    const profilePath = temporaryDatabase("outbox-profile.sqlite");
    const profileStore = new SqliteLearningStore(profilePath);
    profileStore.close();
    const profileDatabase = new DatabaseSync(profilePath, { readOnly: true });
    const profile = profileDatabase.prepare("SELECT * FROM scheduler_profile").get() as {
      scheduler_version: string;
      scheduler_config_hash: string;
    };
    profileDatabase.close();

    const path = temporaryDatabase("legacy-outbox.sqlite");
    createVersionOneDatabase(path, profile.scheduler_version, profile.scheduler_config_hash);
    const legacy = new DatabaseSync(path);
    legacy
      .prepare(`
        INSERT INTO sync_outbox (
          outbox_id, event_type, aggregate_id, payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `)
      .run("pending-event", "reviewed", "legacy-card", "{}", NOW.getTime());
    legacy.close();

    expect(() => new SqliteLearningStore(path)).toThrow(/sync_outbox contains 1 unprocessed/);

    const database = new DatabaseSync(path, { readOnly: true });
    expect(
      (
        database.prepare("SELECT MAX(version) AS version FROM schema_migrations").get() as {
          version: number;
        }
      ).version,
    ).toBe(1);
    expect(
      (database.prepare("SELECT COUNT(*) AS count FROM sync_outbox").get() as { count: number })
        .count,
    ).toBe(1);
    expect(
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'scheduler_profile'",
        )
        .get(),
    ).toBeUndefined();
    database.close();
  });

  it("leaves schema-one data untouched when its scheduler metadata is incompatible", () => {
    const path = temporaryDatabase("legacy-mismatch.sqlite");
    createVersionOneDatabase(path, "legacy-fsrs", `sha256:${"0".repeat(64)}`);

    expect(() => new SqliteLearningStore(path)).toThrow(/Scheduler profile mismatch/);

    const database = new DatabaseSync(path, { readOnly: true });
    expect(
      (
        database.prepare("SELECT MAX(version) AS version FROM schema_migrations").get() as {
          version: number;
        }
      ).version,
    ).toBe(1);
    expect(
      database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sync_outbox'")
        .get(),
    ).toEqual({ name: "sync_outbox" });
    expect(
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'scheduler_profile'",
        )
        .get(),
    ).toBeUndefined();
    database.close();
  });

  it("rejects a version-two database whose card row metadata differs from its profile", () => {
    const path = temporaryDatabase("card-metadata.sqlite");
    const card = cardKey("metadata-card");
    const store = new SqliteLearningStore(path);
    store.ensureCard(card, 1, NOW);
    store.close();

    const admin = new DatabaseSync(path);
    admin
      .prepare("UPDATE card_state SET scheduler_version = ? WHERE card_id = ?")
      .run("tampered-version", card);
    admin.close();

    expect(() => new SqliteLearningStore(path)).toThrow(/Card scheduler metadata mismatch/);

    const database = new DatabaseSync(path, { readOnly: true });
    expect(
      (
        database.prepare("SELECT scheduler_version FROM card_state").get() as {
          scheduler_version: string;
        }
      ).scheduler_version,
    ).toBe("tampered-version");
    database.close();
  });

  it("creates private file-backed databases and private restorable backups", async () => {
    const path = temporaryDatabase();
    const destination = join(dirname(path), "backups", "learning.sqlite");
    const store = new SqliteLearningStore(path);
    const backupCard = cardKey("backup-card");
    store.reviewCard({
      commandId: "backup-review",
      cardKey: backupCard,
      contentRevision: 1,
      rating: Rating.Easy,
      reviewedAt: NOW,
    });
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(statSync(`${path}-wal`).mode & 0o777).toBe(0o600);
    expect(statSync(`${path}-shm`).mode & 0o777).toBe(0o600);
    const pages = await store.backup(destination);
    store.close();

    expect(pages).toBeGreaterThan(0);
    expect(existsSync(destination)).toBe(true);
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(statSync(destination).mode & 0o777).toBe(0o600);
    const restored = new DatabaseSync(destination, { readOnly: true });
    expect(
      (restored.prepare("SELECT COUNT(*) AS count FROM review_event").get() as { count: number })
        .count,
    ).toBe(1);
    restored.close();
  });

  it("leaves an existing backup intact and removes its temporary file when backup fails", async () => {
    const path = temporaryDatabase("backup-source.sqlite");
    const destination = join(dirname(path), "backups", "learning.sqlite");
    const store = new SqliteLearningStore(path);
    store.reviewCard({
      commandId: "preserved-backup-review",
      cardKey: cardKey("preserved-backup-card"),
      contentRevision: 1,
      rating: Rating.Good,
      reviewedAt: NOW,
    });
    await store.backup(destination);
    const original = readFileSync(destination);
    store.close();

    await expect(store.backup(destination)).rejects.toThrow();

    expect(readFileSync(destination)).toEqual(original);
    expect(readdirSync(dirname(destination)).filter((entry) => entry.endsWith(".tmp"))).toEqual([]);
  });
});

describe("composable transactions", () => {
  it("commits several already-transactional writes as one unit", () => {
    const store = new SqliteLearningStore(":memory:");

    store.transaction(() => {
      store.recordExerciseAttempt({
        commandId: "11111111-1111-4111-8111-111111111111",
        exerciseKey: exerciseKey("compose-commit"),
        contentRevision: 1,
        score: 1,
        maxScore: 1,
      });
      store.recordLessonProgress({
        lessonKey: lessonKey(LESSON_ID),
        contentRevision: 1,
        status: "completed",
        progress: 1,
      });
      store.ensureCard(cardKey("compose-commit-card"), 1, NOW);
    });

    expect(store.countExerciseAttempts(exerciseKey("compose-commit"), 1)).toBe(1);
    expect(store.getLessonProgress(lessonKey(LESSON_ID))).toMatchObject({ status: "completed" });
    expect(store.getCard(cardKey("compose-commit-card"))).not.toBeNull();
    store.close();
  });

  it("rolls every nested write back when the unit of work throws", () => {
    const store = new SqliteLearningStore(":memory:");

    expect(() =>
      store.transaction(() => {
        store.recordExerciseAttempt({
          commandId: "22222222-2222-4222-8222-222222222222",
          exerciseKey: exerciseKey("compose-rollback"),
          contentRevision: 1,
          score: 1,
          maxScore: 1,
        });
        store.ensureCard(cardKey("compose-rollback-card"), 1, NOW);
        throw new Error("card enrolment failed");
      }),
    ).toThrow("card enrolment failed");

    // A partially applied outcome is exactly what the transaction prevents:
    // no attempt without its card, no card without its attempt.
    expect(store.countExerciseAttempts(exerciseKey("compose-rollback"), 1)).toBe(0);
    expect(store.getCard(cardKey("compose-rollback-card"))).toBeNull();
    store.close();
  });

  it("still works for a plain single write after a nested unit of work", () => {
    const store = new SqliteLearningStore(":memory:");

    store.transaction(() => store.ensureCard(cardKey("nested-then-plain"), 1, NOW));
    store.ensureCard(cardKey("plain-after-nested"), 1, NOW);

    expect(store.getCard(cardKey("nested-then-plain"))).not.toBeNull();
    expect(store.getCard(cardKey("plain-after-nested"))).not.toBeNull();
    store.close();
  });
});
