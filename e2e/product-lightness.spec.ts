import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ONLINE_ORIGIN } from "./ports.js";
import { CATALOGUE_ROLES, lessonPathOf } from "./harness/catalogue.js";

const LESSON = lessonPathOf(
  CATALOGUE_ROLES.undecidedGrading.course,
  CATALOGUE_ROLES.undecidedGrading.lesson,
);

for (const width of [390, 320, 1440]) {
  test.describe(`U light product ${width}`, () => {
    test.use({
      viewport: { width, height: width === 1440 ? 900 : width === 320 ? 740 : 844 },
      storageState: { cookies: [], origins: [] },
      hasTouch: width < 768,
      isMobile: width < 768,
    });

    test("U1 value and full price precede details; missing transport does not pretend to charge", async ({
      page,
    }) => {
      await page.goto(`${ONLINE_ORIGIN}/plans`);
      const card = page.locator(".plan-card--featured");
      const cta = card.getByRole("button", { name: "升级会员", exact: true });
      await expect(cta).toBeVisible();
      const box = await cta.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height - 52);
      await expect(card).toContainText("$149.00");
      await expect(card).toContainText("每年一次付清");
      await expect(card).toContainText("AI 批改按次另计");
      await expect(page.getByText(/尚未开售|计划价格|不作为现在可购买/)).toHaveCount(0);
      const details = page.locator("[data-billing-details]");
      await expect(details).not.toHaveAttribute("open");
      await details.locator("summary").click();
      await expect(details).toHaveAttribute("open", "");
      await expect(details.getByText(/会员费不包含/)).toBeVisible();
      await details.locator("summary").click();
      await cta.click();
      await expect(page.getByRole("alert")).toContainText("未扣款");
      await expect(page.locator(".payment-order__quote")).toHaveCount(0);
      await expect(cta).toBeEnabled();
    });

    test("U2 welcome is short and its first action never waits for animation", async ({ page }) => {
      await page.goto(ONLINE_ORIGIN);
      const welcome = page.locator("[data-welcome]");
      await expect(welcome).toBeVisible();
      const text = (await welcome.innerText()).replace(/\s/g, "");
      expect(text.length).toBeLessThan(115);
      const start = welcome.locator("[data-welcome-start]");
      await expect(start).toBeEnabled();
      await start.click();
      await expect(page.locator(".lesson-reader")).toBeVisible();
    });

    test("U3 practice leads with an action; optional rules do not crowd the first screen", async ({
      page,
    }) => {
      await page.goto(`${ONLINE_ORIGIN}/practice`);
      const start = page.locator("[data-practice-round]");
      await expect(start).toBeVisible();
      if (width < 768) {
        const counters = await page.locator(".counter-row").boundingBox();
        expect(counters!.y).toBeLessThan(32);
        expect(counters!.height).toBeLessThan(80);
      }
      const box = await start.boundingBox();
      expect(box!.y + box!.height).toBeLessThan(page.viewportSize()!.height - 52);
      await expect(page.locator("[data-practice-details]")).not.toHaveAttribute("open");
      await start.click();
      await expect(page.locator(".practice-stream__ordinal")).toContainText("0 / 3");
      await expect(page.getByRole("button", { name: "先停一下", exact: true })).toBeVisible();
    });

    test("U4 a preserved draft and one undecided result stay actionable", async ({ page }) => {
      await page.goto(`${ONLINE_ORIGIN}${LESSON}`);
      const exercise = page.locator(".exercise-panel").first();
      const answer = exercise.locator("textarea");
      await answer.fill("手机比较画面算出的特征数字，不是逐张对照片。");
      await page.reload();
      await expect(answer).toHaveValue("手机比较画面算出的特征数字，不是逐张对照片。");
      await exercise.getByRole("button", { name: /^提交$/ }).click();
      await expect(exercise.locator("[data-grade-summary]")).toContainText("还不能判断");
      await expect(exercise.locator("[data-grade-summary]")).toHaveCount(1);
      await expect(exercise.locator("[data-grade-details]")).not.toHaveAttribute("open");
      await exercise.locator("[data-grade-details] summary").click();
      await expect(exercise.locator("[data-grade-details]")).toHaveAttribute("open", "");
      await expect(answer).toBeEditable();
    });
  });
}

