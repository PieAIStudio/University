import { expect, test, type Page } from "@playwright/test";

import { watchConsole } from "./harness/console.js";
import { namedStep } from "./harness/step.js";
import { openOnline } from "./harness/online-learner.js";
import { LOCAL_ORIGIN } from "./ports.js";

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
