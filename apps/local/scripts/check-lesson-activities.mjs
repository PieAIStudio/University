#!/usr/bin/env node
/**
 * Every interactive activity a lesson embeds must actually be solvable, and
 * every `::play` in the prose must point at one that is there.
 *
 * This is also the change-impact tool. When an engine's rules move, run this:
 * the activities it can no longer solve are the lessons that need attention,
 * named. That is why it asks the engine's own semantics rather than a second
 * copy of the payload rules — a hand-written spec would drift from the engine
 * the first time the engine gained a field, and would then report the wrong
 * lessons with total confidence.
 *
 * Usage: node apps/local/scripts/check-lesson-activities.mjs [studiesRoot]
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const studiesRoot = process.argv[2] ?? join(process.cwd(), "apps/local/studies");
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
/*
  `statSync`, not `withFileTypes`. A Dirent reports a symlink as a symlink and
  not as a directory, and studies arrive in a worktree as symlinks — so the
  fast version of this walk silently found seven lessons out of four hundred
  and reported everything fine.
*/
const dirs = (path) => {
  if (!existsSync(path)) return [];
  return readdirSync(path).filter((name) => {
    try {
      return statSync(join(path, name)).isDirectory();
    } catch {
      return false;
    }
  });
};

const problems = [];
let lessons = 0;
let activities = 0;

/**
 * A connect activity is solvable when every probe can be walked.
 *
 * `traceConnectionProbe` stops at the first pair the learner has not joined, so
 * a probe naming a hop the author never put in `edges` is a probe that cannot
 * complete however well the learner plays — the activity would be unwinnable
 * and look, from the outside, exactly like a learner who had not finished.
 */
function checkConnect(activity, where) {
  const ids = new Set(activity.nodes?.map((node) => node.id) ?? []);
  if (ids.size !== (activity.nodes?.length ?? 0)) problems.push(`${where}: 节点 id 有重复`);
  const edges = new Set();
  for (const edge of activity.edges ?? []) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) {
      problems.push(`${where}: 连线 ${edge.from}→${edge.to} 指向不存在的节点`);
    }
    const key = `${edge.from}→${edge.to}`;
    if (edges.has(key)) problems.push(`${where}: 连线 ${key} 重复`);
    edges.add(key);
  }
  if (edges.size === 0) problems.push(`${where}: 一条连线都没有，读者无事可做`);
  for (const probe of activity.probes ?? []) {
    for (const [index, node] of probe.path.entries()) {
      if (!ids.has(node)) problems.push(`${where}: 探针「${probe.label}」经过不存在的节点 ${node}`);
      if (index === 0) continue;
      const hop = `${probe.path[index - 1]}→${node}`;
      if (!edges.has(hop)) {
        problems.push(
          `${where}: 探针「${probe.label}」要走 ${hop}，但没有这条连线——无论怎么连都过不去`,
        );
      }
    }
  }
}

/*
  `sort` is asked of the engine rather than re-checked here. `isValidSortActivity`
  already knows what an unplayable board is — a bucket nothing lands in, a
  temptation pointing at the right answer — and a second copy of those rules
  would drift from it the first time the engine gains one.

  Imported from the built output because this is a plain script, not a workspace
  package. A build that has not run yet leaves the sort check unavailable, and
  that is said out loud rather than silently skipped: a gate that quietly stops
  looking is worse than one that is missing.
*/
let isValidSortActivity = null;
try {
  ({ isValidSortActivity } = await import("../../../packages/core/dist/learning-play/sort.js"));
} catch {
  console.log(
    "  ! 读不到 core 的构建产物，sort 组件这一项没有检查（先跑 pnpm --filter @pieai/university-core build）",
  );
}

function checkSort(activity, where) {
  if (!isValidSortActivity) return;
  if (!isValidSortActivity(activity)) {
    problems.push(
      `${where}: 引擎判定这个归类台无法完成——空格子、指向正确答案的诱饵，或指向不存在的格子`,
    );
  }
}

const CHECKS = { connect: checkConnect, sort: checkSort };

for (const studyId of dirs(studiesRoot)) {
  const coursesRoot = join(studiesRoot, studyId, "courses");
  for (const courseId of dirs(coursesRoot)) {
    const unitsRoot = join(coursesRoot, courseId, "units");
    for (const unitId of dirs(unitsRoot)) {
      const lessonsRoot = join(unitsRoot, unitId, "lessons");
      for (const lessonId of dirs(lessonsRoot)) {
        const base = join(lessonsRoot, lessonId);
        const latest = join(base, "latest.json");
        if (!existsSync(latest)) continue;
        lessons += 1;
        const revision = read(latest).contentRevision;
        const manifest = read(join(base, "revisions", String(revision), "manifest.json"));
        const content = readFileSync(
          join(base, "revisions", String(revision), "content.md"),
          "utf8",
        );
        const where = `${studyId}/${courseId}/${unitId}/${lessonId}`;
        const declared = manifest.activities ?? [];
        const byId = new Map(declared.map((activity) => [activity.id, activity]));

        // Both directions. An unreferenced activity is dead weight the reader
        // never meets; a reference to nothing is a hole in the lesson.
        const referenced = [...content.matchAll(/::play\{#([a-z0-9-]+)\}/g)].map((m) => m[1]);
        for (const id of referenced) {
          if (!byId.has(id)) problems.push(`${where}: 正文引用了 ::play{#${id}}，清单里没有它`);
        }
        for (const activity of declared) {
          activities += 1;
          if (!referenced.includes(activity.id)) {
            problems.push(`${where}: 清单里有组件 ${activity.id}，正文从没引用它`);
          }
          const check = CHECKS[activity.kind];
          if (check) check(activity, `${where} · ${activity.id}`);
        }
      }
    }
  }
}

console.log(`扫过 ${lessons} 节课，${activities} 个互动组件`);
if (problems.length === 0) {
  console.log("ok  每个组件都解得开，每个引用都指得到");
  process.exit(0);
}
for (const problem of problems) console.log(`  ${problem}`);
process.exit(1);
