/**
 * One progress store, parameterized by where the bytes go.
 *
 * The mutators are the delivery shell's original store, moved here so both
 * shells call the same FSRS, the same "progress only rises", the same local
 * calendar-day streak. What changed is the walls: local persistence is
 * injected, and a remote is attached only after someone actually signs in.
 *
 * Local writes always succeed first. A remote that is missing, slow, or
 * unreachable must not stall a lesson. The dirty flag is the whole queue —
 * the document is the unit of sync, so there is nothing to replay besides
 * "save this snapshot".
 */

import type { VocabularyState } from "../language/layer.js";
import {
  loadCard,
  newCard,
  RATING,
  review,
  storeCard,
  type RatingName,
} from "../scheduling/fsrs.js";
import type {
  ExerciseAttemptRecord,
  LessonProgress,
  Persistence,
  ProgressPort,
  ProgressRemoteStore,
  ProgressSyncState,
  WordProgress,
  CardProgress,
  RetrievalAttemptRecord,
} from "../ports/progress.js";
import type { ReaderMark } from "../domain/reader-marks.js";
import type { LessonRef } from "./contract.js";
import { cloneProgress, emptyProgress, parseProgress } from "./document.js";
import { mergeProgress } from "./merge.js";
import { xpFor } from "./xp.js";
import {
  cloneAccountData,
  type AccountData,
  type AccountPreferences,
} from "../ports/account-data.js";
import type { FavouritesState } from "../favourites/model.js";
import type { PracticeRecentState } from "../practice/recent.js";

const DAY = 86_400_000;

