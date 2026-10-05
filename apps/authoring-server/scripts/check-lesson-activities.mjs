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
 * Usage: node apps/authoring-server/scripts/check-lesson-activities.mjs [studiesRoot]
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { contentPaths } from "../../../scripts/content-root.mjs";

const studiesRoot =
  process.argv[2] ??
  process.env["UNIVERSITY_LOCAL_STUDIES_ROOT"] ??
  contentPaths({ projectRoot: process.cwd() }).studies;
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
 * Reachability and the difficulty-family rules, for one copy of a lesson.
 *
 * Both directions: an unreferenced activity is dead weight the reader never
 * meets, and a reference to nothing is a hole in the lesson. A family is the
 * one legitimate exception — it is a single activity at several difficulties,
 * so the prose points at one of its ids and the learner reaches the rest
 * through the picker on the component. Requiring every member to appear in the
 * text would either fail every levelled lesson or push authors to write three
 * `::play` markers for one activity, which is three activities on the page.
 *
 * This exists as one function because it did not, and the omission had teeth.
 * The rules were added to the walk over `studies/` and not to the walk over the
 * delivery package below, so the first lesson ever to author three levels
 * passed on disk and failed on delivery — the two extra levels read as dead
 * weight to the only copy a customer will ever hold. A feature that cannot be
 * shipped is not shipped, and the gate would have said so at exactly the wrong
 * end of the pipe.
 *
 * `noun` is what the caller calls the thing it is checking, and `missingTail`
 * lets the delivery side keep its extra warning about what the reader sees.
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
      {
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
        stdio: ["ignore", "pipe", "ignore"],
      },
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

