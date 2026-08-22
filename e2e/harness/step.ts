import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { test, type Page } from "@playwright/test";

const ARTIFACTS = fileURLToPath(new URL("../../SCRATCH/e2e", import.meta.url));

function slug(name: string): string {
  return name
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "step";
}

/**
 * A named step whose failure says where we were, not just "timeout".
 *
 * The screenshot path is the third thing a person needs after the step name
 * and the URL; Playwright's default output does not put those three together.
 */
export async function namedStep(page: Page, name: string, run: () => Promise<void>): Promise<void> {
  await test.step(name, async () => {
    try {
      await run();
    } catch (error) {
      mkdirSync(ARTIFACTS, { recursive: true });
      const shot = join(ARTIFACTS, `${slug(name)}-${Date.now()}.png`);
      try {
        await page.screenshot({ path: shot, fullPage: true });
      } catch {
        // A closed page still deserves the URL in the message.
      }
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`走到「${name}」失败\n当时 URL: ${page.url()}\n截图: ${shot}\n${reason}`);
    }
  });
}