export function createProgressPort(options: { readonly persistence: Persistence }): ProgressPort {
  const { persistence } = options;
  let state = parseProgress(safeRead(persistence));
  const listeners = new Set<() => void>();
  let userId: string | null = null;
  let remote: ProgressRemoteStore | null = null;
  let dirty = false;
  let syncStatus: ProgressSyncState["status"] = "idle";
  let flushing: Promise<void> | null = null;

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
    state = cloneProgress(state);
    try {
      persistence.write(JSON.stringify(state));
    } catch {
      // Private browsing, or a full quota. Losing the write is survivable;
      // throwing in the middle of a lesson is not.
    }
    for (const listener of listeners) listener();
    if (userId && remote) {
      dirty = true;
      void flush();
    }
  }

  async function flush(): Promise<void> {
    if (flushing) {
      dirty = true;
      await flushing;
      if (dirty && userId && remote) return flush();
      return;
    }
    if (!userId || !remote) {
      dirty = false;
      syncStatus = "idle";
      return;
    }

    const boundUser = userId;
    const boundRemote = remote;
    flushing = (async () => {
      syncStatus = "syncing";
      for (;;) {
        dirty = false;
        let pulled;
        try {
          pulled = await boundRemote.load(boundUser);
        } catch {
          dirty = true;
          syncStatus = "offline";
          return;
        }
        const merged = mergeProgress(state, pulled);
        state = cloneProgress(merged);
        try {
          persistence.write(JSON.stringify(state));
        } catch {
          // Same contract as a local commit: a full quota must not stall.
        }
        for (const listener of listeners) listener();
        try {
          await boundRemote.save(boundUser, state);
        } catch {
          dirty = true;
          syncStatus = "offline";
          return;
        }
        if (!dirty || userId !== boundUser || remote !== boundRemote) {
          syncStatus = "idle";
          return;
        }
      }
    })();

    try {
      await flushing;
    } finally {
      flushing = null;
    }
  }

  function lessonState(key: string): LessonProgress {
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
  function advanceLesson(key: string, progress: number) {
    const current = lessonState(key);
    const next = Math.max(current.progress, Math.min(1, progress));
    state.lessons[key] = {
      ...current,
      progress: next,
      completedAt: next >= 1 ? (current.completedAt ?? Date.now()) : current.completedAt,
      attempts: current.attempts + 1,
    };
    if (next >= 1) touchStreak();
    commit();
  }

  function confirmLessonRead(key: string, contentRevision: number) {
    if (!Number.isInteger(contentRevision) || contentRevision <= 0) return;
    const current = lessonState(key);
    const firstRead = current.readConfirmed !== true;
    state.lessons[key] = {
      ...current,
      readConfirmed: true,
      readConfirmedRevision: contentRevision,
    };
    if (firstRead) {
      awardXp(
        `lesson-read:${key}`,
        xpFor([{ kind: "read-lesson", firstTime: true }], {
          streakDays: state.streak.days,
          now: Date.now(),
        }),
      );
    }
    commit();
  }

  function addXp(eventId: string, amount: number): void {
    if (awardXp(eventId, amount)) commit();
  }

  function awardXp(eventId: string, amount: number): boolean {
    const id = eventId.trim();
    if (id.length === 0 || !Number.isSafeInteger(amount) || amount < 0) return false;
    if (Object.hasOwn(state.xpEvents, id)) return false;
    state.xpEvents[id] = amount;
    state.totalXp += amount;
    return true;
  }

  function touchStreak() {
    const now = Date.now();
    const today = calendarDay(now);
    const { lastDay, days } = state.streak;
    if (lastDay === today) return;
    const yesterday = calendarDay(now - DAY);
    state.streak = { days: lastDay === yesterday ? days + 1 : 1, lastDay: today };
  }

  /**
   * New cards enter the queue due tomorrow — that is the reason to come back.
   *
   * This comment used to describe an intention the code did not carry out.
   * FSRS's `newCard()` is due immediately, because in a flashcard app the new
   * queue *is* the study-it-now queue, so a learner finished a lesson and the
   * settlement offered 「现在就可以复习」 while the review screen's own empty
   * state promised 「学一节新课，它会掉落新的卡片，明天就有事做了」. Two screens,
   * opposite promises, about the same two cards.
   *
   * Tomorrow is the right one, and not only because the copy says so. A card
   * reviewed thirty seconds after reading measures short-term memory and
   * nothing else, and it spends the first interval — the most informative one
   * FSRS ever gets — on an answer the learner could not have forgotten yet.
   * Spaced repetition with no space is a quiz.
   *
   * The next calendar day rather than +24h, because the streak already counts
   * in calendar days and "tomorrow" should mean the same thing on both screens.
   * Someone finishing at 23:50 gets a short first gap; someone finishing at
   * 09:00 and returning at 08:00 the next morning finds their cards waiting,
   * which is the case that actually happens.
   */
  function dropCards(
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
        dueAt: startOfNextDay(Date.now()),
        fsrs: storeCard(fresh),
      };
    }
    commit();
  }

  function dueCards(asOf = Date.now()) {
    return Object.values(state.cards)
      .filter((card) => card.dueAt <= asOf)
      .sort((a, b) => a.dueAt - b.dueAt);
  }

  function dueTomorrow(asOf = Date.now()) {
    const end = asOf + DAY;
    return Object.values(state.cards).filter((card) => card.dueAt <= end).length;
  }

  /**
   * Answer a card. The four ratings are FSRS's own, in its own order.
   *
   * `again` is not "wrong". FSRS reads it as "this did not come back in time",
   * which is both a different claim and a kinder one, and it is the claim the
   * review screen should be making to someone who just missed one.
   */
  function gradeCard(cardKey: string, rating: RatingName) {
    const card = state.cards[cardKey];
    if (!card) return;
    const now = Date.now();
    const lastReviewedAt = card.fsrs.last_review ? Date.parse(card.fsrs.last_review) : null;
    const next = review(loadCard(card.fsrs), RATING[rating], new Date(now));
    state.cards[cardKey] = { ...card, dueAt: next.due.getTime(), fsrs: storeCard(next) };
    touchStreak();
    awardXp(
      xpEventId("review", cardKey),
      xpFor([{ kind: "review", rating, lastReviewedAt }], {
        streakDays: state.streak.days,
        now,
      }),
    );
    commit();
  }

  function gradeWord(senseId: string, rating: RatingName) {
    const word = state.words[senseId];
    if (!word || word.stage !== "learning") return;
    const now = Date.now();
    const lastReviewedAt = word.fsrs?.last_review ? Date.parse(word.fsrs.last_review) : null;
    const next = review(word.fsrs ? loadCard(word.fsrs) : newCard(), RATING[rating], new Date(now));
    state.words[senseId] = {
      ...word,
      dueAt: next.due.getTime(),
      lapses: next.lapses,
      fsrs: storeCard(next),
    };
    touchStreak();
    awardXp(
      xpEventId("word-review", senseId),
      xpFor([{ kind: "review", rating, lastReviewedAt }], {
        streakDays: state.streak.days,
        now,
      }),
    );
    commit();
  }

  function importCard(card: CardProgress): void {
    const current = state.cards[card.cardKey];
    if (current && !isImportedCardNewer(current, card)) return;
    state.cards[card.cardKey] = {
      ...card,
      fsrs: { ...card.fsrs },
    };
    commit();
  }

  function importWord(word: WordProgress): void {
    const current = state.words[word.senseId];
    if (current && !isImportedWordNewer(current, word)) return;
    state.words[word.senseId] = {
      ...word,
      ...(word.fsrs ? { fsrs: { ...word.fsrs } } : { fsrs: null }),
    };
    commit();
  }

  /**
   * Record what the learner just said about a word.
   *
   * `learning` opens a scheduler card so the word has a due date; the other two
   * are judgements that need no review — `familiar` retires it to a dimmed
   * mention, `paused` takes it off the page entirely.
   */
  function stageWord(senseId: string, stage: WordProgress["stage"]) {
    const current = state.words[senseId];
    if (stage === "learning") {
      const card = current?.fsrs ? loadCard(current.fsrs) : newCard();
      state.words[senseId] = {
        senseId,
        stage,
        dueAt: card.due.getTime(),
        lapses: current?.lapses ?? 0,
        fsrs: storeCard(card),
      };
    } else {
      state.words[senseId] = {
        senseId,
        stage,
        dueAt: null,
        lapses: current?.lapses ?? 0,
        fsrs: current?.fsrs ?? null,
      };
    }
    commit();
  }

  function readerMarks(studyId?: string): readonly ReaderMark[] {
    return Object.values(state.readerMarks)
      .filter((mark) => mark.deletedAt === null)
      .filter((mark) => studyId === undefined || mark.lessonKey.startsWith(`${studyId}/`))
      .map(({ deletedAt: _deletedAt, ...mark }) => mark);
  }

  function saveReaderMark(mark: ReaderMark): void {
    const current = state.readerMarks[mark.markId];
    // A late response from an older device must not resurrect a mark that was
    // already resolved or deleted on this device. The cloud merge applies the
    // same timestamp rule across machines.
    if (current && eventAt(current) >= eventAt(mark)) return;
    state.readerMarks[mark.markId] = { ...mark, deletedAt: null };
    commit();
  }

  function resolveReaderMark(studyId: string, markId: string): void {
    const current = state.readerMarks[markId];
    if (!current || !current.lessonKey.startsWith(`${studyId}/`)) return;
    state.readerMarks[markId] = { ...current, resolvedAt: new Date().toISOString() };
    commit();
  }

  function deleteReaderMark(studyId: string, markId: string): void {
    const current = state.readerMarks[markId];
    if (!current || !current.lessonKey.startsWith(`${studyId}/`)) return;
    state.readerMarks[markId] = { ...current, deletedAt: new Date().toISOString() };
    commit();
  }

  function recordExerciseAttempt(record: ExerciseAttemptRecord): void {
    const current = state.exerciseAttempts[record.commandId];
    if (current && Date.parse(current.occurredAt) >= Date.parse(record.occurredAt)) return;
    const firstTry = !Object.values(state.exerciseAttempts).some(
      (attempt) =>
        attempt.commandId !== record.commandId &&
        attempt.exerciseId === record.exerciseId &&
        attempt.contentRevision === record.contentRevision &&
        sameLesson(attempt.locator, record.locator),
    );
    state.exerciseAttempts[record.commandId] = { ...record, locator: { ...record.locator } };
    if (record.maxScore > 0 && record.score >= record.maxScore) {
      const occurredAt = Date.parse(record.occurredAt);
      awardXp(
        `exercise:${record.commandId}`,
        xpFor([{ kind: "exercise", firstTry }], {
          streakDays: state.streak.days,
          now: Number.isFinite(occurredAt) ? occurredAt : Date.now(),
        }),
      );
    }
    commit();
  }

  function exerciseAttempts(
    locator: LessonRef,
    exerciseId: string,
    contentRevision: number,
  ): readonly ExerciseAttemptRecord[] {
    return Object.values(state.exerciseAttempts)
      .filter(
        (attempt) =>
          attempt.exerciseId === exerciseId &&
          attempt.contentRevision === contentRevision &&
          attempt.locator.studyId === locator.studyId &&
          attempt.locator.courseId === locator.courseId &&
          attempt.locator.unitId === locator.unitId &&
          attempt.locator.lessonId === locator.lessonId,
      )
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  }

  function latestExerciseAttempt(
    locator: LessonRef,
    exerciseId: string,
    contentRevision: number,
  ): ExerciseAttemptRecord | null {
    return exerciseAttempts(locator, exerciseId, contentRevision)[0] ?? null;
  }

  function recordRetrievalAttempt(record: RetrievalAttemptRecord): void {
    const current = state.retrievalAttempts[record.commandId];
    if (current && Date.parse(current.revealedAt) >= Date.parse(record.revealedAt)) return;
    state.retrievalAttempts[record.commandId] = { ...record };
    commit();
  }

  function retrievalAttempts(cardKey: string): readonly RetrievalAttemptRecord[] {
    return Object.values(state.retrievalAttempts)
      .filter((attempt) => attempt.cardKey === cardKey)
      .sort((a, b) => Date.parse(b.revealedAt) - Date.parse(a.revealedAt));
  }

  function accountData(): AccountData {
    return cloneAccountData(state.account);
  }

  function setFavourites(next: FavouritesState): void {
    const now = new Date().toISOString();
    const previousById = new Map(
      state.account.favourites.items.map((item) => [item.senseId, item]),
    );
    const nextById = new Map(next.items.map((item) => [item.senseId, item]));
    const changes = { ...state.account.favouriteChanges };
    for (const senseId of new Set([...previousById.keys(), ...nextById.keys()])) {
      const before = previousById.get(senseId);
      const after = nextById.get(senseId) ?? null;
      if (JSON.stringify(before) === JSON.stringify(after)) continue;
      changes[senseId] = { senseId, favourite: after, changedAt: now };
    }
    state.account = { ...state.account, favourites: next, favouriteChanges: changes };
    commit();
  }

  function setPracticeRecent(next: PracticeRecentState): void {
    state.account = { ...state.account, practiceRecent: next };
    commit();
  }

  function setAccountPreferences(next: AccountPreferences): void {
    const now = new Date().toISOString();
    const current = state.account.preferences;
    const updatedAt = { ...current.updatedAt };
    for (const key of [
      "foreignSettings",
      "foreignLanguageMode",
      "detailMode",
      "soundEnabled",
      "sharesPresence",
    ] as const) {
      if (JSON.stringify(current[key]) !== JSON.stringify(next[key])) updatedAt[key] = now;
    }
    state.account = {
      ...state.account,
      preferences: { ...next, version: 1, updatedAt },
    };
    commit();
  }

  return {
    snapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    lessonState,
    advanceLesson,
    confirmLessonRead,
    addXp,
    dropCards,
    dueCards,
    dueTomorrow,
    gradeCard,
    gradeWord,
    importCard,
    importWord,
    stageWord,
    readerMarks,
    saveReaderMark,
    resolveReaderMark,
    deleteReaderMark,
    recordExerciseAttempt,
    exerciseAttempts,
    latestExerciseAttempt,
    recordRetrievalAttempt,
    retrievalAttempts,
    accountData,
    setFavourites,
    setPracticeRecent,
    setAccountPreferences,
    vocabularyStates() {
      return Object.values(state.words).map(
        (word): VocabularyState => ({
          senseId: word.senseId,
          stage: word.stage,
          dueAt: word.dueAt === null ? null : new Date(word.dueAt).toISOString(),
          lapses: word.lapses,
        }),
      );
    },
    wordStages() {
      return new Map(Object.values(state.words).map((word) => [word.senseId, word.stage]));
    },
    resetAll() {
      state = emptyProgress();
      commit();
    },
    async bindAccount(nextUserId, nextRemote) {
      userId = nextUserId;
      remote = nextUserId ? nextRemote : null;
      if (!userId || !remote) {
        // Sign-out keeps local data. Wiping would throw away a lesson they
        // just finished; the shared-computer hazard is real, but this product
        // is a personal tutor, not a kiosk, and "forget this device" is a
        // future action rather than the default of signing out. Progress
        // stays on the machine. Sync stops.
        dirty = false;
        syncStatus = "idle";
        return;
      }
      dirty = true;
      await flush();
    },
    flush,
    syncState: () => ({ dirty, status: syncStatus, userId }),
  };
}

