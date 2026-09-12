#!/usr/bin/env node
/**
 * Build — and optionally apply — a revision of one landed lesson.
 *
 * Replaces two earlier one-off scripts that each knew half of this. Cards and
 * exercises are always carried forward whole, because the revise contract is
 * add-only: a proposal that omits an existing card is read as deleting it.
 * They keep their revision numbers as long as their text is unchanged, which
 * the workflow now checks rather than assumes.
 *
 * Usage:
 *   node revise-lesson.mjs <studyId> <courseId> <unitId> <lessonId> [options]
 *     --content <file>      replace content.md with this file
 *     --activity <file>     set the lesson's single activity to this payload
 *     --decision <file>     a pick-activity.mjs answer: applies both at once,
 *                           inserting its transition ahead of the play block
 *     --apply               actually run it; without this, only a dry run
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const WT = "/Users/yuanfei/PieAI/University-courses";
const args = process.argv.slice(2);
const [studyId, courseId, unitId, lessonId] = args;
const flag = (name) => {
  const at = args.indexOf(`--${name}`);
  return at < 0 ? null : args[at + 1];
};
const apply = args.includes("--apply");
if (!lessonId) {
  console.error("usage: revise-lesson.mjs <studyId> <courseId> <unitId> <lessonId> [--content f] [--activity f] [--decision f] [--apply]");
  process.exit(2);
}

const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const base = `${WT}/apps/local/studies/${studyId}/courses/${courseId}/units/${unitId}/lessons/${lessonId}`;
const rev = read(`${base}/latest.json`).contentRevision;
const manifest = read(`${base}/revisions/${rev}/manifest.json`);
let content = readFileSync(`${base}/revisions/${rev}/content.md`, "utf8");
let activities = manifest.activities ?? [];

const decision = flag("decision") ? read(flag("decision")) : null;
if (decision && decision.decision === "add") {
  const activity = decision.activity;
  activities = [activity];
  // Where the play block goes is what the role means, so the role decides it
  // rather than the model choosing a line number.
  const anchor =
    activity.role === "observe" ? "\n## 先猜一下\n" : "\n## 自检\n";
  if (!content.includes(anchor)) throw new Error(`${lessonId}：找不到锚点 ${anchor.trim()}`);
  const block = `\n${decision.transition.trim()}\n\n::play{#${activity.id}}\n${anchor}`;
  content = content.replace(anchor, block);
}

if (flag("content")) content = readFileSync(flag("content"), "utf8");
if (flag("activity")) activities = [read(flag("activity"))];

const collect = (dir, file) =>
  readdirSync(`${base}/${dir}`).map((id) => {
    const r = read(`${base}/${dir}/${id}/latest.json`).contentRevision;
    const body = read(`${base}/${dir}/${id}/revisions/${r}/${file}`);
    const { schemaVersion, contentRevision, contentHash, status, courseId: _c, unitId: _u, lessonId: _l, ...rest } = body;
    return { id, expectedRevision: contentRevision, ...rest };
  });

const snapshots = readdirSync(`${WT}/apps/local/studies/${studyId}/source/snapshots`)
  .filter((name) => name.endsWith(".json"))
  .map((name) => name.replace(/\.json$/, ""));
if (snapshots.length !== 1) throw new Error(`期待恰好一个快照，实际 ${snapshots.length} 个`);

const proposalPath = `/tmp/revise-${lessonId}.json`;
writeFileSync(
  proposalPath,
  JSON.stringify(
    {
      schemaVersion: 1,
      proposalId: `${lessonId}-r${rev + 1}`,
      targetSnapshotId: snapshots[0],
      lesson: {
        courseId,
        unitId,
        id: lessonId,
        expectedRevision: rev,
        title: manifest.title,
        variant: manifest.variant,
        content,
        evidence: manifest.evidence,
        activities,
        cards: collect("cards", "card.json"),
        exercises: collect("exercises", "exercise.json"),
      },
    },
    null,
    2,
  ) + "\n",
);

const cli = ["--filter", "@pieai/university-local", "exec", "node", ".university-local-build/server/cli.js"];
const run = (extra) =>
  execFileSync("pnpm", [...cli, ...extra], { cwd: WT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });

const dry = run(["course", "revise", "--study", studyId, "--input", proposalPath, "--dry-run"]);
const validated = JSON.parse(dry.slice(dry.indexOf("{"), dry.lastIndexOf("}") + 1));
const bumped = Object.entries(validated.revisions.cards)
  .concat(Object.entries(validated.revisions.exercises))
  .filter(([, n]) => n > 1).length;
console.log(
  `${lessonId}: 干跑通过 → 课文 rev ${validated.revisions.lesson}` +
    `，组件 ${activities.length}，被动推号的卡片/练习 ${bumped}`,
);

if (apply) {
  run(["course", "revise", "--study", studyId, "--input", proposalPath]);
  console.log(`${lessonId}: 已落盘`);
}
