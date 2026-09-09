#!/usr/bin/env node
/**
 * Ask the Writer/fixer arm whether one landed lesson earns an interactive
 * activity, and if so to author it.
 *
 * Deciding is the point, not authoring. A run that answers "no activity, and
 * here is why" is a success: the rule this dispatches is written so that most
 * lessons do not earn one, and a pipeline that always produces a game has
 * stopped asking the question.
 *
 * Draft only. Turning the answer into a lesson revision stays outside.
 *
 * Usage: node pick-activity.mjs <studyId> <courseId> <unitId> <lessonId> <out.json>
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const WT = "/Users/yuanfei/PieAI/University-courses";
const SKILL = `${WT}/apps/local/.agents/skills/write-lesson`;

const [studyId, courseId, unitId, lessonId, outPath] = process.argv.slice(2);
if (!outPath) {
  console.error("usage: pick-activity.mjs <studyId> <courseId> <unitId> <lessonId> <out.json>");
  process.exit(2);
}

const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const text = (p) => readFileSync(p, "utf8");
const base = `${WT}/apps/local/studies/${studyId}/courses/${courseId}/units/${unitId}/lessons/${lessonId}`;
const rev = read(`${base}/latest.json`).contentRevision;
const manifest = read(`${base}/revisions/${rev}/manifest.json`);
const content = text(`${base}/revisions/${rev}/content.md`);

const unit = read(`${WT}/apps/local/studies/${studyId}/courses/${courseId}/units/${unitId}/unit.json`);
const course = read(`${WT}/apps/local/studies/${studyId}/courses/${courseId}/course.json`);
const position = unit.lessonIds.indexOf(lessonId) + 1;

/*
  What the neighbours already use. The rotation and repetition rules can only be
  applied by someone who can see them, and the model sees one lesson at a time.
*/
const siblings = unit.lessonIds
  .filter((id) => id !== lessonId)
  .map((id) => {
    try {
      const r = read(`${WT}/apps/local/studies/${studyId}/courses/${courseId}/units/${unitId}/lessons/${id}/latest.json`).contentRevision;
      const m = read(`${WT}/apps/local/studies/${studyId}/courses/${courseId}/units/${unitId}/lessons/${id}/revisions/${r}/manifest.json`);
      const used = (m.activities ?? []).map((a) => `${a.kind}(${a.role})`).join("、") || "无";
      return `  第 ${unit.lessonIds.indexOf(id) + 1} 节 ${id}：${m.variant ?? "?"}，组件 ${used}`;
    } catch {
      return `  第 ${unit.lessonIds.indexOf(id) + 1} 节 ${id}：读不到`;
    }
  })
  .join("\n");

/*
  Every payload file, not just types.ts.

  types.ts spells out connect / tune / hunt / dispatch / program in full and
  imports the five AI ones by name only — so the model was choosing between five
  complete specifications and five labels. That is a thumb on the scale, and it
  is the most likely reason the first twenty decisions never reached for an AI
  kind. Sort lives in its own file too.
*/
const PAYLOAD_FILES = [
  "types.ts",
  "sort.ts",
  "ai-brief.ts",
  "ai-context.ts",
  "ai-agent.ts",
  "ai-eval.ts",
  "ai-repair.ts",
];
const typesSource = PAYLOAD_FILES.map(
  (name) => `// ── ${name} ──\n${text(`${WT}/packages/core/src/learning-play/${name}`)}`,
).join("\n\n");

const prompt = `你要为一节**已经写好、形状已经合格**的课，判断它该不该配一个互动课件。

**默认是不配。** 大多数课不该配。你的任务首先是判断，其次才是编写。
答"不配，理由是……"是一个成功的结果，不是失败。

====== 选组件的规则（这是唯一权威）======

${text(`${SKILL}/references/activities.md`)}

====== 十一种玩法的载荷字段（TypeScript 类型，照它填字段）======

${typesSource}

注意：\`ActivityBase\` 的字段（id、title、brief、goal、takeaway、hint、source）
每一种玩法都要有。除此之外还要加两个我们自己的字段：
- \`kind\`：十种之一
- \`role\`：observe / demonstrate / apply
- \`difficulty\`：intro / practice / challenge

坐标 \`x\`/\`y\` 是**百分比**，取值 0–100，不是格子序号。

====== 这一节的情况 ======

**课程**：${course.title}（${course.audience}）
**课程目标**：${(course.objectives ?? []).join(" / ")}
**单元**：${unit.title} —— ${unit.objective}
**位置**：第 ${position} 节，共 ${unit.lessonIds.length} 节
**变体**：${manifest.variant ?? "无"}

**同单元其它课已经用了什么组件**（轮换和重复规则要看这个）：
${siblings || "  （没有其它课）"}

**这一节可用的出处**（组件的 source 只能从这里选，不许新增，不许编造）：

${JSON.stringify(manifest.evidence ?? [], null, 2)}

**课文全文**：

---
${content}
---

====== 输出要求 ======

只输出一段 JSON，不要用代码块包裹，不要在它前面写任何叙述。形如：

{"decision":"none","why":"……"}

或者：

{"decision":"add","why":"……","transition":"……","activity":{……}}

字段说明：
- \`why\`：**一句话**说清为什么配 / 为什么不配。配的话要说出"课文里哪个词
  让你选了这一种玩法"；不配的话要说出撞了规则里的哪一条。
- \`transition\`：写进课文、紧挨在组件前面的**一到两句话**，把读者交给组件。
  说清接下来做什么、做完能看出什么。不要复述组件里的内容。
  不许出现"互动组件""课件""练习题"这类词——读者不知道这套系统存在。
- \`activity\`：完整载荷，字段照上面的类型填齐。

再确认几条最容易翻车的：
1. 玩法的**必填字段这节课没有对应的真事**，就换一种或者不配。编一个假预算、
   假阈值来把字段填满，是这条规则最主要的坏掉方式。
2. \`role\` 是 \`observe\` 时，组件**不许泄题**——玩完之后预测题必须还悬着。
3. \`source.url\` 必须是上面出处列表里出现过的网址。
4. 所有面向读者的文字都用中文口语，对象是没写过代码的成年人。
5. id 用 kebab-case，且不要和课的 id 重名。
`;

const promptFile = resolve(`${outPath}.prompt.txt`);
writeFileSync(promptFile, prompt);

const started = Date.now();
const out = execFileSync(
  "grok",
  ["-m", "grok-4.6", "--effort", "xhigh", "--always-approve", "--prompt-file", promptFile],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 3_600_000, cwd: "/tmp" },
);

// Grok narrates onto the same stream as its answer, so take the last balanced
// JSON object rather than the whole of stdout.
const start = out.indexOf("{");
const end = out.lastIndexOf("}");
if (start < 0 || end < start) {
  throw new Error(`${lessonId}：${out.length} 字节输出里没有 JSON`);
}
const parsed = JSON.parse(out.slice(start, end + 1));
writeFileSync(outPath, JSON.stringify(parsed, null, 2) + "\n");

const seconds = Math.round((Date.now() - started) / 1000);
console.log(
  parsed.decision === "add"
    ? `${lessonId}：配 ${parsed.activity?.kind}/${parsed.activity?.role} —— ${parsed.why} (${seconds}s)`
    : `${lessonId}：不配 —— ${parsed.why} (${seconds}s)`,
);
