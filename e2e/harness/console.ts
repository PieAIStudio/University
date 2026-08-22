import type { Page } from "@playwright/test";

/**
 * Page-level errors a learner would see. Vite chatter and the occasional
 * ResizeObserver loop are not those.
 */
function ignorable(text: string): boolean {
  if (/\[vite\]/i.test(text)) return true;
  if (/Download the React DevTools/i.test(text)) return true;
  if (/ResizeObserver loop/i.test(text)) return true;
  if (/favicon/i.test(text)) return true;
  if (/apple-touch-icon/i.test(text)) return true;
  if (/Failed to load resource: the server responded with a status of 404/i.test(text)) {
    // Chrome omits the URL. The response listener below keeps the real 404s.
    return true;
  }
  return false;
}

function ignorableUrl(url: string): boolean {
  return /favicon|apple-touch-icon|\.map(?:\?|$)/i.test(url);
}

export function watchConsole(page: Page): { assertClean: () => void; errors: () => readonly string[] } {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    const text = error.stack ?? error.message;
    if (!ignorable(text)) errors.push(text);
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (!ignorable(text)) errors.push(text);
  });
  page.on("response", (response) => {
    if (response.status() !== 404) return;
    const url = response.url();
    if (ignorableUrl(url)) return;
    errors.push(`404 ${url}`);
  });
  return {
    errors: () => errors,
    assertClean() {
      if (errors.length === 0) return;
      throw new Error(`console 出现 error:\n${errors.map((line) => `  · ${line}`).join("\n")}`);
    },
  };
}