function eventAt(mark: {
  readonly createdAt: string;
  readonly resolvedAt: string | null;
  readonly deletedAt?: string | null;
}): number {
  return [mark.createdAt, mark.resolvedAt, mark.deletedAt]
    .filter((value): value is string => typeof value === "string")
    .reduce((latest, value) => {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? latest : Math.max(latest, parsed);
    }, 0);
}

function sameLesson(a: LessonRef, b: LessonRef): boolean {
  return (
    a.studyId === b.studyId &&
    a.courseId === b.courseId &&
    a.unitId === b.unitId &&
    a.lessonId === b.lessonId
  );
}

function xpEventId(kind: string, key: string): string {
  const random = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${kind}:${key}:${random}`;
}

function isImportedCardNewer(current: CardProgress, incoming: CardProgress): boolean {
  if (incoming.fsrs.reps !== current.fsrs.reps) return incoming.fsrs.reps > current.fsrs.reps;
  const currentReview = current.fsrs.last_review ? Date.parse(current.fsrs.last_review) : 0;
  const incomingReview = incoming.fsrs.last_review ? Date.parse(incoming.fsrs.last_review) : 0;
  if (incomingReview !== currentReview) return incomingReview > currentReview;
  return incoming.dueAt >= current.dueAt;
}

function isImportedWordNewer(current: WordProgress, incoming: WordProgress): boolean {
  const rank: Record<WordProgress["stage"], number> = {
    paused: 0,
    familiar: 1,
    learning: 2,
  };
  if (rank[incoming.stage] !== rank[current.stage])
    return rank[incoming.stage] > rank[current.stage];
  const incomingReps = incoming.fsrs?.reps ?? 0;
  const currentReps = current.fsrs?.reps ?? 0;
  if (incomingReps !== currentReps) return incomingReps > currentReps;
  return (incoming.dueAt ?? 0) >= (current.dueAt ?? 0);
}

function safeRead(persistence: Persistence): string | null {
  try {
    return persistence.read();
  } catch {
    return null;
  }
}

/**
 * The learner's own calendar day, not UTC's.
 *
 * `toISOString()` names a UTC day, and a streak is a promise about *your*
 * days. Eight hours east of UTC that boundary falls at eight in the morning:
 * a session before breakfast and one after it were two days and inflated the
 * count, while a session either side of local midnight was one day and broke
 * it. Both directions were wrong, and neither looked wrong from the outside.
 */
/** Midnight at the start of the day after `at`, in the learner's own timezone. */
function startOfNextDay(at: number): number {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime() + DAY;
}

function calendarDay(at: number): string {
  const date = new Date(at);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
