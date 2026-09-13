import { expect, test } from "@playwright/test";
import { ONLINE_ORIGIN } from "./ports.js";
import { makeDroppedCardsDue } from "./harness/online-learner.js";

const KEY = "university.progress.v2";

test.beforeEach(async ({ page }) => {
  // Synthetic cache contract only: no product/account/cloud request runs.
  const url = `${ONLINE_ORIGIN}/__review-clock-fixture`;
  await page.route(url, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Review clock fixture</title>",
    }),
  );
  await page.goto(url);
});

for (const scope of ["guest", "account"] as const) {
  test(`review clock: ${scope} returns tomorrow without rewriting stored schedules`, async ({
    page,
  }) => {
    const before = await page.evaluate(
      ({ key, scope }) => {
        const now = Date.now();
        const raw = JSON.stringify({ cards: { "fixture-card": { dueAt: now + 60_000 } } });
        const activeKey = scope === "guest" ? key : `${key}.account.synthetic`;
        localStorage.setItem(key, JSON.stringify({ cards: {} }));
        localStorage.setItem(activeKey, raw);
        return { activeKey, raw, now };
      },
      { key: KEY, scope },
    );

    expect(await makeDroppedCardsDue(page)).toBe(1);
    const after = await page.evaluate(
      (activeKey) => ({
        raw: localStorage.getItem(activeKey),
        now: Date.now(),
      }),
      before.activeKey,
    );
    expect(after.raw, "FSRS dates and original progress bytes must remain unchanged").toBe(
      before.raw,
    );
    expect(after.now, "time, not the schedule, advances to the next day").toBeGreaterThanOrEqual(
      before.now + 86_400_000,
    );
  });
}

test("review clock refuses missing cards instead of inventing progress", async ({ page }) => {
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ cards: {} })), KEY);
  await expect(makeDroppedCardsDue(page)).rejects.toThrow("没有掉落卡片");
});

test("review clock refuses an ambiguous multi-account cache", async ({ page }) => {
  await page.evaluate((key) => {
    const raw = JSON.stringify({ cards: { "fixture-card": { dueAt: Date.now() + 60_000 } } });
    for (const scope of ["one", "two"]) localStorage.setItem(`${key}.account.${scope}`, raw);
  }, KEY);
  await expect(makeDroppedCardsDue(page)).rejects.toThrow("不能猜测账号");
});

test("review clock rejects invalid dates instead of making them pass", async ({ page }) => {
  await page.evaluate(
    (key) => localStorage.setItem(key, JSON.stringify({ cards: { bad: { dueAt: null } } })),
    KEY,
  );
  await expect(makeDroppedCardsDue(page)).rejects.toThrow("到期时间无效");
});
