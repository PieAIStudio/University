import { expect, type Locator, type Page } from "@playwright/test";
import { humanClick } from "./click.js";

/** Drive the actual input shape. Never fill a hidden textarea behind a choice UI. */
export async function enterExerciseAnswer(page: Page, panel: Locator, answer: string) {
  await expect(panel).toBeVisible();
  if (await panel.locator("[data-exercise-option]").count()) {
    await humanClick(
      page,
      panel.locator(`[data-exercise-option="${answer}"]`),
      "choose the actual exercise option",
    );
  } else {
    await panel.locator("textarea").fill(answer);
  }
}

export async function expectExerciseAnswer(panel: Locator, answer: string) {
  await expect(panel).toBeVisible();
  if (await panel.locator("[data-exercise-option]").count())
    await expect(panel.locator(`[data-exercise-option="${answer}"]`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  else await expect(panel.locator("textarea")).toHaveValue(answer);
}
