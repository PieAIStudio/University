import { describe, expect, it } from "vitest";

import { State, type StoredCard } from "../scheduling/fsrs.js";
import type {
  CardProgress,
  LessonProgress,
  ProgressDocument,
  WordProgress,
} from "../ports/progress.js";
import { DEFAULT_ACCOUNT_PREFERENCES, emptyAccountData } from "../ports/account-data.js";
import { emptyProgress } from "./document.js";
import { mergeProgress } from "./merge.js";
import { XP_EXERCISE_FIRST_TRY, XP_READ_LESSON } from "./xp.js";

const AT = Date.parse("2026-08-22T12:00:00.000Z");

function card(partial: Partial<CardProgress> & Pick<CardProgress, "cardKey">): CardProgress {
  return {
    studyId: "turing-pact",
    courseId: "foundations-before-zero",
    lessonId: "you-already-know-apps",
    dueAt: AT,
    fsrs: stored({ reps: 0 }),
    ...partial,
  };
}

function stored(partial: Partial<StoredCard>): StoredCard {
  return {
    due: new Date(AT).toISOString(),
    stability: 1,
    difficulty: 5,
    elapsed_days: 0,
    scheduled_days: 1,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    state: State.New,
    ...partial,
  };
}

function lesson(partial: Partial<LessonProgress>): LessonProgress {
  return { progress: 0, completedAt: null, attempts: 0, ...partial };
}

function word(partial: Partial<WordProgress> & Pick<WordProgress, "senseId">): WordProgress {
  return { stage: "paused", dueAt: null, lapses: 0, fsrs: null, ...partial };
}

function doc(partial: Partial<ProgressDocument>): ProgressDocument {
  return { ...emptyProgress(), ...partial };
}

