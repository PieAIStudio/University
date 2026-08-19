import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  copyFileSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { STUDIES_ROOT_MARKER } from "../config/load-config.js";
import { LEARNING_SCHEMA_VERSION, SqliteLearningStore } from "../learning/sqlite-learning-store.js";
import { writeJsonAtomically } from "../storage/atomic-json.js";
import { getStudyPaths, type StudyPaths } from "../studies/paths.js";
import { readStudy } from "../studies/repository.js";

type BackupPurpose = "manual" | "pre-restore" | "pre-reset";

interface BackupLearnerInput {
  readonly studiesRoot: string;
  readonly studyId: string;
  readonly now?: Date;
  readonly purpose?: BackupPurpose;
}

interface LearnerBackupReceipt {
  readonly schemaVersion: 1;
  readonly operation: "backup";
  readonly purpose: BackupPurpose;
  readonly studyId: string;
  readonly createdAt: string;
  readonly databasePath: string;
  readonly receiptPath: string;
  readonly pages: number;
  readonly bytes: number;
  readonly sha256: string;
  readonly integrityCheck: "ok";
  readonly learningSchemaVersion: number;
  readonly schedulerVersion: string;
  readonly schedulerConfigHash: string;
}

interface RestoreLearnerInput {
  readonly studiesRoot: string;
  readonly studyId: string;
  readonly candidate: string;
  readonly now?: Date;
}

interface LearnerRestoreReceipt {
  readonly schemaVersion: 1;
  readonly operation: "restore";
  readonly studyId: string;
  readonly createdAt: string;
  readonly candidatePath: string;
  readonly installedSha256: string;
  readonly integrityCheck: "ok";
  readonly learningSchemaVersion: number;
  readonly schedulerVersion: string;
  readonly schedulerConfigHash: string;
  readonly preRestoreBackup: LearnerBackupReceipt;
  readonly activeCardReenrollmentRequired: false;
  readonly receiptPath: string;
}

interface ResetLearnerInput {
  readonly studiesRoot: string;
  readonly studyId: string;
  readonly confirmStudyId: string;
  readonly now?: Date;
}

interface LearnerResetReceipt {
  readonly schemaVersion: 1;
  readonly operation: "reset";
  readonly studyId: string;
  readonly createdAt: string;
  readonly installedSha256: string;
  readonly integrityCheck: "ok";
  readonly learningSchemaVersion: number;
  readonly schedulerVersion: string;
  readonly schedulerConfigHash: string;
  readonly preResetBackup: LearnerBackupReceipt;
  readonly activeCardReenrollmentRequired: true;
  readonly receiptPath: string;
}

interface ManagedLearnerPaths {
  readonly studiesRoot: string;
  readonly study: StudyPaths;
}

interface ValidatedDatabase {
  readonly bytes: number;
  readonly sha256: string;
  readonly schedulerVersion: string;
  readonly schedulerConfigHash: string;
}

function timestampToken(now: Date): string {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error("Learner workflow time must be a valid date");
  }
  return now.toISOString().replaceAll(/[-:.]/g, "");
}

function assertDirectory(path: string, label: string): void {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`${label} must be a real directory, not a symbolic link`);
  }
}

function assertRegularFile(path: string, label: string): void {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`${label} must be a regular file, not a symbolic link`);
  }
}

function resolveManagedLearner(studiesRootCandidate: string, studyId: string): ManagedLearnerPaths {
  const studiesRoot = realpathSync.native(studiesRootCandidate);
  assertDirectory(studiesRoot, "Studies root");
  const markerPath = join(studiesRoot, STUDIES_ROOT_MARKER);
  assertRegularFile(markerPath, "Studies-root marker");
  let marker: unknown;
  try {
    marker = JSON.parse(readFileSync(markerPath, "utf8")) as unknown;
  } catch {
    throw new Error(`Studies-root marker is not valid JSON: ${markerPath}`);
  }
  if (
    marker === null ||
    typeof marker !== "object" ||
    (marker as Record<string, unknown>)["schemaVersion"] !== 1 ||
    (marker as Record<string, unknown>)["product"] !== "UniversityLocal"
  ) {
    throw new Error(`Studies root is not managed by UniversityLocal: ${studiesRoot}`);
  }

  const study = getStudyPaths(studiesRoot, studyId);
  const manifest = readStudy(studiesRoot, studyId);
  if (manifest.id !== studyId) throw new Error("Study manifest ID does not match the requested ID");
  const canonicalStudyRoot = realpathSync.native(study.root);
  if (dirname(canonicalStudyRoot) !== studiesRoot) {
    throw new Error("Study directory must be a direct, non-symbolic child of the studies root");
  }
  assertDirectory(study.root, "Study directory");
  assertDirectory(study.learner.root, "Learner directory");
  if (!existsSync(study.learner.backups)) {
    mkdirSync(study.learner.backups, { mode: 0o700 });
  }
  assertDirectory(study.learner.backups, "Learner backup directory");
  if (existsSync(study.learner.database)) {
    assertRegularFile(study.learner.database, "Learner database");
  }
  return { studiesRoot, study };
}

