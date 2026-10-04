import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "./harness/learner-test.js";

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

test.describe("试玩页的玩法入口，一个都不能藏", () => {
  for (const [name, size] of [
    ["桌面", { width: 1280, height: 720 }],
    ["窄桌面", { width: 900, height: 720 }],
    ["手机", PHONE],
  ] as const) {
    test(`${name}：三种保留玩法全部在屏幕里，不靠横向滚动`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(`${ONLINE_ORIGIN}/play-lab`, { waitUntil: "domcontentloaded" });
      const shelf = page.getByRole("navigation", { name: "挑一种互动课件" });
      const buttons = shelf.getByRole("button");
      await expect(buttons).toHaveCount(3);

      const shelfBox = (await shelf.boundingBox())!;
      for (let index = 0; index < 3; index += 1) {
        const button = buttons.nth(index);
        await expect(button, `第 ${index + 1} 个玩法入口没显示`).toBeVisible();
        const box = (await button.boundingBox())!;
        expect(
          box.x + box.width,
          `第 ${index + 1} 个玩法入口伸出了这一行的右边`,
        ).toBeLessThanOrEqual(shelfBox.x + shelfBox.width + 1);
      }

      const hidden = await shelf.evaluate((node) => node.scrollWidth - node.clientWidth);
      expect(hidden, "玩法入口那一行还在横向滚动，说明有入口被藏起来了").toBeLessThanOrEqual(1);
      await noSidewaysScroll(page);
      await shot(page, `shelf-${size.width}`);
    });
  }
});

/*
  The same question asked of the retained shelf, without needing each
  payload's numbers: every control a board puts on the screen must be visible,
  have a real size, be the thing under its own centre point, and — on a phone —
  be big enough for a thumb.
*/
const FOUNDATION = ["接线台", "归类台", "调参实验室"] as const;

interface Reachability {
  readonly zeroSized: readonly string[];
  readonly covered: readonly { readonly text: string; readonly by: string }[];
  readonly tooSmall: readonly { readonly text: string; readonly height: number }[];
  readonly overflowing: readonly string[];
}

async function sweep(page: Page, phone: boolean): Promise<Reachability> {
  return page.evaluate(async (isPhone) => {
    const settle = () => new Promise((done) => requestAnimationFrame(() => done(null)));
    const board = document.querySelector(".learning-activity");
    const zeroSized: string[] = [];
    const covered: { text: string; by: string }[] = [];
    const tooSmall: { text: string; height: number }[] = [];
    const overflowing: string[] = [];
    if (!board) return { zeroSized, covered, tooSmall, overflowing };
    const boardBox = board.getBoundingClientRect();
    const name = (node: Element) => (node.textContent ?? "").trim().slice(0, 40) || node.tagName;

    for (const node of board.querySelectorAll(
      'button, input, select, textarea, [role="button"], summary',
    )) {
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (box.width === 0 || box.height === 0) {
        zeroSized.push(name(node));
        continue;
      }
      // Anything reaching past the board's own right edge is content the reader
      // has to find rather than read.
      if (box.right > boardBox.right + 1) overflowing.push(name(node));
      // Round before comparing. A control that CSS holds at 44px can measure
      // 43.99996948 through getBoundingClientRect once a fractional layout
      // position is involved, and three ten-thousandths of a pixel is not a
      // thumb missing its target. A real violation is 34 against 44, which
      // rounding leaves exactly as red as it was.
      if (isPhone && Math.round(box.height) < 44)
        tooSmall.push({ text: name(node), height: box.height });

      // Put it in the middle of the screen and ask there. A control the reader
      // can scroll clear of the bottom bar is a control the reader can reach.
      node.scrollIntoView({ block: "center", behavior: "instant" });
      await settle();
      const settledBox = node.getBoundingClientRect();
      const cx = settledBox.x + settledBox.width / 2;
      const cy = settledBox.y + settledBox.height / 2;
      if (cy < 0 || cy > window.innerHeight || cx < 0 || cx > window.innerWidth) continue;
      const hit = document.elementFromPoint(cx, cy);
      if (!hit) {
        covered.push({ text: name(node), by: "(nothing)" });
        continue;
      }
      if (!node.contains(hit) && !hit.contains(node)) {
        covered.push({ text: name(node), by: `${hit.tagName}.${hit.className}` });
      }
    }
    return { zeroSized, covered, tooSmall, overflowing };
  }, phone);
}

for (const [where, phone] of [
  ["桌面", false],
  ["手机", true],
] as const) {
  test.describe(`${where}：保留玩法的每个控件都够得着`, () => {
    for (const mode of FOUNDATION) {
      for (const tier of ["入门", "进阶", "挑战"] as const) {
        test(`${mode} · ${tier}`, async ({ page }) => {
          if (phone) await page.setViewportSize(PHONE);
          await openLab(page, mode, tier);
          const found = await sweep(page, phone);

          expect(found.zeroSized, `${mode}/${tier}：这些控件宽或高是 0`).toEqual([]);
          expect(found.covered, `${mode}/${tier}：这些控件被别的元素盖住了`).toEqual([]);
          expect(found.overflowing, `${mode}/${tier}：这些控件伸到了活动区右边外面`).toEqual([]);
          /*
            DESIGN.md asks for 44px on a phone and nothing was holding it: the
            shell controls are all measured here rather than trusting one
            representative activity, so a regression in any retained mode is
            visible in the same report.
          */
          if (phone) {
            expect(found.tooSmall, `${mode}/${tier}：手机上这些控件矮于 44px`).toEqual([]);
          }
          await noSidewaysScroll(page);
        });
      }
    }
  });
}
