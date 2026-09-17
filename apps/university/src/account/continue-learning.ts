import { isSafeId, type LessonRef, type View } from "@pieai/university-core";

const STORAGE_KEY = "university.account.continue-learning.v1";

export type LearningReturn =
  | { readonly kind: "course"; readonly studyId: string; readonly courseId: string }
  | {
      readonly kind: "lesson" | "settled";
      readonly studyId: string;
      readonly courseId: string;
      readonly unitId: string;
      readonly lessonId: string;
    };

const memory: { current: LearningReturn | null } = { current: null };

const FORBIDDEN_KEYS = new Set([
  "href",
  "returnTo",
  "token",
  "password",
  "email",
  "code",
  "access_token",
  "refresh_token",
  "answer",
  "answers",
]);

function validIds(...ids: string[]): boolean {
  return ids.every((id) => isSafeId(id));
}

export function learningReturnFromView(view: View): LearningReturn | null {
  if (view.kind === "course" && validIds(view.studyId, view.courseId)) {
    return { kind: "course", studyId: view.studyId, courseId: view.courseId };
  }
  if (
    (view.kind === "lesson" || view.kind === "settled") &&
    validIds(view.studyId, view.courseId, view.unitId, view.lessonId)
  ) {
    return {
      kind: view.kind,
      studyId: view.studyId,
      courseId: view.courseId,
      unitId: view.unitId,
      lessonId: view.lessonId,
    };
  }
  return null;
}

export function parseLearningReturn(value: unknown): LearningReturn | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (FORBIDDEN_KEYS.has(key)) return null;
  }
  const kind = record.kind;
  if (kind === "course") {
    if (typeof record.studyId !== "string" || typeof record.courseId !== "string") return null;
    return learningReturnFromView({
      kind: "course",
      studyId: record.studyId,
      courseId: record.courseId,
    });
  }
  if (kind === "lesson" || kind === "settled") {
    if (
      typeof record.studyId !== "string" ||
      typeof record.courseId !== "string" ||
      typeof record.unitId !== "string" ||
      typeof record.lessonId !== "string"
    ) {
      return null;
    }
    return learningReturnFromView({
      kind,
      studyId: record.studyId,
      courseId: record.courseId,
      unitId: record.unitId,
      lessonId: record.lessonId,
    });
  }
  return null;
}

function writeStored(value: LearningReturn | null): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    if (!value) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Private mode must not break account navigation.
  }
}

function readStored(): LearningReturn | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseLearningReturn(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

/** Remember a current lesson/course only. Arbitrary URLs are ignored. */
export function captureLearningReturn(view: View): void {
  const next = learningReturnFromView(view);
  if (!next) return;
  memory.current = next;
  writeStored(next);
}

export function readLearningReturn(): LearningReturn | null {
  return memory.current ?? readStored();
}

export function clearLearningReturn(): void {
  memory.current = null;
  writeStored(null);
}

export function continueLearningView(
  captured: LearningReturn | null,
  nextLesson: LessonRef | null,
  isAvailable: (target: LearningReturn) => boolean = () => true,
): View {
  if (captured && isAvailable(captured)) {
    // Resume the lesson, not an earlier identity's settlement celebration.
    return captured.kind === "settled" ? { ...captured, kind: "lesson" } : captured;
  }
  if (nextLesson && isAvailable({ kind: "lesson", ...nextLesson })) {
    return {
      kind: "lesson",
      studyId: nextLesson.studyId,
      courseId: nextLesson.courseId,
      unitId: nextLesson.unitId,
      lessonId: nextLesson.lessonId,
    };
  }
  return { kind: "catalog" };
}
