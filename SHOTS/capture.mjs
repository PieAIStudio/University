import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const OUT = new URL(".", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

async function humanClick(page, locator, label) {
  await locator.waitFor({ state: "visible", timeout: 20_000 });
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const box = await locator.boundingBox();
    if (!box || box.width < 2 || box.height < 2) {
      await page.waitForTimeout(120);
      continue;
    }
    const handle = await locator.elementHandle();
    if (!handle) {
      await page.waitForTimeout(120);
      continue;
    }
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const hittable = await page.evaluate(
      ({ x, y, node }) => {
        const stack = document.elementsFromPoint(x, y);
        const top = stack[0];
        return Boolean(top && (node === top || node.contains(top)));
      },
      { x, y, node: handle },
    );
    await handle.dispose();
    if (!hittable) {
      await page.waitForTimeout(150);
      continue;
    }
    await page.mouse.move(x, y);
    await page.waitForTimeout(40);
    await page.mouse.down({ button: "left" });
    await page.waitForTimeout(40);
    await page.mouse.up({ button: "left" });
    return;
  }
  throw new Error(`${label}: pointer missed`);
}

async function waitReady(page, origin) {
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.removeItem("app-shell.collapsed"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page
    .locator(".loading-trivia")
    .first()
    .waitFor({ state: "hidden", timeout: 90_000 })
    .catch(() => undefined);
  await page
    .locator(".loading-copy")
    .first()
    .waitFor({ state: "hidden", timeout: 30_000 })
    .catch(() => undefined);
  await page.locator("nav.nav-rail").waitFor({ state: "visible", timeout: 60_000 });
  await page
    .locator(".stagewrap canvas")
    .first()
    .waitFor({ state: "visible", timeout: 60_000 })
    .catch(() => undefined);
  await page.waitForTimeout(1500);
}

async function measureHint(page) {
  return page.evaluate(() => {
    const hint = document.querySelector(".hint");
    const rail = document.querySelector("nav.nav-rail");
    const counters = document.querySelector(".counter-row");
    const feedback = document.querySelector(
      "#app-shell-rail-footer button, .feedback-note__open--docked",
    );
    const collapseRail = document.querySelector(".nav-rail .app-shell__collapse--rail");
    const collapseAside = document.querySelector(".counter-row .app-shell__collapse--aside");
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const box = hint?.getBoundingClientRect();
    const hintCenter = box ? box.left + box.width / 2 : null;
    const dx = hintCenter == null ? null : hintCenter - viewport.width / 2;
    return {
      viewport,
      hint: box
        ? { left: box.left, width: box.width, bottom: viewport.height - box.bottom, center: hintCenter, dx }
        : null,
      hintText: hint?.textContent ?? null,
      railBox: rail?.getBoundingClientRect() ?? null,
      counterBox: counters?.getBoundingClientRect() ?? null,
      feedbackInFooter: Boolean(document.querySelector("#app-shell-rail-footer button")),
      feedbackText: feedback?.textContent ?? null,
      collapseInBrand: Boolean(collapseRail && collapseRail.closest(".nav-rail__brand")),
      collapseInCounters: Boolean(collapseAside && collapseAside.closest(".counter-row")),
      railCollapsed: document.querySelector(".app-shell")?.getAttribute("data-rail-collapsed"),
      asideCollapsed: document.querySelector(".app-shell")?.getAttribute("data-aside-collapsed"),
    };
  });
}

async function shoot(page, name) {
  const path = new URL(`./${name}.png`, import.meta.url).pathname;
  await page.screenshot({ path, fullPage: false });
  return path;
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const notes = [];

for (const shell of [
  { id: "online", origin: "http://127.0.0.1:9998/" },
  { id: "local", origin: "http://127.0.0.1:9999/" },
]) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 810 },
    locale: "zh-CN",
  });
  await waitReady(page, shell.origin);
  const expanded = await measureHint(page);
  await shoot(page, `${shell.id}-expanded`);
  notes.push({ shell: shell.id, state: "expanded", ...expanded });

  const railBtn = page.locator(".nav-rail .app-shell__collapse--rail");
  const asideBtn = page.locator(".counter-row .app-shell__collapse--aside");
  await humanClick(page, railBtn, `${shell.id} 收起导航`);
  if (await asideBtn.count()) {
    await humanClick(page, asideBtn, `${shell.id} 收起上下文`);
  }
  await page.waitForTimeout(400);
  const collapsed = await measureHint(page);
  await shoot(page, `${shell.id}-collapsed`);
  notes.push({ shell: shell.id, state: "collapsed", ...collapsed });
  await page.close();
}

writeFileSync(new URL("./metrics.json", import.meta.url), JSON.stringify(notes, null, 2));
console.log(JSON.stringify(notes, null, 2));
await browser.close();
