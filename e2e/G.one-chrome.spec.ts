import { expect, test, type Page } from "@playwright/test";

import { watchConsole } from "./harness/console.js";
import { namedStep } from "./harness/step.js";
import { openOnline } from "./harness/online-learner.js";
import { LOCAL_ORIGIN, ONLINE_ORIGIN } from "./ports.js";

/*
  Two campuses, one chrome — checked by looking at both, not by trusting that
  they import the same component.

  They do import the same component. `UniversityShell` is one implementation and
  always was, which is exactly why this drifted without anyone noticing: the
  shell's `identity` slot was optional, the delivery campus filled it with an
  avatar, and the authoring campus passed nothing. An optional slot left empty
  is indistinguishable from an optional slot nobody wanted — the compiler saw no
  difference, and neither did a reviewer reading either file on its own. The
  only way to see it was to open the two side by side, which is what the boss
  did and what this test now does every run.

  So the assertion is deliberately a *comparison*, not a presence check. A test
  that said "the rail has destinations" would have passed on both shells the
  whole time it was broken.
*/

async function chrome(page: Page) {
  return page.evaluate(() => {
    const text = (node: Element | null) => (node?.textContent ?? "").replace(/\s+/gu, " ").trim();
    return {
      // The rail's own destinations, in order. Anything behind 更多 is allowed
      // to differ: the authoring campus keeps 工作室 there, which is a real
      // difference between what the two shells are for.
      rail: [...document.querySelectorAll(".nav-rail__list .nav-rail__link, .nav-rail__list .nav-rail__flyout-trigger")].map(
        (node) => text(node),
      ),
      // The capsule that answers 「我在哪」.
      hasCapsule: document.querySelector(".counter-row") != null,
      hasSwitcher: document.querySelector(".study-switcher__trigger") != null,
      // The face at the foot of the rail. Either the live canvas or the
      // placeholder it suspends behind counts — both mean the slot was filled.
      hasIdentity: document.querySelector(".nav-rail__identity .avatar-chip") != null,
    };
  });
}

test.describe("G 两个校园穿同一套壳", () => {
  test.use({ viewport: { width: 1440, height: 810 } });

  test("导航栏、胶囊和头像，两端逐项相同", async ({ page }) => {
    const consoleErrors = watchConsole(page);

    let online: Awaited<ReturnType<typeof chrome>> | null = null;
    await namedStep(page, "读投放端的壳", async () => {
      await openOnline(page);
      await expect(page.locator(".nav-rail__list")).toBeVisible({ timeout: 30_000 });
      // The avatar arrives behind Suspense; wait for the slot to settle rather
      // than racing it, or this test measures load order instead of layout.
      await expect(page.locator(".nav-rail__identity .avatar-chip")).toBeVisible({
        timeout: 30_000,
      });
      online = await chrome(page);
    });

    let local: Awaited<ReturnType<typeof chrome>> | null = null;
    await namedStep(page, "读作者端的壳", async () => {
      await page.goto(`${LOCAL_ORIGIN}/`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText(/正在打开校园档案/)).toHaveCount(0, { timeout: 30_000 });
      await expect(page.locator(".nav-rail__list")).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(".nav-rail__identity .avatar-chip")).toBeVisible({
        timeout: 30_000,
      });
      local = await chrome(page);
    });

    await namedStep(page, "逐项比对", async () => {
      expect(local).toEqual(online);
    });

    consoleErrors.assertClean();
  });
});

/*
  The same walk in both campuses: map → island → course → stone → card.

  This is the second time the two campuses turned out to differ in a way no
  component check could see. The chrome test above compares what is *around* a
  screen; this compares whether a screen exists at all. Picking an island in
  the authoring campus used to resolve the resume lesson and open the reader,
  so the level in between — the island seen from inside, one stone per lesson —
  was a whole part of the product that only one campus had. Nothing was forked:
  the composition simply lived in an app file the other app could not import.

  Every assertion here is 「两边都要」 rather than 「这边有」, for the same reason
  as above: a presence check passes on the working side and tells you nothing.
*/
async function walkToNodeCard(page: Page, origin: string) {
  await page.goto(`${origin}/#/`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".labels button.label").first()).toBeVisible({ timeout: 60_000 });
  await page.locator(".labels button.label").first().click();

  const enter = page.getByRole("button", { name: /进入这门课/ });
  await expect(enter).toBeVisible({ timeout: 30_000 });
  await enter.click();

  // The course scene: a lit stone that says 开始, and the panel naming the
  // course you are standing on.
  const start = page.locator("button.label", { hasText: /^开始$/ });
  await expect(start).toBeVisible({ timeout: 60_000 });
  const courseName = (await page.locator(".picked--left h3").innerText()).trim();

  await start.click();
  const card = page.locator("[aria-modal='true'], .path-card").first();
  await expect(card).toBeVisible({ timeout: 30_000 });

  return {
    courseNamed: courseName.length > 0,
    // Both the way in and the way to read the unit first, because the card
    // offering only one of them is a different card.
    cardStarts: await card.getByRole("button", { name: /^开始/ }).isVisible(),
    cardPreviewsUnit: await card.getByRole("button", { name: /先看这一单元讲什么/ }).isVisible(),
  };
}

test.describe("G2 两个校园走同一条路", () => {
  test.use({ viewport: { width: 1440, height: 810 } });

  test("点岛 → 课程岛 → 关卡石头 → 关卡卡片，两端一样", async ({ page }) => {
    const consoleErrors = watchConsole(page);

    let online: Awaited<ReturnType<typeof walkToNodeCard>> | null = null;
    await namedStep(page, "投放端走一遍", async () => {
      online = await walkToNodeCard(page, ONLINE_ORIGIN);
    });

    let local: Awaited<ReturnType<typeof walkToNodeCard>> | null = null;
    await namedStep(page, "作者端走一遍", async () => {
      local = await walkToNodeCard(page, LOCAL_ORIGIN);
    });

    expect(local).toEqual(online);
    expect(online).toEqual({ courseNamed: true, cardStarts: true, cardPreviewsUnit: true });
    consoleErrors.assertClean();
  });
});
