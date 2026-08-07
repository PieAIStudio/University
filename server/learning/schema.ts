import { DatabaseSync } from "node:sqlite";

import { cardContentKey, exerciseContentKey, lessonContentKey } from "./types.js";
import { validateLessonProgress } from "./lesson-progress.js";

export const LEARNING_SCHEMA_VERSION = 4;
const SCHEMA_VERSION = LEARNING_SCHEMA_VERSION;

const LEGACY_COURSE_ID = "legacy-course";
const LEGACY_UNIT_ID = "legacy-unit";
const LEGACY_LESSON_ID = "legacy-lesson";

export type LearningSchemaSchedulerSeed = {
  readonly schedulerVersion: string;
  readonly parametersJson: string;
  readonly schedulerConfigHash: string;
};

function transaction<T>(db: DatabaseSync, operation: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    if (db.isTransaction) db.exec("ROLLBACK");
    throw error;
  }
}

export function createCurrentSchema(db: DatabaseSync, seed: LearningSchemaSchedulerSeed): void {
  db.exec(`
      CREATE TABLE scheduler_profile (
        singleton_id INTEGER PRIMARY KEY CHECK(singleton_id = 1),
        scheduler_version TEXT NOT NULL,
        parameters_json TEXT NOT NULL CHECK(json_valid(parameters_json)),
        scheduler_config_hash TEXT NOT NULL
      ) STRICT;

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
      CREATE INDEX card_state_due_idx ON card_state(due_at);

      CREATE TABLE review_event (
        event_id TEXT PRIMARY KEY,
        command_id TEXT NOT NULL UNIQUE,
        card_id TEXT NOT NULL,
        content_revision INTEGER NOT NULL,
        rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 4),
        reviewed_at INTEGER NOT NULL,
        previous_due_at INTEGER NOT NULL,
        resulting_due_at INTEGER NOT NULL,
        scheduler_version TEXT NOT NULL,
        scheduler_config_hash TEXT NOT NULL,
        payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
        session_id TEXT REFERENCES learning_session(session_id)
      ) STRICT;
      CREATE INDEX review_event_card_idx ON review_event(card_id, reviewed_at);

      CREATE TABLE lesson_progress (
        lesson_id TEXT PRIMARY KEY,
        content_revision INTEGER NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('not-started', 'in-progress', 'completed')),
        progress REAL NOT NULL CHECK(progress >= 0 AND progress <= 1),
        updated_at INTEGER NOT NULL
      ) STRICT;

      CREATE TABLE exercise_attempt (
        attempt_id TEXT PRIMARY KEY,
        command_id TEXT NOT NULL UNIQUE,
        exercise_id TEXT NOT NULL,
        content_revision INTEGER NOT NULL,
        score REAL NOT NULL,
        max_score REAL NOT NULL CHECK(max_score > 0),
        response_json TEXT CHECK(response_json IS NULL OR json_valid(response_json)),
        occurred_at INTEGER NOT NULL,
        session_id TEXT REFERENCES learning_session(session_id)
      ) STRICT;
      CREATE INDEX exercise_attempt_exercise_idx
        ON exercise_attempt(exercise_id, occurred_at);

      CREATE TABLE learning_session (
        session_id TEXT PRIMARY KEY,
        started_at INTEGER NOT NULL,
        ended_at INTEGER CHECK(ended_at IS NULL OR ended_at >= started_at),
        host TEXT CHECK(host IS NULL OR (length(trim(host)) BETWEEN 1 AND 100)),
        objective TEXT CHECK(
          objective IS NULL OR (length(trim(objective)) BETWEEN 1 AND 2000)
        )
      ) STRICT;
      CREATE UNIQUE INDEX learning_session_one_open_idx
        ON learning_session((1)) WHERE ended_at IS NULL;

      CREATE INDEX review_event_session_idx
        ON review_event(session_id) WHERE session_id IS NOT NULL;
      CREATE INDEX exercise_attempt_session_idx
        ON exercise_attempt(session_id) WHERE session_id IS NOT NULL;

      CREATE TABLE lesson_progress_event (
        event_id TEXT PRIMARY KEY,
        lesson_id TEXT NOT NULL,
        content_revision INTEGER NOT NULL CHECK(content_revision > 0),
        status TEXT NOT NULL CHECK(status IN ('not-started', 'in-progress', 'completed')),
        progress REAL NOT NULL CHECK(progress >= 0 AND progress <= 1),
        occurred_at INTEGER NOT NULL,
        session_id TEXT REFERENCES learning_session(session_id)
      ) STRICT;
      CREATE INDEX lesson_progress_event_lesson_idx
        ON lesson_progress_event(lesson_id, occurred_at);
      CREATE INDEX lesson_progress_event_session_idx
        ON lesson_progress_event(session_id) WHERE session_id IS NOT NULL;

      CREATE TABLE retrieval_attempt (
        attempt_id TEXT PRIMARY KEY,
        command_id TEXT NOT NULL UNIQUE,
        card_key TEXT NOT NULL,
        content_revision INTEGER NOT NULL CHECK(content_revision > 0),
        answer TEXT NOT NULL CHECK(length(trim(answer)) > 0),
        started_at INTEGER NOT NULL,
        revealed_at INTEGER NOT NULL CHECK(revealed_at >= started_at),
        duration_ms INTEGER NOT NULL
          CHECK(duration_ms >= 0 AND duration_ms = revealed_at - started_at),
        used_hint INTEGER NOT NULL CHECK(used_hint IN (0, 1)),
        confidence REAL CHECK(confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
        session_id TEXT REFERENCES learning_session(session_id)
      ) STRICT;
      CREATE INDEX retrieval_attempt_card_idx
        ON retrieval_attempt(card_key, started_at);
      CREATE INDEX retrieval_attempt_session_idx
        ON retrieval_attempt(session_id) WHERE session_id IS NOT NULL;

      CREATE TABLE learner_setting (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL CHECK(json_valid(value_json)),
        updated_at INTEGER NOT NULL
      ) STRICT;
    `);
  insertSchedulerProfile(db, seed);
}