function checkActivitySet(declared, content, where, noun, missingTail) {
  const byId = new Map(declared.map((activity) => [activity.id, activity]));
  const text = content ?? "";
  const referenced = [...text.matchAll(/::play\{#([a-z0-9-]+)\}/g)].map((m) => m[1]);
  for (const id of referenced) {
    if (!byId.has(id)) {
      problems.push(`${where}: 正文引用了 ::play{#${id}}，${noun}里没有它${missingTail}`);
    }
  }

  const families = new Map();
  for (const activity of declared) {
    if (!activity.family) continue;
    families.set(activity.family, [...(families.get(activity.family) ?? []), activity]);
  }
  const referencedFamilies = new Set(
    declared.filter((a) => referenced.includes(a.id) && a.family).map((a) => a.family),
  );
  for (const [family, members] of families) {
    const kinds = new Set(members.map((member) => member.kind));
    if (kinds.size > 1) {
      problems.push(
        `${where}: 难度组 ${family} 里混了 ${[...kinds].join("、")} 几种玩法；` +
          `一个组件的三档要跑在同一个引擎上`,
      );
    }
    const levels = members.map((member) => member.difficulty ?? "practice");
    if (new Set(levels).size !== levels.length) {
      problems.push(`${where}: 难度组 ${family} 里有两个组件难度相同（${levels.join("、")}）`);
    }
    if (!referencedFamilies.has(family)) {
      problems.push(`${where}: 难度组 ${family} 的组件，正文一个都没引用`);
    }
  }

  for (const activity of declared) {
    const reachable =
      referenced.includes(activity.id) ||
      (activity.family && referencedFamilies.has(activity.family));
    if (!reachable) problems.push(`${where}: ${noun}里有组件 ${activity.id}，正文从没引用它`);
  }
}

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
let tuneEngine = null;
try {
  ({ isValidSortActivity } = await import("../../../packages/core/dist/learning-play/sort.js"));
  tuneEngine = await import("../../../packages/core/dist/learning-play/tune.js");
} catch {
  console.log("  ! 读不到 core 的构建产物，保留玩法判定要等 core build");
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
 * A contrast board has to contain both answers.
 *
 * The engine refuses a board whose cases all agree or all split, because a
 * reader who answers the same way every time finishes it — and finishing it is
 * indistinguishable, from outside, from having understood the distinction it
 * was supposed to teach. The other half is quieter: an `outcomes` map missing a
 * key renders a blank column, which reads as 「it does nothing here」 rather
 * than as the missing text it is.
 */
function checkTune(activity, where) {
  if (!tuneEngine) return;
  const { evaluateTuning } = tuneEngine;
  const controls = activity.controls ?? [];
  if (controls.length === 0 || controls.length > 3) {
    problems.push(`${where}: ${controls.length} 个滑块，这一关没有被验证过解得开`);
    return;
  }
  const STEPS = 24;
  const axis = (control) =>
    Array.from(
      { length: STEPS + 1 },
      (_, index) => control.min + ((control.max - control.min) * index) / STEPS,
    );
  let feasible = 0;
  let sampled = 0;
  const walk = (index, values) => {
    if (index === controls.length) {
      sampled += 1;
      if (evaluateTuning(activity, values).passed) feasible += 1;
      return;
    }
    for (const value of axis(controls[index])) {
      walk(index + 1, { ...values, [controls[index].id]: value });
    }
  };
  walk(0, {});
  if (feasible === 0) {
    problems.push(`${where}: 扫遍滑块也没有一处让所有指标同时成立——这一关无解`);
  }
  if (feasible === sampled) {
    problems.push(`${where}: 滑块怎么拖都成立，几条带子一条都没在起作用`);
  }
  const start = Object.fromEntries(controls.map((control) => [control.id, control.initial]));
  if (evaluateTuning(activity, start).passed) {
    problems.push(`${where}: 一进来就已经全部达标，读者不动手也算通关`);
  }
}

/**
 * A dispatch scenario needs a routing that finishes inside the budget, and a
 * budget that can actually be blown.
 *
 * It also needs the cache to matter: the lane only opens for a request whose
 * key an earlier request already warmed, so a card list where no key repeats
 * has a cache lane the reader can never legally take. That is the whole
 * mechanic, sitting there unusable.
 */
const { LessonActivitySchema: PathActivitySchema, interactionLessonIssues } =
  await import("../../../packages/core/dist/domain/schemas.js");

const CHECKS = {
  primm: (activity, where) => {
    const result = PathActivitySchema.safeParse(activity);
    if (!result.success)
      problems.push(...result.error.issues.map((issue) => `${where}: ${issue.message}`));
  },
  connect: checkConnect,
  sort: checkSort,
  tune: checkTune,
};

const unchecked = new Set();

/*
  Every kind the wire enum accepts must have a check here.

  This was a warning line, and a warning is what let `hunt` sit with no engine
  check at all while the gate printed 「ok」 — the same silence that let `sort`
  ship without a line in the enum. A kind is added to the enum precisely when
  lessons may start storing it, so that is exactly the moment its payloads start
  going unchecked.

  It reads the enum through the built core rather than a list here, because a
  list here is the thing that goes stale.
*/
try {
  const { LessonActivityKindSchema } =
    await import("../../../packages/core/dist/domain/schemas.js");
  const missing = LessonActivityKindSchema.options.filter((kind) => !CHECKS[kind]);
  if (missing.length > 0) {
    problems.push(
      `这几种玩法在 wire enum 里，但这里没有对应的引擎判定：${missing.join("、")}——` +
        `课文可以存它们了，而没有任何检查看得见它们是否解得开`,
    );
  }
} catch {
  console.log("  ! 读不到 core 的构建产物，玩法覆盖这一项没有检查");
}

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
        checkActivitySet(declared, content, where, "清单", "");
        if (declared.some((activity) => activity.kind === "primm"))
          problems.push(
            ...interactionLessonIssues({ ...manifest, content }).map(
              (message) => `${where}: ${message}`,
            ),
          );

        for (const activity of declared) {
          activities += 1;
          checkSource(activity, `${where} · ${activity.id}`, studyId);
          if (activity.kind === "primm") {
            for (const source of activity.sources ?? [])
              checkSource(
                { source: source.reference },
                `${where} · ${activity.id}/${source.id}`,
                studyId,
              );
          }
          checkRolePosition(activity, content, `${where} · ${activity.id}`);
          const check = CHECKS[activity.kind];
          if (check) check(activity, `${where} · ${activity.id}`);
          else unchecked.add(activity.kind);
        }
      }
    }
  }
}

/*
  The same two directions, one boundary later.

  Everything above reads `configured course root/studies`, which is the authoring side — and
  that is where this check was green while nine `::play` markers shipped to
  delivery pointing at activities the publish DTO had dropped. The reader says
  so out loud when a marker resolves to nothing, so what a customer got was a
  block reading "找不到这个互动课件" in the middle of a paid lesson. A gate that
  only ever reads the authoring copy cannot see a boundary losing things.

  `apps/university/content` is generated and git-ignored, so it may be absent or
  behind. That is said rather than skipped in silence, for the same reason the
  missing-build branch above says it.
*/
const deliveryRoot = join(studiesRoot, "..", "..", "university", "content");
let deliveryLessons = 0;
if (!existsSync(deliveryRoot)) {
  console.log("  ! 没有交付内容可以核对（先跑 pnpm --filter @pieai/university-app content）");
} else {
  for (const studyId of dirs(deliveryRoot)) {
    for (const name of readdirSync(join(deliveryRoot, studyId))) {
      if (!name.endsWith(".json")) continue;
      const pkg = read(join(deliveryRoot, studyId, name));
      for (const unit of pkg.course?.units ?? pkg.units ?? []) {
        for (const lesson of unit.lessons ?? []) {
          deliveryLessons += 1;
          const where = `交付 ${studyId}/${name.replace(/\.json$/, "")}/${lesson.id}`;
          checkActivitySet(
            lesson.activities ?? [],
            lesson.content ?? "",
            where,
            "交付包",
            "——读者会看到一块报错",
          );
          if (lesson.activities?.some((activity) => activity.kind === "primm"))
            problems.push(
              ...interactionLessonIssues({
                ...lesson,
                assets: (lesson.assets ?? []).map((asset) => asset.metadata ?? asset),
              }).map((message) => `${where}: ${message}`),
            );
        }
      }
    }
  }
}

