import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { humanClick, waitForStableBox } from "./harness/click.js";
import { watchConsole } from "./harness/console.js";
import { installCourseLabelFixture } from "./harness/catalogue.js";
import { LOCAL_ORIGIN, ONLINE_ORIGIN } from "./ports.js";
import { openOnline, selectGameRoute, waitForMapReady } from "./harness/online-learner.js";
import { namedStep } from "./harness/step.js";
import { assertWorldCarrierAboveGround } from "./harness/world-carrier.js";

/**
 * The object-side entry action must follow the island, not pin to a screen corner.
 *
 * A CSS `right:` on `.picked` is why collapsing the context rail stacked the
 * card on the collapse capsule. The test clicks with a real mouse —
 * `element.click()` never hit-tests, and that is how "looks clickable,
 * isn't" shipped twice in this repo.
 */

const SHOTS = fileURLToPath(new URL("../SHOTS", import.meta.url));

type Box = { x: number; y: number; width: number; height: number };

function center(box: Box): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function overlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function enterCard(page: Page): Locator {
  return page.locator('.map-entry-action[data-map-entry="true"].is-visible');
}

async function visibleCourseLabels(page: Page): Promise<Locator> {
  const labels = page.locator("button.label.label--course.is-visible");
  await expect(labels.first()).toBeVisible({ timeout: 30_000 });
  return labels;
}

async function visibleCourseSnapshot(page: Page): Promise<{ id: string; box: Box }[]> {
  const labels = await visibleCourseLabels(page);
  // Read identities and rectangles in one browser turn. The .is-visible list
  // changes as the rail finishes collapsing and the projector chooses labels;
  // retaining nth(i) across awaits can silently turn a left-hand island into
  // an unrelated right-hand island before the pointer is sent.
  return labels.evaluateAll((elements) =>
    elements.flatMap((element) => {
      const id = element.getAttribute("data-map-marker");
      const { x, y, width, height } = element.getBoundingClientRect();
      return id && width >= 4 && height >= 4 ? [{ id, box: { x, y, width, height } }] : [];
    }),
  );
}

async function waitForCourseLabelLayout(page: Page): Promise<void> {
  let previous = "";
  let stableSamples = 0;
  await expect
    .poll(
      async () => {
        const snapshot = await visibleCourseSnapshot(page);
        const signature = JSON.stringify(
          snapshot.map(({ id, box }) => [
            id,
            Math.round(box.x),
            Math.round(box.y),
            Math.round(box.width),
            Math.round(box.height),
          ]),
        );
        stableSamples = signature === previous ? stableSamples + 1 : 0;
        previous = signature;
        return stableSamples;
      },
      { message: "课程标签须在栏位动画和相机投影后保持身份与位置稳定", intervals: [100] },
    )
    .toBeGreaterThanOrEqual(3);
}

function courseLabel(page: Page, id: string): Locator {
  return page.locator(`button.label--course[data-map-marker=${JSON.stringify(id)}]`);
}

/**
 * Real pointer on the course-name button that sits on the island.
 *
 * The name is a DOM button whose `activate` is the same as the mesh
 * `onClick`. `humanClick` hit-tests first. Clicking 18px below the name
 * (the mesh) misses on the local shell, where islands are smaller; the
 * name is the target a person actually aims at.
 */
async function clickCourseLabel(page: Page, label: Locator): Promise<Box> {
  // The visible-label list is allowed to reflow when the entry hint retires
  // after a pick. Resolve the chosen course by its stable marker ID before the
  // click, and retain the pre-click box: it is the screen point the pointer
  // actually aimed at, not a different nth label after the list reflowed.
  // innerText concatenates an inline rewrite badge without a separator,
  // whereas the accessibility name separates child text nodes. It is not a
  // reliable way to recover a role locator for that same button.
  const id = await label.getAttribute("data-map-marker");
  if (!id) throw new Error("课名标签缺少稳定地图身份");
  const target = courseLabel(page, id);
  await expect(target).toHaveCount(1);
  await waitForStableBox(target);
  const box = await target.boundingBox();
  if (!box) throw new Error("课名标签没有屏幕矩形");
  await humanClick(page, target, "课名");
  return box;
}

