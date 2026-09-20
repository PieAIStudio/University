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
let isValidContrastActivity = null;
let isValidWeighActivity = null;
let isValidBriefActivity = null;
let huntEngine = null;
let isValidProgramActivity = null;
let agentEngine = null;
let evalEngine = null;
let contextEngine = null;
let repairEngine = null;
let tuneEngine = null;
let dispatchEngine = null;
try {
  ({ isValidSortActivity } = await import("../../../packages/core/dist/learning-play/sort.js"));
  ({ isValidContrastActivity } =
    await import("../../../packages/core/dist/learning-play/contrast.js"));
  ({ isValidWeighActivity } = await import("../../../packages/core/dist/learning-play/weigh.js"));
  ({ isValidBriefActivity } =
    await import("../../../packages/core/dist/learning-play/ai-brief.js"));
  huntEngine = await import("../../../packages/core/dist/learning-play/hunt.js");
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
 * A contrast board has to contain both answers.
 *
 * The engine refuses a board whose cases all agree or all split, because a
 * reader who answers the same way every time finishes it — and finishing it is
 * indistinguishable, from outside, from having understood the distinction it
 * was supposed to teach. The other half is quieter: an `outcomes` map missing a
 * key renders a blank column, which reads as 「it does nothing here」 rather
 * than as the missing text it is.
 */
function checkContrast(activity, where) {
  if (!isValidContrastActivity) return;
  if (!isValidContrastActivity(activity)) {
    problems.push(
      `${where}: 引擎判定这个对照台不成立——两边的结果全一样或全不一样（那就没有对照），或者某个情况没写全两种做法各自的结果`,
    );
  }
}

/**
 * A weigh board must not have a choice that is always right.
 *
 * This is the one rule that separates a trade-off from a quiz, and it is
 * invisible to every other check: each situation has an answer, each answer has
 * a reason, the reader can finish. They finish by picking the same thing every
 * time, which is the exact habit a 决策 lesson exists to break.
 */
function checkWeigh(activity, where) {
  if (!isValidWeighActivity) return;
  if (!isValidWeighActivity(activity)) {
    problems.push(
      `${where}: 引擎判定这个取舍台不成立——有个选项一次都赢不了（那它就不是取舍，是送分），或者情况数少于选项数、正确选项不在选项里`,
    );
  }
}

/**
 * A hunt has to have a counterexample inside the range the learner can reach.
 *
 * This is the only kind that had no check, and the reason it went last is the
 * reason it was worth writing: the engine already refuses a malformed payload
 * with `"invalid-activity"`, so the shape was covered — but a well-formed hunt
 * whose boundary sits outside `input.min…max` is a round nobody can finish.
 * The reader tries values until they give up, and it looks exactly like being
 * bad at it.
 *
 * The points are sampled rather than reasoned about, because the engine is
 * where the two models live and a second copy of 「threshold differs at the
 * boundary, clamp differs below zero」 here would be a rule that drifts.
 */
function checkHunt(activity, where) {
  if (!huntEngine) return;
  const { min, max } = activity.input ?? {};
  const shape = huntEngine.evaluateHunt(activity, activity.input?.initial ?? min);
  if (!shape.valid && shape.reason === "invalid-activity") {
    problems.push(`${where}: 引擎判定这个反例猎手本身不成立——范围或分界写错了`);
    return;
  }
  const points = new Set([min, max, activity.boundary, 0, -1, activity.boundary - 1]);
  for (let step = 0; step <= 40; step += 1) points.add(min + ((max - min) * step) / 40);
  const found = [...points].some((value) => {
    if (!Number.isFinite(value) || value < min || value > max) return false;
    const verdict = huntEngine.evaluateHunt(activity, value);
    return verdict.valid && verdict.counterexample;
  });
  if (!found) {
    problems.push(
      `${where}: 这一关的输入范围里找不到任何反例——读者怎么试都过不了，而且看起来像是自己没试对`,
    );
  }
}

/**
 * A brief has to be agreeable and then observable.
 *
 * This kind had no engine check at all, because until the axes came out of the
 * engine there was nothing payload-specific left to be wrong: every brief was
 * the same three axes and the same two buttons. Now that a lesson brings its
 * own agreements, the joins can miss — an action decided by an axis nobody is
 * asked about, a gate on one, an outcome with nothing to show for it — and each
 * of those renders as a product that does not react to what the learner just
 * agreed to.
 */
function checkBrief(activity, where) {
  if (!isValidBriefActivity) return;
  if (!isValidBriefActivity(activity)) {
    problems.push(
      `${where}: 引擎判定这个原型台不成立——某个动作或门槛挂在没人问到的约定上，或者某个结果没有对应的说法`,
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
    ...(activity.choices ?? []).map((choice) => ({
      type: "choose",
      value: choice.id,
    })),
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

const { LessonActivitySchema: PathActivitySchema, interactionLessonIssues } =
  await import("../../../packages/core/dist/domain/schemas.js");

const CHECKS = {
  primm: (activity, where) => {
    const result = PathActivitySchema.safeParse(activity);
    if (!result.success)
      problems.push(...result.error.issues.map((issue) => `${where}: ${issue.message}`));
  },
  "interaction-path": (activity, where) => {
    const result = PathActivitySchema.safeParse(activity);
    if (!result.success)
      problems.push(...result.error.issues.map((issue) => `${where}: ${issue.message}`));
  },
  connect: checkConnect,
  sort: checkSort,
  contrast: checkContrast,
  weigh: checkWeigh,
  "ai-brief": checkBrief,
  hunt: checkHunt,
  program: checkProgram,
  "ai-agent": checkAgent,
  "ai-eval": checkEval,
  "ai-context": checkContext,
  "ai-repair": checkRepair,
  tune: checkTune,
  dispatch: checkDispatch,
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
  working directory, so running it from `apps/local` instead of the repository
  root walked zero lessons and still printed `ok` — a green light for a gate
  that was not looking at anything. Every real run has hundreds of lessons, so
  a floor of one costs nothing and turns the silent case into a loud one.
*/
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
