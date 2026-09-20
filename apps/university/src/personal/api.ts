import { readJson } from "@pieai/university-ui/api/client.js";
import { translate } from "@pieai/university-ui/i18n.js";
import type { LessonRef } from "@pieai/university-core";
export {
  PERSONAL_STUDY_ID,
  PERSONAL_UNIT_ID,
  PERSONAL_LESSON_ID,
  personalContentId,
} from "@pieai/university-core";
import { identityPort } from "../account/identity.js";

const GUEST_KEY = "university.personal-lesson.guest-scope";
let ephemeralGuest: string | undefined;

export interface PersonalRecord {
  readonly contentId: string;
  readonly locator: LessonRef;
  readonly title: string;
  readonly goal: string;
  readonly createdAt: string;
  readonly unitObjective: string;
  readonly cardIds: readonly string[];
  readonly scope: {
    studyId: string;
    courseId: string;
    unitId: string;
    lessonIds: readonly string[];
  };
}
export interface PersonalJob {
  readonly commandId: string;
  /** Echo only the owning learner's task so a reopened job is understandable. */
  readonly goal?: string;
  readonly status: "working" | "ready" | "failed" | "cancelled";
  readonly stage: "writing" | "reviewing" | "revising" | "polishing" | "saving";
  readonly record?: PersonalRecord;
  readonly error?: string;
}

export class PersonalHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "PersonalHttpError";
  }
}

/** Browser identity is only a namespace in this explicitly loopback owner pilot,
 * not a substitute for authenticated production authorization. */
export function personalAccountScope(): string {
  const identity = identityPort.status();
  if (identity.kind === "anonymous" || identity.kind === "signed_in")
    return `account:${identity.user.id}`;
  try {
    const prior = localStorage.getItem(GUEST_KEY);
    if (prior && /^guest-[a-f0-9-]{36}$/.test(prior)) return prior;
    const created = `guest-${crypto.randomUUID()}`;
    localStorage.setItem(GUEST_KEY, created);
    return created;
  } catch {
    return (ephemeralGuest ??= `guest-${crypto.randomUUID()}`);
  }
}

export function personalPreviewUrl(): string {
  const value = import.meta.env.DEV && import.meta.env.VITE_MAP_NODES_PERSONAL_URL;
  if (!value) throw new Error(translate("mapNodes.personal.unavailable"));
  const url = new URL(value);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port)
    throw new Error(translate("mapNodes.personal.unavailable"));
  return url.toString().replace(/\/$/, "");
}

export async function readPersonalJson<T>(
  path: string,
  accountScope: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${personalPreviewUrl()}${path}`, {
    ...init,
    signal: init?.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(120_000)])
      : AbortSignal.timeout(120_000),
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      "X-Map-Nodes-Owner": "owner-preview-v1",
      "X-Map-Nodes-Account": accountScope,
      ...init?.headers,
    },
  });
  try {
    return await readJson<T>(response);
  } catch (error) {
    throw new PersonalHttpError(
      response.status,
      error instanceof Error ? error.message : translate("mapNodes.personal.failed"),
    );
  }
}

type Cancellation = {
  readonly aborted: boolean;
  addEventListener(type: "abort", listener: () => void, options?: { once?: boolean }): void;
  removeEventListener(type: "abort", listener: () => void): void;
};
export async function withPersonalSignal<T>(
  signal: Cancellation | undefined,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    return await run(controller.signal);
  } finally {
    signal?.removeEventListener("abort", abort);
  }
}
