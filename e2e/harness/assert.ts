import { expect, type Locator, type Page } from "@playwright/test";

import { averagePixels, colorDistance, decodePng } from "./png.js";

/** Visible prose, not a CSS class that a refactor will rename. */
export async function assertVisibleText(page: Page, text: string | RegExp): Promise<void> {
  await expect(page.getByText(text).first()).toBeVisible();
}

/**
 * Evidence screenshots used to overflow a 457px column because the shared
 * stylesheet never loaded. The number that matters is the painted right edge.
 */
export async function assertImagesStayInViewport(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const width = window.innerWidth;
    return [...document.images]
      .map((img) => {
        const box = img.getBoundingClientRect();
        if (box.width <= 0 || box.height <= 0) return null;
        if (box.right <= width + 1) return null;
        return {
          alt: img.alt,
          src: img.currentSrc || img.src,
          right: Math.round(box.right),
          width,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  });
  if (overflow.length > 0) {
    const lines = overflow.map((item) => `  · right=${item.right}px > ${item.width}px  ${item.alt || item.src}`);
    throw new Error(`图片冲出视口:\n${lines.join("\n")}`);
  }
}

/**
 * The grey-brick HUD: the panel existed, was "visible", and had text, but
 * every pixel was the colour of the WebGL canvas behind it.
 *
 * Sample the panel screenshot against the canvas screenshot. CSS computed
 * style cannot catch this; the compositor already lost.
 */
export async function assertPanelIsPainted(page: Page, panel: Locator, against: Locator, label: string): Promise<void> {
  await expect(panel).toBeVisible();
  const panelBox = await panel.boundingBox();
  const againstBox = await against.boundingBox();
  if (!panelBox || !againstBox) throw new Error(`${label}: 没有屏幕矩形`);

  const panelPng = decodePng(await panel.screenshot());
  const againstPng = decodePng(await against.screenshot());

  const panelSamples = [
    { x: panelPng.width * 0.5, y: panelPng.height * 0.35 },
    { x: panelPng.width * 0.25, y: panelPng.height * 0.55 },
    { x: panelPng.width * 0.75, y: panelPng.height * 0.55 },
    { x: panelPng.width * 0.5, y: panelPng.height * 0.75 },
  ];
  const againstSamples = [
    { x: againstPng.width * 0.5, y: againstPng.height * 0.5 },
    { x: againstPng.width * 0.3, y: againstPng.height * 0.4 },
    { x: againstPng.width * 0.7, y: againstPng.height * 0.6 },
  ];

  const panelColor = averagePixels(panelPng, panelSamples);
  const againstColor = averagePixels(againstPng, againstSamples);
  const distance = colorDistance(panelColor, againstColor);

  if (distance < 18) {
    throw new Error(
      `${label}: 面板像素 ${fmt(panelColor)} 和容器 ${fmt(againstColor)} 几乎一样（距离 ${distance.toFixed(1)}）。` +
        "这就是灰砖：元素在、字在，整块糊成了画布的颜色。",
    );
  }
}

function fmt(color: readonly [number, number, number, number]): string {
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}
