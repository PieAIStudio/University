import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { ONLINE_ORIGIN, LOCAL_ORIGIN } from "./ports.js";
import { humanClick } from "./harness/click.js";
import { enterSelectedMapObject, mapEntryButton } from "./harness/map-actions.js";

const { course } = JSON.parse(
  readFileSync("apps/university/content/ai-literacy/understanding-ai.json", "utf8"),
);
const firstUnit = course.units[0];
const firstLesson = firstUnit.lessons[0];
const lessonPath = `/ai-literacy/${course.id}/${firstUnit.id}/${firstLesson.id}`;

async function expectEnglish(scope: Locator) {
  await expect(scope).toBeVisible();
  expect(await scope.innerText()).not.toMatch(/[\u4e00-\u9fff]/u);
  const labels = await scope
    .locator("[aria-label]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")));
  expect(labels.join(" ")).not.toMatch(/[\u4e00-\u9fff]/u);
}

async function expectToolbarTargets(page: Page) {
  const toolbar = page.locator(".lesson-toolbar__tools");
  await expect(toolbar).toBeVisible();
  const geometry = await toolbar.locator("button, label.game-ui-toggle").evaluateAll((nodes) =>
    nodes
      .map((node) => {
        const box = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return {
          text: node.textContent,
          visible: style.display !== "none" && style.visibility !== "hidden" && box.width > 0,
          left: box.left,
          right: box.right,
          top: box.top,
          bottom: box.bottom,
          width: window.innerWidth,
          height: window.innerHeight,
          hit: hit !== null && (hit === node || node.contains(hit)),
        };
      })
      .filter((node) => node.visible),
  );
  expect(geometry.length).toBeGreaterThanOrEqual(3);
  for (const box of geometry) {
    expect(box.left, `${box.text}: left edge`).toBeGreaterThanOrEqual(-1);
    expect(box.right, `${box.text}: right edge`).toBeLessThanOrEqual(box.width + 1);
    expect(box.top, `${box.text}: top edge`).toBeGreaterThanOrEqual(-1);
    expect(box.bottom, `${box.text}: bottom edge`).toBeLessThanOrEqual(box.height + 1);
    expect(box.hit, `${box.text}: actual hit target`).toBe(true);
  }
}

for (const [mode, origin] of [
  ["delivery", ONLINE_ORIGIN],
  ["authoring", LOCAL_ORIGIN],
] as const) {
  test.describe(`Y English campus ${mode}`, () => {
    test.use({ locale: "en-US", viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });

    test("planet, study, course and lesson share one readable English journey", async ({
      page,
    }, info) => {
      await page.goto(`${origin}/planet?lang=en`);
      await humanClick(
        page,
        page.locator('button[data-domain-id="ai-foundations"]'),
        "choose AI foundations",
      );
      // This domain currently has one published study. The selected planet's
      // sole Enter names that study; no duplicate selection row is required.
      await expect(mapEntryButton(page)).toHaveAttribute("aria-label", /Understanding|Understand/);
      await expectEnglish(page.locator(".map-information"));
      await expect(page.locator('[data-map-entry="true"]')).toBeVisible();
      await enterSelectedMapObject(page, "enter the beginner study");
      const island = page.locator(`button.label--course[data-map-marker="${course.id}"]`);
      await humanClick(page, island, "select the real introductory course");
      await enterSelectedMapObject(page, "enter this course");
      await expect(page).toHaveURL(new RegExp(`/ai-literacy/${course.id}(?:\\?|$)`));
      await expect(page.locator(".loading-trivia")).toHaveCount(0);
      const labels = page.locator("[data-lesson-state][aria-label]");
      await expect(labels.first()).toBeAttached();
      expect(
        (
          await labels.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")))
        ).join(" "),
      ).not.toMatch(/[\u4e00-\u9fff]/u);
      await humanClick(
        page,
        page.locator(`button.label--lesson[data-map-marker="${firstLesson.id}"]`),
        "start the actual lesson",
      );
      await enterSelectedMapObject(page, "read the selected real lesson");
      await expect(page.locator(".lesson-reader")).toContainText(firstLesson.locales.en.title);
      await expectEnglish(page.locator(".lesson-toolbar"));
      await page.screenshot({ path: info.outputPath("english-journey.png"), fullPage: true });
    });

    test("English reading tools fit and stay operable, including advanced language settings", async ({
      page,
    }, info) => {
      await page.goto(`${origin}${lessonPath}?lang=en`);
      await expect(page.locator(".lesson-reader")).toContainText(firstLesson.locales.en.title);
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => window.scrollTo(0, 0));
        await expectToolbarTargets(page);
        const detail = page.locator(".lesson-toolbar__tools .game-ui-segmented-option").last();
        await humanClick(page, detail, "change reading detail without a clipped target");
        await expectToolbarTargets(page);
        await page.screenshot({ path: info.outputPath(`english-tools-${width}.png`) });
      }
      await page.goto(`${origin}/settings?lang=en`);
      await humanClick(page, page.locator("#settings-language"), "open optional reading aids");
      await expectEnglish(page.locator(".foreign-settings"));
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        321,
      );
      await page.screenshot({
        path: info.outputPath("english-reading-settings.png"),
        fullPage: true,
      });
    });
  });
}
