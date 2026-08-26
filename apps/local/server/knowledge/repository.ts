import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import {
  KnowledgeNoteSchema,
  Sha256,
  StableId,
  type KnowledgeCard,
  type KnowledgeNote,
} from "@pieai/university-core/domain/schemas.js";
import { validateEvidence } from "../content/evidence.js";
import { writeJsonAtomically, writeTextAtomically } from "../storage/atomic-json.js";
import { canonicalJson, readJson, sha256 } from "../storage/serialization.js";
import { getKnowledgeNotePaths, getStudyPaths } from "../studies/paths.js";
import { readStudy } from "../studies/repository.js";

const KnowledgeLatestPointerSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: StableId,
    contentRevision: z.number().int().positive(),
    contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  })
  .strict();

/**
 * How long a note write lock is believed even while its PID looks alive.
 * A single note write is a handful of local file operations; ten minutes is
 * far beyond that, so crossing it means the holder is gone and the PID has
 * been reused.
 */
const WRITE_LOCK_MAX_AGE_MS = 10 * 60 * 1000;

const KnowledgeWriteLockSchema = z
  .object({
    schemaVersion: z.literal(1),
    pid: z.number().int().positive(),
    token: z.string().uuid(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();

type KnowledgeLatestPointer = z.infer<typeof KnowledgeLatestPointerSchema>;
type KnowledgeNoteCandidate = Omit<z.input<typeof KnowledgeNoteSchema>, "contentHash">;

interface WriteKnowledgeNoteRevisionInput {
  readonly note: KnowledgeNoteCandidate;
  readonly content: string;
}

interface StoredKnowledgeNote {
  readonly note: KnowledgeNote;
  readonly content: string;
}

interface ActiveKnowledgeCard {
  readonly note: KnowledgeNote;
  readonly card: KnowledgeCard;
}

interface MarkKnowledgeNoteStaleInput {
  readonly studiesRoot: string;
  readonly studyId: string;
  readonly noteId: string;
  readonly reportHash: string;
  readonly now?: Date;
}

interface MarkKnowledgeNoteStaleResult {
  readonly note: KnowledgeNote;
  readonly transitioned: boolean;
}

function syncDirectory(directory: string): void {
  const descriptor = openSync(directory, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !(
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ESRCH"
    );
  }
}

function withKnowledgeWriteLock<T>(
  studiesRoot: string,
  studyId: string,
  noteId: string,
  operation: () => T,
): T {
  const notesRoot = getStudyPaths(studiesRoot, studyId).notes;
  mkdirSync(notesRoot, { recursive: true, mode: 0o700 });
  const lockPath = join(notesRoot, `.write-${noteId}.lock`);
  const lock = {
    schemaVersion: 1 as const,
    pid: process.pid,
    token: randomUUID(),
    createdAt: new Date().toISOString(),
  };

  let descriptor: number | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      descriptor = openSync(lockPath, "wx", 0o600);
      writeFileSync(descriptor, `${JSON.stringify(lock)}\n`, "utf8");
      fsyncSync(descriptor);
      closeSync(descriptor);
      descriptor = undefined;
      syncDirectory(notesRoot);
      break;
    } catch (error) {
      if (descriptor !== undefined) {
        closeSync(descriptor);
        descriptor = undefined;
        rmSync(lockPath, { force: true });
      }
      const code =
        error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : null;
      if (code !== "EEXIST") throw error;
      const existing = KnowledgeWriteLockSchema.parse(readJson(lockPath));
      // PID liveness alone is not enough to decide a lock is held. PIDs get
      // reused: if a writer crashes and the OS later hands its number to an
      // unrelated long-lived process, the lock looks alive forever and that
      // note can never be written again. An age limit gives the lock a way
      // out, while liveness still keeps a genuinely running writer safe for
      // as long as it plausibly needs.
      const age = Date.now() - Date.parse(existing.createdAt);
      const withinLifetime = Number.isFinite(age) && age < WRITE_LOCK_MAX_AGE_MS;
      if (processIsAlive(existing.pid) && withinLifetime) {
        throw new Error(`Knowledge note write is already in progress: ${noteId}`);
      }
      rmSync(lockPath, { force: true });
    }
  }
  if (!existsSync(lockPath)) {
    throw new Error(`Unable to acquire knowledge note write lock: ${noteId}`);
  }

  try {
    return operation();
  } finally {
    let ownsLock = false;
    try {
      ownsLock = KnowledgeWriteLockSchema.parse(readJson(lockPath)).token === lock.token;
    } catch {
      // Never remove a lock whose current ownership cannot be proven.
    }
    if (ownsLock) {
      rmSync(lockPath, { force: true });
      syncDirectory(notesRoot);
    }
  }
}

function semanticIdentity(note: KnowledgeNote): string {
  const {
    contentRevision: _contentRevision,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    origin,
    ...durableTeachingContent
  } = note;
  return canonicalJson({
    ...durableTeachingContent,
    // Conversational recaptures of identical teaching content collapse as before.
    // Refresh lifecycle revisions remain distinct so a later reactivation can be
    // invalidated again without reusing an older immutable revision.
    freshnessTransition:
      origin.kind === "source-refresh" ? { captureId: origin.captureId } : undefined,
  });
}

function sameSemanticContent(left: KnowledgeNote, right: KnowledgeNote): boolean {
  return semanticIdentity(left) === semanticIdentity(right);
}

function readRevision(
  studiesRoot: string,
  studyId: string,
  noteId: string,
  revision: number,
): StoredKnowledgeNote {
  const paths = getKnowledgeNotePaths(studiesRoot, studyId, noteId);
  const revisionRoot = join(paths.revisions, String(revision));
  const note = KnowledgeNoteSchema.parse(readJson(join(revisionRoot, "note.json")));
  if (note.id !== noteId) throw new Error("Knowledge note ID does not match its directory");
  if (note.contentRevision !== revision) {
    throw new Error("Knowledge note revision does not match its directory");
  }
  const content = readFileSync(join(revisionRoot, "content.md"), "utf8");
  if (note.contentHash !== sha256(content)) throw new Error("Knowledge note content hash mismatch");
  return { note, content };
}

function listRevisionNumbers(revisionsRoot: string): readonly number[] {
  if (!existsSync(revisionsRoot)) return [];
  const revisions: number[] = [];
  for (const entry of readdirSync(revisionsRoot, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (!entry.isDirectory() || !/^[1-9]\d*$/.test(entry.name)) {
      throw new Error(`Invalid knowledge note revision entry: ${entry.name}`);
    }
    const revision = Number(entry.name);
    if (!Number.isSafeInteger(revision)) {
      throw new Error(`Knowledge note revision is outside the safe integer range: ${entry.name}`);
    }
    revisions.push(revision);
  }
  revisions.sort((left, right) => left - right);
  for (let index = 0; index < revisions.length; index += 1) {
    if (revisions[index] !== index + 1) {
      throw new Error("Knowledge note revision history contains a gap");
    }
  }
  return revisions;
}

function readLatestPointer(path: string, expectedId: string): KnowledgeLatestPointer {
  const pointer = KnowledgeLatestPointerSchema.parse(readJson(path));
  if (pointer.id !== expectedId) {
    throw new Error(
      `Knowledge note latest pointer ID mismatch: expected ${expectedId}, received ${pointer.id}`,
    );
  }
  return pointer;
}

function assertPointerMatches(pointer: KnowledgeLatestPointer, stored: StoredKnowledgeNote): void {
  if (
    stored.note.id !== pointer.id ||
    stored.note.contentRevision !== pointer.contentRevision ||
    stored.note.contentHash !== pointer.contentHash
  ) {
    throw new Error("Knowledge note latest pointer does not match its revision");
  }
}

function makePointer(note: KnowledgeNote): KnowledgeLatestPointer {
  return {
    schemaVersion: 1,
    id: note.id,
    contentRevision: note.contentRevision,
    contentHash: note.contentHash,
  };
}

function finalizeLatest(
  latestPath: string,
  stored: StoredKnowledgeNote,
  previousRevision: number | null,
): void {
  if (existsSync(latestPath)) {
    const current = readLatestPointer(latestPath, stored.note.id);
    if (current.contentRevision === stored.note.contentRevision) {
      assertPointerMatches(current, stored);
      return;
    }
    if (previousRevision === null || current.contentRevision !== previousRevision) {
      throw new Error(
        "Knowledge note latest revision changed while the revision was being written",
      );
    }
  } else if (previousRevision !== null && previousRevision !== 0) {
    throw new Error(
      "Knowledge note latest pointer disappeared while the revision was being written",
    );
  }
  writeJsonAtomically(latestPath, makePointer(stored.note));
}

function recoverPendingLatest(
  latestPath: string,
  stored: StoredKnowledgeNote,
  latest: KnowledgeLatestPointer | null,
  maximumRevision: number,
): void {
  if (stored.note.contentRevision !== maximumRevision) {
    if (!latest || maximumRevision > latest.contentRevision) {
      throw new Error(
        "Knowledge note has a different pending revision; retry that exact capture first",
      );
    }
    return;
  }
  if (latest) {
    if (latest.contentRevision === stored.note.contentRevision) return;
    if (latest.contentRevision + 1 !== stored.note.contentRevision) {
      throw new Error("Knowledge note pending revision is not adjacent to latest");
    }
    finalizeLatest(latestPath, stored, latest.contentRevision);
    return;
  }

  // An exact retry may safely repair a crash after the immutable revision directory
  // was installed but before latest.json was written. No non-identical request may do this.
  writeJsonAtomically(latestPath, makePointer(stored.note));
}

function assertRevisionLifecycle(previous: KnowledgeNote, candidate: KnowledgeNote): void {
  if (candidate.createdAt !== previous.createdAt) {
    throw new Error("Knowledge note createdAt must remain stable across revisions");
  }
  if (new Date(candidate.updatedAt).getTime() < new Date(previous.updatedAt).getTime()) {
    throw new Error("Knowledge note updatedAt must not move backwards across revisions");
  }
  const allowed: Readonly<Record<KnowledgeNote["status"], readonly KnowledgeNote["status"][]>> = {
    draft: ["draft", "active", "retired"],
    active: ["active", "stale", "retired"],
    stale: ["stale", "active", "retired"],
    retired: [],
  };
  if (!allowed[previous.status].includes(candidate.status)) {
    throw new Error(
      `Invalid knowledge note status transition: ${previous.status} -> ${candidate.status}`,
    );
  }
}

function assertExistingRevisionCanSatisfy(
  existing: StoredKnowledgeNote,
  candidate: KnowledgeNote,
): void {
  const sameCapture = existing.note.origin.captureId === candidate.origin.captureId;
  const sameContent = sameSemanticContent(existing.note, candidate);
  if (sameCapture && !sameContent) {
    throw new Error("Knowledge note captureId was already used for different content");
  }
  if (!sameCapture && !sameContent) {
    throw new Error(
      `Knowledge note revision ${candidate.contentRevision} already exists and conflicts with requested content`,
    );
  }
}

function installRevision(
  studiesRoot: string,
  studyId: string,
  candidate: KnowledgeNote,
  content: string,
): StoredKnowledgeNote {
  const paths = getKnowledgeNotePaths(studiesRoot, studyId, candidate.id);
  mkdirSync(paths.revisions, { recursive: true, mode: 0o700 });
  const revisionRoot = join(paths.revisions, String(candidate.contentRevision));
  if (existsSync(revisionRoot)) {
    const existing = readRevision(studiesRoot, studyId, candidate.id, candidate.contentRevision);
    assertExistingRevisionCanSatisfy(existing, candidate);
    return existing;
  }

  const stagingRoot = join(
    paths.revisions,
    `.creating-${candidate.contentRevision}-${randomUUID()}`,
  );
  try {
    mkdirSync(stagingRoot, { mode: 0o700 });
    writeTextAtomically(join(stagingRoot, "content.md"), content);
    writeJsonAtomically(join(stagingRoot, "note.json"), candidate);
    try {
      renameSync(stagingRoot, revisionRoot);
      syncDirectory(paths.revisions);
      return { note: candidate, content };
    } catch (error) {
      if (!existsSync(revisionRoot)) throw error;
      const existing = readRevision(studiesRoot, studyId, candidate.id, candidate.contentRevision);
      assertExistingRevisionCanSatisfy(existing, candidate);
      return existing;
    }
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
  }
}

export function writeKnowledgeNoteRevision(
  studiesRoot: string,
  studyId: string,
  input: WriteKnowledgeNoteRevisionInput,
): KnowledgeNote {
  readStudy(studiesRoot, studyId);
  if (input.content.trim() === "") throw new Error("Knowledge note content must not be empty");
  const candidate = KnowledgeNoteSchema.parse({
    ...input.note,
    contentHash: sha256(input.content),
  });
  for (const evidence of candidate.evidence) validateEvidence(studiesRoot, studyId, evidence);

  return withKnowledgeWriteLock(studiesRoot, studyId, candidate.id, () =>
    writeValidatedKnowledgeNoteRevision(studiesRoot, studyId, candidate, input.content),
  );
}

function writeValidatedKnowledgeNoteRevision(
  studiesRoot: string,
  studyId: string,
  candidate: KnowledgeNote,
  content: string,
): KnowledgeNote {
  const paths = getKnowledgeNotePaths(studiesRoot, studyId, candidate.id);
  const revisions = listRevisionNumbers(paths.revisions);
  const storedRevisions = revisions.map((revision) =>
    readRevision(studiesRoot, studyId, candidate.id, revision),
  );
  const maximumRevision = revisions.at(-1) ?? 0;
  const latest = existsSync(paths.latest) ? readLatestPointer(paths.latest, candidate.id) : null;

  if (latest) {
    const latestStored = storedRevisions[latest.contentRevision - 1];
    if (!latestStored)
      throw new Error("Knowledge note latest pointer references a missing revision");
    assertPointerMatches(latest, latestStored);
    if (maximumRevision > latest.contentRevision + 1) {
      throw new Error("Knowledge note revision history jumped ahead of latest");
    }
  } else if (maximumRevision > 0 && storedRevisions.length !== maximumRevision) {
    throw new Error("Knowledge note revision history is incomplete");
  }

  const reusedCapture = storedRevisions.find(
    (stored) => stored.note.origin.captureId === candidate.origin.captureId,
  );
  if (reusedCapture) {
    if (!sameSemanticContent(reusedCapture.note, candidate)) {
      throw new Error("Knowledge note captureId was already used for different content");
    }
    recoverPendingLatest(paths.latest, reusedCapture, latest, maximumRevision);
    return reusedCapture.note;
  }

  const semanticDuplicate = storedRevisions.find((stored) =>
    sameSemanticContent(stored.note, candidate),
  );
  if (semanticDuplicate) {
    recoverPendingLatest(paths.latest, semanticDuplicate, latest, maximumRevision);
    return semanticDuplicate.note;
  }

  if (!latest && maximumRevision > 0) {
    throw new Error(
      "Knowledge note has an installed revision without latest.json; retry the exact capture to recover",
    );
  }
  if (latest && maximumRevision === latest.contentRevision + 1) {
    throw new Error(
      "Knowledge note has a pending revision; retry the exact capture before writing another revision",
    );
  }

  const previousRevision = latest?.contentRevision ?? 0;
  const expectedRevision = previousRevision + 1;
  if (candidate.contentRevision !== expectedRevision) {
    throw new Error(
      `Knowledge note revision must be ${expectedRevision}, received ${candidate.contentRevision}`,
    );
  }
  if (latest) {
    const previous = storedRevisions[latest.contentRevision - 1];
    if (!previous) throw new Error("Knowledge note latest revision is missing");
    assertRevisionLifecycle(previous.note, candidate);
  }

  const installed = installRevision(studiesRoot, studyId, candidate, content);
  finalizeLatest(paths.latest, installed, previousRevision);
  return installed.note;
}

export function readLatestKnowledgeNote(
  studiesRoot: string,
  studyId: string,
  noteId: string,
): StoredKnowledgeNote {
  readStudy(studiesRoot, studyId);
  const id = StableId.parse(noteId);
  const paths = getKnowledgeNotePaths(studiesRoot, studyId, id);
  const pointer = readLatestPointer(paths.latest, id);
  const stored = readRevision(studiesRoot, studyId, id, pointer.contentRevision);
  assertPointerMatches(pointer, stored);
  return stored;
}

/**
 * Appends a lifecycle-only revision when freshness evidence invalidates an active note.
 * The Markdown body and every teaching field stay unchanged; only status and provenance move.
 */
export function markKnowledgeNoteStale(
  input: MarkKnowledgeNoteStaleInput,
): MarkKnowledgeNoteStaleResult {
  readStudy(input.studiesRoot, input.studyId);
  const noteId = StableId.parse(input.noteId);
  const reportHash = Sha256.parse(input.reportHash);
  const requestedAt = input.now ?? new Date();
  if (Number.isNaN(requestedAt.getTime())) throw new Error("Knowledge stale timestamp is invalid");

  return withKnowledgeWriteLock(input.studiesRoot, input.studyId, noteId, () => {
    const stored = readLatestKnowledgeNote(input.studiesRoot, input.studyId, noteId);
    if (stored.note.status !== "active") {
      return { note: stored.note, transitioned: false };
    }

    const previousUpdatedAt = new Date(stored.note.updatedAt);
    const transitionTime = new Date(
      Math.max(requestedAt.getTime(), previousUpdatedAt.getTime()),
    ).toISOString();
    const candidate = KnowledgeNoteSchema.parse({
      ...stored.note,
      status: "stale",
      contentRevision: stored.note.contentRevision + 1,
      origin: {
        kind: "source-refresh",
        host: "UniversityLocal freshness",
        capturedAt: transitionTime,
        captureId: `freshness:${reportHash}:r${stored.note.contentRevision}`,
      },
      updatedAt: transitionTime,
    });
    for (const evidence of candidate.evidence) {
      validateEvidence(input.studiesRoot, input.studyId, evidence);
    }
    const note = writeValidatedKnowledgeNoteRevision(
      input.studiesRoot,
      input.studyId,
      candidate,
      stored.content,
    );
    return { note, transitioned: note.status === "stale" };
  });
}

export function listKnowledgeNotes(studiesRoot: string, studyId: string): readonly KnowledgeNote[] {
  readStudy(studiesRoot, studyId);
  const notesRoot = getStudyPaths(studiesRoot, studyId).notes;
  if (!existsSync(notesRoot)) return [];
  const notes: KnowledgeNote[] = [];
  for (const entry of readdirSync(notesRoot, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (!entry.isDirectory() || !StableId.safeParse(entry.name).success) {
      throw new Error(`Invalid knowledge note entry: ${entry.name}`);
    }
    notes.push(readLatestKnowledgeNote(studiesRoot, studyId, entry.name).note);
  }
  return notes.sort(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id),
  );
}

export function readActiveKnowledgeCard(
  studiesRoot: string,
  studyId: string,
  noteId: string,
  cardId: string,
): ActiveKnowledgeCard {
  const stored = readLatestKnowledgeNote(studiesRoot, studyId, noteId);
  if (stored.note.status !== "active") {
    throw new Error(`Knowledge note is not active: ${stored.note.id}`);
  }
  const id = StableId.parse(cardId);
  const card = stored.note.cards.find((candidate) => candidate.id === id);
  if (!card) throw new Error(`Knowledge note does not declare card: ${id}`);
  return { note: stored.note, card };
}

export function listActiveKnowledgeCards(
  studiesRoot: string,
  studyId: string,
): readonly ActiveKnowledgeCard[] {
  return listKnowledgeNotes(studiesRoot, studyId).flatMap((note) =>
    note.status === "active" ? note.cards.map((card) => ({ note, card })) : [],
  );
}