console.log(
  `扫过 ${lessons} 节课，${activities} 个互动组件` +
    (deliveryLessons > 0 ? `；交付包里另核对 ${deliveryLessons} 节` : ""),
);
if (unchecked.size > 0) {
  console.log(
    `  ! 这几种玩法没有可单独调用的引擎判定，只检查了共同约定和出处：${[...unchecked].join("、")}`,
  );
}
/*
  `role` says where the activity sits; `::play{#id}` is where it actually sits.

  activities.md gives the three roles three different jobs, and each is defined
  by a position in the prose: `observe` comes before 「先猜一下」 so the reader
  has seen the phenomenon before predicting, `apply` comes after 「答案」 so it
  is a first use of something just learned, and `observe` additionally 「不能泄
  题」 — a board sitting after the prediction question cannot be the thing that
  sets it up.

  Nothing checked that the field and the marker agreed, which made `role` a
  second source of truth for a fact the prose already decides. All 27 activities
  on the shelf happen to agree today, and all 27 are `apply`, so the other two
  values have never been exercised at all. That is the moment to add the check,
  not after the first lesson where they disagree.

  Silence where a section is absent is deliberate: not every variant has a
  「先猜一下」, and a missing landmark is not evidence of a misplaced board.
*/
function checkRolePosition(activity, content, where) {
  const lines = content.split("\n");
  const at = (pattern) => lines.findIndex((line) => pattern.test(line));
  const play = lines.findIndex((line) => line.includes(`::play{#${activity.id}}`));
  if (play < 0) return; // The missing-reference check above already said so.
  const predict = at(/^## 先猜一下/u);
  const answer = at(/^## 答案/u);
  const selfCheck = at(/^## 自检/u);

  if (activity.role === "observe" && predict >= 0 && play > predict) {
    problems.push(
      `${where}: role 写的是 observe，组件却放在「先猜一下」之后——` +
        `放在预测之后的组件会泄题，要么挪到前面，要么它的 role 不是 observe`,
    );
  }
  if (activity.role === "apply" && answer >= 0 && play < answer) {
    problems.push(
      `${where}: role 写的是 apply，组件却放在「答案」之前——` +
        `apply 的意思是刚学完第一次自己用，这个位置上读者还没学到`,
    );
  }
  if (activity.role === "apply" && selfCheck >= 0 && play > selfCheck) {
    problems.push(`${where}: role 写的是 apply，组件却放在「自检」之后`);
  }
}

/*
  Nothing scanned is a failure, not a pass.

  This script resolves `studies/` and the delivery package relative to the
  working directory, so running it from `apps/authoring-server` instead of the repository
  root walked zero lessons and still printed `ok` — a green light for a gate
  that was not looking at anything. Every real run has hundreds of lessons, so
  a floor of one costs nothing and turns the silent case into a loud one.
*/
const hasConfiguredContent = Boolean(
  process.argv[2] ||
  process.env["UNIVERSITY_COURSE_ROOT"] ||
  process.env["UNIVERSITY_LOCAL_STUDIES_ROOT"],
);
if (lessons === 0 && !hasConfiguredContent && !existsSync(studiesRoot)) {
  console.log("  没有配置课程仓库，跳过课文互动核对（先配置 UNIVERSITY_COURSE_ROOT）");
  process.exit(0);
}
if (lessons === 0) {
  console.log("  这一趟一节课都没扫到——多半是从错误的目录跑的，请从仓库根目录跑");
  process.exit(1);
}
if (problems.length === 0) {
  console.log("ok  每个组件都解得开，每个引用都指得到");
  process.exit(0);
}
for (const problem of problems) console.log(`  ${problem}`);
process.exit(1);