async function clickEmptySky(page: Page): Promise<void> {
  const canvas = page.locator(".stagewrap canvas").first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("画布没有屏幕矩形");
  // Sky and island are the same <canvas> node, so `elementsFromPoint` can
  // rule out DOM overlays but can never tell the two apart — the ray did
  // that, not the DOM. Ask the product instead: the hint reads
  // the control hint while nothing is hovered, and swaps to a course title
  // the moment the ray hits an island. A point that leaves the hover hint
  // absent is a point the raycaster missed.
  //
  // The four fixed guesses this replaces were written when the map held a
  // handful of islands. Fifty-three of them leave almost no sky at a fixed
  // coordinate, so scan instead of guess.
  const columns = [0.5, 0.42, 0.58, 0.34, 0.66, 0.28, 0.72];
  const rows = [18, 34, 52, 74, box.height - 24, box.height - 44];
  const candidates: { x: number; y: number }[] = [];
  for (const row of rows) {
    for (const column of columns) {
      candidates.push({ x: box.x + box.width * column, y: box.y + row });
    }
  }

  for (const point of candidates) {
    const domClear = await page.evaluate(({ x, y }) => {
      const stack = document.elementsFromPoint(x, y);
      const blocked = stack.some((entry) => {
        const el = entry as HTMLElement;
        return Boolean(
          el.closest(".map-entry-action") ||
          el.closest("button.label") ||
          el.closest(".app-shell__collapse") ||
          el.closest(".nav-rail") ||
          el.closest(".app-shell__aside"),
        );
      });
      // A transparent centered breadcrumb can have a canvas below it in the
      // stack without delivering the click there. Test the actual pointer hit.
      return document.elementFromPoint(x, y)?.tagName === "CANVAS" && !blocked;
    }, point);
    if (!domClear) continue;

    await page.mouse.move(point.x, point.y);
    // One frame for the raycast, one for React to render the swapped hint.
    await page.waitForTimeout(120);
    const rayHitIsland = await page.locator(".hint--hover").count();
    if (rayHitIsland > 0) continue;

    await page.mouse.click(point.x, point.y);
    return;
  }
  throw new Error("找不到能点到画布的空处（海面/天空）");
}

async function pickLeftishIsland(page: Page): Promise<Box> {
  await waitForCourseLabelLayout(page);
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("没有视口");
  const chosen = (await visibleCourseSnapshot(page))
    .filter(({ box }) => center(box).x <= viewport.width * 0.55)
    .sort((a, b) => a.box.x - b.box.x)[0];
  if (!chosen) throw new Error("没有真实偏左的可见课名，不能用右侧岛冒充左岛验收");
  const clicked = await clickCourseLabel(page, courseLabel(page, chosen.id));
  expect(center(clicked).x, "实际点击的同一座岛必须仍在左侧").toBeLessThanOrEqual(
    viewport.width * 0.55,
  );
  return clicked;
}

