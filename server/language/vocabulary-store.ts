import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  FSRSVersion,
  Rating,
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card,
  type Grade,
} from "ts-fsrs";

/**
 * Where a word sits in the learner's head, as far as anything can honestly tell.
 *
 * The stages exist to keep four different observations from being confused with
 * each other, because collapsing them is how a vocabulary system starts lying:
 *
 * - `candidate` — in the lexicon, never interacted with.
 * - `learning` — the learner said they did not know it, or failed a retrieval.
 * - `familiar` — the learner *said* they knew it. This is a request for less
 *   noise, not a claim of mastery, and it is deliberately not the end state.
 * - `stable` — passed a retrieval on a later day. Still scheduled; still
 *   forgettable.
 * - `paused` — the learner does not want this word right now.
 *
 * What is missing from this list is any stage a word can reach by being shown.
 * Displaying a word proves the pixels were painted, not that anybody read them,
 * and a system that promotes on impressions will report fluency the learner
 * does not have.
 */
export type VocabularyStage = "candidate" | "learning" | "familiar" | "stable" | "paused";

export interface VocabularyState {
  readonly senseId: string;
  readonly stage: VocabularyStage;
  readonly dueAt: string | null;
  readonly reps: number;
  readonly lapses: number;
  readonly updatedAt: string;
}

interface VocabularyBudget {
  /** Words whose first-ever interaction happened today. */
  readonly introducedToday: number;
  /** Gradings recorded today. */
  readonly reviewedToday: number;
  readonly dueNow: number;
}

type VocabularyEventKind = "presented" | "opened" | "graded" | "stage-change";

const SCHEMA_VERSION = 1;
const PARAMETERS = generatorParameters({ request_retention: 0.9, enable_fuzz: false });

/**
 * Vocabulary state lives beside the studies rather than inside one.
 *
 * Learner databases are per-study, which is right for progress through a
 * course: finishing a lesson in one study says nothing about another. A word is
 * the opposite. Learning what `stale` means while reading TuringPact does not
 * un-learn it when the shelf changes, and storing it per-study would ask the
 * same word four times and average the answers into nonsense.
 */
export function getVocabularyDatabasePath(studiesRoot: string, language = "en"): string {
  return join(studiesRoot, ".vocabulary", `${language}.sqlite`);
}

export class VocabularyStore {
  readonly #db: DatabaseSync;
  readonly #scheduler = fsrs(PARAMETERS);

  constructor(databasePath: string) {
    mkdirSync(dirname(databasePath), { recursive: true });
    this.#db = new DatabaseSync(databasePath);
    this.#db.exec("PRAGMA journal_mode = WAL");
    this.#db.exec("PRAGMA foreign_keys = ON");
    this.#migrate();
  }