function sha256File(path: string): string {
  return `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}`;
}

function removeSqliteSidecars(path: string): void {
  rmSync(`${path}-wal`, { force: true });
  rmSync(`${path}-shm`, { force: true });
}

function removeDatabaseCandidate(path: string): void {
  rmSync(path, { force: true });
  removeSqliteSidecars(path);
}

function fsyncFile(path: string): void {
  const descriptor = openSync(path, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function fsyncDirectory(path: string): void {
  const descriptor = openSync(path, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function integrityCheck(path: string): void {
  let database: DatabaseSync | undefined;
  try {
    database = new DatabaseSync(path, {
      readOnly: true,
      allowExtension: false,
      enableDoubleQuotedStringLiterals: false,
      defensive: true,
      timeout: 5_000,
    });
    const rows = database.prepare("PRAGMA integrity_check").all() as unknown as Array<
      Record<string, unknown>
    >;
    if (rows.length !== 1 || Object.values(rows[0] ?? {})[0] !== "ok") {
      const details = rows.map((row) => String(Object.values(row)[0])).join("; ");
      throw new Error(`Learner database integrity check failed: ${details || "no result"}`);
    }
  } catch (error) {
    throw new Error(
      `Learner database integrity check failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  } finally {
    database?.close();
  }
}

function validateDatabase(path: string): ValidatedDatabase {
  assertRegularFile(path, "Learner database candidate");
  let store: SqliteLearningStore | undefined;
  let schedulerVersion: string;
  let schedulerConfigHash: string;
  try {
    store = new SqliteLearningStore(path);
    schedulerVersion = store.schedulerVersion;
    schedulerConfigHash = store.schedulerConfigHash;
  } finally {
    store?.close();
  }
  removeSqliteSidecars(path);
  integrityCheck(path);
  removeSqliteSidecars(path);
  const schemaDatabase = new DatabaseSync(path, { readOnly: true });
  try {
    const schema = schemaDatabase
      .prepare("SELECT MAX(version) AS version FROM schema_migrations")
      .get() as { version: number };
    if (schema.version !== LEARNING_SCHEMA_VERSION) {
      throw new Error(
        `Learner database schema ${schema.version} does not match ${LEARNING_SCHEMA_VERSION}`,
      );
    }
  } finally {
    schemaDatabase.close();
  }
  removeSqliteSidecars(path);
  chmodSync(path, 0o600);
  return {
    bytes: statSync(path).size,
    sha256: sha256File(path),
    schedulerVersion: schedulerVersion!,
    schedulerConfigHash: schedulerConfigHash!,
  };
}

function nextArtifactPaths(
  backups: string,
  operation: "backup" | "restore" | "reset",
  now: Date,
): { readonly database?: string; readonly receipt: string } {
  const stem = `${operation}-${timestampToken(now)}-${randomUUID()}`;
  return {
    ...(operation === "backup" ? { database: join(backups, `${stem}.sqlite`) } : {}),
    receipt: join(backups, `${stem}.receipt.json`),
  };
}

function writeReceipt<T extends { readonly receiptPath: string }>(receipt: T): T {
  writeJsonAtomically(receipt.receiptPath, receipt);
  chmodSync(receipt.receiptPath, 0o600);
  return receipt;
}

function assertQuiescent(path: string): void {
  if (!existsSync(path)) return;
  const database = new DatabaseSync(path, { timeout: 5_000 });
  try {
    const checkpoint = database.prepare("PRAGMA wal_checkpoint(TRUNCATE)").get() as
      | { busy: number; log: number; checkpointed: number }
      | undefined;
    if (checkpoint && checkpoint.busy !== 0) {
      throw new Error("Learner database is busy; stop the local server before restore or reset");
    }
    database.exec("BEGIN EXCLUSIVE; COMMIT;");
  } finally {
    database.close();
  }
}

function installDatabase(current: string, replacement: string): void {
  assertQuiescent(current);
  removeSqliteSidecars(current);
  removeSqliteSidecars(replacement);
  chmodSync(replacement, 0o600);
  fsyncFile(replacement);
  renameSync(replacement, current);
  chmodSync(current, 0o600);
  fsyncDirectory(dirname(current));
}

export async function backupLearner(input: BackupLearnerInput): Promise<LearnerBackupReceipt> {
  const managed = resolveManagedLearner(input.studiesRoot, input.studyId);
  const now = input.now ?? new Date();
  const artifacts = nextArtifactPaths(managed.study.learner.backups, "backup", now);
  const destination = artifacts.database!;
  const purpose = input.purpose ?? "manual";
  let store: SqliteLearningStore | undefined;
  try {
    store = new SqliteLearningStore(managed.study.learner.database);
    const schedulerVersion = store.schedulerVersion;
    const schedulerConfigHash = store.schedulerConfigHash;
    const pages = await store.backup(destination);
    store.close();
    store = undefined;
    const validated = validateDatabase(destination);
    if (
      validated.schedulerVersion !== schedulerVersion ||
      validated.schedulerConfigHash !== schedulerConfigHash
    ) {
      throw new Error("Learner backup scheduler profile changed during validation");
    }
    const receipt: LearnerBackupReceipt = {
      schemaVersion: 1,
      operation: "backup",
      purpose,
      studyId: input.studyId,
      createdAt: now.toISOString(),
      databasePath: destination,
      receiptPath: artifacts.receipt,
      pages,
      bytes: validated.bytes,
      sha256: validated.sha256,
      integrityCheck: "ok",
      learningSchemaVersion: LEARNING_SCHEMA_VERSION,
      schedulerVersion,
      schedulerConfigHash,
    };
    return writeReceipt(receipt);
  } catch (error) {
    removeDatabaseCandidate(destination);
    throw error;
  } finally {
    store?.close();
  }
}

function stageCandidate(candidatePath: string, learnerRoot: string): string {
  assertRegularFile(candidatePath, "Restore candidate");
  if (existsSync(`${candidatePath}-wal`) && statSync(`${candidatePath}-wal`).size > 0) {
    throw new Error("Restore candidate must be a self-contained SQLite file without WAL sidecars");
  }
  const staged = join(learnerRoot, `.learning.${randomUUID()}.replacement`);
  copyFileSync(candidatePath, staged, constants.COPYFILE_EXCL);
  chmodSync(staged, 0o600);
  fsyncFile(staged);
  return staged;
}

export async function restoreLearner(input: RestoreLearnerInput): Promise<LearnerRestoreReceipt> {
  const managed = resolveManagedLearner(input.studiesRoot, input.studyId);
  assertRegularFile(input.candidate, "Restore candidate");
  const candidatePath = realpathSync.native(input.candidate);
  if (
    existsSync(managed.study.learner.database) &&
    candidatePath === realpathSync.native(managed.study.learner.database)
  ) {
    throw new Error("Restore candidate must not be the active learner database");
  }
  const now = input.now ?? new Date();
  const preRestoreBackup = await backupLearner({
    studiesRoot: managed.studiesRoot,
    studyId: input.studyId,
    now,
    purpose: "pre-restore",
  });
  const staged = stageCandidate(candidatePath, managed.study.learner.root);
  try {
    const validated = validateDatabase(staged);
    installDatabase(managed.study.learner.database, staged);
    integrityCheck(managed.study.learner.database);
    removeSqliteSidecars(managed.study.learner.database);
    const artifacts = nextArtifactPaths(managed.study.learner.backups, "restore", now);
    const receipt: LearnerRestoreReceipt = {
      schemaVersion: 1,
      operation: "restore",
      studyId: input.studyId,
      createdAt: now.toISOString(),
      candidatePath,
      installedSha256: validated.sha256,
      integrityCheck: "ok",
      learningSchemaVersion: LEARNING_SCHEMA_VERSION,
      schedulerVersion: validated.schedulerVersion,
      schedulerConfigHash: validated.schedulerConfigHash,
      preRestoreBackup,
      activeCardReenrollmentRequired: false,
      receiptPath: artifacts.receipt,
    };
    return writeReceipt(receipt);
  } finally {
    removeDatabaseCandidate(staged);
  }
}

export async function resetLearner(input: ResetLearnerInput): Promise<LearnerResetReceipt> {
  const managed = resolveManagedLearner(input.studiesRoot, input.studyId);
  if (input.confirmStudyId !== input.studyId) {
    throw new Error(`Reset confirmation must exactly equal study ID: ${input.studyId}`);
  }
  const now = input.now ?? new Date();
  const preResetBackup = await backupLearner({
    studiesRoot: managed.studiesRoot,
    studyId: input.studyId,
    now,
    purpose: "pre-reset",
  });
  const staged = join(managed.study.learner.root, `.learning.${randomUUID()}.replacement`);
  let store: SqliteLearningStore | undefined;
  try {
    store = new SqliteLearningStore(staged);
    store.close();
    store = undefined;
    const validated = validateDatabase(staged);
    installDatabase(managed.study.learner.database, staged);
    integrityCheck(managed.study.learner.database);
    removeSqliteSidecars(managed.study.learner.database);
    const artifacts = nextArtifactPaths(managed.study.learner.backups, "reset", now);
    const receipt: LearnerResetReceipt = {
      schemaVersion: 1,
      operation: "reset",
      studyId: input.studyId,
      createdAt: now.toISOString(),
      installedSha256: validated.sha256,
      integrityCheck: "ok",
      learningSchemaVersion: LEARNING_SCHEMA_VERSION,
      schedulerVersion: validated.schedulerVersion,
      schedulerConfigHash: validated.schedulerConfigHash,
      preResetBackup,
      activeCardReenrollmentRequired: true,
      receiptPath: artifacts.receipt,
    };
    return writeReceipt(receipt);
  } finally {
    store?.close();
    removeDatabaseCandidate(staged);
  }
}