test.describe("U details accessibility", () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  test("U5 details work with keyboard and reduced motion keeps feedback readable", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${ONLINE_ORIGIN}/plans`);
    const summary = page.locator("[data-billing-details] summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-billing-details]")).toHaveAttribute("open", "");
    await page.keyboard.press("Space");
    await expect(page.locator("[data-billing-details]")).not.toHaveAttribute("open");
    const result = await new AxeBuilder({ page }).analyze();
    expect(result.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  });

  test("U6 dark mode supports revealed hints, settings and a concise account error", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.goto(`${ONLINE_ORIGIN}/settings`);
    await expect(page.locator(".settings-screen")).toBeVisible();
    const sharing = page.getByRole("switch", { name: "共享学习动态" });
    await expect(sharing).toHaveAttribute("aria-checked", "false");
    const details = page.locator(".speech-quality-control details");
    await details.locator("summary").click();
    await expect(details).toHaveAttribute("open", "");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.goto(`${ONLINE_ORIGIN}/me`);
    const accountForm = page.locator("details.account-panel__form");
    await expect(accountForm).toBeVisible();
    await accountForm.locator(":scope > summary").click();
    await expect(accountForm).toHaveAttribute("open", "");
    const email = accountForm.locator('input[type="email"]');
    await email.fill("learner@example.invalid");
    await expect(email).toHaveValue("learner@example.invalid");
    await accountForm.locator('form button[type="submit"]').click();
    // The shared Kit uses native required-field validation for sign-in, not
    // the retired form's custom eight-character registration policy message.
    const password = accountForm.locator('input[type="password"]');
    await expect(password).toBeFocused();
    expect(await password.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(
      true,
    );
    expect(await password.evaluate((input: HTMLInputElement) => input.validationMessage)).not.toBe(
      "",
    );
    await page.goto(`${ONLINE_ORIGIN}${LESSON}`);
    const exercise = page.locator(".exercise-panel").first();
    await exercise.locator("textarea").fill("画面被算成数字，与设置时记录的特征比较。");
    await exercise.getByRole("button", { name: /^提交$/ }).click();
    await expect(exercise.locator("[data-grade-summary]")).toContainText("还不能判断");
    await exercise.locator("[data-grade-details] summary").click();
    expect(
      (await new AxeBuilder({ page }).include(".exercise-panel").analyze()).violations,
    ).toEqual([]);
  });

  test("U7 the short-round ending celebrates real answers and reduced motion stops the decoration", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${ONLINE_ORIGIN}/practice`);
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
      true,
    );
    await page.locator("[data-practice-round]").click();
    for (let question = 0; question < 3; question += 1) {
      const block = page.locator(".practice-stream__question .choice-block");
      const options = block.locator(".choice-block__option");
      // Exercise the published quiz through real selections, not seeded completion.
      for (let candidate = 0; candidate < (await options.count()); candidate += 1) {
        await options.nth(candidate).click();
        await block.locator(".choice-block__submit button").click();
        if (
          (await page.locator("[data-practice-round-complete]").count()) ||
          (await block.locator(".choice-block__option--correct").count())
        )
          break;
      }
      if (question < 2) await block.locator(".choice-block__submit button").click();
    }
    await expect(page.locator("[data-practice-round-complete]")).toHaveCount(0);
    await page
      .locator(".practice-stream__question")
      .getByRole("button", { name: "完成这一轮", exact: true })
      .click();
    const completed = page.locator("[data-practice-round-complete]");
    await expect(completed).toContainText("3 道题");
    const icon = completed.locator(".practice-stream__celebrate");
    await expect(icon).toBeVisible();
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
      true,
    );
    expect(await icon.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    expect(await icon.evaluate((element) => getComputedStyle(element).animationName)).toBe(
      "practice-celebrate",
    );
    expect(
      await icon.evaluate((element) => getComputedStyle(element).animationIterationCount),
    ).toBe("1");
    await page.getByRole("button", { name: "今天先到这里", exact: true }).click();
    await expect(page.locator("[data-practice-round-complete]")).toHaveCount(0);
  });
});
