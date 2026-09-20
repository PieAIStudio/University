import { expect, type Locator, type Page } from "@playwright/test";
import { waitForStableBox } from "./click.js";

/** The same real-pointer protocol as humanClick, across an opaque iframe. */
export async function prototypeClick(page: Page, target: Locator): Promise<void> {
  await target.waitFor({ state: "visible" });
  await target.scrollIntoViewIfNeeded();
  await waitForStableBox(target);
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  // A parent autoscroll can settle before Chrome forwards input to its child
  // surface. Move the pointer before pressing, just as a person does. Never
  // dispatch DOM clicks or force through a covering element.
  await page.mouse.move(x - Math.min(8, box!.width / 4), y);
  await page.mouse.move(x, y, { steps: 8 });
  // Child-frame hover confirms that the browser has forwarded the pointer,
  // not just that both DOM trees think the coordinates are correct.
  await expect.poll(() => target.evaluate((node) => node.matches(":hover"))).toBe(true);
  expect(
    await target.evaluate((node) => {
      const r = node.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return top === node || (top !== null && node.contains(top));
    }),
  ).toBe(true);
  expect(
    await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName === "IFRAME", {
      x,
      y,
    }),
  ).toBe(true);
  await page.mouse.down();
  await page.waitForTimeout(40);
  await page.mouse.up();
}
