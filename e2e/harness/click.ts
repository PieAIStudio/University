import type { Locator, Page } from "@playwright/test";

type Hit = { readonly hittable: boolean; readonly describe: string };

export interface HumanClickOptions {
  readonly beforePress?: () => void | Promise<void>;
}

/**
 * A real pointer, not `element.click()`.
 *
 * This repo has shipped twice with a control that `element.click()` could
 * fire and a human pointer could not: the overlay sat in the hit-test tree
 * while looking invisible. The test has to sample `elementsFromPoint` at the
 * element's screen position and then dispatch the mouse sequence a hand
 * would. See docs/reference/learnings/workflow-issues/.
 */
export async function humanClick(
  page: Page,
  target: Locator,
  label: string,
  options?: HumanClickOptions,
): Promise<void> {
  await target.waitFor({ state: "visible" });
  await target.scrollIntoViewIfNeeded();
  let lastStack = "空";

  for (let attempt = 0; attempt < 8; attempt += 1) {
    await waitForStableBox(target);
    const box = await target.boundingBox();
    if (!box || box.width < 2 || box.height < 2) {
      await page.waitForTimeout(120);
      continue;
    }
    const handle = await target.elementHandle();
    if (!handle) {
      await page.waitForTimeout(120);
      continue;
    }

    const candidates = [
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      { x: box.x + Math.min(12, box.width / 3), y: box.y + box.height / 2 },
      { x: box.x + box.width - Math.min(12, box.width / 3), y: box.y + box.height / 2 },
    ];

    let chosen: { x: number; y: number } | null = null;
    for (const point of candidates) {
      const hit = await hitTest(page, handle, point);
      lastStack = hit.describe;
      if (hit.hittable) {
        chosen = point;
        break;
      }
    }
    await handle.dispose();
    if (!chosen) {
      await page.waitForTimeout(150);
      continue;
    }

    await page.mouse.move(chosen.x, chosen.y);
    await page.waitForTimeout(40);
    await options?.beforePress?.();
    await page.mouse.down({ button: "left" });
    await page.waitForTimeout(40);
    await page.mouse.up({ button: "left" });
    return;
  }

  throw new Error(
    `${label}: 真人指针点不中（element.click() 会在这里撒谎）。elementsFromPoint: ${lastStack}`,
  );
}

async function hitTest(
  page: Page,
  element: NonNullable<Awaited<ReturnType<Locator["elementHandle"]>>>,
  point: { x: number; y: number },
): Promise<Hit> {
  return page.evaluate(
    ({ x, y, node }) => {
      const stack = document.elementsFromPoint(x, y);
      const top = stack[0];
      const hittable = Boolean(top && (node === top || node.contains(top)));
      const describe = stack.slice(0, 6).map((entry) => {
        const el = entry as HTMLElement;
        const cls =
          typeof el.className === "string"
            ? el.className.trim().split(/\s+/).slice(0, 3).join(".")
            : "";
        return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${cls ? `.${cls}` : ""}`;
      });
      return { hittable, describe: describe.join(" → ") || "空" };
    },
    { x: point.x, y: point.y, node: element },
  );
}

/** Path labels drift while the camera flies. Clicking a moving box is a miss. */
export async function waitForStableBox(target: Locator): Promise<void> {
  let previous = await target.boundingBox();
  for (let i = 0; i < 20; i += 1) {
    await target.page().waitForTimeout(80);
    const next = await target.boundingBox();
    if (previous && next && Math.hypot(previous.x - next.x, previous.y - next.y) < 1.5) return;
    previous = next;
  }
}
