import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "./harness/learner-test.js";
import { ONLINE_ORIGIN } from "./ports.js";
import { watchConsole } from "./harness/console.js";
import { humanClick } from "./harness/click.js";

/*
 * Task 10, the learner's house (V7 amendment one; Owner H1–H3, 2026-10-01).
 * The synthetic page renders the real HouseRoom with fixed keepsakes and
 * answers; the last test walks the real app's entry from Me.
 */
const folder = "SCRATCH/e2e/house";
async function capture(page: Page, name: string) {
  mkdirSync(folder, { recursive: true });
  await page.screenshot({ path: `${folder}/${name}.png` });
}
const FIXTURE = `${ONLINE_ORIGIN}/e2e-fixtures/house.html`;
const placements = async (page: Page) =>
  JSON.parse((await page.locator("[data-fixture-house]").textContent()) ?? "{}") as Record<
    string,
    { x: number; y: number }
  >;

test("a keepsake drags with a real pointer, moves with the keys, and opens only on a press", async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(FIXTURE);
  const plane = page.locator('[data-keepsake$="first-useful-step#1/checkpoint"]');
  await expect(plane).toBeVisible();
  await capture(page, "room-1280");

  const stage = (await page.locator(".house-room__stage").boundingBox())!;
  const from = (await plane.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(stage.x + stage.width * 0.45, stage.y + stage.height * 0.85, { steps: 12 });
  await page.mouse.up();
  const id = (await plane.getAttribute("data-keepsake"))!;
  await expect.poll(async () => (await placements(page))[id]?.x ?? 0).toBeGreaterThan(0.4);
  // A drag is not a press: the detail did not open.
  await expect(page.locator("[data-keepsake-detail]")).toHaveCount(0);

  const before = (await placements(page))[id]!.x;
  await plane.focus();
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await placements(page))[id]!.x).toBeLessThan(before);

  await humanClick(page, plane, "open the paper plane");
  const detail = page.locator("[data-keepsake-detail]");
  await expect(detail).toContainText("发出去之前由你自己定稿");
  await expect(detail).toContainText("先让它帮上一点忙 · 检查站");
  await capture(page, "detail-1280");
  await humanClick(page, detail.getByRole("button", { name: "回到那一段" }), "back to the stretch");
  await expect(page.locator("main")).toHaveAttribute("data-fixture-opened", `segment:${id}`);
  errors.assertClean();
});

test("the wall marks only the days answered 用了, in the chosen style", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(FIXTURE);
  await humanClick(page, page.locator("[data-house-calendar]"), "open the wall calendar");
  await expect(page.locator("[data-used]")).toHaveCount(2);
  await expect(page.locator('[data-day="2026-10-09"]')).not.toHaveAttribute("data-used", /.*/);
  await page.mouse.move(0, 0); // a resting pointer, not a hover, in the picture
  await capture(page, "calendar-tick");
  await humanClick(page, page.getByRole("radio", { name: "画正字" }), "choose tally strokes");
  await expect(page.locator(".house-calendar__tally")).toHaveAttribute("data-used-count", "2");
  await expect(page.locator(".house-calendar__tally")).toContainText("丅");
  await page.mouse.move(0, 0); // a resting pointer, not a hover, in the picture
  await capture(page, "calendar-tally");
});

test("on a phone the room pans inside itself and keepsakes stay finger-sized", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(FIXTURE);
  await expect(page.locator("[data-keepsake]").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
  const room = page.locator("[data-house-room]");
  expect(await room.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  for (const box of await page
    .locator("[data-keepsake]")
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width)))
    expect(box).toBeGreaterThanOrEqual(44);
  await capture(page, "room-390");
});

test("Me opens the house from its top card; a new learner's house is bare and says so", async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${ONLINE_ORIGIN}/me?lang=zh-CN`);
  const card = page.locator("[data-me-house]");
  await expect(card).toContainText("我的小屋");
  // Owner H1: the house card is the first thing under the heading.
  expect(await card.evaluate((el) => el.previousElementSibling?.tagName.toLowerCase() ?? "")).toBe(
    "h1",
  );
  await humanClick(page, card, "open the house from Me");
  await expect(page).toHaveURL(/\/house(?:\?|$)/);
  await expect(page.locator("[data-house-welcome]")).toHaveText("欢迎回家");
  await expect(page.locator("[data-keepsake]")).toHaveCount(0);
  await capture(page, "app-empty-390");
  errors.assertClean();
});
