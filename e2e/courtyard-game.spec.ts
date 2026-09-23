import { expect, test, type Page } from "@playwright/test";

import { ONLINE_ORIGIN } from "./ports.js";

/**
 * 庭院拦截 (ADR-0011): the first game assembled from the kit, in the play lab.
 * Content comes from the first course's lessons; the learner's avatar is the
 * hero; everything the game shows lives inside one frame.
 */
interface Live {
  state: {
    phase: string;
    run: { hearts: number; score: number };
    boats: { id: number; itemId: string; state: string; targeted: boolean; progress: number }[];
    notice: { kind: string; reason: string } | null;
  };
  round: { bins: { id: string }[]; items: { id: string; binId: string; why: string }[] } | null;
}

const live = (page: Page) => page.evaluate(() => Reflect.get(window, "__intercept")() as Live);

async function startFirstRound(page: Page) {
  await page.goto(`${ONLINE_ORIGIN}/play-lab/toy-3d?game=courtyard&lang=zh-CN`);
  await page.getByTestId("game-start").click({ timeout: 120_000 });
  await page.getByTestId("game-ready").click();
  await expect
    .poll(async () => (await live(page)).state.phase, { timeout: 30_000 })
    .toBe("playing");
}

/** The answer index for the boat a throw would take now, once it is readable. */
async function nextBoat(page: Page) {
  let pick: { boatId: number; right: number; wrong: number; why: string } | null = null;
  await expect
    .poll(
      async () => {
        const { state, round } = await live(page);
        const boat = state.boats
          .filter((b) => b.state === "sailing" && !b.targeted)
          .sort((a, b) => b.progress - a.progress)[0];
        if (!boat || !round || boat.progress < 0.05) return false;
        const item = round.items.find((candidate) => candidate.id === boat.itemId)!;
        const right = round.bins.findIndex((bin) => bin.id === item.binId);
        pick = { boatId: boat.id, right, wrong: right === 0 ? 1 : 0, why: item.why };
        return true;
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  return pick!;
}

test("delivery courtyard game: one frame, the lesson's verdict, a heart for a wrong throw", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await startFirstRound(page);
  const frame = page.getByTestId("game-frame");

  // Hearts, progress, score, the question and the answers are all inside the frame.
  const box = (await frame.boundingBox())!;
  for (const part of [
    frame.locator(".game-frame__hearts"),
    frame.locator(".game-frame__score"),
    page.getByTestId("game-question"),
    page.getByTestId("game-answer-0"),
    page.getByTestId("game-answer-1"),
  ]) {
    const inner = (await part.boundingBox())!;
    expect(inner.x).toBeGreaterThanOrEqual(box.x);
    expect(inner.y).toBeGreaterThanOrEqual(box.y);
    expect(inner.x + inner.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
    expect(inner.y + inner.height).toBeLessThanOrEqual(box.y + box.height + 0.5);
  }

  // The hero is the learner's avatar, standing in the scene.
  expect(
    await page.evaluate(() =>
      Boolean(Reflect.get(window, "three")?.scene.getObjectByName("game-hero")),
    ),
  ).toBe(true);

  // A right throw scores and the note lands in the right basket.
  const first = await nextBoat(page);
  await page.getByTestId(`game-answer-${first.right}`).click();
  await expect
    .poll(async () => (await live(page)).state.run.score, { timeout: 15_000 })
    .toBeGreaterThan(0);

  // A wrong throw costs a heart and says the lesson's own reason.
  const hearts = (await live(page)).state.run.hearts;
  const second = await nextBoat(page);
  await page.getByTestId(`game-answer-${second.wrong}`).click();
  await expect
    .poll(async () => (await live(page)).state.run.hearts, { timeout: 15_000 })
    .toBe(hearts - 1);
  const notice = frame.locator(".game-frame__notice");
  await expect(notice).toBeVisible();
  const reason = (await live(page)).state.notice!.reason;
  await expect(notice).toContainText(reason);
});

test("delivery courtyard game: phone answers are reachable and uncovered", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await startFirstRound(page);
    for (const id of ["game-answer-0", "game-answer-1"]) {
      const button = page.getByTestId(id);
      await button.scrollIntoViewIfNeeded();
      const b = (await button.boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(44);
      // Nothing — the floating feedback pill included — sits on top of an answer.
      const hit = await page.evaluate(
        ({ x, y, testId }) =>
          Boolean(document.elementFromPoint(x, y)?.closest(`[data-testid="${testId}"]`)),
        { x: b.x + b.width - 12, y: b.y + b.height / 2, testId: id },
      );
      expect(hit, `${id} is covered at its right edge`).toBe(true);
    }
    const boat = await nextBoat(page);
    await page.getByTestId(`game-answer-${boat.right}`).tap();
    await expect
      .poll(async () => (await live(page)).state.run.score, { timeout: 15_000 })
      .toBeGreaterThan(0);
  } finally {
    await context.close();
  }
});
