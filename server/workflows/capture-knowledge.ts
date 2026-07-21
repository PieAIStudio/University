import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import { KnowledgeNoteSchema, type KnowledgeNote } from "../../src/domain/schemas.js";
import { validateEvidence } from "../content/evidence.js";
import { writeKnowledgeNoteRevision } from "../knowledge/repository.js";
import { SqliteLearningStore } from "../learning/sqlite-learning-store.js";
import { knowledgeCardContentKey } from "../learning/types.js";
import { getKnowledgeNotePaths, getStudyPaths } from "../studies/paths.js";
import { readStudy } from "../studies/repository.js";

const MAX_CAPTURE_CONTENT_BYTES = 512 * 1024;
const MAX_CAPTURE_CARDS = 3;
const CaptureEnvelopeSchema = z
  .object({
    note: z.record(z.string(), z.unknown()),
    content: z.string().min(1),
  })
  .strict();
const LatestPointerSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string(),
    contentRevision: z.number().int().positive(),
    contentHash: z.string(),
  })
  .strict();

export interface CaptureKnowledgeInput {
  readonly studiesRoot: string;
  readonly studyId: string;
  readonly proposal: unknown;
  readonly dryRun?: boolean;
  readonly now?: Date;
}

export interface CaptureKnowledgeReceipt {
  readonly schemaVersion: 1;
  readonly operation: "capture-knowledge";
  readonly mode: "dry-run" | "apply";
  readonly disposition: "created" | "reused";
  readonly studyId: string;
  readonly noteId: string;
  readonly requestedCaptureId: string;
  readonly storedCaptureId: string;
  readonly revision: number;
  readonly status: KnowledgeNote["status"];
  readonly enrolledCardKeys: readonly string[];
  readonly wouldEnrollCardKeys: readonly string[];
  readonly rawTranscriptStored: false;
}

interface ValidatedProposal {
  readonly note: KnowledgeNote;
  readonly noteInput: Omit<KnowledgeNote, "contentHash">;
  readonly content: string;
}

interface RevisionState {
  readonly revisions: readonly KnowledgeNote[];
  readonly latest: KnowledgeNote | null;
}

