import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "./harness/learner-test.js";
import { mkdirSync } from "node:fs";
import { CONCEPT_HEADS } from "../packages/core/src/concepts/heads.js";
import { LOCAL_ORIGIN, ONLINE_ORIGIN } from "./ports.js";
import { humanClick } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";

const OUTPUT = "SCRATCH/e2e/knowledge-album";

test("isolated award readability: locked badge rules and the promotion stay legible in both themes", async ({
  page,
}) => {
  mkdirSync(OUTPUT, { recursive: true });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const findings: unknown[] = [];
  for (const theme of ["light", "night"]) {
    await page.goto(`${ONLINE_ORIGIN}/e2e-fixtures/knowledge.html?lang=en`);
    await expect(page.locator(".badge-tile")).toHaveCount(17);
    await page.evaluate((value) => {
      document.documentElement.dataset.gameUiTheme = value;
    }, theme);
    const result = await new AxeBuilder({ page })
      .include(".badge-wall")
      .withRules(["color-contrast"])
      .analyze();
    findings.push(
      ...result.violations.map((item) => ({
        theme,
        id: item.id,
        nodes: item.nodes.map((node) => ({ target: node.target, failure: node.failureSummary })),
      })),
    );
    await page.locator("[data-fixture-grade]").click();
    const promotion = page.locator(".rank-promotion");
    await expect(promotion).toBeVisible();
    await imagesReady(page, ".rank-promotion img");
    const control = promotion.getByRole("button");
    const hit = await control.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const target = document.elementFromPoint(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2,
      );
      return {
        hit: target !== null && element.contains(target),
        target: target?.outerHTML.slice(0, 240),
      };
    });
    expect(hit, JSON.stringify(hit)).toMatchObject({ hit: true });
    await promotion.screenshot({ path: `${OUTPUT}/synthetic-${theme}-readable-promotion.png` });
    const toast = await new AxeBuilder({ page })
      .include(".rank-promotion")
      .withRules(["color-contrast"])
      .analyze();
    findings.push(
      ...toast.violations.map((item) => ({
        theme: `${theme}-promotion`,
        id: item.id,
        nodes: item.nodes.map((node) => ({ target: node.target, failure: node.failureSummary })),
      })),
    );
  }
  expect(findings).toEqual([]);
});

