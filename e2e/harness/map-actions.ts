import { expect, type Locator, type Page } from "@playwright/test";

import { humanClick } from "./click.js";

/** The map has one keyboard entry point; keep the real focus contract shared. */
export async function openMapQuickActions(page: Page): Promise<Locator> {
  const surface = page.locator('[data-map-surface="true"]:visible').first();
  await expect(surface, "可见地图表面必须存在").toBeVisible();
  await surface.focus();
  await expect(surface, "快捷操作必须从真实地图焦点打开").toBeFocused();
  await page.keyboard.press("Space");
  const palette = page.locator(".map-quick-actions:visible");
  await expect(palette).toBeVisible();
  return palette;
}

/** Invoke a command through the visible UIKit palette, not a private map handle. */
export async function runMapCommand(page: Page, command: string): Promise<void> {
  const palette = await openMapQuickActions(page);
  const control = palette.locator(`[data-map-command=${JSON.stringify(command)}]`);
  await expect(control, `地图快捷操作缺少 ${command}`).toBeVisible();
  await humanClick(page, control, `地图快捷操作：${command}`);
  await expect(palette).toBeHidden();
}

/** Open the on-demand directory from the same keyboard palette. */
export async function openMapDirectory(page: Page): Promise<Locator> {
  const palette = await openMapQuickActions(page);
  const directory = palette.locator('[data-map-command="directory"]');
  await expect(directory).toBeVisible();
  await humanClick(page, directory, "地图目录");
  await expect(palette.locator("[data-map-destination]").first()).toBeVisible();
  return palette;
}

/**
 * Open the palette's route page, where the course panel lives.
 *
 * The map keeps no persistent chrome, so the course panel is a page of the
 * on-demand palette rather than a fixture on the map. Unlike a command that
 * navigates away, this one switches the open palette's page, so the palette
 * stays visible and the helper is safe to call again.
 */
export async function openMapRoutePage(page: Page): Promise<Locator> {
  const open = page.locator(".map-quick-actions:visible");
  const wasOpen = (await open.count()) > 0;
  const palette = wasOpen ? open : await openMapQuickActions(page);
  const routePage = palette.locator(".map-quick-actions__route");
  // Opening the palette resets it to its commands page, so a route page that
  // still looks visible in that first frame belongs to the previous visit and is
  // about to be hidden. Only a palette that was already open can be believed.
  if (wasOpen && (await routePage.isVisible())) return palette;
  const route = palette.locator('[data-map-command="route"]');
  // Wait for the entry rather than skipping when it is not there yet: the slot
  // only exists once the course itself has loaded, which the authoring mode
  // fetches from the local server, so an early look finds a palette without it.
  await expect(route, "快捷面板没有路线页入口：课程可能还没加载完").toBeVisible();
  await humanClick(page, route, "地图路线页");
  await expect(routePage).toBeVisible();
  return palette;
}

/** Select an actual directory destination; the helper deliberately does not Enter for it. */
export async function selectMapDestination(page: Page, id: string): Promise<void> {
  const palette = await openMapDirectory(page);
  const destination = palette.locator(`[data-map-destination=${JSON.stringify(id)}]`);
  await expect(destination).toBeVisible();
  await humanClick(page, destination, `地图目录目标：${id}`);
  await expect(palette).toBeHidden();
}

/** One shared locator for planet, island and lesson entry actions. */
export function mapEntryButton(page: Page): Locator {
  return page
    .locator('[data-map-entry="true"] button:visible, button[data-map-entry="true"]:visible')
    .first();
}

export async function enterSelectedMapObject(page: Page, label: string): Promise<void> {
  const entry = mapEntryButton(page);
  await expect(entry, `${label} 必须有对象旁进入按钮`).toBeVisible();
  // The entry button is bound to its object and reprojects every frame with no
  // follow delay, so it genuinely moves while the camera eases to the choice.
  // A learner presses it after it arrives; wait for the same thing rather than
  // racing the ease. A button that never settles still fails, and loudly.
  await entry.evaluate(async (element) => {
    let previous = "",
      streak = 0;
    for (let frame = 0; frame < 240; frame++) {
      await new Promise(requestAnimationFrame);
      const box = element.getBoundingClientRect();
      const next = `${Math.round(box.x * 10)}:${Math.round(box.y * 10)}`;
      streak = next === previous ? streak + 1 : 0;
      previous = next;
      if (streak >= 5) return;
    }
    throw new Error("The object-bound entry button never stopped moving");
  });
  await humanClick(page, entry, label);
}

/** Navigate an actual ancestor link from the shared map breadcrumb trail. */
export async function navigateMapBreadcrumb(page: Page, href: string): Promise<void> {
  let link = page.locator(`nav.map-breadcrumbs a[href=${JSON.stringify(href)}]:visible`).first();
  if (!(await link.isVisible())) {
    await page.locator("nav.map-breadcrumbs details > summary").click();
    link = page
      .locator(`nav.map-breadcrumbs details a[href=${JSON.stringify(href)}]:visible`)
      .first();
  }
  await expect(link, `地图面包屑缺少 ${href}`).toBeVisible();
  // Authoring may replace the placeholder crumb after loading its title.
  // Playwright's real native click re-resolves this locator across that render.
  await link.click();
}
