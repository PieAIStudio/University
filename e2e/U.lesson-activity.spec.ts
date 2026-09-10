import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";

import { LOCAL_ORIGIN } from "./ports.js";

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
          const revision = JSON.parse(readFileSync(latest, "utf8"))
            .contentRevision as number;
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
      await expect(board).toBeVisible({ timeout: 20_000 });
      await expect(board).toHaveAttribute("data-activity", target.kind, {
        timeout: 5_000,
      });
      const game = board.locator(".learning-activity__game");
      expect((await game.textContent())?.trim().length ?? 0).toBeGreaterThan(0);
    } catch {
      const body = (await page.locator("body").innerText())
        .slice(0, 120)
        .replace(/\s+/g, " ");
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
  const sample = lessonsWithActivities().filter(
    (t) => !seen.has(t.kind) && seen.add(t.kind),
  );
  expect(sample.length, "货架上一个带组件的课节都没有").toBeGreaterThan(0);

  const escaped: string[] = [];
  for (const target of sample) {
    await page.goto(`${LOCAL_ORIGIN}${target.path}`, {
      waitUntil: "domcontentloaded",
    });
    const board = page.locator(".learning-activity__game");
    await expect(board).toBeVisible({ timeout: 20_000 });
    const box = await board.boundingBox();
    if (!box) {
      escaped.push(`${target.kind} @ ${target.path} — 板子没有尺寸`);
      continue;
    }

    /*
      Everything the reader is meant to see or press. Wires are excluded: an
      SVG overlay legitimately spans the board and is not a thing to reach.
    */
    const pieces = board.locator(
      "button, .play-connect__node, .play-contrast__case, .play-sort__item, .play-weigh__situation",
    );
    const total = await pieces.count();
    expect(
      total,
      `${target.kind} @ ${target.path} 板子上一个可见的东西都没有`,
    ).toBeGreaterThan(0);

    for (let index = 0; index < total; index += 1) {
      const piece = pieces.nth(index);
      if (!(await piece.isVisible())) continue;
      const pieceBox = await piece.boundingBox();
      if (!pieceBox) continue;
      const label =
        ((await piece.textContent()) ?? "").trim().slice(0, 20) ||
        `第 ${index + 1} 个`;
      if (pieceBox.width === 0 || pieceBox.height === 0) {
        escaped.push(
          `${target.kind} @ ${target.path} — 「${label}」宽或高为 0`,
        );
        continue;
      }
      // One pixel of slack for sub-pixel rounding on borders.
      if (pieceBox.x < box.x - 1)
        escaped.push(`${target.kind} — 「${label}」左边露到板子外`);
      if (pieceBox.x + pieceBox.width > box.x + box.width + 1) {
        escaped.push(`${target.kind} — 「${label}」右边露到板子外`);
      }
    }
  }
  expect(escaped, "手机上这些东西掉出了板子").toEqual([]);
});
