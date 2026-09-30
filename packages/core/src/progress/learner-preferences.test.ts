import { describe, expect, it } from "vitest";
import {
  DAILY_LESSON_GOALS,
  dailyLessonGoal,
  domainInterestEmail,
  parseDomainInterests,
  setDomainInterest,
  mergeDomainInterests,
} from "./learner-preferences.js";
import { createProgressPort } from "./port.js";
import { createMemoryPersistence } from "./memory.js";
import { mergeAccountPreferences } from "../ports/account-data.js";
import { questsForToday } from "./goals.js";

const at = Date.parse("2026-09-30T08:00:00.000Z");
describe("V7 learner preferences", () => {
  it("rejects out-of-range clocks and treats inherited property names as ordinary scoped ids", () => {
    expect(setDomainInterest({}, "ai-media", true, "a@example.test", 1e99)).toBeNull();
    expect(domainInterestEmail("a\u0000b@example.test")).toBeNull();
    const value = setDomainInterest({}, "constructor", true, "a@example.test", at)!;
    expect(value.constructor).toMatchObject({ enabled: true, email: "a@example.test" });
    expect(mergeDomainInterests({}, value)).toEqual(value);
  });
  it("reading and merging an untouched account cannot manufacture stored preferences", () => {
    const persistence = createMemoryPersistence();
    const port = createProgressPort({ persistence });
    const before = JSON.stringify(port.accountData().preferences);
    port.addXp("unrelated", 1);
    const reloaded = createProgressPort({ persistence }).accountData().preferences;
    expect(JSON.stringify(reloaded)).toBe(before);
    expect(JSON.stringify(mergeAccountPreferences(reloaded, reloaded))).toBe(before);
    expect(reloaded.dailyLessonGoal).toBeUndefined();
    expect(reloaded.domainInterests).toBeUndefined();
  });
  it("the daily goal is bounded and old accounts retain one level", () => {
    expect(DAILY_LESSON_GOALS).toEqual([1, 2, 3]);
    for (const value of [undefined, null, -1, 0, 4, 2.5, "3", NaN])
      expect(dailyLessonGoal(value)).toBe(1);
    expect(dailyLessonGoal(2)).toBe(2);
  });
  it("goals use the same account document and do not alter learning data", () => {
    const persistence = createMemoryPersistence();
    const port = createProgressPort({ persistence });
    port.setAccountPreferences({ ...port.accountData().preferences, dailyLessonGoal: 3 });
    expect(questsForToday(port.snapshot(), at)[0]?.goal).toBe(3);
    expect(createProgressPort({ persistence }).accountData().preferences.dailyLessonGoal).toBe(3);
    expect(port.snapshot().lessons).toEqual({});
    expect(port.snapshot().totalXp).toBe(0);
  });
  it("independent devices merge goal and picture preferences without losing either", () => {
    const port = createProgressPort({ persistence: createMemoryPersistence() });
    const base = port.accountData().preferences;
    const left = {
      ...base,
      dailyLessonGoal: 2 as const,
      updatedAt: { dailyLessonGoal: new Date(at).toISOString() },
    };
    const right = {
      ...base,
      theme: "dark" as const,
      updatedAt: { theme: new Date(at + 1).toISOString() },
    };
    expect(mergeAccountPreferences(left, right)).toMatchObject({
      dailyLessonGoal: 2,
      theme: "dark",
    });
  });
  it("rejects malformed contact addresses and records no implied consent", () => {
    for (const value of [
      null,
      "bad",
      "a\nb@example.test",
      "a@b",
      "<a>@b.test",
      "x".repeat(260) + "@a.test",
    ])
      expect(domainInterestEmail(value)).toBeNull();
    expect(
      parseDomainInterests({
        "ai-media": { email: "reader@example.test", changedAt: new Date(at).toISOString() },
      }),
    ).toEqual({});
    expect(setDomainInterest({}, "bad/id", true, "a@example.test", at)).toBeNull();
  });
  it("persists explicit interest and can remove its address with a withdrawal tombstone", () => {
    const persistence = createMemoryPersistence();
    const port = createProgressPort({ persistence });
    const interests = setDomainInterest({}, "ai-media", true, " reader@example.test ", at)!;
    port.setAccountPreferences({ ...port.accountData().preferences, domainInterests: interests });
    const reopened = createProgressPort({ persistence });
    expect(reopened.accountData().preferences.domainInterests?.["ai-media"]?.email).toBe(
      "reader@example.test",
    );
    const withdrawn = setDomainInterest(interests, "ai-media", false, null, at + 1)!;
    expect(withdrawn["ai-media"]).toMatchObject({ enabled: false, email: null });
    expect(mergeDomainInterests(withdrawn, interests)).toEqual(withdrawn);
  });
  it("preserves independent interests and lets simultaneous withdrawal win in both merge directions", () => {
    const first = setDomainInterest({}, "ai-media", true, "a@example.test", at)!;
    const other = setDomainInterest({}, "ai-games", true, "b@example.test", at)!;
    expect(Object.keys(mergeDomainInterests(first, other))).toHaveLength(2);
    const withdrawn = {
      "ai-media": { enabled: false, email: null, changedAt: new Date(at).toISOString() },
    };
    expect(mergeDomainInterests(first, withdrawn)).toEqual(withdrawn);
    expect(mergeDomainInterests(withdrawn, first)).toEqual(withdrawn);
  });
  it("same-clock edits advance their receipt and passive reload does not renew consent", () => {
    const first = setDomainInterest({}, "ai-media", true, "a@example.test", at)!;
    const second = setDomainInterest(first, "ai-media", false, null, at)!;
    expect(Date.parse(second["ai-media"]!.changedAt)).toBe(at + 1);
    expect(parseDomainInterests(first)).toEqual(first);
  });
});
