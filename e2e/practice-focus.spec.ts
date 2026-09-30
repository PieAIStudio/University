import { expect, test, type Page } from "./harness/learner-test.js";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { ONLINE_ORIGIN } from "./ports.js";
import { prepareNativePractice, answerNativePractice } from "./harness/native-practice.js";

// V7 retains these focus/feedback/ending contracts, but asks native questions
// from completed levels. The old fresh-learner global concept bank was the
// defect being removed, not a fixture that could still judge this path.
async function startRound(page: Page, reduced = false) {
  const { answers } = await prepareNativePractice(page);
  if (reduced) await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${ONLINE_ORIGIN}/practice`);
  await expect(page.locator("[data-native-practice]")).toHaveAttribute(
    "data-practice-state",
    "asking",
  );
  await expect(page.locator("[data-practice-focus]")).toBeFocused();
  return answers;
}
const submit = (page: Page) => page.locator('[data-question-action="submit"]');
const next = (page: Page) => page.locator("[data-practice-next]");

for (const width of [320, 390, 1440]) {
  test.describe(`V practice flow ${width}`, () => {
    test.use({ viewport: { width, height: width === 1440 ? 900 : 844 } });
    test("V1 Next returns to the question heading and collapses the previous answer", async ({
      page,
    }) => {
      const answers = await startRound(page);
      const oldPrompt = await page.locator(".question-step__prompt").textContent();
      await answerNativePractice(page, answers);
      await expect(page.locator("[data-practice-reward]")).not.toHaveAttribute("open");
      await page.locator("[data-practice-reward] summary").click();
      await expect(page.locator("[data-practice-reward]")).toHaveAttribute("open", "");
      await next(page).click();
      await expect(page.locator("[data-practice-focus]")).toBeFocused();
      await expect(page.locator(".question-step__prompt")).not.toHaveText(oldPrompt!);
      const box = await page.locator(".question-step__prompt").boundingBox();
      // The reader's practice section has a deliberate 52px margin and 38px
      // top padding; the standalone rehearsal must not inherit either.
      await expect(page.locator("[data-native-practice]")).not.toHaveClass(/lesson-practice/);
      await expect(page.locator("[data-native-practice]")).toHaveCSS("margin-top", "0px");
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeLessThan(240);
      await expect(page.locator("[data-practice-reward]")).toHaveCount(0);
      await expect(page.locator("[data-practice-verdict]")).toHaveCount(0);
      await expect(submit(page)).toBeVisible();
      await expect(submit(page)).toBeDisabled();
    });
    test("V2 the last correct answer stays readable until an explicit result click", async ({
      page,
    }) => {
      const answers = await startRound(page);
      for (let index = 0; index < 3; index += 1) {
        await answerNativePractice(page, answers);
        if (index < 2) await next(page).click();
      }
      await expect(page.locator("[data-native-practice]")).toHaveAttribute(
        "data-practice-state",
        "asking",
      );
      await expect(page.locator("[data-practice-round-complete]")).toHaveCount(0);
      await expect(page.locator("[data-practice-verdict]")).toHaveText("这次答对了。");
      await expect(page.locator("[data-practice-reward]")).not.toHaveAttribute("open");
      await page.locator("[data-practice-reward] summary").click();
      await expect(page.locator("[data-practice-reward]")).toHaveAttribute("open", "");
      await expect(page.locator("[data-practice-reward] button")).toBeVisible();
      await expect(next(page)).toHaveText("结束这轮");
      await next(page).click();
      await expect(page.locator("[data-practice-round-complete]")).toBeVisible();
      await expect(page.locator("[data-practice-focus]")).toBeFocused();
      await expect(page.locator("[data-practice-round-complete]")).toContainText("这次练了 3 道题");
      expect(
        (await new AxeBuilder({ page }).include(".app-shell__main").analyze()).violations,
      ).toEqual([]);
      mkdirSync("SCRATCH/e2e/practice-flow", { recursive: true });
      await page.screenshot({ path: `SCRATCH/e2e/practice-flow/native-round-${width}.png` });
    });
  });
}

test("V3 keyboard and reduced motion can read final feedback, open details and finish", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const answers = await startRound(page, true);
  for (let index = 0; index < 3; index += 1) {
    const prompt = (await page.locator(".question-step__prompt").innerText()).trim();
    const input = page.locator("[data-native-practice] textarea");
    if (await input.count()) {
      await input.focus();
      await page.keyboard.insertText(answers.get(prompt)!);
    } else {
      const choice = page
        .locator("[data-native-practice] [role=radio]")
        .filter({ hasText: answers.get(prompt)! })
        .first();
      await choice.focus();
      await page.keyboard.press("Space");
    }
    await submit(page).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-practice-verdict]")).toHaveAttribute(
      "data-practice-verdict",
      "correct",
    );
    if (index < 2) {
      await next(page).focus();
      await page.keyboard.press("Enter");
    }
  }
  const summary = page.locator("[data-practice-reward] summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-practice-reward]")).toHaveAttribute("open", "");
  await next(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-practice-round-complete]")).toBeVisible();
  await expect(page.locator("[data-practice-focus]")).toBeFocused();
  const finish = page.locator("[data-practice-finish]");
  await finish.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/review(?:\?|$)/);
});

test("V4 dark disabled Submit uses the muted ink token and reveals a real enabled affordance", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  const answers = await startRound(page, true);
  await expect(submit(page)).toBeDisabled();
  const colors = await submit(page).evaluate((element) => {
    const style = getComputedStyle(element);
    const probe = document.createElement("span");
    probe.style.color = "var(--game-ui-text-muted)";
    document.body.append(probe);
    const muted = getComputedStyle(probe).color;
    probe.remove();
    return { color: style.color, muted, cursor: style.cursor };
  });
  expect(colors.color).toBe(colors.muted);
  expect(colors.cursor).toBe("not-allowed");
  const prompt = (await page.locator(".question-step__prompt").innerText()).trim();
  const input = page.locator("[data-native-practice] textarea");
  if (await input.count()) await input.fill(answers.get(prompt)!);
  else
    await page
      .locator("[data-native-practice] [role=radio]")
      .filter({ hasText: answers.get(prompt)! })
      .first()
      .click();
  await expect(submit(page)).toBeEnabled();
  expect((await new AxeBuilder({ page }).include(".app-shell__main").analyze()).violations).toEqual(
    [],
  );
});