interface CaptureDecision {
  readonly disposition: "created" | "reused";
  readonly stored: KnowledgeNote;
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

function semanticIdentity(note: KnowledgeNote): string {
  const {
    contentRevision: _contentRevision,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    origin: _origin,
    ...teachingContent
  } = note;
  return canonicalJson(teachingContent);
}

function parseProposal(proposal: unknown): ValidatedProposal {
  const envelope = CaptureEnvelopeSchema.parse(proposal);
  if (Buffer.byteLength(envelope.content, "utf8") > MAX_CAPTURE_CONTENT_BYTES) {
    throw new Error(`Knowledge content must not exceed ${MAX_CAPTURE_CONTENT_BYTES} bytes`);
  }
  if (envelope.content.trim() === "") throw new Error("Knowledge content must not be empty");
  if (Object.hasOwn(envelope.note, "contentHash")) {
    throw new Error("Do not supply contentHash; UniversityLocal derives it from content");
  }
  const note = KnowledgeNoteSchema.parse({
    ...envelope.note,
    contentHash: sha256(envelope.content),
  });
  const { contentHash: _contentHash, ...noteInput } = note;
  return { note, noteInput, content: envelope.content };
}

function readRevisionState(studiesRoot: string, studyId: string, noteId: string): RevisionState {
  const paths = getKnowledgeNotePaths(studiesRoot, studyId, noteId);
  if (!existsSync(paths.revisions)) return { revisions: [], latest: null };

  const revisionNumbers = readdirSync(paths.revisions, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("."))
    .map((entry) => {
      if (!entry.isDirectory() || !/^[1-9]\d*$/.test(entry.name)) {
        throw new Error(`Invalid knowledge note revision entry: ${entry.name}`);
      }
      return Number(entry.name);
    })
    .sort((left, right) => left - right);
  revisionNumbers.forEach((revision, index) => {
    if (revision !== index + 1) throw new Error("Knowledge note revision history contains a gap");
  });

  const revisions = revisionNumbers.map((revision) => {
    const root = join(paths.revisions, String(revision));
    const note = KnowledgeNoteSchema.parse(
      JSON.parse(readFileSync(join(root, "note.json"), "utf8")) as unknown,
    );
    const content = readFileSync(join(root, "content.md"), "utf8");
    if (note.id !== noteId || note.contentRevision !== revision) {
      throw new Error("Knowledge note revision identity does not match its directory");
    }
    if (note.contentHash !== sha256(content)) {
      throw new Error(`Knowledge note revision ${revision} content hash mismatch`);
    }
    return note;
  });

  if (!existsSync(paths.latest)) return { revisions, latest: null };
  const pointer = LatestPointerSchema.parse(
    JSON.parse(readFileSync(paths.latest, "utf8")) as unknown,
  );
  const latest = revisions[pointer.contentRevision - 1];
  if (
    !latest ||
    pointer.id !== noteId ||
    latest.id !== pointer.id ||
    latest.contentHash !== pointer.contentHash
  ) {
    throw new Error("Knowledge note latest pointer does not match its revision");
  }
  if (revisions.length > latest.contentRevision + 1) {
    throw new Error("Knowledge note revision history jumped ahead of latest");
  }
  return { revisions, latest };
}

function assertLifecycle(previous: KnowledgeNote, candidate: KnowledgeNote): void {
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

function decideCapture(state: RevisionState, candidate: KnowledgeNote): CaptureDecision {
  const identity = semanticIdentity(candidate);
  const sameCapture = state.revisions.find(
    (revision) => revision.origin.captureId === candidate.origin.captureId,
  );
  if (sameCapture) {
    if (semanticIdentity(sameCapture) !== identity) {
      throw new Error("Knowledge note captureId was already used for different content");
    }
    return { disposition: "reused", stored: sameCapture };
  }
  const semanticDuplicate = state.revisions.find(
    (revision) => semanticIdentity(revision) === identity,
  );
  if (semanticDuplicate) return { disposition: "reused", stored: semanticDuplicate };

  if (!state.latest && state.revisions.length > 0) {
    throw new Error(
      "Knowledge note has an installed revision without latest.json; retry the exact capture to recover",
    );
  }
  if (state.latest && state.revisions.length === state.latest.contentRevision + 1) {
    throw new Error(
      "Knowledge note has a pending revision; retry the exact capture before writing another revision",
    );
  }
  const expectedRevision = (state.latest?.contentRevision ?? 0) + 1;
  if (candidate.contentRevision !== expectedRevision) {
    throw new Error(
      `Knowledge note revision must be ${expectedRevision}, received ${candidate.contentRevision}`,
    );
  }
  if (state.latest) assertLifecycle(state.latest, candidate);
  return { disposition: "created", stored: candidate };
}

/**
 * Validates and stores one curated teaching note plus derived review cards.
 * The envelope is deliberately strict: raw chat transcripts and unrelated host payloads are rejected.
 */
export function captureKnowledge(input: CaptureKnowledgeInput): CaptureKnowledgeReceipt {
  readStudy(input.studiesRoot, input.studyId);
  const proposal = parseProposal(input.proposal);
  for (const evidence of proposal.note.evidence) {
    validateEvidence(input.studiesRoot, input.studyId, evidence);
  }
  const state = readRevisionState(input.studiesRoot, input.studyId, proposal.note.id);
  const decision = decideCapture(state, proposal.note);
  if (decision.disposition === "created" && proposal.note.cards.length > MAX_CAPTURE_CARDS) {
    throw new Error(`Knowledge capture may include at most ${MAX_CAPTURE_CARDS} cards`);
  }
  const previewKeys =
    decision.stored.status === "active"
      ? decision.stored.cards.map((card) =>
          knowledgeCardContentKey({ noteId: decision.stored.id, cardId: card.id }),
        )
      : [];

  if (input.dryRun) {
    return {
      schemaVersion: 1,
      operation: "capture-knowledge",
      mode: "dry-run",
      disposition: decision.disposition,
      studyId: input.studyId,
      noteId: decision.stored.id,
      requestedCaptureId: proposal.note.origin.captureId,
      storedCaptureId: decision.stored.origin.captureId,
      revision: decision.stored.contentRevision,
      status: decision.stored.status,
      enrolledCardKeys: [],
      wouldEnrollCardKeys: previewKeys,
      rawTranscriptStored: false,
    };
  }

  const stored = writeKnowledgeNoteRevision(input.studiesRoot, input.studyId, {
    note: proposal.noteInput,
    content: proposal.content,
  });
  const enrolledCardKeys: string[] = [];
  if (stored.status === "active" && stored.cards.length > 0) {
    const store = new SqliteLearningStore(
      getStudyPaths(input.studiesRoot, input.studyId).learner.database,
    );
    try {
      for (const card of stored.cards) {
        const key = knowledgeCardContentKey({ noteId: stored.id, cardId: card.id });
        store.ensureCard(key, stored.contentRevision, input.now ?? new Date());
        enrolledCardKeys.push(key);
      }
    } finally {
      store.close();
    }
  }

  return {
    schemaVersion: 1,
    operation: "capture-knowledge",
    mode: "apply",
    disposition: decision.disposition,
    studyId: input.studyId,
    noteId: stored.id,
    requestedCaptureId: proposal.note.origin.captureId,
    storedCaptureId: stored.origin.captureId,
    revision: stored.contentRevision,
    status: stored.status,
    enrolledCardKeys,
    wouldEnrollCardKeys: enrolledCardKeys,
    rawTranscriptStored: false,
  };
}