export function migrate(db: DatabaseSync, seed: LearningSchemaSchedulerSeed): void {
  db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
      ) STRICT;
    `);
  const version = db
    .prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations")
    .get() as { version: number };
  if (version.version > SCHEMA_VERSION) {
    throw new Error(`Learning database schema ${version.version} is newer than supported`);
  }
  if (version.version === 0) {
    transaction(db, () => {
      createCurrentSchema(db, seed);
      db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(
        SCHEMA_VERSION,
        Date.now(),
      );
    });
    return;
  }
  let currentVersion = version.version;
  if (currentVersion === 1) {
    migrateVersionOne(db, seed);
    currentVersion = 2;
  }
  if (currentVersion === 2) {
    migrateVersionTwo(db);
    currentVersion = 3;
  }
  if (currentVersion === 3) migrateVersionThree(db);
}

function migrateVersionOne(db: DatabaseSync, seed: LearningSchemaSchedulerSeed): void {
  transaction(db, () => {
    const pendingOutbox = db.prepare("SELECT COUNT(*) AS count FROM sync_outbox").get() as {
      count: number;
    };
    if (pendingOutbox.count > 0) {
      throw new Error(
        `Cannot migrate learning database: sync_outbox contains ${pendingOutbox.count} unprocessed row(s)`,
      );
    }

    const schedulerRows = db
      .prepare(`
          SELECT scheduler_version, scheduler_config_hash FROM card_state
          UNION
          SELECT scheduler_version, scheduler_config_hash FROM review_event
        `)
      .all() as unknown as Array<{
      scheduler_version: string;
      scheduler_config_hash: string;
    }>;
    const incompatible = schedulerRows.find(
      (row) =>
        row.scheduler_version !== seed.schedulerVersion ||
        row.scheduler_config_hash !== seed.schedulerConfigHash,
    );
    if (incompatible) {
      throw new Error(
        `Scheduler profile mismatch: legacy database uses ${incompatible.scheduler_version} / ${incompatible.scheduler_config_hash}, requested ${seed.schedulerVersion} / ${seed.schedulerConfigHash}`,
      );
    }

    const legacyCardIds = db
      .prepare(`
          SELECT card_id AS id FROM card_state
          UNION
          SELECT card_id AS id FROM review_event
        `)
      .all() as unknown as Array<{ id: string }>;
    for (const { id } of legacyCardIds) {
      cardContentKey({
        courseId: LEGACY_COURSE_ID,
        unitId: LEGACY_UNIT_ID,
        lessonId: LEGACY_LESSON_ID,
        cardId: id,
      });
    }
    const legacyLessonIds = db
      .prepare("SELECT lesson_id AS id, status, progress FROM lesson_progress")
      .all() as unknown as Array<{ id: string; status: string; progress: number }>;
    for (const { id, status, progress } of legacyLessonIds) {
      lessonContentKey({
        courseId: LEGACY_COURSE_ID,
        unitId: LEGACY_UNIT_ID,
        lessonId: id,
      });
      validateLessonProgress(status, progress);
    }
    const legacyExerciseIds = db
      .prepare("SELECT exercise_id AS id FROM exercise_attempt")
      .all() as unknown as Array<{ id: string }>;
    for (const { id } of legacyExerciseIds) {
      exerciseContentKey({
        courseId: LEGACY_COURSE_ID,
        unitId: LEGACY_UNIT_ID,
        lessonId: LEGACY_LESSON_ID,
        exerciseId: id,
      });
    }

    db.exec(`
        CREATE TABLE scheduler_profile (
          singleton_id INTEGER PRIMARY KEY CHECK(singleton_id = 1),
          scheduler_version TEXT NOT NULL,
          parameters_json TEXT NOT NULL CHECK(json_valid(parameters_json)),
          scheduler_config_hash TEXT NOT NULL
        ) STRICT;
        ALTER TABLE review_event ADD COLUMN command_id TEXT;
        CREATE UNIQUE INDEX review_event_command_idx
          ON review_event(command_id) WHERE command_id IS NOT NULL;
        ALTER TABLE exercise_attempt ADD COLUMN command_id TEXT;
        CREATE UNIQUE INDEX exercise_attempt_command_idx
          ON exercise_attempt(command_id) WHERE command_id IS NOT NULL;
        DROP TABLE sync_outbox;
      `);
    const cardPrefix = `${LEGACY_COURSE_ID}/${LEGACY_UNIT_ID}/${LEGACY_LESSON_ID}/`;
    const lessonPrefix = `${LEGACY_COURSE_ID}/${LEGACY_UNIT_ID}/`;
    db.prepare("UPDATE card_state SET card_id = ? || card_id").run(cardPrefix);
    db.prepare("UPDATE review_event SET card_id = ? || card_id").run(cardPrefix);
    db.prepare("UPDATE lesson_progress SET lesson_id = ? || lesson_id").run(lessonPrefix);
    db.prepare("UPDATE exercise_attempt SET exercise_id = ? || exercise_id").run(cardPrefix);
    insertSchedulerProfile(db, seed);
    db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(
      2,
      Date.now(),
    );
  });
}

function migrateVersionTwo(db: DatabaseSync): void {
  transaction(db, () => {
    db.exec(`
        CREATE TABLE retrieval_attempt (
          attempt_id TEXT PRIMARY KEY,
          command_id TEXT NOT NULL UNIQUE,
          card_key TEXT NOT NULL,
          content_revision INTEGER NOT NULL CHECK(content_revision > 0),
          answer TEXT NOT NULL CHECK(length(trim(answer)) > 0),
          started_at INTEGER NOT NULL,
          revealed_at INTEGER NOT NULL CHECK(revealed_at >= started_at),
          duration_ms INTEGER NOT NULL
            CHECK(duration_ms >= 0 AND duration_ms = revealed_at - started_at),
          used_hint INTEGER NOT NULL CHECK(used_hint IN (0, 1)),
          confidence REAL CHECK(confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
          session_id TEXT REFERENCES learning_session(session_id)
        ) STRICT;
        CREATE INDEX retrieval_attempt_card_idx
          ON retrieval_attempt(card_key, started_at);
        CREATE INDEX retrieval_attempt_session_idx
          ON retrieval_attempt(session_id) WHERE session_id IS NOT NULL;
      `);
    db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(
      3,
      Date.now(),
    );
  });
}

function migrateVersionThree(db: DatabaseSync): void {
  transaction(db, () => {
    const openSessions = db
      .prepare("SELECT COUNT(*) AS count FROM learning_session WHERE ended_at IS NULL")
      .get() as { count: number };
    if (openSessions.count > 1) {
      throw new Error(
        `Cannot migrate learning database: found ${openSessions.count} open learning sessions`,
      );
    }
    db.exec(`
        ALTER TABLE learning_session ADD COLUMN host TEXT
          CHECK(host IS NULL OR (length(trim(host)) BETWEEN 1 AND 100));
        ALTER TABLE learning_session ADD COLUMN objective TEXT
          CHECK(objective IS NULL OR (length(trim(objective)) BETWEEN 1 AND 2000));
        CREATE UNIQUE INDEX learning_session_one_open_idx
          ON learning_session((1)) WHERE ended_at IS NULL;

        ALTER TABLE review_event ADD COLUMN session_id TEXT
          REFERENCES learning_session(session_id);
        CREATE INDEX review_event_session_idx
          ON review_event(session_id) WHERE session_id IS NOT NULL;

        ALTER TABLE exercise_attempt ADD COLUMN session_id TEXT
          REFERENCES learning_session(session_id);
        CREATE INDEX exercise_attempt_session_idx
          ON exercise_attempt(session_id) WHERE session_id IS NOT NULL;

        CREATE TABLE lesson_progress_event (
          event_id TEXT PRIMARY KEY,
          lesson_id TEXT NOT NULL,
          content_revision INTEGER NOT NULL CHECK(content_revision > 0),
          status TEXT NOT NULL CHECK(status IN ('not-started', 'in-progress', 'completed')),
          progress REAL NOT NULL CHECK(progress >= 0 AND progress <= 1),
          occurred_at INTEGER NOT NULL,
          session_id TEXT REFERENCES learning_session(session_id)
        ) STRICT;
        CREATE INDEX lesson_progress_event_lesson_idx
          ON lesson_progress_event(lesson_id, occurred_at);
        CREATE INDEX lesson_progress_event_session_idx
          ON lesson_progress_event(session_id) WHERE session_id IS NOT NULL;
      `);
    db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(
      SCHEMA_VERSION,
      Date.now(),
    );
  });
}

function insertSchedulerProfile(db: DatabaseSync, seed: LearningSchemaSchedulerSeed): void {
  db.prepare(`
        INSERT INTO scheduler_profile (
          singleton_id, scheduler_version, parameters_json, scheduler_config_hash
        ) VALUES (1, ?, ?, ?)
      `).run(seed.schedulerVersion, seed.parametersJson, seed.schedulerConfigHash);
}
