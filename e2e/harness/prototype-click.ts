import type { Locator, Page } from "@playwright/test";
import { scrollIntoView, waitForStableBox } from "./click.js";

/** The same real-pointer protocol as humanClick, across an opaque iframe. */
export async function prototypeClick(page: Page, target: Locator): Promise<void> {
  await target.waitFor({ state: "visible" });
  // Like humanClick, retarget only BEFORE pressing. A hover or the enclosing
  // page's final layout may move the child: polling the old point forever
  // cannot forward a pointer that is no longer over its target.
  // Say which surface refused last, not only that one did.
  let last = "no attempt";
  for (let attempt = 0; attempt < 8; attempt++) {
    await scrollIntoView(target);
    await waitForStableBox(target);
    const handle = await target.elementHandle();
    const frame = await handle?.ownerFrame();
    const frameElement = await frame?.frameElement();
    try {
      const box = await handle?.boundingBox();
      if (!box || !handle || !frameElement) {
        last = "no box";
        continue;
      }
      const x = box.x + box.width / 2,
        y = box.y + box.height / 2;
      const parentHit = () =>
        page.evaluate(
          ({ element, x, y }) => element.isConnected && document.elementFromPoint(x, y) === element,
          { element: frameElement, x, y },
        );
      if (!(await parentHit())) {
        last = await page.evaluate(
          ({ x, y }) => {
            const top = document.elementFromPoint(x, y);
            return `parent point (${Math.round(x)}, ${Math.round(y)}) in ${innerWidth}x${innerHeight} hits ${top ? `${top.tagName}.${top.className}` : "nothing"}`;
          },
          { x, y },
        );
        continue;
      }
      await page.mouse.move(x - Math.min(8, box.width / 4), y);
      await page.mouse.move(x, y, { steps: 8 });
      await waitForStableBox(target);
      const current = await handle.boundingBox();
      if (
        !current ||
        x < current.x ||
        x > current.x + current.width ||
        y < current.y ||
        y > current.y + current.height
      ) {
        last = "target moved under the pointer";
        continue;
      }
      const childHit = await handle.evaluate((node) => {
        if (!node.isConnected || !node.matches(":hover") || node.matches(":disabled")) return false;
        const r = node.getBoundingClientRect();
        const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return top === node || (top !== null && node.contains(top));
      });
      if (!childHit || !(await parentHit())) {
        last = childHit ? "parent lost the point after hover" : "child not hovered or covered";
        continue;
      }
      await page.mouse.down();
      try {
        await page.waitForTimeout(40);
      } finally {
        await page.mouse.up();
      }
      return;
    } finally {
      await handle?.dispose();
      await frameElement?.dispose();
    }
  }
  throw new Error(
    `Prototype target is not reachable through its actual parent and child hit surfaces: ${last}`,
  );
}