async function pickRightEdgeIsland(page: Page): Promise<Box> {
  await waitForCourseLabelLayout(page);
  const rightmost = (await visibleCourseSnapshot(page)).sort(
    (a, b) => center(b.box).x - center(a.box).x,
  )[0];
  if (!rightmost) throw new Error("地图上没有可见的课名");
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("没有视口");
  const now = rightmost.box.x + rightmost.box.width / 2;
  // The entry is now a compact button, not a 260px card. Put the target
  // genuinely against the right edge to exercise flipping, not at 78% where
  // the new control correctly still fits to its right.
  const wantX = viewport.width - 85;
  const dx = Math.min(Math.max(wantX - now, 0), 440);
  if (dx > 40) {
    const canvas = page.locator(".stagewrap canvas").first();
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error("画布没有屏幕矩形");
    const fromX = canvasBox.x + canvasBox.width * 0.4;
    const fromY = canvasBox.y + 56;
    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.mouse.move(fromX + dx, fromY, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(500);
  }
  await waitForCourseLabelLayout(page);
  const next = (await visibleCourseSnapshot(page)).sort(
    (a, b) => center(b.box).x - center(a.box).x,
  )[0];
  if (!next) throw new Error("平移后没有真实可见的课程岛");
  const clicked = await clickCourseLabel(page, courseLabel(page, next.id));
  expect(center(clicked).x, "翻边验收必须实际点到右侧岛").toBeGreaterThan(viewport.width * 0.62);
  return clicked;
}

/** Everything the follow-card projector treats as opaque, in viewport pixels.
 *
 * `controls.tsx` passes `placeLabels` the shell chrome boxes plus, for the
 * entry action only, the learner avatar's projected bounds. A failure that
 * lists only the DOM half of that sends the reader looking for a rail that is
 * not there, which is how this assertion was mis-diagnosed twice. Read without
 * waiting: several of these are legitimately absent at points in this walk,
 * and a locator that waits would spend twenty seconds proving the obvious. */
async function mapObstacles(page: Page): Promise<readonly Record<string, number | string>[]> {
  return page.evaluate(() => {
    const round = (value: number) => Math.round(value);
    const chrome = [
      ...document.querySelectorAll<HTMLElement>(
        ".nav-rail, .counter-row, .app-shell__aside, [data-map-shell] .app-shell__east-stack, .nextup, .tab-bar, .map-breadcrumbs",
      ),
    ]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          what: element.className.toString().split(" ")[0] ?? "?",
          x: round(rect.x),
          y: round(rect.y),
          w: round(rect.width),
          h: round(rect.height),
        };
      })
      .filter((entry) => entry.w > 0 && entry.h > 0);
    const state = (window as unknown as { three?: any }).three;
    const marker =
      state?.scene.getObjectByName("learner-marker-world") ??
      state?.scene.getObjectByName("learner-marker-course");
    const avatar = marker?.getObjectByName("university-avatar-occlusion-target");
    if (!state || !avatar) return chrome;
    state.scene.updateMatrixWorld(true);
    const points: { x: number; y: number }[] = [];
    const canvas = state.gl.domElement.getBoundingClientRect();
    avatar.traverse((child: any) => {
      const geometry = child.geometry;
      if (!geometry) return;
      geometry.computeBoundingBox?.();
      const bb = geometry.boundingBox;
      if (!bb) return;
      for (const x of [bb.min.x, bb.max.x])
        for (const y of [bb.min.y, bb.max.y])
          for (const z of [bb.min.z, bb.max.z]) {
            const point = state.camera.position.clone().set(x, y, z);
            child.localToWorld(point);
            point.project(state.camera);
            points.push({
              x: canvas.left + ((point.x + 1) * canvas.width) / 2,
              y: canvas.top + ((1 - point.y) * canvas.height) / 2,
            });
          }
    });
    if (points.length === 0) return chrome;
    const left = Math.min(...points.map((point) => point.x));
    const right = Math.max(...points.map((point) => point.x));
    const top = Math.min(...points.map((point) => point.y));
    const bottom = Math.max(...points.map((point) => point.y));
    return [
      ...chrome,
      {
        what: "avatar",
        x: round(left) - 10,
        y: round(top) - 10,
        w: round(right - left) + 20,
        h: round(bottom - top) + 20,
      },
    ];
  });
}