async function offlineAccount(page: Page) {
  await page.route(/https:\/\/[^/]+\.supabase\.co\//, (route) =>
    route.fulfill({ status: 503, json: { message: "Synthetic offline account provider" } }),
  );
  await page.route(/https:\/\/[^/]*posthog\.com\//, (route) => route.abort());
  await page.routeWebSocket(/supabase\.co/, (socket) => socket.close());
}
async function imagesReady(page: Page, selector: string) {
  await expect(page.locator(selector).first()).toBeAttached();
  await expect
    .poll(() =>
      page
        .locator(selector)
        .evaluateAll((nodes) =>
          nodes.every(
            (node) =>
              (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await page.evaluate(() => document.fonts.ready);
}
async function noHorizontalOverflow(page: Page) {
  const bounds = await page.evaluate(() => ({
    viewport: innerWidth,
    width: document.documentElement.scrollWidth,
    wider: [
      ...document.querySelectorAll(
        "main,section,article,.game-ui-panel,.term-index,.knowledge-fixture__tiers",
      ),
    ]
      .flatMap((node) => {
        const r = node.getBoundingClientRect();
        return r.right > innerWidth + 1
          ? [{ className: node.className, left: r.left, right: r.right, width: r.width }]
          : [];
      })
      .slice(0, 12),
  }));
  expect(bounds.width, JSON.stringify(bounds)).toBeLessThanOrEqual(bounds.viewport + 1);
}

test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus)
    await page
      .screenshot({ path: info.outputPath("knowledge-failure.png") })
      .catch(() => undefined);
});

for (const [mode, origin] of [
  ["delivery", ONLINE_ORIGIN],
  ["authoring", LOCAL_ORIGIN],
] as const) {
  for (const width of [1440, 390]) {
    test(`${mode} ${width}: the real library defaults to this domain, keeps two gifts, and expands the actual catalogue`, async ({
      page,
    }) => {
      mkdirSync(OUTPUT, { recursive: true });
      await offlineAccount(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${origin}/ai-literacy/understanding-ai?lang=zh-CN`);
      await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });
      const shell = page.locator(".app-shell");
      if ((await shell.getAttribute("data-map-rail-open")) === "false")
        await page.locator(".app-shell__collapse--rail").click();
      const library = page
        .locator(
          '.nav-rail a[href="/library"],.nav-rail a[href="/concepts"],.nav-rail a[href="/library/concepts"]',
        )
        .first();
      await humanClick(page, library, "Open the actual library from the map");
      const scope = page.locator('[data-album-scope="ai-foundations"]');
      await expect(scope).toBeVisible();
      await expect(page.locator('[data-concept-card][data-collected="true"]')).toHaveCount(2);
      await imagesReady(page, ".knowledge-card__art");
      await noHorizontalOverflow(page);
      await page.screenshot({ path: `${OUTPUT}/${mode}-${width}-album.png` });
      await page.locator("[data-album-expand]").click();
      await expect(page.locator("[data-concept-card]")).toHaveCount(CONCEPT_HEADS.length);
      const ids = await page
        .locator("[data-concept-card]")
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-concept-card")));
      expect(new Set(ids).size).toBe(CONCEPT_HEADS.length);
      await page.locator('[data-concept-card="prompt"] .game-ui-collect-card').focus();
      await page.keyboard.press("Enter");
      await expect(
        page.locator('[data-concept-card="prompt"] .game-ui-collect-card'),
      ).toHaveAttribute("aria-pressed", "true");
      const tabs = page.getByRole("navigation", { name: "图鉴", exact: true });
      await tabs.getByRole("button", { name: "我的笔记", exact: true }).click();
      await expect(page.getByText("还没有保存的笔记", { exact: true })).toBeVisible();
      await tabs.getByRole("button", { name: "互动课件", exact: true }).click();
      await expect(page.locator(".play-catalog")).toBeVisible({ timeout: 30_000 });
      await noHorizontalOverflow(page);
      await page.screenshot({ path: `${OUTPUT}/${mode}-${width}-courseware.png` });
    });
  }
}

for (const width of [1440, 390]) {
  test(`isolated ${width}: three real card frames, ordered reveal, all badges and a scheduler-earned promotion`, async ({
    page,
  }) => {
    mkdirSync(OUTPUT, { recursive: true });
    const consoleErrors = watchConsole(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${ONLINE_ORIGIN}/e2e-fixtures/knowledge.html?lang=en`);
    await expect(page.locator("[data-knowledge-fixture]")).toBeVisible();
    await expect(page.getByText("Synthetic learning history", { exact: true })).toBeVisible();
    for (const tier of ["new", "known", "shining"])
      await expect(page.locator(`[data-tier-gallery] [data-memory-tier="${tier}"]`)).toBeVisible();
    await imagesReady(page, "[data-tier-gallery] .knowledge-card__art");
    await noHorizontalOverflow(page);
    await page.screenshot({ path: `${OUTPUT}/synthetic-${width}-tiers.png` });
    await humanClick(page, page.locator("[data-fixture-reveal]"), "Reveal the isolated history");
    await expect(page.locator("[data-knowledge-revealed]")).toBeVisible();
    await expect(page.locator("[data-knowledge-revealed]")).toHaveAttribute(
      "data-knowledge-revealed",
      "3",
      { timeout: 10_000 },
    );
    expect(
      await page
        .locator("[data-reveal-card]")
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-reveal-card"))),
    ).toEqual(["frontend", "prompt", "multimodal"]);
    await expect(page.locator(".knowledge-reveal .game-ui-collect-card--spotlight")).toHaveCount(1);
    const rarest = page.locator('[data-reveal-card="multimodal"]');
    await expect
      .poll(() =>
        rarest.evaluate((element) => {
          const card = element.getBoundingClientRect();
          const tray = element.parentElement!.getBoundingClientRect();
          return card.left >= tray.left - 1 && card.right <= tray.right + 1;
        }),
      )
      .toBe(true);
    const rarestButton = rarest.getByRole("button");
    await rarestButton.focus();
    await page.keyboard.press("Enter");
    await expect(rarestButton).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Enter");
    await expect(rarestButton).toHaveAttribute("aria-pressed", "false");
    await page.locator("[data-reveal-previous]").click();
    await expect(page.locator("[data-reveal-active]")).toHaveAttribute(
      "data-reveal-active",
      "prompt",
    );
    await page.locator("[data-reveal-next]").click();
    await expect(page.locator("[data-reveal-active]")).toHaveAttribute(
      "data-reveal-active",
      "multimodal",
    );
    await expect(page.locator("[data-course-completion]")).toBeVisible();
    await noHorizontalOverflow(page);
    await expect(page.locator(".chest-rewards canvas")).toHaveCount(0);
    await expect(page.locator(".chest-rewards__line--badge img")).toHaveCount(1);
    await imagesReady(page, ".chest-rewards__line--badge img");
    await page
      .locator(".chest-rewards")
      .screenshot({ path: `${OUTPUT}/synthetic-${width}-reveal.png` });
    await page.locator('[data-chest-action="continue"]').click();
    await expect(page.locator(".badge-tile")).toHaveCount(17);
    await expect(page.locator(".league-rung")).toHaveCount(5);
    await page.locator("[data-growth-details] summary").click();
    await expect(page.locator(".badge-tile__disc img")).toHaveCount(17);
    await expect(page.locator(".league-rung__emblem img")).toHaveCount(5);
    await imagesReady(page, ".league-rung__emblem img,.badge-tile__disc img");
    await page
      .locator(".league-ladder")
      .screenshot({ path: `${OUTPUT}/synthetic-${width}-ranks.png` });
    await page
      .locator(".badge-wall")
      .screenshot({ path: `${OUTPUT}/synthetic-${width}-badge-wall.png` });
    await expect(page.locator("[data-long-term-count]")).toHaveText("9");
    await page.locator("[data-fixture-grade]").click();
    await expect(page.locator('[data-rank-promotion="bronze"]')).toBeVisible();
    await expect(page.getByLabel("An unfinished answer")).toHaveValue("Keep this draft");
    await expect(page.locator("[data-fixture-grade]")).toBeFocused();
    const ceremony = page.locator(".rank-promotion [data-emblem-animating]");
    await expect(ceremony).toHaveAttribute("data-emblem-animating", "true");
    await expect(ceremony).toHaveAttribute("data-emblem-animating", "false");
    // The receipt auto-dismisses: capture its settled frame without waiting
    // for element stability until the subject has already left the DOM.
    const clip = await page.locator(".rank-promotion").boundingBox();
    expect(clip).not.toBeNull();
    await page.screenshot({ path: `${OUTPUT}/synthetic-${width}-promotion.png`, clip: clip! });
    consoleErrors.assertClean();
  });
}

test("isolated reduced motion: all recorded cards appear without spotlight and the exact catalogue still opens", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${ONLINE_ORIGIN}/e2e-fixtures/knowledge.html?lang=en`);
  await page.locator("[data-fixture-reveal]").click();
  await expect(page.locator("[data-knowledge-revealed]")).toHaveAttribute(
    "data-knowledge-revealed",
    "3",
  );
  await expect(page.locator(".knowledge-reveal .game-ui-collect-card--spotlight")).toHaveCount(0);
  await page.locator('[data-chest-action="continue"]').click();
  await page.locator("[data-album-expand]").click();
  await expect(page.locator(".term-index [data-concept-card]")).toHaveCount(CONCEPT_HEADS.length);
});

test("isolated device permission: never requested by opening the album, denial retains keyboard flipping", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const proof = { requests: 0 };
    Object.assign(window, { __knowledgePermissionProof: proof });
    class SyntheticOrientationEvent extends Event {
      static async requestPermission() {
        proof.requests++;
        return "denied";
      }
    }
    Object.defineProperty(window, "DeviceOrientationEvent", {
      value: SyntheticOrientationEvent,
      configurable: true,
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${ONLINE_ORIGIN}/e2e-fixtures/knowledge.html?lang=en`);
  await expect(page.locator("[data-knowledge-fixture]")).toBeVisible();
  const requests = () =>
    page.evaluate(
      () =>
        (window as unknown as { __knowledgePermissionProof: { requests: number } })
          .__knowledgePermissionProof.requests,
    );
  expect(await requests()).toBe(0);
  await page.locator(".knowledge-album__rules summary").click();
  expect(await requests()).toBe(0);
  await page.locator("[data-album-tilt]").click();
  await expect(page.locator("[data-album-tilt-state]")).toHaveAttribute(
    "data-album-tilt-state",
    "denied",
  );
  expect(await requests()).toBe(1);
  const card = page.locator('.term-index [data-concept-card="prompt"] .game-ui-collect-card');
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(card).toHaveAttribute("aria-pressed", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("[data-album-tilt]")).toBeDisabled();
  expect(await requests()).toBe(1);
});
