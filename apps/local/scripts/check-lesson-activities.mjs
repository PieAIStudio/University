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
import { execFileSync } from "node:child_process";
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
let isValidProgramActivity = null;
try {
  ({ isValidSortActivity } = await import("../../../packages/core/dist/learning-play/sort.js"));
  ({ isValidProgramActivity } = await import("../../../packages/core/dist/learning-play/program.js"));
} catch {
  console.log(
    "  ! 读不到 core 的构建产物，sort/program 组件这一项没有检查（先跑 pnpm --filter @pieai/university-core build）",
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

/**
 * Where an activity says its facts came from, checked rather than read.
 *
 * This was the half of the payload nothing looked at, and it rotted in three
 * separate ways at once while the gate stayed green: three citations pointed at
 * `blob/main/`, which moves out from under a lesson pinned to a snapshot; one
 * carried a snapshot id in the `commit` field, which the receipt renders as
 * `@git-7bdf`; and one named a line that was not the line its own label
 * described. A receipt that names the wrong place is worse than no receipt,
 * because the reader has no reason to doubt it.
 *
 * The schema now rejects a malformed commit, so what is left for a gate is
 * everything the schema cannot see: whether the ref moves, and whether the file
 * and line are really there in the snapshot this study is pinned to.
 */
const FLOATING_REF = /\/blob\/(main|master|HEAD)\//;

function studySnapshot(studyId) {
  const sourceRoot = join(studiesRoot, studyId, "source");
  const snapshotsRoot = join(sourceRoot, "snapshots");
  const mirror = join(sourceRoot, "repository.git");
  if (!existsSync(snapshotsRoot) || !existsSync(mirror)) return null;
  const names = readdirSync(snapshotsRoot).filter((name) => name.endsWith(".json"));
  if (names.length !== 1) return null;
  return { mirror, ...read(join(snapshotsRoot, names[0])) };
}

const snapshots = new Map();
function snapshotFor(studyId) {
  if (!snapshots.has(studyId)) snapshots.set(studyId, studySnapshot(studyId));
  return snapshots.get(studyId);
}

function checkSource(activity, where, studyId) {
  const source = activity.source;
  if (!source) return;

  if (source.url) {
    if (FLOATING_REF.test(source.url)) {
      problems.push(
        `${where}: 出处指向会移动的分支（blob/main 之类）——上游一改，这节课就在引用别的代码了`,
      );
    }
    return;
  }

  const snapshot = snapshotFor(studyId);
  if (!snapshot) {
    problems.push(`${where}: 出处引用了仓库里的文件，但这个 study 没有可核对的快照`);
    return;
  }
  if (source.commit && source.commit !== snapshot.sourceCommit) {
    problems.push(
      `${where}: 出处钉在 ${source.commit.slice(0, 8)}，这门课钉在 ${snapshot.sourceCommit.slice(0, 8)}`,
    );
    return;
  }
  let file;
  try {
    file = execFileSync(
      "git",
      ["--git-dir", snapshot.mirror, "show", `${snapshot.sourceCommit}:${source.path}`],
      { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] },
    );
  } catch {
    problems.push(`${where}: 快照里没有 ${source.path} 这个文件`);
    return;
  }
  const lines = file.split("\n").length;
  const far = source.lineEnd ?? source.line;
  if (far && far > lines) {
    problems.push(`${where}: 出处指到第 ${far} 行，${source.path} 只有 ${lines} 行`);
  }
}

function checkProgram(activity, where) {
  if (!isValidProgramActivity) return;
  if (!isValidProgramActivity(activity)) {
    problems.push(`${where}: 引擎判定这个程序题本身不成立——起点、终点或指令上限有问题`);
  }
}

/*
  Three of the eleven kinds can be asked whether they are playable without
  first playing them; the other eight decide it inside a move, from state this
  script does not have. That is a fine reason not to check them and a bad
  reason to say nothing, which is the same rule the missing-build branch above
  already follows — so the kinds that got no engine check are named in the
  summary rather than counted as passing.
*/
const CHECKS = { connect: checkConnect, sort: checkSort, program: checkProgram };
const unchecked = new Set();

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
          checkSource(activity, `${where} · ${activity.id}`, studyId);
          const check = CHECKS[activity.kind];
          if (check) check(activity, `${where} · ${activity.id}`);
          else unchecked.add(activity.kind);
        }
      }
    }
  }
}

console.log(`扫过 ${lessons} 节课，${activities} 个互动组件`);
if (unchecked.size > 0) {
  console.log(
    `  ! 这几种玩法没有可单独调用的引擎判定，只检查了共同约定和出处：${[...unchecked].join("、")}`,
  );
}
if (problems.length === 0) {
  console.log("ok  每个组件都解得开，每个引用都指得到");
  process.exit(0);
}
for (const problem of problems) console.log(`  ${problem}`);
process.exit(1);