async function assertCardFollowsIsland(page: Page, island: Box): Promise<Box> {
  const card = enterCard(page);
  await expect(card).toBeVisible({ timeout: 10_000 });
  await waitForStableBox(card);
  const cardBox = await card.boundingBox();
  if (!cardBox) throw new Error("对象旁进入动作没有屏幕矩形");
  /*
    Edge gap, not centre distance.

    `controls.tsx` places this card through `placeLabels` with `anchor: "aside"`
    and `gap: 8`, then keeps it inside the follow viewport and clear of the
    opaque shell. Staying inside is the card doing its job, and centre distance
    punished it for that — the card runs ~740px tall against an island label
    24px tall, so an island low on the screen pushes the two centres apart while
    the boxes are still touching. Measured on 2026-09-12 across the four
    placements this walk produces: edge gap 0, 0, 0 and 20px, while the centre
    distance the old gate measured ranged 368 to 460 and tripped only at the
    island nearest the right edge — the one placement with the least room left.
  */
  const gapX = Math.max(
    0,
    island.x - (cardBox.x + cardBox.width),
    cardBox.x - (island.x + island.width),
  );
  const gapY = Math.max(
    0,
    island.y - (cardBox.y + cardBox.height),
    cardBox.y - (island.y + island.height),
  );
  const gap = Math.hypot(gapX, gapY);
  /*
    One step from the island, whichever slot the projector chose.

    The earlier gate asked "is it beside?" and then tried to re-derive, from
    the DOM, whether a beside slot existed. That is the gate re-implementing
    the thing it guards, and it cannot be done from here: `placeLabels` reasons
    in stage coordinates about the island's projected peak and about the
    learner avatar's projected bounds, while everything a test can measure is
    a viewport rectangle around the *label*. Two wrong diagnoses came out of
    that gap before this comment was written.

    So this asks the question the learner actually has: is the button still
    attached to the island I clicked? Every slot `slotsFor("aside")` can return
    is one step from the anchor — `width / 2 + gap + clearance` to a side (96px
    for this 64px button) or `height / 2 + gap` above or below (30px).

    Measured 2026-09-21 at 1440 wide, across the placements this walk produces:
    4.8, 0 and 0px for the ordinary beside placements; 8px for the local
    variant's right-edge island, where the button does flip to the left; and
    86px for the delivery variant's right-edge island, whose 203px-wide label
    runs from x=1221 to the frame while the east stack (1360..1424) and the
    avatar (1362..1427) sit on its right end — there the button steps above,
    centred, instead of beside. A card that stopped following measures 214px —
    pushing it 260px along the side it already sits on, so only this assertion
    can speak — and still fails here.

    Why the flip is correct rather than tolerated, and what is still open about
    the archipelago's framing, is written down rather than decided here:
    docs/reference/execution/archipelago-framing-gap.md.
  */
  const obstacles = await mapObstacles(page);
  const boxes =
    ` 岛 ${island.width.toFixed(0)}×${island.height.toFixed(0)} @ ${island.x.toFixed(0)},${island.y.toFixed(0)}；` +
    `卡片 ${cardBox.width.toFixed(0)}×${cardBox.height.toFixed(0)} @ ${cardBox.x.toFixed(0)},${cardBox.y.toFixed(0)}；` +
    `遮挡 ${JSON.stringify(obstacles)}。`;
  expect(
    gap,
    `进入动作应跟着岛走（一个落位步长内，< 96px），现在是 ${gap.toFixed(0)}px。` + boxes,
  ).toBeLessThan(96);
  // Touching edges is not covering: a button placed beside an island shares a
  // boundary and measures zero on both gaps. Ask for real overlapping area.
  const overlapX =
    Math.min(cardBox.x + cardBox.width, island.x + island.width) - Math.max(cardBox.x, island.x);
  const overlapY =
    Math.min(cardBox.y + cardBox.height, island.y + island.height) - Math.max(cardBox.y, island.y);
  const covered = Math.max(0, overlapX) * Math.max(0, overlapY);
  expect(
    covered / (island.width * island.height),
    "卡片压在岛上，学习者看不到自己选了什么" + boxes,
  ).toBeLessThan(0.2);
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("没有视口");
  expect(cardBox.x).toBeGreaterThanOrEqual(-1);
  expect(cardBox.y).toBeGreaterThanOrEqual(-1);
  expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(viewport.height + 1);
  return cardBox;
}

