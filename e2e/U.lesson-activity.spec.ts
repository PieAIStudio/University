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
    await page.goto(`${LOCAL_ORIGIN}${target.path}`, { waitUntil: "domcontentloaded" });
    const board = page.locator(".learning-activity");
    try {
      await expect(board).toBeVisible({ timeout: 20_000 });
      await expect(board).toHaveAttribute("data-activity", target.kind, { timeout: 5_000 });
      const game = board.locator(".learning-activity__game");
      expect((await game.textContent())?.trim().length ?? 0).toBeGreaterThan(0);
    } catch {
      const body = (await page.locator("body").innerText()).slice(0, 120).replace(/\s+/g, " ");
      broken.push(`${target.kind} @ ${target.path} — 页面上是：${body}`);
    }
  }
  expect(broken, "这些课节声明了组件，读者却看不到").toEqual([]);
});
