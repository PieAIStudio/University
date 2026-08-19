/**
 * What the learner has done, kept on this machine.
 *
 * Deliberately local for now. Accounts, wallet and entitlement belong to
 * SwimmerBackend and arrive with the paywall; a first slice that stops to build
 * sign-in proves nothing about whether the loop is worth signing in for. So the
 * first lesson costs no account, exactly as the journey's second act requires,
 * and the settlement screen's "save what you just earned" has something real to
 * offer when it lands.
 *
 * The card schedule here is a placeholder for FSRS, and is marked as one. The
 * real scheduler is the authoring side's `ts-fsrs` and belongs in the shared
 * package both halves import — reimplementing it here would be the drift the
 * parity contract exists to prevent. What this does is keep the shape of the
 * state FSRS needs, so swapping the algorithm in does not migrate storage.
 */
const KEY = "university.progress.v1";
const DAY = 86_400_000;

export interface CardState {
  readonly cardKey: string;
  readonly studyId: string;
  readonly courseId: string;
  readonly lessonId: string;
  /** Milliseconds since epoch. The due queue is `dueAt <= now`, nothing more. */
  dueAt: number;
  /** Days. FSRS calls this stability; the placeholder only ever doubles it. */
  interval: number;
  reps: number;
  lapses: number;
}

export interface LessonState {
  /** 0 to 1. Never moves backwards — a failed attempt cannot undo progress. */
  progress: number;
  completedAt: number | null;
  attempts: number;
}

interface Progress {
  lessons: Record<string, LessonState>;
  cards: Record<string, CardState>;
  streak: { days: number; lastDay: string | null };
}

const empty: Progress = { lessons: {}, cards: {}, streak: { days: 0, lastDay: null } };

function read(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(empty);
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return {
      lessons: parsed.lessons ?? {},
      cards: parsed.cards ?? {},
      streak: parsed.streak ?? { days: 0, lastDay: null },
    };
  } catch {
    // A corrupt local store must not lock a learner out of their own campus.
    return structuredClone(empty);
  }
}

let state = read();
const listeners = new Set<() => void>();

function commit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private browsing, or a full quota. Losing the write is survivable;
    // throwing in the middle of a lesson is not.
  }
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function snapshot(): Progress {
  return state;
}

export const lessonKey = (studyId: string, courseId: string, lessonId: string) =>
  `${studyId}/${courseId}/${lessonId}`;

export function lessonState(key: string): LessonState {
  return state.lessons[key] ?? { progress: 0, completedAt: null, attempts: 0 };
}

/**
 * Progress only ever rises.
 *
 * The authoring side learned this the hard way: submitting wrote a higher
 * number, a later failing grade tried to write a lower one, the store refused
 * to move backwards and every failing grade came back as a conflict with no
 * feedback. One advancing function is the fix.
 */
export function advanceLesson(key: string, progress: number) {
  const current = lessonState(key);
  const next = Math.max(current.progress, Math.min(1, progress));
  state.lessons[key] = {
    progress: next,
    completedAt: next >= 1 ? (current.completedAt ?? Date.now()) : current.completedAt,
    attempts: current.attempts + 1,
  };
  if (next >= 1) touchStreak();
  commit();
}

function touchStreak() {
  const today = new Date().toISOString().slice(0, 10);
  const { lastDay, days } = state.streak;
  if (lastDay === today) return;
  const yesterday = new Date(Date.now() - DAY).toISOString().slice(0, 10);
  state.streak = { days: lastDay === yesterday ? days + 1 : 1, lastDay: today };
}

/** New cards enter the queue due tomorrow — that is the reason to come back. */
export function dropCards(
  studyId: string,
  courseId: string,
  lessonId: string,
  cardIds: readonly string[],
) {
  for (const id of cardIds) {
    const cardKey = `${studyId}/${courseId}/${lessonId}/${id}`;
    if (state.cards[cardKey]) continue;
    state.cards[cardKey] = {
      cardKey,
      studyId,
      courseId,
      lessonId,
      dueAt: Date.now() + DAY,
      interval: 1,
      reps: 0,
      lapses: 0,
    };
  }
  commit();
}

export function dueCards(asOf = Date.now()): readonly CardState[] {
  return Object.values(state.cards)
    .filter((card) => card.dueAt <= asOf)
    .sort((a, b) => a.dueAt - b.dueAt);
}

export function dueTomorrow(): number {
  const end = Date.now() + DAY;
  return Object.values(state.cards).filter((card) => card.dueAt <= end).length;
}

/**
 * Grade a card. 1 forgot, 2 hard, 3 good, 4 easy.
 *
 * Placeholder intervals, and named as such: FSRS derives these from a state
 * vector this store keeps room for but does not yet use. The one property worth
 * preserving even in a placeholder is that forgetting is not free — it resets
 * the interval and counts a lapse, because a scheduler that lets you keep a
 * long interval after failing is lying to you about what you know.
 */
export function gradeCard(cardKey: string, grade: 1 | 2 | 3 | 4) {
  const card = state.cards[cardKey];
  if (!card) return;
  const interval =
    grade === 1
      ? 0.007
      : grade === 2
        ? Math.max(1, card.interval)
        : grade === 3
          ? card.interval * 2
          : card.interval * 3;
  state.cards[cardKey] = {
    ...card,
    interval,
    dueAt: Date.now() + interval * DAY,
    reps: card.reps + 1,
    lapses: grade === 1 ? card.lapses + 1 : card.lapses,
  };
  touchStreak();
  commit();
}

export function resetAll() {
  state = structuredClone(empty);
  commit();
}
