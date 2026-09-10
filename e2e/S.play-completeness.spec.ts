import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { ONLINE_ORIGIN } from "./ports.js";

/*
  「设计为 4 个连 4 个，结果用上去之后发现连显示都没显示全。」

  That is the defect class this file exists for, and it is not the same thing
  the other play specs check. P and Q walk each game to completion, which proves
  the rules work; R checks the three-tier entry points. None of them asks the
  question a reader would ask, which is whether everything the payload declares
  actually arrived on the screen — a board can be completable while one of its
  items sits under another element, off the side, or at zero height.

  So the assertions here are deliberately dumb and deliberately per-element:
  count what the payload declares, count what is on screen, and require the
  second to be visible. A test that checked 「the board rendered」 would pass on
  a board showing half its cases.

  Both widths, because most of this only happens on a phone.
*/

const EVIDENCE = resolve("SCRATCH/play-completeness");
const PHONE = { width: 375, height: 812 };

const activity = (page: Page) => page.locator(".learning-activity");

async function openLab(page: Page, mode: string, tier: "入门" | "进阶" | "挑战") {
  await page.goto(`${ONLINE_ORIGIN}/play-lab`, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("navigation", { name: "挑一种互动课件" })
    .getByRole("button", { name: new RegExp(`^${mode}`) })
    .click();
  await page.getByRole("button", { name: tier, exact: true }).click();
  const explore = page.getByRole("button", { name: "自由探索", exact: true });
  if (await explore.count()) await explore.click();
  await expect(activity(page)).toBeVisible();
}

/** Every one of these must be on the screen, and inside the page's own width. */
async function allVisibleAndInside(page: Page, rows: Locator, what: string, expected: number) {
  await expect(rows, `${what}: 屏幕上的数量对不上载荷`).toHaveCount(expected);
  for (let index = 0; index < expected; index += 1) {
    const row = rows.nth(index);
    await expect(row, `${what} 第 ${index + 1} 个没显示出来`).toBeVisible();
    const box = await row.boundingBox();
    expect(box, `${what} 第 ${index + 1} 个没有尺寸`).not.toBeNull();
    expect(box!.width, `${what} 第 ${index + 1} 个宽度为 0`).toBeGreaterThan(0);
    expect(box!.height, `${what} 第 ${index + 1} 个高度为 0`).toBeGreaterThan(0);
  }
}

/** The page itself must never scroll sideways; wide content scrolls in its own box. */
async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow, "整页出现了横向滚动").toBeLessThanOrEqual(1);
}

async function shot(page: Page, name: string) {
  mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: resolve(EVIDENCE, `${name}.png`), fullPage: true });
}

test.describe("对照台：两栏都要在，而且要并排", () => {
  for (const [tier, cases] of [
    ["入门", 2],
    ["进阶", 4],
    ["挑战", 5],
  ] as const) {
    test(`${tier} 档的 ${cases} 个情况全部可见，两种做法都印出来了`, async ({ page }) => {
      await openLab(page, "对照台", tier);

      await allVisibleAndInside(page, activity(page).locator(".play-contrast__approach"), "做法", 2);
      await allVisibleAndInside(page, activity(page).locator(".play-contrast__case"), "情况", cases);
      await noSidewaysScroll(page);

      // Reveal one, and require both columns — the blank-column defect is the
      // whole reason `outcomes` coverage is an engine rule.
      await activity(page).locator(".play-contrast__choice").first().click();
      await allVisibleAndInside(
        page,
        activity(page).locator(".play-contrast__outcome"),
        "揭示后的两栏结果",
        2,
      );

      /*
        Side by side, not stacked. A comparison read as two paragraphs one after
        the other is not the thing this game teaches, so the two columns share a
        row at every width — asserted on real geometry rather than on the CSS
        that is supposed to produce it.
      */
      const boxes = await activity(page).locator(".play-contrast__outcome").all();
      const [left, right] = await Promise.all(boxes.map((box) => box.boundingBox()));
      expect(left!.y, "两栏结果被折成上下排了").toBeCloseTo(right!.y, 0);
    });
  }

  test("手机上两栏仍然并排，情况一个不少", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await openLab(page, "对照台", "挑战");

    await allVisibleAndInside(page, activity(page).locator(".play-contrast__case"), "情况", 5);
    await activity(page).locator(".play-contrast__choice").first().click();
    await allVisibleAndInside(
      page,
      activity(page).locator(".play-contrast__outcome"),
      "手机上的两栏结果",
      2,
    );
    await noSidewaysScroll(page);
    await shot(page, "contrast-phone-challenge");
  });
});

