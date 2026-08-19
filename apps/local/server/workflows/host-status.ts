import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import {
  CourseManifestSchema,
  UaAnalysisManifestSchema,
  type SnapshotManifest,
  type UaAnalysisManifest,
} from "../../src/domain/schemas.js";
import { listKnowledgeNotes } from "../knowledge/repository.js";
import { getStudyPaths } from "../studies/paths.js";
import { readStudy } from "../studies/repository.js";
import { listSnapshots } from "../studies/snapshots.js";
import { inspectSourceStatus, type SourceStatus } from "./refresh-study.js";

type StatusName = "draft" | "active" | "stale" | "retired";

interface HostStatusInput {
  readonly studiesRoot: string;
  readonly studyId: string;
}

interface HostStudyStatus {
  readonly schemaVersion: 1;
  readonly operation: "host-status";
  readonly study: ReturnType<typeof readStudy>;
  readonly source: SourceStatus & {
    readonly pushRequiredForRefresh: false;
    readonly refreshBlockedReason: string | null;
  };
  readonly snapshots: {
    readonly count: number;
    readonly latest: SnapshotManifest | null;
    readonly items: readonly SnapshotManifest[];
  };
  readonly ua: {
    readonly counts: Readonly<Record<UaAnalysisManifest["status"], number>>;
    readonly preparingIds: readonly string[];
    readonly readyIds: readonly string[];
    readonly supersededIds: readonly string[];
  };
  readonly courses: {
    readonly count: number;
    readonly byStatus: Readonly<Record<StatusName, number>>;
  };
  readonly notes: {
    readonly count: number;
    readonly byStatus: Readonly<Record<StatusName, number>>;
  };
  readonly learner: {
    readonly databaseExists: boolean;
    readonly databaseBytes: number;
    readonly openSession: {
      readonly sessionId: string;
      readonly startedAt: string;
      readonly host: string | null;
      readonly objective: string | null;
    } | null;
    readonly backups: {
      readonly count: number;
      readonly totalBytes: number;
      readonly latestName: string | null;
    };
  };
}

interface SessionRow {
  readonly session_id: string;
  readonly started_at: number;
  readonly host?: string | null;
  readonly objective?: string | null;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function emptyStatusCounts(): Record<StatusName, number> {
  return { draft: 0, active: 0, stale: 0, retired: 0 };
}

function listUa(directory: string): readonly UaAnalysisManifest[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${directory}/${entry.name}/manifest.json`)
    .filter(existsSync)
    .map((path) => UaAnalysisManifestSchema.parse(readJson(path)))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function countCourses(directory: string): {
  readonly count: number;
  readonly byStatus: Readonly<Record<StatusName, number>>;
} {
  const byStatus = emptyStatusCounts();
  if (!existsSync(directory)) return { count: 0, byStatus };
  let count = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const path = `${directory}/${entry.name}/course.json`;
    if (!existsSync(path)) continue;
    const course = CourseManifestSchema.parse(readJson(path));
    byStatus[course.status] += 1;
    count += 1;
  }
  return { count, byStatus };
}

function sqliteHasColumn(database: DatabaseSync, table: string, column: string): boolean {
  const rows = database.prepare(`PRAGMA table_info(${table})`).all() as unknown as Array<{
    name: string;
  }>;
  return rows.some((row) => row.name === column);
}

function readOpenSession(databasePath: string): HostStudyStatus["learner"]["openSession"] {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const table = database
      .prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get("learning_session") as { present: number } | undefined;
    if (!table) return null;
    const hasHost = sqliteHasColumn(database, "learning_session", "host");
    const hasObjective = sqliteHasColumn(database, "learning_session", "objective");
    const row = database
      .prepare(
        `SELECT session_id, started_at${hasHost ? ", host" : ""}${hasObjective ? ", objective" : ""}
         FROM learning_session WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1`,
      )
      .get() as SessionRow | undefined;
    if (!row) return null;
    const startedAt = new Date(row.started_at);
    if (!Number.isFinite(startedAt.getTime())) {
      throw new Error(`Open learning session has an invalid start time: ${row.session_id}`);
    }
    return {
      sessionId: row.session_id,
      startedAt: startedAt.toISOString(),
      host: row.host ?? null,
      objective: row.objective ?? null,
    };
  } finally {
    database.close();
  }
}

function inspectBackups(directory: string): HostStudyStatus["learner"]["backups"] {
  if (!existsSync(directory)) return { count: 0, totalBytes: 0, latestName: null };
  const files = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sqlite"))
    .map((entry) => ({ name: entry.name, ...statSync(`${directory}/${entry.name}`) }))
    .sort((left, right) => right.mtimeMs - left.mtimeMs || left.name.localeCompare(right.name));
  return {
    count: files.length,
    totalBytes: files.reduce((total, file) => total + file.size, 0),
    latestName: files[0]?.name ?? null,
  };
}

/** Returns a read-only operational view. It never creates or migrates the learner database. */
export function getHostStudyStatus(input: HostStatusInput): HostStudyStatus {
  const study = readStudy(input.studiesRoot, input.studyId);
  const paths = getStudyPaths(input.studiesRoot, input.studyId);
  const sourceStatus = inspectSourceStatus(input.studiesRoot, input.studyId);
  const snapshots = listSnapshots(input.studiesRoot, input.studyId);
  const analyses = listUa(paths.ua);
  const uaCounts: Record<UaAnalysisManifest["status"], number> = {
    preparing: 0,
    failed: 0,
    ready: 0,
    "legacy-import": 0,
    superseded: 0,
  };
  for (const analysis of analyses) uaCounts[analysis.status] += 1;
  const courses = countCourses(paths.courses);
  const notes = listKnowledgeNotes(input.studiesRoot, input.studyId);
  const noteCounts = emptyStatusCounts();
  for (const note of notes) noteCounts[note.status] += 1;
  const databaseExists = existsSync(paths.learner.database);

  return {
    schemaVersion: 1,
    operation: "host-status",
    study,
    source: {
      ...sourceStatus,
      pushRequiredForRefresh: false,
      refreshBlockedReason: sourceStatus.dirty
        ? "Commit or discard working-tree changes, or explicitly acknowledge that dirty files will be excluded; snapshots include commits only."
        : null,
    },
    snapshots: {
      count: snapshots.length,
      latest: snapshots[0] ?? null,
      items: snapshots,
    },
    ua: {
      counts: uaCounts,
      preparingIds: analyses
        .filter((analysis) => analysis.status === "preparing")
        .map((analysis) => analysis.id),
      readyIds: analyses
        .filter((analysis) => analysis.status === "ready")
        .map((analysis) => analysis.id),
      supersededIds: analyses
        .filter((analysis) => analysis.status === "superseded")
        .map((analysis) => analysis.id),
    },
    courses,
    notes: { count: notes.length, byStatus: noteCounts },
    learner: {
      databaseExists,
      databaseBytes: databaseExists ? statSync(paths.learner.database).size : 0,
      openSession: databaseExists ? readOpenSession(paths.learner.database) : null,
      backups: inspectBackups(paths.learner.backups),
    },
  };
}
