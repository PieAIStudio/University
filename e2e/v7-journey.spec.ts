import { expect, test, type Page } from "./harness/learner-test.js";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { ONLINE_ORIGIN } from "./ports.js";
import {
  openOnline,
  readAndAnswerFirstLesson,
  startFirstLessonFromLanding,
  waitForMapReady,
} from "./harness/online-learner.js";
import { waitForGuidePaint } from "./harness/opening.js";

const OUTPUT = "SCRATCH/e2e/v7-journey";

/** These tests must never create a real account, email, order or model request. */
async function isolatedGuest(page: Page) {
  await page.route(/https:\/\/[^/]+\.supabase\.co\//, (route) =>
    route.fulfill({ status: 503, json: { message: "Synthetic offline account provider" } }),
  );
  await page.route(/https:\/\/[^/]*posthog\.com\//, (route) => route.abort());
  await page.routeWebSocket(/supabase\.co/, (socket) => socket.close());
}

async function completeFirst(page: Page) {
  await isolatedGuest(page);
  await openOnline(page);
  await waitForMapReady(page);
  await startFirstLessonFromLanding(page);
  await readAndAnswerFirstLesson(page);
  await expect(page.locator('[data-chest-action="open"]')).toBeVisible();
  await page.locator('[data-chest-action="open"]').click();
  await expect(page.locator('[data-chest-action="continue"]')).toBeVisible({ timeout: 20_000 });
  await page.locator('[data-chest-action="continue"]').click();
  await expect(page.locator('[data-opening-topic="wrap-up"]')).toBeVisible({ timeout: 20_000 });
}

for (const width of [1440, 390]) {
  test.describe(`V7 return loop ${width}`, () => {
    test.use({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    test("the real lesson ends on the island, asks once, and resumes the next level in one press", async ({
      page,
    }) => {
      mkdirSync(OUTPUT, { recursive: true });
      await completeFirst(page);
      await expect(page.locator(".settle")).toHaveCount(0);
      await expect(page.locator("[data-email-save-card]")).toBeVisible();
      const count = Number(
        await page.locator("[data-wrap-up]").getAttribute("data-wrap-up-card-count"),
      );
      expect(count).toBeGreaterThan(0);
      await waitForGuidePaint(page);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({ path: `${OUTPUT}/guest-wrap-${width}.png` });
      await page.locator("[data-journey-later]").click();
      await expect(page.locator('[data-opening-topic="wrap-up"]')).toHaveCount(0);
      const preference = await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("university.progress.v2") ?? "null")?.account
            ?.preferences,
      );
      expect(preference.journey.saveDays).toHaveLength(1);
      expect(preference.reviewEmail).toBeUndefined();
      await page.goto(ONLINE_ORIGIN + "/");
      await expect(page.locator("[data-journey-start]")).toBeVisible({ timeout: 90_000 });
      await expect(page.locator("[data-journey-start]")).toHaveAccessibleName(/2/);
      await expect(page.locator(".hint--entry,[data-welcome]")).toHaveCount(0);
      await waitForGuidePaint(page);
      await page.screenshot({ path: `${OUTPUT}/continue-${width}.png` });
      await page.locator("[data-journey-start]").focus();
      await page.keyboard.press("Enter");
      await expect(page.locator(".lesson-reader")).toBeVisible();
      await expect(page.locator("[data-journey-continue]")).toHaveCount(0);
    });
  });
}

test.describe("V7 phone avatar and email intent", () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  test("the flame opens the full panel; choosing save-only records an opt-out before the shared account page", async ({
    page,
  }) => {
    mkdirSync(OUTPUT, { recursive: true });
    await completeFirst(page);
    await page.locator('[data-journey-save="only"]').click();
    await expect(page).toHaveURL(/\/me(?:[?#]|$)/);
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("university.progress.v2") ?? "null")?.account?.preferences
            ?.reviewEmail?.enabled,
      ),
    ).toBe(false);
    await page.goto(ONLINE_ORIGIN + "/");
    await expect(page.locator("[data-journey-start]")).toBeVisible({ timeout: 90_000 });
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-journey-continue]")).toHaveCount(0);
    expect(
      await page.evaluate(() => {
        const glow = (window as any).three?.scene.getObjectByName("course-chest-ready-glow");
        return Boolean(glow?.visible);
      }),
    ).toBe(true);
    await expect(page.locator(".avatar-panel__flame").first()).toBeVisible();
    await page.locator("button.avatar-chip--button").first().click();
    const panel = page.locator(".journey-avatar-modal");
    await expect(panel).toBeVisible();
    await expect(panel.locator(".avatar-panel__day")).toHaveCount(7);
    await expect(panel.locator("[data-rest-tickets]")).toHaveAttribute("data-rest-tickets", "1");
    await panel.locator("[data-rest-tickets] summary").click();
    await expect(panel.locator(".avatar-panel__rest p").first()).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `${OUTPUT}/avatar-phone.png` });
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
  });
});

