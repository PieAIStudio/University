import { describe, expect, it } from "vitest";
import {
  emptyAccountData,
  mergeAccountPreferences,
  parseAccountData,
} from "../ports/account-data.js";
import { createProgressPort } from "./port.js";
import {
  mergeJourneyHistory,
  parseJourneyHistory,
  parseReviewEmailIntent,
  recordJourneyShown,
  shouldOfferEmailSave,
  shouldOfferMemberLine,
} from "./journey.js";

const at = (day: string) => new Date(`${day}T12:00:00`).getTime();

describe("V7 considerate return prompts and explicit email intent", () => {
  it("never asks before learning; asks on day one then once from day three", () => {
    expect(shouldOfferEmailSave(undefined, at("2026-09-28"), 0)).toBe(false);
    expect(shouldOfferEmailSave(undefined, at("2026-09-28"), 1)).toBe(true);
    const first = recordJourneyShown(undefined, "save", at("2026-09-28"));
    expect(shouldOfferEmailSave(first, at("2026-09-28"), 2)).toBe(false);
    expect(shouldOfferEmailSave(first, at("2026-09-29"), 2)).toBe(false);
    expect(shouldOfferEmailSave(first, at("2026-09-30"), 2)).toBe(true);
    const second = recordJourneyShown(first, "save", at("2026-10-02"));
    expect(shouldOfferEmailSave(second, at("2026-10-20"), 9)).toBe(false);
  });
  it("compares calendar days through a DST weekend and month boundary", () => {
    const history = { saveDays: ["2026-10-31"] };
    expect(shouldOfferEmailSave(history, at("2026-11-01"), 1)).toBe(false);
    expect(shouldOfferEmailSave(history, at("2026-11-02"), 1)).toBe(true);
    expect(shouldOfferEmailSave(history, Number.NaN, 1)).toBe(false);
  });
  it("merges presentation facts idempotently without growing a daily diary", () => {
    const a = { saveDays: ["2026-09-28"], memberWeek: "2026-09-28" };
    const b = { saveDays: ["2026-10-01"], memberWeek: "2026-10-05" };
    expect(mergeJourneyHistory(a, b)).toEqual(mergeJourneyHistory(b, a));
    expect(mergeJourneyHistory(a, a)).toEqual(a);
    expect(
      mergeJourneyHistory(mergeJourneyHistory(a, b), { saveDays: ["2026-11-01"] })?.saveDays,
    ).toEqual(["2026-09-28", "2026-10-01"]);
    expect(parseJourneyHistory({ saveDays: ["not-a-date", "2026-02-31"] })?.saveDays).toEqual([]);
  });
  it("allows the membership line at most once each local week", () => {
    const history = recordJourneyShown(undefined, "member", at("2026-09-28"));
    expect(shouldOfferMemberLine(history, at("2026-10-04"))).toBe(false);
    expect(shouldOfferMemberLine(history, at("2026-10-05"))).toBe(true);
  });
  it("does not import consent without an explicit field timestamp", () => {
    const consent = { enabled: true, schedule: "cards-due", timezone: "Asia/Shanghai" };
    expect(
      parseAccountData({ preferences: { reviewEmail: consent } }).preferences.reviewEmail,
    ).toBeUndefined();
    expect(parseReviewEmailIntent({ ...consent, timezone: "not/a-zone" })).toBeUndefined();
    expect(parseReviewEmailIntent({ ...consent, email: "ignored@example.test" })).toEqual(consent);
  });
  it("keeps a concurrent opt-out and does not let new presentation history overwrite it", () => {
    const base = emptyAccountData().preferences;
    const a = {
      ...base,
      reviewEmail: { enabled: true, timezone: "UTC", schedule: "cards-due" as const },
      updatedAt: { reviewEmail: "2026-09-28T12:00:00Z" },
    };
    const b = { ...a, reviewEmail: { ...a.reviewEmail, enabled: false } };
    expect(mergeAccountPreferences(a, b).reviewEmail?.enabled).toBe(false);
    expect(mergeAccountPreferences(b, a).reviewEmail?.enabled).toBe(false);
    const historyOnly = {
      ...a,
      journey: { saveDays: ["2026-10-02"] },
      updatedAt: { ...a.updatedAt, journey: "2026-10-02T12:00:00Z" },
    };
    expect(mergeAccountPreferences(b, historyOnly).reviewEmail?.enabled).toBe(false);
  });
  it("round-trips intent through the real account-scoped progress cache", async () => {
    let raw: string | null = null;
    const accounts = new Map<string, string>();
    const persistence = {
      read: () => raw,
      write: (value: string) => {
        raw = value;
      },
      readAccount: (id: string) => accounts.get(id) ?? null,
      writeAccount: (id: string, value: string) => {
        accounts.set(id, value);
      },
    };
    const port = createProgressPort({ persistence });
    await port.bindAccount("learner-a", null);
    port.setAccountPreferences({
      ...port.accountData().preferences,
      reviewEmail: { enabled: true, timezone: "UTC", schedule: "cards-due" },
      journey: recordJourneyShown(undefined, "save", at("2026-09-28")),
    });
    expect(port.accountData().preferences.updatedAt.reviewEmail).toBeTruthy();
    await port.bindAccount("learner-b", null);
    expect(port.accountData().preferences.reviewEmail).toBeUndefined();
    await port.bindAccount("learner-a", null);
    expect(port.accountData().preferences.reviewEmail?.enabled).toBe(true);
    expect(port.accountData().preferences.journey?.saveDays).toEqual(["2026-09-28"]);
    expect(port.snapshot().totalXp).toBe(0);
    expect(Object.keys(port.snapshot().lessons)).toEqual([]);
  });
});
