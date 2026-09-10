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
let agentEngine = null;
let evalEngine = null;
let contextEngine = null;
let repairEngine = null;
let tuneEngine = null;
let dispatchEngine = null;
try {
  ({ isValidSortActivity } = await import("../../../packages/core/dist/learning-play/sort.js"));
  ({ isValidProgramActivity } =
    await import("../../../packages/core/dist/learning-play/program.js"));
  agentEngine = await import("../../../packages/core/dist/learning-play/ai-agent.js");
  evalEngine = await import("../../../packages/core/dist/learning-play/ai-eval.js");
  contextEngine = await import("../../../packages/core/dist/learning-play/ai-context.js");
  repairEngine = await import("../../../packages/core/dist/learning-play/ai-repair.js");
  tuneEngine = await import("../../../packages/core/dist/learning-play/tune.js");
  dispatchEngine = await import("../../../packages/core/dist/learning-play/dispatch.js");
} catch {
  console.log(
    "  ! 读不到 core 的构建产物，connect 以外的引擎判定这一项没有检查（先跑 pnpm --filter @pieai/university-core build）",
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
/**
 * An agent scenario is solvable when playing it the careful way wins.
 *
 * The careful way is what the lesson teaches: give each tool exactly the files
 * its own `taskFileIds` names, run every action the task requires, and refuse
 * every action it does not. `evaluateAgentWorkspace` already knows what winning
 * means — all actions decided, no protected file touched, every goal met, no
 * tool granted anything outside its task. Asking it is the only way to find out
 * that an author has written a scenario whose goal cannot be reached without
 * over-granting, which from the outside is indistinguishable from a learner who
 * simply has not solved it yet.
 */
function checkAgent(activity, where) {
  if (!agentEngine) return;
  const { createAgentState, setAgentCapability, advanceAgent, evaluateAgentWorkspace } =
    agentEngine;

  /*
    Two things the replay below structurally cannot see, found by attacking it.

    The replay grants each tool exactly its own `taskFileIds`, and `broadToolIds`
    compares grants against `taskFileIds` — so the two always agree and a task
    scope the author wrote too wide is invisible to it. Widening the writer to
    include a protected file left the whole check green.

    Both rules say the same thing from different sides: the careful play must not
    be able to damage anything, and the declared scope must be the task, not the
    project. The second is the rule the learner is graded on, so an author who
    breaks it is grading a learner against a scope the author did not honour.
  */
  const protectedIds = new Set(
    (activity.files ?? []).filter((file) => file.protected).map((file) => file.id),
  );
  for (const tool of activity.tools ?? []) {
    if (tool.capability !== "write") continue;
    const damaging = (tool.taskFileIds ?? []).filter((id) => protectedIds.has(id));
    if (damaging.length) {
      problems.push(
        `${where}: 写文件工具 ${tool.id} 的任务范围里有受保护的 ${damaging.join("、")}——` +
          `照任务范围授权就能把它改坏，那道保护就守不住任何东西了`,
      );
    }
  }
  for (const tool of activity.tools ?? []) {
    const touched = new Set(
      (activity.actions ?? [])
        .filter((action) => action.toolId === tool.id)
        .flatMap((action) => [
          ...(action.inputFileIds ?? []),
          ...(action.requiredFileIds ?? []),
          ...(action.effects ?? []).map((effect) => effect.fileId),
          ...(action.effects ?? []).flatMap((effect) => effect.sourceFileIds ?? []),
        ]),
    );
    const idle = (tool.taskFileIds ?? []).filter((id) => !touched.has(id));
    if (idle.length) {
      problems.push(
        `${where}: 工具 ${tool.id} 的任务范围里有 ${idle.join("、")}，但没有任何一步动作用得到——` +
          `这节课判读者「范围过宽」，作者自己先宽了`,
      );
    }
  }

  let state = createAgentState(activity);
  for (const tool of activity.tools ?? []) {
    state = setAgentCapability(activity, state, tool.id, tool.taskFileIds ?? []);
  }
  for (const action of activity.actions ?? []) {
    const move = advanceAgent(activity, state, action.required ? "execute" : "reject");
    if (!move.accepted) {
      problems.push(
        `${where}: 按任务范围授权、只做必需动作，走到 ${action.id} 就被引擎挡住了（${move.reason}）`,
      );
      return;
    }
    state = move.state;
  }
  const verdict = evaluateAgentWorkspace(activity, state);
  if (!verdict.passed) {
    const why = [
      verdict.unmetGoalFileIds.length
        ? `没达成的目标文件 ${verdict.unmetGoalFileIds.join("、")}`
        : "",
      verdict.changedProtectedFileIds.length
        ? `动了受保护的 ${verdict.changedProtectedFileIds.join("、")}`
        : "",
      verdict.missingActionIds.length ? `漏掉必需动作 ${verdict.missingActionIds.join("、")}` : "",
      verdict.broadToolIds.length ? `工具范围过宽 ${verdict.broadToolIds.join("、")}` : "",
    ]
      .filter(Boolean)
      .join("；");
    problems.push(`${where}: 照这个玩法自己声明的正解走完，引擎判定没过——${why}`);
  }
}

/**
 * An eval scenario is solvable when the lesson's own release rule can be met.
 *
 * The learner freezes the required conditions, watches the product fail one of
 * them, adds the checks that catch it, and reruns. `assessEvalRelease` refuses
 * a release that skipped any of those steps — including `blind-spot`, which is
 * the whole point of the game: you may not ship what you never saw fail.
 *
 * So the check plays that sequence. An activity where no candidate ever fails a
 * boundary case can never satisfy `blind-spot`, and is unwinnable in a way that
 * looks, from the outside, like a learner who has not finished.
 */
function checkEval(activity, where) {
  if (!evalEngine) return;
  const { expectedEvalOutcome, freezeEvalCase, runEvalCandidate, assessEvalRelease } = evalEngine;
  const required = activity.requiredInputs ?? [];
  if (required.length === 0) {
    problems.push(`${where}: 没有 requiredInputs，读者冻结哪几道题全凭运气，无法确认这一关解得开`);
    return;
  }
  let cases = [];
  for (const input of required) {
    const frozen = freezeEvalCase(cases, input, expectedEvalOutcome(input));
    if (!frozen.valid) {
      problems.push(`${where}: 引擎不接受 requiredInputs 里的一道题（${frozen.reason}）`);
      return;
    }
    cases = [...cases, frozen.testCase];
  }
  const off = { information: false, availability: false, supported: false };
  const on = { information: true, availability: true, supported: true };
  const evidence = [];
  for (const candidate of activity.candidates ?? []) {
    const bare = runEvalCandidate(activity, cases, candidate.id, off);
    if (!bare.valid) {
      problems.push(`${where}: 引擎判定这个载荷本身不成立（${bare.reason}）`);
      return;
    }
    evidence.push(bare.run);
  }
  const releasable = (activity.candidates ?? []).filter((candidate) => {
    const guarded = runEvalCandidate(activity, cases, candidate.id, on);
    return (
      guarded.valid &&
      assessEvalRelease(activity, cases, [...evidence, guarded.run], guarded.run).passed
    );
  });
  if (releasable.length === 0) {
    problems.push(
      `${where}: 把该冻结的题全冻结、该加的检查全加上之后，没有一个版本能放行——这一关无解`,
    );
  }
  if (releasable.length === (activity.candidates ?? []).length) {
    problems.push(
      `${where}: 每个版本最后都能放行，读者比不出差别——至少要有一个版本是加了检查也救不回来的`,
    );
  }
}

/**
 * A context scenario is solvable when some selection inside the capacity fills
 * every slot, and unsolvable-looking when every one does.
 *
 * The capacity is the whole teaching device: it forces the reader to leave
 * something out. An activity where taking everything also passes has a capacity
 * that never bites, and one where nothing fits has a capacity that is simply
 * wrong — from the reader's side those look identical to being stuck.
 *
 * The search is exhaustive over subsets, which is honest for the sizes these
 * payloads actually have and says so out loud rather than sampling when it is
 * not.
 */
function checkContext(activity, where) {
  if (!contextEngine) return;
  const ids = (activity.documents ?? []).flatMap((doc) =>
    (doc.paragraphs ?? []).map((paragraph) => paragraph.id),
  );
  if (ids.length > 18) {
    problems.push(`${where}: ${ids.length} 段材料，穷举解会太慢——这一关没有被验证过解得开`);
    return;
  }
  const { evaluateContextPack } = contextEngine;
  let solutions = 0;
  let withinCapacity = 0;
  for (let mask = 0; mask < 1 << ids.length; mask += 1) {
    const pick = ids.filter((_, index) => mask & (1 << index));
    const result = evaluateContextPack(activity, pick);
    if (result.overCapacity) continue;
    withinCapacity += 1;
    if (result.passed) solutions += 1;
  }
  if (solutions === 0) {
    problems.push(`${where}: 装得下的材料组合里，没有一种能把每一格都填成 ready——这一关无解`);
  }
  const everything = evaluateContextPack(activity, ids);
  if (!everything.overCapacity && everything.passed) {
    problems.push(`${where}: 把所有材料全塞进去也能过——容量没有起作用，读者不必挑`);
  }
  if (solutions > 0 && solutions === withinCapacity) {
    problems.push(`${where}: 装得下的组合全都能过，读者挑什么都对——这一关没有在教挑选`);
  }
}

/**
 * A repair scenario is solvable when the reader can tell the patches apart by
 * operating the product, and pointless when they cannot.
 *
 * `checkRepairRegression` replays the learner's own events through `scoped` to
 * decide what should have happened, so `scoped` is the engine's reference
 * answer rather than one option among several — an activity that does not offer
 * it is grading against something the reader was never given.
 *
 * Two patches that behave identically under every sequence of the product's own
 * controls are one patch printed twice, and the choice between them is a coin
 * toss dressed as a judgement.
 */
function checkRepair(activity, where) {
  if (!repairEngine) return;
  const { initialRepairProduct, stepRepairProduct } = repairEngine;
  const offered = activity.offeredPatches ?? ["scoped", "rewrite", "removed"];
  if (!offered.includes("scoped")) {
    problems.push(
      `${where}: 候选修法里没有 scoped，而引擎正是拿它当标准答案回放读者的操作——` +
        `这一关会拿读者没见过的东西给他判分`,
    );
  }
  for (const patch of offered) {
    if (!activity.patches?.[patch]) {
      problems.push(`${where}: 候选里有 ${patch}，但 patches 里没有写它`);
      return;
    }
  }
  const events = [
    ...(activity.choices ?? []).map((choice) => ({ type: "choose", value: choice.id })),
    { type: "submit" },
    { type: "reload" },
    { type: "cancel" },
  ];
  const signature = (implementation) => {
    const seen = [];
    const walk = (product, depth) => {
      if (depth === 0) {
        seen.push(`${product.choice}/${product.savedChoice}/${product.reservations.join("+")}`);
        return;
      }
      for (const event of events) {
        walk(stepRepairProduct(activity, implementation, product, event).after, depth - 1);
      }
    };
    walk(initialRepairProduct(activity), 3);
    return seen.join(";");
  };
  const behaviour = new Map();
  for (const implementation of ["broken", ...offered]) {
    behaviour.set(implementation, signature(implementation));
  }
  if (offered.every((patch) => behaviour.get(patch) === behaviour.get("broken"))) {
    problems.push(`${where}: 没有一个候选修法的行为跟原样不同——这个毛病修不掉`);
  }
  for (let i = 0; i < offered.length; i += 1) {
    for (let j = i + 1; j < offered.length; j += 1) {
      if (behaviour.get(offered[i]) === behaviour.get(offered[j])) {
        problems.push(
          `${where}: 候选修法 ${offered[i]} 和 ${offered[j]} 怎么操作都一模一样，读者分不出来`,
        );
      }
    }
  }
}

/**
 * A tune scenario needs a reachable feasible region that the reader is not
 * already standing in.
 *
 * Every metric band has to hold at once, so the interesting failure is a set of
 * bands with no overlap — an activity nobody can finish, which from the slider
 * side is indistinguishable from not having found it yet. The opposite failure
 * is quieter: an activity whose starting position already satisfies everything,
 * where the reader completes it by touching nothing and learns nothing about
 * the tradeoff.
 *
 * The grid is a sample, not a proof. It is coarse enough to be fast and fine
 * enough to find any region worth asking a reader to find.
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
function checkDispatch(activity, where) {
  if (!dispatchEngine) return;
  const { createDispatchState, routeDispatch, dispatchStatus } = dispatchEngine;
  const lanes = activity.lanes ?? [];
  if (!lanes.some((lane) => lane.id === activity.cacheLaneId)) {
    problems.push(`${where}: cacheLaneId 指的 ${activity.cacheLaneId} 不是这一关里的通道`);
    return;
  }
  const keys = (activity.cards ?? []).map((card) => card.cacheKey).filter(Boolean);
  if (new Set(keys).size === keys.length) {
    problems.push(
      `${where}: 没有两件事用同一个缓存 key，缓存那条通道读者永远合法走不到——` +
        `这一关的机制是空的`,
    );
  }
  let solved = false;
  let anyFailure = false;
  const search = (state) => {
    const status = dispatchStatus(activity, state);
    if (status === "over-budget") {
      anyFailure = true;
      return;
    }
    if (status === "completed") {
      solved = true;
      return;
    }
    for (const lane of lanes) {
      const move = routeDispatch(activity, state, lane.id);
      if (!move.accepted) {
        anyFailure = true;
        continue;
      }
      search(move.state);
    }
  };
  search(createDispatchState());
  if (!solved) {
    problems.push(`${where}: 怎么排都排不完、或者一定超预算——这一关无解`);
  }
  if (!anyFailure) {
    problems.push(`${where}: 每一种排法都能过，预算和缓存都没在起作用`);
  }
}

const CHECKS = {
  connect: checkConnect,
  sort: checkSort,
  program: checkProgram,
  "ai-agent": checkAgent,
  "ai-eval": checkEval,
  "ai-context": checkContext,
  "ai-repair": checkRepair,
  tune: checkTune,
  dispatch: checkDispatch,
};
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

/*
  The same two directions, one boundary later.

  Everything above reads `apps/local/studies`, which is the authoring side — and
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
          const declared = new Set((lesson.activities ?? []).map((a) => a.id));
          const where = `交付 ${studyId}/${name.replace(/\.json$/, "")}/${lesson.id}`;
          for (const [, id] of (lesson.content ?? "").matchAll(/::play\{#([a-z0-9-]+)\}/g)) {
            if (!declared.has(id)) {
              problems.push(
                `${where}: 正文引用了 ::play{#${id}}，交付包里没有它——读者会看到一块报错`,
              );
            }
          }
          for (const id of declared) {
            if (!(lesson.content ?? "").includes(`::play{#${id}}`)) {
              problems.push(`${where}: 交付包里有组件 ${id}，正文从没引用它`);
            }
          }
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
if (problems.length === 0) {
  console.log("ok  每个组件都解得开，每个引用都指得到");
  process.exit(0);
}
for (const problem of problems) console.log(`  ${problem}`);
process.exit(1);
