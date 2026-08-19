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
 * Card scheduling is not decided here. It comes from
 * `@pieai/university-core`, which is real FSRS with recorded parameters, and
 * is the same function the authoring shell calls. Until it did, this store ran
 * a placeholder that doubled an interval — so the same learner, the same card
 * and the same answer produced two different review dates depending on which
 * shell they happened to be in, and neither looked wrong from the outside.
 *
 * What stays local is where the state is kept, not how it is computed.
 */
import {
  loadCard,
  newCard,
  RATING,
  review,
  storeCard,
  type RatingName,
  type StoredCard,
} from "@pieai/university-core";

// v2: cards hold the scheduler's own state instead of a bare interval. A v1
// card cannot be migrated into one — its interval says nothing about stability
// or difficulty — so the key changes and old progress is left where it is
// rather than guessed at.
const KEY = "university.progress.v2";
const DAY = 86_400_000;

export interface CardState {
  readonly cardKey: string;
  readonly studyId: string;
  readonly courseId: string;
  readonly lessonId: string;
  /** Milliseconds since epoch. The due queue is `dueAt <= now`, nothing more. */
  dueAt: number;
  /** The scheduler's own state, stored verbatim so nothing here interprets it. */
  fsrs: StoredCard;
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
  // A new identity on every write, at every level React might compare.
  //
  // `useSyncExternalStore` decides whether to re-render by comparing the
  // snapshot it holds with the one it just read — by reference. The mutators
  // here assign into `state.cards` and `state.lessons` in place, so without
  // this line the top-level object never changes and React concludes nothing
  // happened. The symptom was quiet and specific: finishing a lesson dropped
  // its cards and wrote them to storage, but the header went on saying
  // "复习 · 明天 0 张" until the page was reloaded, at which point two cards
  // were suddenly due. Nothing threw. The data was always right.
  state = { ...state, lessons: { ...state.lessons }, cards: { ...state.cards } };
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
    const fresh = newCard();
    state.cards[cardKey] = {
      cardKey,
      studyId,
      courseId,
      lessonId,
      dueAt: fresh.due.getTime(),
      fsrs: storeCard(fresh),
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
 * Answer a card. The four ratings are FSRS's own, in its own order.
 *
 * `again` is not "wrong". FSRS reads it as "this did not come back in time",
 * which is both a different claim and a kinder one, and it is the claim the
 * review screen should be making to someone who just missed one.
 */
export function gradeCard(cardKey: string, rating: RatingName) {
  const card = state.cards[cardKey];
  if (!card) return;
  const next = review(loadCard(card.fsrs), RATING[rating]);
  state.cards[cardKey] = { ...card, dueAt: next.due.getTime(), fsrs: storeCard(next) };
  touchStreak();
  commit();
}

export function resetAll() {
  state = structuredClone(empty);
  commit();
}