describe("mergeProgress", () => {
  it("is a no-op on two empty documents", () => {
    expect(mergeProgress(emptyProgress(), emptyProgress())).toEqual(emptyProgress());
    expect(mergeProgress(null, null)).toEqual(emptyProgress());
  });

  it("returns the other side when one is missing, so a first login uploads local work", () => {
    const local = doc({
      lessons: { "s/c/l": lesson({ progress: 1, completedAt: AT, attempts: 1 }) },
    });
    expect(mergeProgress(local, null).lessons["s/c/l"]?.progress).toBe(1);
    expect(mergeProgress(null, local).lessons["s/c/l"]?.progress).toBe(1);
  });

  it("never lets a lesson move backwards", () => {
    const left = doc({ lessons: { a: lesson({ progress: 1, completedAt: AT, attempts: 2 }) } });
    const right = doc({
      lessons: { a: lesson({ progress: 0.4, completedAt: null, attempts: 1 }) },
    });
    const merged = mergeProgress(left, right);
    expect(merged.lessons.a).toEqual({ progress: 1, completedAt: AT, attempts: 2 });
    expect(mergeProgress(right, left).lessons.a).toEqual(merged.lessons.a);
  });

  it("keeps the first completion time, not the later machine's repeat", () => {
    const first = doc({ lessons: { a: lesson({ progress: 1, completedAt: AT, attempts: 1 }) } });
    const later = doc({
      lessons: { a: lesson({ progress: 1, completedAt: AT + 86_400_000, attempts: 4 }) },
    });
    expect(mergeProgress(first, later).lessons.a).toEqual({
      progress: 1,
      completedAt: AT,
      attempts: 4,
    });
  });

  it("unions cards so a card that only exists on one machine is not dropped", () => {
    const left = doc({ cards: { a: card({ cardKey: "a", dueAt: AT }) } });
    const right = doc({ cards: { b: card({ cardKey: "b", dueAt: AT + 1 }) } });
    const merged = mergeProgress(left, right);
    expect(Object.keys(merged.cards).sort()).toEqual(["a", "b"]);
  });

  it("keeps the more-reviewed card when the same card forked", () => {
    const shallow = doc({
      cards: { a: card({ cardKey: "a", dueAt: AT, fsrs: stored({ reps: 1 }) }) },
    });
    const deeper = doc({
      cards: {
        a: card({
          cardKey: "a",
          dueAt: AT + 7 * 86_400_000,
          fsrs: stored({ reps: 6, last_review: new Date(AT + 1).toISOString() }),
        }),
      },
    });
    expect(mergeProgress(shallow, deeper).cards.a?.fsrs.reps).toBe(6);
    expect(mergeProgress(deeper, shallow).cards.a?.dueAt).toBe(AT + 7 * 86_400_000);
  });

  it("breaks a reps tie with the later due date", () => {
    const sooner = doc({
      cards: { a: card({ cardKey: "a", dueAt: AT, fsrs: stored({ reps: 3 }) }) },
    });
    const later = doc({
      cards: { a: card({ cardKey: "a", dueAt: AT + 10, fsrs: stored({ reps: 3 }) }) },
    });
    expect(mergeProgress(sooner, later).cards.a?.dueAt).toBe(AT + 10);
  });

  it("prefers a word still being learned over one a fork retired", () => {
    const learning = doc({
      words: {
        w: word({
          senseId: "w",
          stage: "learning",
          dueAt: AT,
          fsrs: stored({ reps: 1 }),
        }),
      },
    });
    const paused = doc({
      words: { w: word({ senseId: "w", stage: "paused" }) },
    });
    expect(mergeProgress(learning, paused).words.w?.stage).toBe("learning");
    expect(mergeProgress(paused, learning).words.w?.stage).toBe("learning");
  });

  it("takes the later streak day rather than averaging two calendars", () => {
    const older = doc({ streak: { days: 12, lastDay: "2026-08-20" } });
    const newer = doc({ streak: { days: 2, lastDay: "2026-08-22" } });
    expect(mergeProgress(older, newer).streak).toEqual({ days: 2, lastDay: "2026-08-22" });
  });

  it("on the same calendar day keeps the higher streak count", () => {
    const low = doc({ streak: { days: 3, lastDay: "2026-08-22" } });
    const high = doc({ streak: { days: 9, lastDay: "2026-08-22" } });
    expect(mergeProgress(low, high).streak.days).toBe(9);
  });

  it("sums independent XP events without double-counting a retried merge", () => {
    const phoneXp = XP_READ_LESSON;
    const laptopXp = XP_EXERCISE_FIRST_TRY;
    const phone = doc({
      totalXp: phoneXp,
      xpEvents: { "phone/read": phoneXp },
    });
    const laptop = doc({
      totalXp: laptopXp,
      xpEvents: { "laptop/exercise": laptopXp },
    });

    const merged = mergeProgress(phone, laptop);
    expect(merged.totalXp).toBe(phoneXp + laptopXp);
    expect(merged.xpEvents).toEqual({
      "laptop/exercise": laptopXp,
      "phone/read": phoneXp,
    });
    expect(mergeProgress(laptop, phone)).toEqual(merged);
    expect(mergeProgress(merged, phone)).toEqual(merged);
  });

  it("merges account library, practice history, and settings across devices", () => {
    const phoneFavourite = {
      senseId: "phone-sense",
      createdAt: "2026-08-24T08:00:00.000Z",
      updatedAt: "2026-08-24T08:00:00.000Z",
    };
    const laptopFavourite = {
      senseId: "laptop-sense",
      createdAt: "2026-08-24T09:00:00.000Z",
      updatedAt: "2026-08-24T09:00:00.000Z",
    };
    const phone = doc({
      account: {
        ...emptyAccountData(),
        favourites: { version: 1, items: [phoneFavourite] },
        favouriteChanges: {
          [phoneFavourite.senseId]: {
            senseId: phoneFavourite.senseId,
            favourite: phoneFavourite,
            changedAt: phoneFavourite.updatedAt,
          },
        },
        practiceRecent: { version: 1, ids: ["phone-question"] },
        preferences: {
          ...DEFAULT_ACCOUNT_PREFERENCES,
          foreignLanguageMode: true,
          updatedAt: { foreignLanguageMode: "2026-08-24T08:00:00.000Z" },
        },
      },
    });
    const laptop = doc({
      account: {
        ...emptyAccountData(),
        favourites: { version: 1, items: [laptopFavourite] },
        favouriteChanges: {
          [laptopFavourite.senseId]: {
            senseId: laptopFavourite.senseId,
            favourite: laptopFavourite,
            changedAt: laptopFavourite.updatedAt,
          },
        },
        practiceRecent: { version: 1, ids: ["laptop-question"] },
        preferences: {
          ...DEFAULT_ACCOUNT_PREFERENCES,
          detailMode: "all",
          updatedAt: { detailMode: "2026-08-24T09:00:00.000Z" },
        },
      },
    });

    const merged = mergeProgress(phone, laptop);
    expect(merged.account.favourites.items.map((item) => item.senseId).sort()).toEqual([
      "laptop-sense",
      "phone-sense",
    ]);
    expect(merged.account.practiceRecent.ids).toEqual(["laptop-question", "phone-question"]);
    expect(merged.account.preferences.foreignLanguageMode).toBe(true);
    expect(merged.account.preferences.detailMode).toBe("all");
  });

  it("merges the requested speech quality as one timestamped account preference", () => {
    const phone = doc({
      account: {
        ...emptyAccountData(),
        preferences: {
          ...DEFAULT_ACCOUNT_PREFERENCES,
          speechQuality: "online",
          updatedAt: { speechQuality: "2026-08-24T08:00:00.000Z" },
        },
      },
    });
    const laptop = doc({
      account: {
        ...emptyAccountData(),
        preferences: {
          ...DEFAULT_ACCOUNT_PREFERENCES,
          speechQuality: "local",
          updatedAt: { speechQuality: "2026-08-24T09:00:00.000Z" },
        },
      },
    });

    expect(mergeProgress(phone, laptop).account.preferences.speechQuality).toBe("local");
    expect(mergeProgress(laptop, phone).account.preferences.speechQuality).toBe("local");
  });

  it("keeps a newer favourite deletion tombstone over an older device copy", () => {
    const favourite = {
      senseId: "shared-sense",
      createdAt: "2026-08-24T08:00:00.000Z",
      updatedAt: "2026-08-24T08:00:00.000Z",
    };
    const older = doc({
      account: {
        ...emptyAccountData(),
        favourites: { version: 1, items: [favourite] },
        favouriteChanges: {
          [favourite.senseId]: {
            senseId: favourite.senseId,
            favourite,
            changedAt: favourite.updatedAt,
          },
        },
      },
    });
    const deletionAt = "2026-08-24T10:00:00.000Z";
    const newerDeletion = doc({
      account: {
        ...emptyAccountData(),
        favouriteChanges: {
          [favourite.senseId]: {
            senseId: favourite.senseId,
            favourite: null,
            changedAt: deletionAt,
          },
        },
      },
    });

    const merged = mergeProgress(older, newerDeletion);
    expect(merged.account.favourites.items).toEqual([]);
    expect(merged.account.favouriteChanges[favourite.senseId]?.favourite).toBeNull();
  });

  it("is commutative and idempotent so a retried save does not thrash", () => {
    const left = doc({
      lessons: { a: lesson({ progress: 1, completedAt: AT, attempts: 1 }) },
      cards: { a: card({ cardKey: "a", dueAt: AT + 5, fsrs: stored({ reps: 4 }) }) },
    });
    const right = doc({
      lessons: {
        a: lesson({ progress: 0.5, attempts: 3 }),
        b: lesson({ progress: 1, completedAt: AT }),
      },
      cards: {
        a: card({ cardKey: "a", dueAt: AT, fsrs: stored({ reps: 1 }) }),
        c: card({ cardKey: "c" }),
      },
    });
    const ab = mergeProgress(left, right);
    const ba = mergeProgress(right, left);
    expect(ab).toEqual(ba);
    expect(mergeProgress(ab, left)).toEqual(ab);
    expect(mergeProgress(ab, right)).toEqual(ab);
    expect(mergeProgress(ab, ab)).toEqual(ab);
  });
});
