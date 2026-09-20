import type { Locator, Page } from "@playwright/test";

type Hit = { readonly hittable: boolean; readonly describe: string };

export interface HumanClickOptions {
  readonly beforePress?: () => void | Promise<void>;
}

/**
 * Scroll a target into view without Playwright's stability precondition.
 *
 * `locator.scrollIntoViewIfNeeded()` waits for two consecutive animation
 * frames whose bounding boxes are bit-identical. Two kinds of element in this
 * product never supply that: a control bound to a map object reprojects every
 * frame and keeps a sub-pixel jitter after it has arrived, and a lesson reader
 * is replaced wholesale when progress is adopted into its account scope. The
 * wait then ends in `Element is not attached to the DOM` — twice now, each
 * time as a single red in a 40-minute push run that passed when re-run alone
 * (`humanClick`, 2026-09-20; the English image audit, 2026-09-21).
 *
 * This keeps everything that call was there for — it waits for the target to
 * be visible, `block: "nearest"` keeps the original "only if needed" scrolling,
 * and it still returns only once the box has settled, because callers measure
 * geometry on the next line. What changes is how settling is judged: this
 * project's own tolerant check rather than bit-equality.
 *
 * Returning before the scroll had landed was a real regression, not a
 * theoretical one: `primm.spec.ts` captures a baseline box immediately after
 * this call and asserts a late-loading photo moves it by no more than 1px. A
 * first version of this helper skipped the settle and measured 1.79px of the
 * scroll itself.
 */
export async function scrollIntoView(target: Locator): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await target.waitFor({ state: "visible" });
    try {
      await target.evaluate((element) =>
        element.scrollIntoView({ block: "nearest", inline: "nearest" }),
      );
    } catch (error) {
      if (!(error instanceof Error) || !/not attached to the DOM/i.test(error.message)) throw error;
      continue;
    }
    await waitForStableBox(target);
    return;
  }
  throw new Error("滚动目标反复在对齐时被重新挂载，界面没有停下来");
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
  let lastStack = "空";

  for (let attempt = 0; attempt < 8; attempt += 1) {
    // A settled screen may replace a control while progress is adopted into
    // its new account scope. The locator owns the current control, not the
    // retired node or its old scroll position. Nothing has been pressed yet.
    // This project's own settle checks are deliberately tolerant of sub-pixel
    // drift — 0.1px over five frames in `enterSelectedMapObject`, 1.5px in
    // `waitForStableBox` below — so the alignment above must be too.
    await scrollIntoView(target);
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
    if (!chosen) {
      await handle.dispose();
      await page.waitForTimeout(150);
      continue;
    }

    await page.mouse.move(chosen.x, chosen.y);
    await page.waitForTimeout(40);
    // Hover, scroll and a finishing layout transition may move a previously
    // hittable target. Follow it before pressing, like a real hand; never
    // retry an already-dispatched click or force through an overlay.
    await waitForStableBox(target);
    const afterHover = await hitTest(page, handle, chosen);
    lastStack = afterHover.describe;
    await handle.dispose();
    if (!afterHover.hittable) continue;
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