async function walkIslandPick(page: Page, prefix: "online" | "local"): Promise<void> {
  mkdirSync(SHOTS, { recursive: true });

  await namedStep(page, "初始没有对象旁进入动作", async () => {
    await expect(page.locator('[data-map-entry="true"].is-visible')).toHaveCount(0);
    await assertWorldCarrierAboveGround(page);
    await page.screenshot({ path: `${SHOTS}/${prefix}-unselected.png` });
  });

  const collapse = page.locator(".app-shell__collapse--aside");
  const canCollapse = await collapse.isVisible().catch(() => false);
  if (canCollapse) {
    await namedStep(page, "先收起右栏，好验卡片不再钉在胶囊上", async () => {
      await humanClick(page, collapse, "收起上下文");
      await expect(page.locator(".app-shell")).toHaveAttribute("data-aside-collapsed", "true");
    });
  }

  await namedStep(page, "点一座偏左的岛，进入动作出现在岛旁边", async () => {
    const island = await pickLeftishIsland(page);
    const cardBox = await assertCardFollowsIsland(page, island);
    expect(center(cardBox).x, "偏左的岛：卡片默认在右侧").toBeGreaterThan(center(island).x);
    await page.screenshot({ path: `${SHOTS}/${prefix}-picked-left.png` });
  });

  await namedStep(page, "Escape 取消对象选择，不打开模态层", async () => {
    await expect(enterCard(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-map-entry="true"].is-visible')).toHaveCount(0);
    await assertWorldCarrierAboveGround(page);
  });

  await namedStep(page, "再点回那座岛，好接着验海面", async () => {
    const island = await pickLeftishIsland(page);
    await assertCardFollowsIsland(page, island);
  });

  await namedStep(page, "点海面（天空）后卡片消失", async () => {
    await clickEmptySky(page);
    await expect(page.locator('[data-map-entry="true"].is-visible')).toHaveCount(0);
  });

  await namedStep(page, "点靠右边缘的岛，进入动作不越过岛的右缘且不裁切", async () => {
    const rightIsland = await pickRightEdgeIsland(page);
    const cardBox = await assertCardFollowsIsland(page, rightIsland);
    // Not "flips left": measured 2026-09-21, the local variant does flip left
    // while the delivery variant steps above, centred, because the east stack
    // and the avatar sit on that island's right end. What both owe the learner
    // is the same — the button must not be pushed out past the island toward
    // the frame edge, which is where it would start to be clipped.
    expect(center(cardBox).x, "靠右的岛：进入动作跑到岛的右缘之外，离裁切只差一步").toBeLessThan(
      rightIsland.x + rightIsland.width,
    );
    await page.screenshot({ path: `${SHOTS}/${prefix}-picked-right.png` });
  });

  if (canCollapse) {
    await namedStep(page, "收起右栏时进入动作不和收起胶囊重叠", async () => {
      const card = enterCard(page);
      await expect(card).toBeVisible();
      const cardBox = await card.boundingBox();
      const handleBox = await collapse.boundingBox();
      if (!cardBox || !handleBox) throw new Error("卡片或收起按钮没有矩形");
      expect(overlap(cardBox, handleBox), "收起右栏后对象旁进入动作叠在胶囊上").toBe(false);
      await page.screenshot({ path: `${SHOTS}/${prefix}-aside-collapsed.png` });
    });
  }
}

test.describe("F 点岛出现对象旁进入动作 · 跟岛走", () => {
  test.use({ viewport: { width: 1440, height: 810 } });

  test("在线端：未选中 → 点岛出现在旁边 → 点海面消失 → 靠右翻边", async ({ page }) => {
    const consoleErrors = watchConsole(page);
    await openOnline(page);
    await waitForMapReady(page);
    await walkIslandPick(page, "online");
    consoleErrors.assertClean();
  });

  test("本地端：同一套卡片，跟岛走", async ({ page }) => {
    const consoleErrors = watchConsole(page);
    await namedStep(page, "打开本地端世界地图", async () => {
      await page.goto(`${LOCAL_ORIGIN}/`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText("第一项学习还没有准备好。")).toHaveCount(0, { timeout: 30_000 });
      await expect(page.getByText(/正在打开校园档案/)).toHaveCount(0, { timeout: 30_000 });
      await expect(page.locator(".stagewrap canvas")).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(".loading-trivia")).toHaveCount(0, { timeout: 90_000 });
      await expect(page.locator("button.label.is-visible").first()).toBeVisible({
        timeout: 30_000,
      });
      await page.waitForTimeout(600);
    });
    await walkIslandPick(page, "local");
    consoleErrors.assertClean();
  });
});

