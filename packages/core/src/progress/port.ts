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
  LessonProgress,
  Persistence,
  ProgressPort,
  ProgressRemoteStore,
  ProgressSyncState,
  WordProgress,
} from "../ports/progress.js";
import { cloneProgress, emptyProgress, parseProgress } from "./document.js";
import { mergeProgress } from "./merge.js";

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
      progress: next,
      completedAt: next >= 1 ? (current.completedAt ?? Date.now()) : current.completedAt,
      attempts: current.attempts + 1,
    };
    if (next >= 1) touchStreak();
    commit();
  }

  function touchStreak() {
    const now = Date.now();
    const today = calendarDay(now);
    const { lastDay, days } = state.streak;
    if (lastDay === today) return;
    const yesterday = calendarDay(now - DAY);
    state.streak = { days: lastDay === yesterday ? days + 1 : 1, lastDay: today };
  }

  /** New cards enter the queue due tomorrow — that is the reason to come back. */
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
        dueAt: fresh.due.getTime(),
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
    const next = review(loadCard(card.fsrs), RATING[rating]);
    state.cards[cardKey] = { ...card, dueAt: next.due.getTime(), fsrs: storeCard(next) };
    touchStreak();
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
    dropCards,
    dueCards,
    dueTomorrow,
    gradeCard,
    stageWord,
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
function calendarDay(at: number): string {
  const date = new Date(at);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
