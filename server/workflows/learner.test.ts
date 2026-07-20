import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { Rating } from "ts-fsrs";
import { describe, expect, it } from "vitest";

import { SqliteLearningStore } from "../learning/sqlite-learning-store.js";
import { cardContentKey } from "../learning/types.js";
import { getStudyPaths } from "../studies/paths.js";
import { createStudy } from "../studies/repository.js";
import { backupLearner, resetLearner, restoreLearner } from "./learner.js";

const NOW = new Date("2026-07-20T12:00:00.000Z");
const STUDY_ID = "sample-study";
const CARD_KEY = cardContentKey({
  courseId: "founder-engineer",
  unitId: "system-boundaries",
  lessonId: "source-integrity",
  cardId: "clean-snapshot",
});

function temporaryStudiesRoot(): string {
  const root = join(mkdtempSync(join(tmpdir(), "university-local-learner-workflow-")), "studies");
  createStudy(root, { id: STUDY_ID, title: "Sample Study", now: NOW });
  return root;
}

function addReview(database: string, commandId: string, reviewedAt = NOW): void {
  const store = new SqliteLearningStore(database);
  store.reviewCard({
    commandId,
    cardKey: CARD_KEY,
    contentRevision: 1,
    rating: Rating.Good,
    reviewedAt,
  });
  store.close();
}

function sqliteArtifactCount(backups: string): number {
  return readdirSync(backups).filter((entry) => entry.endsWith(".sqlite")).length;
}

