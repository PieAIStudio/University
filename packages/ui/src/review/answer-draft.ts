import type { LessonRef } from "@pieai/university-core";

/**
 * A small local recovery cache for text that has not been submitted yet.
 *
 * This is deliberately not another learner/account document: submitted
 * answers continue to live only in ProgressDocument. Drafts never leave this
 * browser, never emit analytics, and disappear after a bounded time.
 */
export const ANSWER_DRAFT_STORAGE_KEY = "university.answer-drafts.v1";
export const ANSWER_DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const ANSWER_DRAFT_MAX_ENTRIES = 40;
export const ANSWER_DRAFT_MAX_CHARS = 20_000;

export interface AnswerDraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface AnswerDraftIdentity {
  readonly accountScope: string;
  readonly locator: LessonRef;
  readonly exerciseId: string;
  readonly contentRevision: number;
}

export type AnswerDraftReadResult =
  | { readonly status: "restored"; readonly answer: string; readonly updatedAt: number }
  | { readonly status: "missing" }
  | { readonly status: "unavailable" };

export type AnswerDraftWriteResult =
  | { readonly status: "saved"; readonly updatedAt: number }
  | { readonly status: "cleared" }
  | { readonly status: "unavailable" }
  | { readonly status: "failed"; readonly reason: "too-large" | "write-failed" };

interface StoredDraft {
  readonly identity: string;
  readonly answer: string;
  readonly updatedAt: number;
}

interface StoredDrafts {
  readonly version: 1;
  readonly entries: readonly StoredDraft[];
}

export function answerDraftIdentityKey(identity: AnswerDraftIdentity): string {
  return JSON.stringify([
    identity.accountScope,
    identity.locator.studyId,
    identity.locator.courseId,
    identity.locator.unitId,
    identity.locator.lessonId,
    identity.exerciseId,
    identity.contentRevision,
  ]);
}

export function browserAnswerDraftStorage(): AnswerDraftStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readAnswerDraft(
  storage: AnswerDraftStorage | null,
  identity: AnswerDraftIdentity,
  now = Date.now(),
): AnswerDraftReadResult {
  if (!storage) return { status: "unavailable" };
  let raw: string | null;
  try {
    raw = storage.getItem(ANSWER_DRAFT_STORAGE_KEY);
  } catch {
    return { status: "unavailable" };
  }
  const wanted = answerDraftIdentityKey(identity);
  const draft = parseStoredDrafts(raw).entries.find((entry) => entry.identity === wanted);
  if (!draft || isExpired(draft, now)) return { status: "missing" };
  return { status: "restored", answer: draft.answer, updatedAt: draft.updatedAt };
}

export function writeAnswerDraft(
  storage: AnswerDraftStorage | null,
  identity: AnswerDraftIdentity,
  answer: string,
  now = Date.now(),
): AnswerDraftWriteResult {
  if (!storage) return { status: "unavailable" };
  if (answer.length > ANSWER_DRAFT_MAX_CHARS) {
    return { status: "failed", reason: "too-large" };
  }

  let raw: string | null;
  try {
    raw = storage.getItem(ANSWER_DRAFT_STORAGE_KEY);
  } catch {
    return { status: "unavailable" };
  }

  const wanted = answerDraftIdentityKey(identity);
  const retained = parseStoredDrafts(raw).entries.filter(
    (entry) => entry.identity !== wanted && !isExpired(entry, now),
  );
  const entries =
    answer.length === 0
      ? retained
      : [{ identity: wanted, answer, updatedAt: now }, ...retained]
          .sort((left, right) => right.updatedAt - left.updatedAt)
          .slice(0, ANSWER_DRAFT_MAX_ENTRIES);

  try {
    storage.setItem(
      ANSWER_DRAFT_STORAGE_KEY,
      JSON.stringify({ version: 1, entries } satisfies StoredDrafts),
    );
  } catch {
    return { status: "failed", reason: "write-failed" };
  }
  return answer.length === 0 ? { status: "cleared" } : { status: "saved", updatedAt: now };
}

function parseStoredDrafts(raw: string | null): StoredDrafts {
  if (!raw) return { version: 1, entries: [] };
  try {
    const value = JSON.parse(raw) as unknown;
    if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.entries)) {
      return { version: 1, entries: [] };
    }
    return {
      version: 1,
      entries: value.entries.filter(isStoredDraft),
    };
  } catch {
    return { version: 1, entries: [] };
  }
}

function isStoredDraft(value: unknown): value is StoredDraft {
  return (
    isRecord(value) &&
    typeof value.identity === "string" &&
    typeof value.answer === "string" &&
    value.answer.length <= ANSWER_DRAFT_MAX_CHARS &&
    typeof value.updatedAt === "number" &&
    Number.isFinite(value.updatedAt)
  );
}

function isExpired(draft: StoredDraft, now: number): boolean {
  return draft.updatedAt > now || now - draft.updatedAt > ANSWER_DRAFT_TTL_MS;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
