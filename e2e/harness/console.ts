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

export function watchConsole(
  page: Page,
  options: {
    /** Each entry accepts one deliberately fulfilled resource error, never a blanket exemption. */
    expectedHttpErrors?: readonly {
      status: number;
      matchesUrl: (url: string) => boolean;
    }[];
  } = {},
): {
  assertClean: () => void;
  errors: () => readonly string[];
} {
  const errors: string[] = [];
  const expectedHttpErrors = (options.expectedHttpErrors ?? []).map((expected) => ({
    ...expected,
    consumed: false,
  }));
  page.on("pageerror", (error) => {
    const text = error.stack ?? error.message;
    if (!ignorable(text)) errors.push(text);
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    // Chrome emits a console error for an intentionally rejected sign-in.
    // Match both the browser's resource message AND the exact intercepted URL;
    // never silence other 400s, JavaScript exceptions or missing app assets.
    const resourceStatus =
      /^Failed to load resource: the server responded with a status of (\d{3})\b/u.exec(text);
    const expected =
      resourceStatus &&
      expectedHttpErrors.find(
        (candidate) =>
          !candidate.consumed &&
          candidate.status === Number(resourceStatus[1]) &&
          candidate.matchesUrl(message.location().url),
      );
    if (expected) {
      expected.consumed = true;
      return;
    }
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