  #migrate(): void {
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS vocab_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS vocab_state (
        sense_id TEXT PRIMARY KEY,
        stage TEXT NOT NULL,
        due TEXT,
        stability REAL NOT NULL DEFAULT 0,
        difficulty REAL NOT NULL DEFAULT 0,
        elapsed_days REAL NOT NULL DEFAULT 0,
        scheduled_days REAL NOT NULL DEFAULT 0,
        reps INTEGER NOT NULL DEFAULT 0,
        lapses INTEGER NOT NULL DEFAULT 0,
        fsrs_state INTEGER NOT NULL DEFAULT 0,
        last_review TEXT,
        first_seen_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        scheduler_version TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS vocab_event (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sense_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        rating INTEGER,
        study_id TEXT,
        lesson_id TEXT,
        occurred_at TEXT NOT NULL,
        occurred_day TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS vocab_event_sense ON vocab_event (sense_id, occurred_at);
      CREATE INDEX IF NOT EXISTS vocab_event_day ON vocab_event (occurred_day, kind);
      CREATE UNIQUE INDEX IF NOT EXISTS vocab_event_presented_once
        ON vocab_event (sense_id, occurred_day, lesson_id)
        WHERE kind = 'presented';
      CREATE INDEX IF NOT EXISTS vocab_state_due ON vocab_state (stage, due);
    `);
    this.#db
      .prepare("INSERT OR REPLACE INTO vocab_meta (key, value) VALUES ('schemaVersion', ?)")
      .run(String(SCHEMA_VERSION));
  }

  close(): void {
    this.#db.close();
  }

  /**
   * Records that a word appeared on screen in a lesson.
   *
   * Unique per word per lesson per day on purpose. Re-rendering a lesson,
   * reloading the tab, or walking back through a unit would otherwise let a
   * learner accumulate "exposures" without reading anything, and any later
   * decision made from that count would be measuring page loads.
   */
  recordPresented(
    senseIds: readonly string[],
    context: { readonly studyId: string; readonly lessonId: string },
    now = new Date(),
  ): void {
    const statement = this.#db.prepare(
      `INSERT OR IGNORE INTO vocab_event (sense_id, kind, study_id, lesson_id, occurred_at, occurred_day)
       VALUES (?, 'presented', ?, ?, ?, ?)`,
    );
    for (const senseId of senseIds) {
      statement.run(senseId, context.studyId, context.lessonId, iso(now), day(now));
    }
  }

  readState(senseId: string): VocabularyState | null {
    const row = this.#db.prepare("SELECT * FROM vocab_state WHERE sense_id = ?").get(senseId) as
      | Record<string, unknown>
      | undefined;
    return row ? toState(row) : null;
  }

  listStates(): readonly VocabularyState[] {
    const rows = this.#db.prepare("SELECT * FROM vocab_state ORDER BY sense_id").all() as Record<
      string,
      unknown
    >[];
    return rows.map(toState);
  }

  /**
   * Moves a word to a stage the learner chose directly.
   *
   * `learning` schedules it immediately, because a word the learner just said
   * they did not know is exactly the one worth asking about. `familiar` and
   * `paused` clear the due date instead of deleting the row: the history of a
   * word the learner set aside is the reason they can set it aside again later
   * without starting over.
   */
  setStage(senseId: string, stage: VocabularyStage, now = new Date()): VocabularyState {
    const existing = this.readState(senseId);
    const card = existing ? this.#readCard(senseId) : createEmptyCard(now);
    const due = stage === "learning" ? now : null;
    this.#writeState(senseId, stage, { ...card, due: due ?? card.due }, now, due === null);
    this.#event(senseId, "stage-change", null, null, now);
    return this.readState(senseId)!;
  }

  /**
   * Grades a retrieval and lets FSRS decide when the word comes back.
   *
   * A pass only promotes to `stable` when the previous review was on an earlier
   * day. Answering correctly seconds after reading the gloss measures short-term
   * memory, which is the thing spaced repetition exists to avoid rewarding.
   */
  grade(senseId: string, rating: Grade, now = new Date()): VocabularyState {
    const previous = this.readState(senseId);
    const card = previous ? this.#readCard(senseId) : createEmptyCard(now);
    const result = this.#scheduler.next(card, now, rating);
    const passed = rating !== Rating.Again;
    const lastReviewDay = previous?.updatedAt ? previous.updatedAt.slice(0, 10) : null;
    const acrossDays = lastReviewDay !== null && lastReviewDay < day(now);
    const stage: VocabularyStage = !passed ? "learning" : acrossDays ? "stable" : "familiar";
    this.#writeState(senseId, stage, result.card, now, false);
    this.#event(senseId, "graded", rating, null, now);
    return this.readState(senseId)!;
  }

  recordOpened(senseId: string, studyId: string, now = new Date()): void {
    this.#event(senseId, "opened", null, studyId, now);
  }

  /**
   * Words that are due, newest lapses first.
   *
   * `paused` is excluded rather than filtered by due date, because a paused word
   * with a due date in the past is not overdue — it is off.
   */
  listDue(limit: number, now = new Date()): readonly VocabularyState[] {
    const rows = this.#db
      .prepare(
        `SELECT * FROM vocab_state
         WHERE stage IN ('learning', 'familiar', 'stable')
           AND due IS NOT NULL AND due <= ?
         ORDER BY lapses DESC, due ASC
         LIMIT ?`,
      )
      .all(iso(now), Math.max(1, Math.min(limit, 200))) as Record<string, unknown>[];
    return rows.map(toState);
  }

  /**
   * Today's load, so the caller can stop introducing new words before the
   * review queue outgrows the time the learner actually has. The budget is
   * reported, never enforced here — deciding to stop is a product decision, and
   * a store that silently refused to record work would hide it instead.
   */
  budget(now = new Date()): VocabularyBudget {
    const today = day(now);
    const introduced = this.#db
      .prepare("SELECT COUNT(*) AS n FROM vocab_state WHERE substr(first_seen_at, 1, 10) = ?")
      .get(today) as { n: number };
    const reviewed = this.#db
      .prepare("SELECT COUNT(*) AS n FROM vocab_event WHERE kind = 'graded' AND occurred_day = ?")
      .get(today) as { n: number };
    const due = this.#db
      .prepare(
        `SELECT COUNT(*) AS n FROM vocab_state
         WHERE stage IN ('learning', 'familiar', 'stable') AND due IS NOT NULL AND due <= ?`,
      )
      .get(iso(now)) as { n: number };
    return { introducedToday: introduced.n, reviewedToday: reviewed.n, dueNow: due.n };
  }

  #readCard(senseId: string): Card {
    const row = this.#db.prepare("SELECT * FROM vocab_state WHERE sense_id = ?").get(senseId) as
      | Record<string, unknown>
      | undefined;
    if (!row) return createEmptyCard();
    return {
      due: new Date(String(row.due ?? new Date().toISOString())),
      stability: Number(row.stability),
      difficulty: Number(row.difficulty),
      elapsed_days: Number(row.elapsed_days),
      scheduled_days: Number(row.scheduled_days),
      reps: Number(row.reps),
      lapses: Number(row.lapses),
      state: Number(row.fsrs_state),
      learning_steps: 0,
      last_review: row.last_review ? new Date(String(row.last_review)) : undefined,
    } as Card;
  }

  #writeState(
    senseId: string,
    stage: VocabularyStage,
    card: Card,
    now: Date,
    clearDue: boolean,
  ): void {
    this.#db
      .prepare(
        `INSERT INTO vocab_state (
           sense_id, stage, due, stability, difficulty, elapsed_days, scheduled_days,
           reps, lapses, fsrs_state, last_review, first_seen_at, updated_at, scheduler_version
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(sense_id) DO UPDATE SET
           stage = excluded.stage,
           due = excluded.due,
           stability = excluded.stability,
           difficulty = excluded.difficulty,
           elapsed_days = excluded.elapsed_days,
           scheduled_days = excluded.scheduled_days,
           reps = excluded.reps,
           lapses = excluded.lapses,
           fsrs_state = excluded.fsrs_state,
           last_review = excluded.last_review,
           updated_at = excluded.updated_at`,
      )
      .run(
        senseId,
        stage,
        clearDue ? null : card.due.toISOString(),
        card.stability,
        card.difficulty,
        card.elapsed_days,
        card.scheduled_days,
        card.reps,
        card.lapses,
        card.state,
        card.last_review ? card.last_review.toISOString() : null,
        iso(now),
        iso(now),
        FSRSVersion,
      );
  }

  #event(
    senseId: string,
    kind: VocabularyEventKind,
    rating: number | null,
    studyId: string | null,
    now: Date,
  ): void {
    this.#db
      .prepare(
        `INSERT INTO vocab_event (sense_id, kind, rating, study_id, lesson_id, occurred_at, occurred_day)
         VALUES (?, ?, ?, ?, NULL, ?, ?)`,
      )
      .run(senseId, kind, rating, studyId, iso(now), day(now));
  }
}

function toState(row: Record<string, unknown>): VocabularyState {
  return {
    senseId: String(row.sense_id),
    stage: String(row.stage) as VocabularyStage,
    dueAt: row.due === null || row.due === undefined ? null : String(row.due),
    reps: Number(row.reps),
    lapses: Number(row.lapses),
    updatedAt: String(row.updated_at),
  };
}

function iso(value: Date): string {
  return value.toISOString();
}

function day(value: Date): string {
  return value.toISOString().slice(0, 10);
}