describe("learner protection workflow", () => {
  it("creates a timestamped verified private online backup and receipt", async () => {
    const studiesRoot = temporaryStudiesRoot();
    const paths = getStudyPaths(studiesRoot, STUDY_ID);
    addReview(paths.learner.database, "backup-source-review");

    const receipt = await backupLearner({ studiesRoot, studyId: STUDY_ID, now: NOW });

    expect(receipt).toMatchObject({
      schemaVersion: 1,
      operation: "backup",
      purpose: "manual",
      studyId: STUDY_ID,
      createdAt: NOW.toISOString(),
      integrityCheck: "ok",
      learningSchemaVersion: 4,
    });
    expect(receipt.databasePath).toMatch(/backup-20260720T120000000Z-.*\.sqlite$/);
    expect(receipt.sha256).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(receipt.pages).toBeGreaterThan(0);
    expect(receipt.bytes).toBeGreaterThan(0);
    expect(statSync(receipt.databasePath).mode & 0o777).toBe(0o600);
    expect(statSync(receipt.receiptPath).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(receipt.receiptPath, "utf8"))).toEqual(receipt);

    const backup = new SqliteLearningStore(receipt.databasePath);
    expect(backup.reviewEventCount()).toBe(1);
    backup.close();
  });

  it("pre-backs up the current learner and atomically restores a verified candidate", async () => {
    const studiesRoot = temporaryStudiesRoot();
    const paths = getStudyPaths(studiesRoot, STUDY_ID);
    addReview(paths.learner.database, "first-review");
    const oneReview = await backupLearner({ studiesRoot, studyId: STUDY_ID, now: NOW });
    addReview(paths.learner.database, "second-review", new Date("2026-07-21T12:00:00.000Z"));

    const receipt = await restoreLearner({
      studiesRoot,
      studyId: STUDY_ID,
      candidate: oneReview.databasePath,
      now: new Date("2026-07-22T12:00:00.000Z"),
    });

    expect(receipt.operation).toBe("restore");
    expect(receipt.preRestoreBackup.purpose).toBe("pre-restore");
    expect(receipt.preRestoreBackup.databasePath).not.toBe(oneReview.databasePath);
    expect(receipt.activeCardReenrollmentRequired).toBe(false);
    expect(statSync(receipt.receiptPath).mode & 0o777).toBe(0o600);
    const restored = new SqliteLearningStore(paths.learner.database);
    expect(restored.reviewEventCount()).toBe(1);
    restored.close();
    const preservedCurrent = new SqliteLearningStore(receipt.preRestoreBackup.databasePath);
    expect(preservedCurrent.reviewEventCount()).toBe(2);
    preservedCurrent.close();
  });

  it("keeps the active learner untouched when a corrupt restore candidate fails after pre-backup", async () => {
    const studiesRoot = temporaryStudiesRoot();
    const paths = getStudyPaths(studiesRoot, STUDY_ID);
    addReview(paths.learner.database, "preserved-review");
    const corrupt = join(paths.learner.backups, "corrupt.sqlite");
    writeFileSync(corrupt, "not a sqlite database", { mode: 0o600 });
    const before = sqliteArtifactCount(paths.learner.backups);

    await expect(
      restoreLearner({
        studiesRoot,
        studyId: STUDY_ID,
        candidate: corrupt,
        now: NOW,
      }),
    ).rejects.toThrow(/database|integrity|SQLite/i);

    expect(sqliteArtifactCount(paths.learner.backups)).toBe(before + 1);
    const active = new SqliteLearningStore(paths.learner.database);
    expect(active.reviewEventCount()).toBe(1);
    active.close();
    expect(
      readdirSync(paths.learner.root).filter((entry) => entry.endsWith(".replacement")),
    ).toEqual([]);
  });

  it("rejects a restore candidate with a different scheduler profile after preserving current data", async () => {
    const studiesRoot = temporaryStudiesRoot();
    const paths = getStudyPaths(studiesRoot, STUDY_ID);
    addReview(paths.learner.database, "scheduler-preserved-review");
    const candidate = join(paths.learner.backups, "incompatible-scheduler.sqlite");
    const incompatible = new SqliteLearningStore(candidate, { request_retention: 0.85 });
    incompatible.close();

    await expect(
      restoreLearner({ studiesRoot, studyId: STUDY_ID, candidate, now: NOW }),
    ).rejects.toThrow(/Scheduler profile mismatch/);

    const active = new SqliteLearningStore(paths.learner.database);
    expect(active.reviewEventCount()).toBe(1);
    active.close();
    expect(
      readdirSync(paths.learner.backups).filter((entry) => entry.endsWith(".receipt.json")),
    ).toHaveLength(1);
  });

  it("requires exact study confirmation before reset and creates no backup on mismatch", async () => {
    const studiesRoot = temporaryStudiesRoot();
    const paths = getStudyPaths(studiesRoot, STUDY_ID);
    addReview(paths.learner.database, "confirmation-review");

    await expect(
      resetLearner({
        studiesRoot,
        studyId: STUDY_ID,
        confirmStudyId: ` ${STUDY_ID}`,
        now: NOW,
      }),
    ).rejects.toThrow(/exactly equal/);

    expect(sqliteArtifactCount(paths.learner.backups)).toBe(0);
    const active = new SqliteLearningStore(paths.learner.database);
    expect(active.reviewEventCount()).toBe(1);
    active.close();
  });

  it("resets only the exact learner database after backup and requests card re-enrollment", async () => {
    const studiesRoot = temporaryStudiesRoot();
    const paths = getStudyPaths(studiesRoot, STUDY_ID);
    const sentinels = [
      join(paths.source.root, "keep.txt"),
      join(paths.ua, "keep.txt"),
      join(paths.courses, "keep.txt"),
      join(paths.notes, "keep.txt"),
    ];
    for (const sentinel of sentinels) {
      mkdirSync(dirname(sentinel), { recursive: true });
      writeFileSync(sentinel, `preserve:${sentinel}`, "utf8");
    }
    addReview(paths.learner.database, "reset-review");
    const before = new SqliteLearningStore(paths.learner.database);
    before.startSession(NOW, { host: "grok", objective: "reset test" });
    before.close();

    const receipt = await resetLearner({
      studiesRoot,
      studyId: STUDY_ID,
      confirmStudyId: STUDY_ID,
      now: new Date("2026-07-23T12:00:00.000Z"),
    });

    expect(receipt.operation).toBe("reset");
    expect(receipt.preResetBackup.purpose).toBe("pre-reset");
    expect(receipt.activeCardReenrollmentRequired).toBe(true);
    expect(statSync(receipt.receiptPath).mode & 0o777).toBe(0o600);
    const clean = new SqliteLearningStore(paths.learner.database);
    expect(clean.reviewEventCount()).toBe(0);
    expect(clean.listSessions()).toEqual([]);
    clean.close();
    const preserved = new SqliteLearningStore(receipt.preResetBackup.databasePath);
    expect(preserved.reviewEventCount()).toBe(1);
    expect(preserved.getOpenSession()?.host).toBe("grok");
    preserved.close();
    for (const sentinel of sentinels) {
      expect(readFileSync(sentinel, "utf8")).toBe(`preserve:${sentinel}`);
    }
    expect(existsSync(`${paths.learner.database}-wal`)).toBe(false);
    expect(existsSync(`${paths.learner.database}-shm`)).toBe(false);

    const database = new DatabaseSync(paths.learner.database, { readOnly: true });
    expect(
      (
        database.prepare("SELECT MAX(version) AS version FROM schema_migrations").get() as {
          version: number;
        }
      ).version,
    ).toBe(4);
    database.close();
  });

  it("rejects an unmanaged studies root before touching a learner path", async () => {
    const unmanaged = mkdtempSync(join(tmpdir(), "unmanaged-studies-"));
    await expect(
      backupLearner({ studiesRoot: unmanaged, studyId: STUDY_ID, now: NOW }),
    ).rejects.toThrow(/marker|managed/i);
    expect(readdirSync(unmanaged)).toEqual([]);
  });
});
