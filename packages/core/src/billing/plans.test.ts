import { describe, expect, it } from "vitest";

import {
  groupPerSeatMonthly,
  planById,
  PLANS,
  worstCaseYearlyCost,
  yearlySaving,
} from "./plans.js";

/*
  Duolingo, August 2026: Super $12.99/mo, Max $29.99/mo. These are the numbers
  a buyer will have in their head, and matching them exactly is the point — a
  price a few dollars off invites the question "why", and there is no good
  answer to it on a pricing page.
*/
describe("pricing benchmarks Duolingo", () => {
  it("matches Super and Max on the monthly price", () => {
    expect(planById("apprentice")!.monthly).toBe(12.99);
    expect(planById("craftsman")!.monthly).toBe(29.99);
  });

  it("makes a year cheaper than twelve months, on every paid plan", () => {
    for (const plan of PLANS.filter((entry) => entry.monthly !== null)) {
      expect(yearlySaving(plan)!).toBeGreaterThan(0.2);
    }
  });
});

/*
  Three seats, not six. Six is a household; people learning to code together
  are colleagues or classmates. This is the one place the plan deliberately
  stops copying Duolingo, and the constraint lives in the backend schema too
  (university.study_groups.seat_limit).
*/
describe("the study-group plan", () => {
  it("holds three seats", () => {
    expect(planById("study-group")!.seats).toBe(3);
  });

  it("beats three separate subscriptions but not by Duolingo's margin", () => {
    const apprentice = planById("apprentice")!;
    const group = planById("study-group")!;
    const separately = apprentice.yearly! * group.seats;
    expect(group.yearly!).toBeLessThan(separately);
    /*
      Duolingo's family plan lands near 84% off six individual subscriptions,
      because their marginal cost per seat is close to zero. Ours is a real AI
      bill per seat, so a discount that deep would be sold at a loss by exactly
      the customers who use it most. Anything past half off is that mistake.
    */
    expect(1 - group.yearly! / separately).toBeLessThan(0.5);
  });

  it("costs less per seat per month than a single apprentice", () => {
    expect(groupPerSeatMonthly()).toBeLessThan(planById("apprentice")!.monthly!);
  });
});

/*
  The assertion that makes a losing plan impossible to ship.

  Every AI turn costs real money, so a daily cap is the only thing bounding
  what one subscriber can cost us. The first draft of these plans — 60 turns a
  day on apprentice, 300 on craftsman — would have cost $120 and $1,204 a year
  at the cap against $95.99 and $239.99 of revenue, and nothing in the code
  said so. Now the arithmetic runs on every commit.

  These are worst cases, not forecasts: real use is nearer a tenth of the cap.
  But a worst case that loses money is a plan whose most engaged customers are
  the ones who hurt, and those are the customers the product is for.
*/
describe("no plan loses money at its own cap", () => {
  for (const plan of PLANS.filter((entry) => entry.yearly !== null)) {
    it(`${plan.id} covers a full year of capped use`, () => {
      expect(worstCaseYearlyCost(plan)).toBeLessThan(plan.yearly!);
    });
  }

  it("keeps a real margin, not a rounding error", () => {
    for (const plan of PLANS.filter((entry) => entry.yearly !== null)) {
      const margin = 1 - worstCaseYearlyCost(plan) / plan.yearly!;
      expect(margin).toBeGreaterThan(0.1);
    }
  });

  it("charges more for the plan that answers with the more expensive model", () => {
    expect(planById("craftsman")!.model).toBe("sonnet");
    expect(planById("craftsman")!.yearly!).toBeGreaterThan(planById("apprentice")!.yearly!);
  });
});

describe("the free tier", () => {
  /*
    Locking courses behind the paywall is the version of this product that
    cannot be judged before it is bought. The课 are the thing; what money buys
    is the AI bill and syncing, both of which cost real money per person.
  */
  it("does not lock any course", () => {
    const free = planById("free")!;
    expect(free.lines.some((line) => line.includes("不锁课"))).toBe(true);
    expect(free.monthly).toBeNull();
  });

  it("earns its AI turns rather than being handed a fixed number", () => {
    expect(planById("free")!.dailyAiTurns).toBeNull();
  });
});
