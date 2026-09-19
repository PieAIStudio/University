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
