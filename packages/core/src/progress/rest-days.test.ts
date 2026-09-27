import { afterEach, describe, expect, it } from "vitest";

import { dailyFirstBonus } from "./chest-reward.js";
import { emptyProgress } from "./document.js";
import { calendarDay } from "./goals.js";
import { mergeProgress } from "./merge.js";
import { advanceStreak, restTicketBalance, type Streak } from "./rest-days.js";

/** Local noon on a day of September/October 2026; 2026-09-28 is a Monday. */
const on = (month: number, date: number, hour = 12) =>
  new Date(2026, month - 1, date, hour).getTime();
const fresh = (): Streak => ({ days: 0, lastDay: null });

function walk(start: Streak, ...days: number[]): Streak {
  return days.reduce((streak, at) => advanceStreak(streak, at), start);
}

describe("rest-day tickets", () => {
  it("count consecutive days as before, and a second visit the same day as none", () => {
    const streak = walk(fresh(), on(9, 28), on(9, 29), on(9, 29, 22), on(9, 30));
    expect(streak.days).toBe(3);
    expect(streak.lastDay).toBe("2026-09-30");
  });

  it("cover one missed day with the week's ticket, keeping the streak without adding to it", () => {
    // Monday, Tuesday, (Wednesday missed), Thursday.
    const streak = walk(fresh(), on(9, 28), on(9, 29), on(10, 1));
    expect(streak.days).toBe(3);
    expect(streak.rest?.covered).toEqual(["2026-09-30"]);
    expect(restTicketBalance(streak)).toBe(0);
  });

  it("let a second missed day in the same week break the streak", () => {
    const streak = walk(fresh(), on(9, 28), on(9, 30), on(10, 2));
    expect(streak.days).toBe(1);
  });

  it("cover a gap across the weekend with the new week's ticket", () => {
    // Saturday, (Sunday missed), Monday. Saturday's week ticket is already
    // spent, so only Monday's first visit, granting the new week's, can cover it.
    const saturday = walk(fresh(), on(9, 26));
    const spent: Streak = {
      ...saturday,
      rest: { granted: saturday.rest!.granted, covered: ["2026-09-01"] },
    };
    expect(restTicketBalance(spent)).toBe(0);
    const monday = advanceStreak(spent, on(9, 28));
    expect(monday.days).toBe(2);
    expect(monday.rest?.covered).toContain("2026-09-27");
  });

  it("grant one more ticket at every seven days of streak", () => {
    const week = walk(fresh(), ...Array.from({ length: 7 }, (_, index) => on(9, 28 + index)));
    expect(week.days).toBe(7);
    expect(week.rest?.granted).toContain("streak:2026-10-04");
    // The week's own ticket, next Monday's is not yet, and the seven-day one.
    expect(restTicketBalance(week)).toBe(2);
  });

  it("reset when there are not enough tickets for the gap", () => {
    const streak = walk(fresh(), on(9, 28), on(10, 3));
    expect(streak.days).toBe(1);
    expect(streak.rest?.covered ?? []).toEqual([]);
  });

  it("step calendar days, so a daylight-saving change never skips or doubles one", () => {
    // Europe's clocks go back on 2026-10-25; the day is 25 hours long.
    const previous = process.env.TZ;
    process.env.TZ = "Europe/Berlin";
    try {
      const streak = walk(fresh(), on(10, 24, 23), on(10, 25, 23), on(10, 26, 0));
      expect(streak.days).toBe(3);
      expect(streak.rest?.covered ?? []).toEqual([]);
    } finally {
      process.env.TZ = previous;
    }
  });

  it("merge two devices by union: a ticket spent on either stays spent", () => {
    const phone = emptyProgress();
    phone.streak = walk(fresh(), on(9, 28), on(9, 30));
    const laptop = emptyProgress();
    laptop.streak = walk(fresh(), on(9, 28), on(9, 29));
    const merged = mergeProgress(phone, laptop).streak;
    expect(merged.lastDay).toBe("2026-09-30");
    expect(merged.rest?.covered).toEqual(["2026-09-29"]);
    expect(merged.rest?.granted).toEqual(["week:2026-09-28"]);
  });

  it("read an older document with no tickets as a balance of none", () => {
    expect(restTicketBalance({ days: 12, lastDay: "2026-09-20" })).toBe(0);
  });
});

describe("the day's first chest", () => {
  const previous = process.env.TZ;
  afterEach(() => {
    process.env.TZ = previous;
  });

  it("doubles the first lesson's XP once a day", () => {
    const document = emptyProgress();
    const first = dailyFirstBonus(document, on(9, 28, 9), 40);
    expect(first).toEqual({ eventId: "daily-first:2026-09-28", amount: 40 });
    document.xpEvents[first!.eventId] = first!.amount;
    expect(dailyFirstBonus(document, on(9, 28, 21), 30)).toBeNull();
    expect(dailyFirstBonus(document, on(9, 29, 0), 30)?.eventId).toBe("daily-first:2026-09-29");
  });

  it("gives nothing for a lesson that earned nothing", () => {
    expect(dailyFirstBonus(emptyProgress(), on(9, 28), 0)).toBeNull();
  });

  it("names the learner's own day, not UTC's", () => {
    // 2026-09-28 20:30 UTC is already the 29th in Shanghai and still the 28th in Los Angeles.
    const instant = Date.UTC(2026, 8, 28, 20, 30);
    process.env.TZ = "Asia/Shanghai";
    expect(calendarDay(instant)).toBe("2026-09-29");
    expect(dailyFirstBonus(emptyProgress(), instant, 10)?.eventId).toBe("daily-first:2026-09-29");
    process.env.TZ = "America/Los_Angeles";
    expect(calendarDay(instant)).toBe("2026-09-28");
  });
});