test.describe("取舍台：选项常驻，情况一个一个来", () => {
  for (const [tier, options, situations] of [
    ["入门", 2, 2],
    ["进阶", 2, 4],
    ["挑战", 3, 6],
  ] as const) {
    test(`${tier} 档印出 ${options} 个选项，并数得清共 ${situations} 种情况`, async ({ page }) => {
      await openLab(page, "取舍台", tier);

      await allVisibleAndInside(
        page,
        activity(page).locator(".play-weigh__option-card"),
        "选项说明",
        options,
      );
      await allVisibleAndInside(
        page,
        activity(page).locator(".play-weigh__choice"),
        "可点的选项按钮",
        options,
      );

      /*
        The counter is the only place the reader can see how much is left, and
        it is exactly the thing that lied in the defect this file is named for:
        a board saying 「已接 2 条」 while needing three.
      */
      await expect(activity(page).locator(".play-weigh__progress")).toContainText(
        `共 ${situations} 种`,
      );
      await noSidewaysScroll(page);
    });
  }

  test("挑战档走到底：每一步都说得出另外两个选择各自的代价", async ({ page }) => {
    await openLab(page, "取舍台", "挑战");
    const board = activity(page);

    for (let step = 0; step < 6; step += 1) {
      await expect(board.locator(".play-weigh__progress")).toContainText(`第 ${step + 1} 种`);
      const buttons = board.locator(".play-weigh__choice");
      // Try each option until one is accepted; a miss must not consume a turn.
      for (let pick = 0; pick < 3; pick += 1) {
        await buttons.nth(pick).click();
        if ((await board.locator(".play-weigh__settled-row").count()) > step) break;
      }
      /*
        Three options mean two losing choices, so a settled row owes the reader
        two priced lines. One line was the original shape of this field and it
        could not say which choice it was pricing.
      */
      await expect(
        board.locator(".play-weigh__settled-row").nth(step).locator(".play-weigh__cost"),
      ).toHaveCount(2);
    }

    await expect(board.locator(".play-weigh__flip")).toBeVisible();
    // Every option won something — that is the board's own claim, printed back.
    await allVisibleAndInside(page, board.locator(".play-weigh__done li"), "结尾的翻面清单", 3);
    await expect(board.locator('[data-result="completed"]')).toBeVisible();
    await noSidewaysScroll(page);
    await shot(page, "weigh-challenge-complete");
  });

  test("手机上三个选项都够得着", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await openLab(page, "取舍台", "挑战");

    await allVisibleAndInside(
      page,
      activity(page).locator(".play-weigh__choice"),
      "手机上的选项按钮",
      3,
    );
    // A control smaller than this is one a thumb misses.
    for (const button of await activity(page).locator(".play-weigh__choice").all()) {
      const box = await button.boundingBox();
      expect(box!.height, "选项按钮在手机上矮于 44px").toBeGreaterThanOrEqual(44);
    }
    await noSidewaysScroll(page);
    await shot(page, "weigh-phone-challenge");
  });
});

/*
  The shelf itself. This page exists to say 「every game is here, pick one」, so
  a game that is on the shelf but off the screen is the page failing at its only
  job — and it fails silently, because the other seven render.

  It happened as soon as the shelf reached eight: the row was a horizontal
  scroller sized for five, and the last two sat past the right edge with no
  scrollbar and nothing to suggest they existed. Counting buttons would not have
  caught it; they were all in the DOM.
*/
test.describe("试玩页的玩法入口，一个都不能藏", () => {
  for (const [name, size] of [
    ["桌面", { width: 1280, height: 720 }],
    ["窄桌面", { width: 900, height: 720 }],
    ["手机", PHONE],
  ] as const) {
    test(`${name}：八种玩法全部在屏幕里，不靠横向滚动`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(`${ONLINE_ORIGIN}/play-lab`, { waitUntil: "domcontentloaded" });
      const shelf = page.getByRole("navigation", { name: "挑一种互动课件" });
      const buttons = shelf.getByRole("button");
      await expect(buttons).toHaveCount(8);

      const shelfBox = (await shelf.boundingBox())!;
      for (let index = 0; index < 8; index += 1) {
        const button = buttons.nth(index);
        await expect(button, `第 ${index + 1} 个玩法入口没显示`).toBeVisible();
        const box = (await button.boundingBox())!;
        expect(
          box.x + box.width,
          `第 ${index + 1} 个玩法入口伸出了这一行的右边`,
        ).toBeLessThanOrEqual(shelfBox.x + shelfBox.width + 1);
      }

      // And the row itself must not be hiding anything behind a scroll.
      const hidden = await shelf.evaluate((node) => node.scrollWidth - node.clientWidth);
      expect(hidden, "玩法入口那一行还在横向滚动，说明有入口被藏起来了").toBeLessThanOrEqual(1);
      await noSidewaysScroll(page);
      await shot(page, `shelf-${size.width}`);
    });
  }
});