for (const [mode, origin] of [
  ["delivery", ONLINE_ORIGIN],
  ["authoring", LOCAL_ORIGIN],
] as const) {
  for (const width of [1440, 375]) {
    test.describe(`F course label status ${mode} ${width}`, () => {
      test.use({ viewport: { width, height: width === 1440 ? 900 : 812 }, colorScheme: "light" });
      test("long names leave learning state and rewrite notices visible and clickable", async ({
        page,
      }) => {
        const consoleErrors = watchConsole(page);
        await installCourseLabelFixture(page);
        await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
        await selectGameRoute(page);
        await assertWorldCarrierAboveGround(page);
        await waitForCourseLabelLayout(page);
        const rows = await page.locator("button.label--course.is-visible").evaluateAll((elements) =>
          elements.map((element) => {
            const bounds = element.getBoundingClientRect();
            const title = element.querySelector<HTMLElement>(".label__course-title");
            return {
              id: element.getAttribute("data-map-marker"),
              title: title?.textContent ?? "",
              titleWidth: title?.getBoundingClientRect().width ?? 0,
              truncated: Boolean(title && title.scrollWidth > title.clientWidth + 1),
              badges: [...element.querySelectorAll<HTMLElement>("small")].map((badge) => {
                const box = badge.getBoundingClientRect();
                return {
                  text: badge.textContent,
                  inside:
                    box.left >= bounds.left &&
                    box.right <= bounds.right + 1 &&
                    box.top >= bounds.top &&
                    box.bottom <= bounds.bottom + 1,
                  notTruncated: badge.scrollWidth <= badge.clientWidth + 1,
                  width: box.width,
                  height: box.height,
                };
              }),
            };
          }),
        );
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.some((row) => row.truncated)).toBe(true);
        expect(rows.flatMap((row) => row.badges).some((badge) => badge.text === "改写中")).toBe(
          true,
        );
        for (const row of rows) {
          expect(row.titleWidth, row.id ?? "course title").toBeGreaterThan(20);
          expect(row.badges.length).toBeGreaterThan(0);
          for (const badge of row.badges) {
            expect(badge.inside, `${row.id}/${badge.text} must not be clipped with the title`).toBe(
              true,
            );
            expect(badge.notTruncated).toBe(true);
            expect(badge.width).toBeGreaterThan(0);
            expect(badge.height).toBeGreaterThan(0);
          }
        }
        const sample = rows.find((row) => row.truncated)!;
        await clickCourseLabel(page, courseLabel(page, sample.id!));
        await expect(enterCard(page).getByRole("button")).toHaveAttribute(
          "aria-label",
          new RegExp(sample.title.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")),
        );
        const folder = "SCRATCH/e2e/course-label-status";
        mkdirSync(folder, { recursive: true });
        writeFileSync(
          `${folder}/${mode}-${width}.json`,
          JSON.stringify({ url: page.url(), width, rows }, null, 2),
        );
        await page.screenshot({ path: `${folder}/${mode}-${width}.png` });
        consoleErrors.assertClean();
      });
    });
  }
}
