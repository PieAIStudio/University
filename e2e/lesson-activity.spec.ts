import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";

import { LOCAL_ORIGIN, ONLINE_ORIGIN } from "./ports.js";
import { humanClick } from "./harness/click.js";
import { SHIPPED_COURSES } from "./harness/catalogue.js";
import type { ConnectActivity } from "@pieai/university-core";

/*
  A lesson that declares an activity has to show it to a reader.

  Everything else in the chain checks a different question. `check:activities`
  asks whether the payload is solvable and whether the prose points at it;
  `lint-lessons` asks about the prose; the engines ask about the rules. Not one
  of them opens the lesson, and on 2026-09-10 that gap swallowed a real defect:
  `course open-for-edit` leaves a course `stale`, a stale course serves no
  content at all, and the reader gets 「课程资料没有打开」 while every gate
  reports ok — the page title even resolves to the new revision's title.

  Authoring origin, because it reads the disk through the loopback server and so
  sees the revision that just landed without waiting for a content build.

  The lessons are discovered rather than named. A list of ids here would go
  stale the first time a course was reorganised, and this file exists because
  something went stale quietly.
*/

interface Target {
  readonly path: string;
  readonly kind: string;
  readonly lessonId: string;
}

/*
  Read off disk rather than through an endpoint. The authoring server is the
  thing under test here, so asking it what to test would let a broken server
  answer 「nothing」 and turn this file green.
*/
function lessonsWithActivities(): readonly Target[] {
  const root = resolve("apps/local/studies");
  const out: Target[] = [];
  const dirs = (at: string) => {
    if (!existsSync(at)) return [];
    return readdirSync(at).filter((name) => {
      try {
        return statSync(join(at, name)).isDirectory();
      } catch {
        return false;
      }
    });
  };
  for (const studyId of dirs(root)) {
    const coursesRoot = join(root, studyId, "courses");
    for (const courseId of dirs(coursesRoot)) {
      const unitsRoot = join(coursesRoot, courseId, "units");
      for (const unitId of dirs(unitsRoot)) {
        const lessonsRoot = join(unitsRoot, unitId, "lessons");
        for (const lessonId of dirs(lessonsRoot)) {
          const latest = join(lessonsRoot, lessonId, "latest.json");
          if (!existsSync(latest)) continue;
          const revision = JSON.parse(readFileSync(latest, "utf8")).contentRevision as number;
          const manifestPath = join(
            lessonsRoot,
            lessonId,
            "revisions",
            String(revision),
            "manifest.json",
          );
          if (!existsSync(manifestPath)) continue;
          const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
            activities?: { kind: string }[];
          };
          for (const activity of manifest.activities ?? []) {
            out.push({
              path: `/${studyId}/${courseId}/${unitId}/${lessonId}`,
              kind: activity.kind,
              lessonId,
            });
          }
        }
      }
    }
  }
  return out;
}

test("每一节声明了互动组件的课，读者都真的看得到它", async ({ page }) => {
  const targets = lessonsWithActivities();

  /*
    Every kind that any lesson actually stores, sampled once. A missing
    renderer branch or a course left in `stale` shows up on the first lesson
    that uses it, and walking a hundred lessons would only make the run slower.
  */
  expect(targets.length, "磁盘上一个带组件的课节都没有").toBeGreaterThan(0);

  // One per kind is enough to catch a missing renderer branch or a stale
  // course, and keeps this from walking a hundred lessons every run.
  const seen = new Set<string>();
  const sample = targets.filter((t) => !seen.has(t.kind) && seen.add(t.kind));
  expect(sample.length, "货架上一个带组件的课节都没有").toBeGreaterThan(0);

  const broken: string[] = [];
  for (const target of sample) {
    await page.goto(`${LOCAL_ORIGIN}${target.path}`, {
      waitUntil: "domcontentloaded",
    });
    const board = page.locator(".learning-activity");
    try {
      if (target.kind === "primm" || target.kind === "interaction-path") {
        // These two draw their own readers instead of the shared activity board,
        // so "the reader can see it" is the same question asked of a different
        // element. A missing renderer branch still shows up here.
        const reader = page
          .locator(target.kind === "primm" ? ".primm, .primm-steps" : ".interaction-path")
          .first();
        await expect(reader).toBeVisible({ timeout: 20_000 });
        expect((await reader.textContent())?.trim().length ?? 0).toBeGreaterThan(0);
      } else {
        await expect(board).toBeVisible({ timeout: 20_000 });
        await expect(board).toHaveAttribute("data-activity", target.kind, {
          timeout: 5_000,
        });
        const game = board.locator(".learning-activity__game");
        expect((await game.textContent())?.trim().length ?? 0).toBeGreaterThan(0);
      }
    } catch {
      const body = (await page.locator("body").innerText()).slice(0, 120).replace(/\s+/g, " ");
      broken.push(`${target.kind} @ ${target.path} — 页面上是：${body}`);
    }
  }
  expect(broken, "这些课节声明了组件，读者却看不到").toEqual([]);
});

