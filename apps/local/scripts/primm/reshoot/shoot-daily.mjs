/**
 * Re-shoot the two lesson screenshots against the commit the lesson is pinned
 * to, not against whatever the project happens to be today.
 *
 * Deterministic on purpose: fixed viewport, fixed locale, no manual pointing.
 * The annotated variant draws its boxes from the live layout rather than from
 * an image editor, so the callouts land wherever the elements actually are and
 * a later re-shoot cannot silently disagree with the picture underneath.
 */
// `@playwright/test` re-exports the driver; the bare `playwright` package is
// not a direct dependency of the studied project.
import { chromium } from "@playwright/test";

const OUT = process.argv[2];
if (!OUT) throw new Error("usage: shoot.mjs <output-dir>");

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  locale: "en-US",
  deviceScaleFactor: 2,
});

await page.goto("http://localhost:5188/daily", { waitUntil: "networkidle" });
await page.waitForSelector(".tp-daily-choice");

// Pick the first candidate and let the result panel settle. Which alias that
// is depends on the date — the puzzle rotates — so nothing downstream may name
// it; the lesson caption speaks about regions, not about who was chosen.
await page.locator(".tp-daily-choice").first().click();
await page.waitForTimeout(1200);
await page.evaluate(() => {
  document.querySelector(".tp-daily-case")?.scrollTo(0, 0);
  window.scrollTo(0, 0);
});
await page.waitForTimeout(400);

await page.screenshot({ path: `${OUT}/daily-result.png` });

/*
  The annotated pass. Three regions, because the lesson teaches exactly three:
  where the conversation is, where the verdict is, and where the choices are.
  Boxes are positioned from `getBoundingClientRect`, so they are measured, not
  drawn by eye.
*/
const regions = await page.evaluate(() => {
  /*
    Measured from the studied project's own class names, not guessed by
    substring. An earlier pass matched `[class*="forensic"]` and framed the
    transcript's hint line instead of the verdict — a callout that teaches the
    wrong location is worse than none.

    The verdict has no element of its own inside the viewport: `.tp-daily-
    result-card` sits below the fold at y=914, while what the reader sees is
    the head of the suspects column. So region 2 is that column down to where
    the choices begin — derived from two real rects rather than hard-coded.
  */
  const rect = (selector) => {
    const element = document.querySelector(selector);
    return element ? element.getBoundingClientRect() : null;
  };
  const transcript = rect(".tp-daily-transcript");
  const column = rect(".tp-daily-suspects");
  const choices = rect(".tp-daily-choice-grid");
  const boxes = [];
  const push = (label, top, left, width, height) => {
    if (width > 0 && height > 0) {
      boxes.push({ label, top: top + scrollY, left: left + scrollX, width, height });
    }
  };
  if (transcript) {
    push("1 对话区", transcript.top, transcript.left, transcript.width, transcript.height);
  }
  if (column && choices) {
    push("2 结果状态", column.top, column.left, column.width, choices.top - column.top - 6);
  }
  if (choices) push("3 候选人按钮", choices.top, choices.left, choices.width, choices.height);
  return boxes;
});

await page.evaluate((boxes) => {
  const layer = document.createElement("div");
  layer.style.cssText =
    "position:absolute;inset:0;z-index:99999;pointer-events:none;font:600 15px/1.2 system-ui";
  for (const region of boxes) {
    const frame = document.createElement("div");
    frame.style.cssText = `position:absolute;top:${region.top}px;left:${region.left}px;width:${region.width}px;height:${region.height}px;border:3px solid #e5484d;border-radius:10px;box-shadow:0 0 0 3px rgb(229 72 77 / 22%)`;
    const tag = document.createElement("span");
    tag.textContent = region.label;
    tag.style.cssText =
      "position:absolute;top:-13px;left:10px;background:#e5484d;color:#fff;padding:2px 9px;border-radius:6px;white-space:nowrap";
    frame.append(tag);
    layer.append(frame);
  }
  document.body.append(layer);
}, regions);

await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/daily-result-annotated.png` });

console.log(JSON.stringify({ regions: regions.map((r) => r.label) }));
await browser.close();