/** Actual React/Nerve/product components; explicitly synthetic account facts.
 * Not a live membership, cloud-save receipt or model/email integration test. */
for (const state of ["email", "member"] as const) {
  for (const width of [1440, 390]) {
    test(`V7 isolated ${state} wrap-up ${width}: correct card, one weekly pitch, no accidental request`, async ({
      page,
    }) => {
      mkdirSync(OUTPUT, { recursive: true });
      await page.setViewportSize({ width, height: 900 });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      // Use the same Vite-transformed HTML lane as the account fixtures, so
      // React's normal refresh preamble is installed, not bypassed by routing.
      await page.goto(`${ONLINE_ORIGIN}/e2e-fixtures/journey.html?state=${state}&lang=en`);
      await expect.poll(() => errors).toEqual([]);
      await expect(page.locator("[data-fixture-ready]")).toBeVisible();
      await page.locator("[data-fixture-finish]").click();
      await expect(page.locator('[data-opening-topic="wrap-up"]')).toBeVisible();
      // A member with no next lesson/recap has only the opening's sentence;
      // its deliberately empty optional card slot has no painted height.
      await expect(page.locator(`[data-wrap-up="${state}"]`)).toHaveCount(1);
      await expect(page.locator("[data-email-save-card]")).toHaveCount(0);
      await waitForGuidePaint(page);
      await page.screenshot({ path: `${OUTPUT}/synthetic-${state}-${width}.png` });
      if (state === "email") {
        await expect(page.locator("[data-member-line]")).toBeVisible();
        await expect(page.locator('[data-wrap-up-sync="saved"]')).toBeVisible();
        await page.keyboard.press("Escape");
        await page.locator("[data-fixture-again]").click();
        await page.locator("[data-fixture-finish]").click();
        await expect(page.locator('[data-wrap-up="email"]')).toBeVisible();
        await expect(page.locator("[data-member-line]")).toHaveCount(0);
      } else {
        await expect(page.locator("[data-member-line],[data-wrap-up-sync]")).toHaveCount(0);
        await page.mouse.move(0, 0);
        await expect(page.locator('[data-opening-topic="wrap-up"]')).toHaveCount(0, {
          timeout: 10_000,
        });
      }
      expect(await page.evaluate(() => (window as any).__journeyFixtureWrites)).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}

test.describe("用了吗 on the return card (V7 amendment one)", () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  test("a small thing left yesterday is asked about once, and 用了 marks the house wall", async ({
    page,
  }) => {
    mkdirSync(OUTPUT, { recursive: true });
    await completeFirst(page);
    await page.locator("[data-journey-later]").click();
    // Yesterday's lesson left one small thing. The record says so; the
    // question never comes on the day the lesson was finished.
    const yesterday = await page.evaluate(() => {
      const day = new Date(Date.now() - 86_400_000);
      return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    });
    await page.evaluate((day) => {
      const key = "university.progress.v2";
      const document = JSON.parse(localStorage.getItem(key)!);
      document.account.preferences.house = {
        placements: {},
        used: {},
        offered: {
          "e2e/yesterday/lesson": {
            task: "给朋友发消息前，先附上两条你以前发给他的消息。",
            day,
            at: new Date(Date.now() - 86_400_000).toISOString(),
          },
        },
      };
      localStorage.setItem(key, JSON.stringify(document));
    }, yesterday);
    await page.goto(ONLINE_ORIGIN + "/");
    const question = page.locator("[data-journey-continue] [data-used-question]");
    await expect(question).toBeVisible({ timeout: 90_000 });
    await expect(question).toContainText("先附上两条你以前发给他的消息");
    // The forward action is still the one primary button on the card.
    await expect(page.locator("[data-journey-start]")).toBeVisible();
    await waitForGuidePaint(page);
    await page.screenshot({ path: `${OUTPUT}/used-question-390.png` });
    await question.locator('[data-used-answer="used"]').click();
    await expect(page.locator('[data-used-answered="used"]')).toHaveText("在小屋墙上记了一笔。");
    const used = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("university.progress.v2")!).account.preferences.house.used,
    );
    expect(used["e2e/yesterday/lesson"].answer).toBe("used");
  });
});
