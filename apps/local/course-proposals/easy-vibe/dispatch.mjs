#!/usr/bin/env node
/**
 * Rewrite one easy-vibe lesson from the retired six-section skeleton into the
 * current spine, using the measured Writer/fixer arm.
 *
 * The contract is inlined from main's working tree rather than read by the
 * model from this worktree, because this worktree's skill files are the older
 * committed ones and main's are newer and uncommitted. Pointing the model at
 * either tree would give it one of two wrong answers: stale rules here, or
 * write access to somebody else's in-flight work there.
 *
 * Draft-only. It writes a markdown file; injecting into the proposal JSON and
 * running the gates stays here.
 *
 * Usage: node dispatch.mjs <unit-file> <lesson-id> <variant> <out.md>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const MAIN = "/Users/yuanfei/PieAI/University";
const WT = "/Users/yuanfei/PieAI/University-wt-easy-vibe";
const SKILL = `${MAIN}/apps/local/.agents/skills/write-lesson`;

const [unitFile, lessonId, variant, outPath] = process.argv.slice(2);
if (!outPath) {
  console.error("usage: dispatch.mjs <unit-file> <lesson-id> <variant> <out.md>");
  process.exit(2);
}

const unit = JSON.parse(readFileSync(`${WT}/apps/local/course-proposals/easy-vibe/${unitFile}`, "utf8"));
const lesson = unit.lessons.find((l) => l.id === lessonId);
if (!lesson) throw new Error(`no lesson ${lessonId} in ${unitFile}`);

const read = (p) => readFileSync(p, "utf8");

const prompt = `你要把一节课从**已经退休的旧骨架**改写成**现行骨架**。

读者是一个**没写过代码的成年人**：他会用电脑和手机，手里有一个自己想做的东西，
现在想用 AI 帮他做出来。他不笨，但不懂任何术语。

这是一门**通用课，没有代码仓库、没有代码快照**。所以：
- 绝对不许出现 \`[[evidence:文件:行号]]\` 这种锚点，也不许编造文件名或行号
- 出处是权威原始资料的网址（MDN、各家官方文档等）
- **每一条出处必须在正文里以可点击的 Markdown 链接出现**：\`[说明文字](网址)\`。
  只写在 evidence 字段里不算数，机器会判错。

====== 现行骨架与全部规矩（这是唯一权威，照它写）======

${read(`${SKILL}/SKILL.md`)}

====== 五个变体的结构约束 ======

${read(`${SKILL}/references/variants.md`)}

====== 验收清单 ======

${read(`${SKILL}/references/checklist.md`)}

====== 卡片和练习的合同 ======

${read(`${SKILL}/references/cards-and-exercises.md`)}

====== 没有仓库时证据怎么办 ======

${read(`${SKILL}/references/evidence-and-failures.md`)}

====== 这一节的具体情况 ======

**这一节在这个单元里的位置**：第 ${unit.lessons.findIndex((l) => l.id === lessonId) + 1} 节，共 ${unit.lessons.length} 节。
**单元目标**：${unit.unit.objective}

**指定变体：${variant}**。按上面 variants.md 里 ${variant} 的中段数量和必带小节来写，不要改变体。

**这一节可用的出处**（只能用这些，不许新增，不许编造）：

${JSON.stringify(lesson.evidence ?? [], null, 2)}

**旧骨架的原稿**（内容和事实照搬，形状全部推翻重来）：

---
${lesson.content}
---

====== 输出要求 ======

先输出**改写后的完整课文 Markdown**，第一行是 \`# <问句标题>\`。
**这一行前面不许有任何叙述文字**——你的过程说明如果和标题挤在同一行，会被切错。

课文写完之后，另起一行写下这一行分隔符：

\`\`\`
===CARDS-AND-EXERCISE===
\`\`\`

然后输出一段 JSON（不要用代码块包裹），形如：

\`\`\`
{"cards":[{"front":"...","back":"..."}],"exercise":{"prompt":"...","expectedAnswer":"..."}}
\`\`\`

卡片和练习必须由**你**来写，因为只有你知道这一稿的课文讲了什么。要求：
- 卡片 **2 到 3 张**；正面 **≤40 字**、背面 **≤120 字**；**考理解不考名字**
  （「XX 叫什么」这种查得到的东西不许做成卡片）；背面要能脱离课文独立看懂，
  不许出现「见上文」「前面说过」
- 练习**恰好 1 道**，\`expectedAnswer\` 必须是**一个词或一个短短语**、机器能直接比对；
  题干给一个**和课文、和自检都不一样的新场景**，让读者做判断而不是复述定义；
  题干里如果给了选项，选项字面必须和 \`expectedAnswer\` 一模一样

再确认一遍最容易翻车的几条：
1. \`## 先猜一下\` 恰好一次，紧跟其后必须是 \`## 答案\`（标题就两个字，不许加后缀）
2. \`## 先猜一下\` 里必须原样包含这一行：先写下你的判断，再往下看答案。
3. \`## 一句话\` 是最后一节，正文是**一句**加粗的话
4. 不许出现 \`## 学习目标\` \`## 先给结论\` \`## 一个类比\` \`## 工作示例\` \`## 重点\`
5. \`:::detail[读者会问的问句？]\` 块：至少 1 块最多 8 块，
   **所有块正文加起来不少于标准正文字数的 60%**，标题必须以问号结尾
6. \`## 自检\` 只提问不给答案，而且要**换一个输入、条件或例子**，不要复用正文那个场景
7. 中段小标题写成读者自己会问的话，不要写「现象」「对比」这种内部标签
8. 每 1000 字至少 2 个「你」
`;

// Absolute, because grok runs with cwd /tmp so it cannot touch either tree,
// and a relative prompt path would be resolved against that cwd instead.
const promptFile = resolve(`${outPath}.prompt.txt`);
writeFileSync(promptFile, prompt);

const started = Date.now();
const out = execFileSync(
  "grok",
  [
    "-m", "grok-4.6",
    "--effort", "xhigh",
    "--always-approve",
    "--prompt-file", promptFile,
  ],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 1_500_000, cwd: "/tmp" },
);

/*
  Grok narrates its progress on the same stream as the answer, so the raw
  stdout starts with a paragraph of "先跑 preflight，再对照前后几节…" before the
  lesson. `lesson-pipeline-runner.mjs` already solved this by splitting at the
  first Markdown H1; do the same rather than inventing a second rule.
*/
// Not anchored to a line start: grok glued 385 characters of narration to the
// front of the title on one line, so `lesson-pipeline-runner.mjs`'s `^# ` split
// finds nothing on exactly this output. Match the first single `#` heading
// wherever it sits, and never a `##` section.
const h1 = out.search(/(?<!#)# (?!#)/u);
if (h1 < 0) throw new Error(`no H1 in ${out.length} bytes of output — model returned no lesson`);
const body = out
  .slice(h1)
  .replace(/^```(?:markdown|md)?\n/, "")
  .replace(/\n```\s*$/, "")
  .trim();

const [prose, tail] = body.split("===CARDS-AND-EXERCISE===");
writeFileSync(outPath, prose.trim() + "\n");

let extras = null;
if (tail) {
  const json = tail.slice(tail.indexOf("{"), tail.lastIndexOf("}") + 1);
  try {
    extras = JSON.parse(json);
    writeFileSync(`${outPath}.extras.json`, JSON.stringify(extras, null, 2) + "\n");
  } catch (error) {
    console.log(`  ! 卡片/练习 JSON 解析失败：${String(error.message).slice(0, 60)}`);
  }
}

const cards = extras?.cards?.length ?? 0;
console.log(
  `${lessonId} [${variant}] ${lesson.content.length} → ${prose.trim().length} 字` +
    `, 卡片 ${cards}, 练习 ${extras?.exercise ? 1 : 0}` +
    `, ${Math.round((Date.now() - started) / 1000)}s`,
);