/*
  A board designed for N has to show N — on a phone, which is where it doesn't.

  This is the failure the whole activity mandate was given against: 「设计为
  4个连4个，结果用上去之后发现连显示都没显示全」. Nothing else catches it.
  `check:activities` reads the payload, so a node it can see is a node it
  believes rendered; `S.play-completeness` measures real geometry but only on
  the play lab's own fixtures, whose coordinates are hand-tuned. A lesson's
  board carries its own `x`/`y` and its own label lengths, and no fixture
  shares them.

  Measured against the board's own box rather than the viewport, because the
  board is what the reader is told to look at: a node hanging outside it is
  unreachable even when the page happens to scroll far enough sideways to
  reveal it.
*/
test("手机宽度下，每块板子上的东西都在板子里面", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });

  const seen = new Set<string>();
  /*
    Board activities only. This measures pieces against their board's own box,
    and neither a PRIMM nor an interaction-path lesson has one: each runs its own
    reader, and both are walked at phone width by primm.spec.ts and
    interaction-path.spec.ts. Including them would fail on a missing element
    rather than on a piece that escaped, which is not what this guards.
  */
  const sample = lessonsWithActivities()
    .filter((t) => t.kind !== "primm" && t.kind !== "interaction-path")
    .filter((t) => !seen.has(t.kind) && seen.add(t.kind));
  expect(sample.length, "货架上一个带组件的课节都没有").toBeGreaterThan(0);

  const escaped: string[] = [];
  for (const target of sample) {
    await page.goto(`${LOCAL_ORIGIN}${target.path}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator(".learning-activity__game")).toBeVisible({
      timeout: 20_000,
    });

    /*
      The whole measurement happens in one evaluate, on purpose.

      Measuring across Playwright calls — `toBeVisible`, then `boundingBox`,
      then a box per piece — re-resolves the locator every time, and a board
      that re-renders after mount can swap its node in any of those gaps.
      `boundingBox` then returns null for an element that is on the screen, and
      the failure reads 「板子没有尺寸」 about a board measured at 261×545 in a
      real browser a moment later. `ai-repair` did exactly that. Reading the
      board and every piece synchronously in the page removes the gap rather
      than papering over it with a retry.

      Wires are excluded: an SVG overlay legitimately spans the board and is
      not a thing the reader reaches for.
    */
    const report = await page.evaluate(() => {
      const board = document.querySelector(".learning-activity__game");
      if (!board) return { ok: false as const, why: "板子不在页面上" };
      const box = board.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) {
        return {
          ok: false as const,
          why: `板子尺寸是 ${box.width}×${box.height}`,
        };
      }
      const pieces = [
        ...board.querySelectorAll(
          "button, .play-connect__node, .play-contrast__case, .play-sort__item, .play-weigh__situation",
        ),
      ];
      const shown = pieces.filter((piece) => {
        const style = getComputedStyle(piece);
        return style.display !== "none" && style.visibility !== "hidden";
      });
      const escapes: string[] = [];
      const geometry: {
        label: string;
        bounds: ReturnType<DOMRect["toJSON"]>;
        layout: Record<string, string>;
      }[] = [];
      for (const [index, piece] of shown.entries()) {
        const rect = piece.getBoundingClientRect();
        const label = piece.textContent?.trim().slice(0, 20) || `第 ${index + 1} 个`;
        const style = getComputedStyle(piece);
        geometry.push({
          label,
          bounds: rect.toJSON(),
          layout: {
            width: style.width,
            minWidth: style.minWidth,
            maxWidth: style.maxWidth,
            height: style.height,
            minHeight: style.minHeight,
            whiteSpace: style.whiteSpace,
            parent: piece.parentElement?.className ?? "",
            className: piece.className,
            position: style.position,
            transform: style.transform,
            translate: style.translate,
          },
        });
        if (rect.width === 0 || rect.height === 0) {
          escapes.push(`「${label}」宽或高为 0`);
          continue;
        }
        // One pixel of slack for sub-pixel rounding on borders.
        if (rect.left < box.left - 1) escapes.push(`「${label}」左边露到板子外`);
        if (rect.right > box.right + 1) escapes.push(`「${label}」右边露到板子外`);
      }
      return { ok: true as const, pieces: shown.length, escapes, board: box.toJSON(), geometry };
    });

    if (!report.ok) {
      escaped.push(`${target.kind} @ ${target.path} — ${report.why}`);
      continue;
    }
    expect(
      report.pieces,
      `${target.kind} @ ${target.path} 板子上一个可见的东西都没有`,
    ).toBeGreaterThan(0);
    for (const escape of report.escapes) {
      escaped.push(`${target.kind} @ ${target.path} — ${escape}`);
    }
    if (target.kind === "connect") {
      await test.info().attach("connect-layout", {
        body: JSON.stringify({ target, report }, null, 2),
        contentType: "application/json",
      });
      await page.screenshot({ path: test.info().outputPath("connect-phone-page.png") });
      await page.locator(".play-connect__board").evaluate((element) => {
        element.scrollIntoView({ block: "start" });
        const toolbar = document.querySelector(".lesson-toolbar");
        window.scrollBy(0, -((toolbar?.getBoundingClientRect().height ?? 0) + 12));
      });
      await page.screenshot({ path: test.info().outputPath("connect-phone-board.png") });
    }
    if (report.escapes.length) {
      console.error(JSON.stringify({ label: "actual-lesson-board-overflow", target, report }));
      await test.info().attach(`overflow-${target.kind}`, {
        body: JSON.stringify({ target, report }, null, 2),
        contentType: "application/json",
      });
      await page.screenshot({ path: test.info().outputPath(`overflow-${target.kind}.png`) });
    }
  }
  expect(escaped, "手机上这些东西掉出了板子").toEqual([]);
});

test("长标签接线课在两种语言和两种模式下都能亲手完成", async ({ page }) => {
  const candidates = SHIPPED_COURSES.flatMap((course) =>
    course.units.flatMap((unit) =>
      unit.lessons
        .filter((lesson) => lesson.packageLesson.locales)
        .flatMap((lesson) =>
          ((lesson.packageLesson.activities ?? []) as ConnectActivity[])
            .filter((activity) => activity.kind === "connect")
            .map((activity) => ({
              path: `/${course.studyId}/${course.id}/${lesson.unitId}/${lesson.id}`,
              activity,
            })),
        ),
    ),
  );
  expect(
    candidates.length,
    "a published bilingual connect task must exercise the real layout",
  ).toBeGreaterThan(0);
  const target = candidates[0]!;
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const origin of [ONLINE_ORIGIN, LOCAL_ORIGIN])
    for (const language of ["en", "zh-CN"]) {
      await page.goto(`${origin}${target.path}?lang=${language}`);
      const board = page.locator(".play-connect__board");
      await expect(board).toBeVisible();
      for (const edge of target.activity.edges) {
        await humanClick(
          page,
          board.locator(`[data-connect-node=${JSON.stringify(edge.from)}]`),
          "choose source node",
        );
        await humanClick(
          page,
          board.locator(`[data-connect-node=${JSON.stringify(edge.to)}]`),
          "choose destination node",
        );
      }
      await expect(board.locator(".play-connect__wires > path")).toHaveCount(
        target.activity.edges.length,
      );
      const wirePaths = await board
        .locator(".play-connect__wires > path")
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("d")));
      expect(wirePaths.join(" ")).not.toMatch(/NaN|Infinity/);
      await humanClick(
        page,
        page.locator(".play-connect .play-action-row button").first(),
        "run the learner's connections",
      );
      await expect(
        page.locator('.learning-activity__result[data-result="completed"]'),
      ).toBeVisible();
      await expect(page.locator('.learning-activity__feedback[data-passed="true"]')).toBeVisible();
      await page.locator(".learning-activity__feedback").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: test
          .info()
          .outputPath(
            `connect-completed-${origin === ONLINE_ORIGIN ? "delivery" : "authoring"}-${language}.png`,
          ),
      });
    }
});
