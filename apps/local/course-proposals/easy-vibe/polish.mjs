// Draft is ours, final voice is flash's.
//
// Flash writes more spoken Chinese than either Claude or Codex does, and for a
// course whose whole promise is "explained in plain words" that is not a
// nicety, it is the product. But flash does not know the gates, so every
// returned body is checked structurally before it is kept. A body failing any
// check is dropped and the draft stands — a bad polish is a no-op, never a red
// gate and never a silent regression.
//
// Usage:
//   node apps/local/course-proposals/easy-vibe/polish.mjs <unit.json> [lessonId]
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const SECTIONS = ["## 学习目标", "## 先给结论", "## 一个类比", "## 工作示例", "## 自检", "## 重点"];
const BANNED = ["众所周知", "显而易见", "简单来说", "不言而喻"];
const ANALOGY_WORDS = /就像|好比|相当于|类似于|想象|想成|当作|看成|打个比方|如同|等于是|好像/u;

const file = process.argv[2];
const only = process.argv[3];
const doc = JSON.parse(readFileSync(file, "utf8"));
const lessons = doc.lessons ?? doc.course?.units?.flatMap((u) => u.lessons) ?? [];

const PROMPT = `你是中文技术科普的润色编辑。下面是一节课文，读者是**一个没写过代码的成年人**——
他会用电脑和手机，手里有一个想做的东西，现在想用 AI 帮他做出来。他不是小孩，
不要把他当小孩哄；但他确实不懂任何术语。

请把它改得更口语、更像一个人在跟他讲话，同时严格遵守：

1. **六个小节标题一个字都不许改，顺序不许变**：## 学习目标 / ## 先给结论 / ## 一个类比 / ## 工作示例 / ## 自检 / ## 重点
2. **「## 学习目标」那一句必须保持「读完你能……」开头，而且必须是一件能自己验证的事。**
   不许改成「读完你能了解／明白／理解／知道……」——那些没法自检。
3. **不许删内容，不许加新知识点。**只改说法，不改事实。尤其不许改动任何数字、
   命令、代码、URL、专有名词。
4. 「## 一个类比」里必须保留一个比喻词（就像／好比／想象／打个比方 等），
   并且保留「不一样的地方是……」那一段——类比在哪里失效，是这门课的规矩。
5. **禁止出现**：众所周知、显而易见、简单来说、不言而喻。
6. 保留所有 Markdown 结构：列表、加粗、代码块、表格、引用块原样不动。
7. 长句拆短。书面词换口语词（「于是乎」→「所以」，「习得」→「学会」，「该模型」→「它」，
   「进行配置」→「设置」）。
8. 保持第二人称「你」，不要变成「我们」或「读者」。

**只输出润色后的完整课文，不要任何解释、不要代码块包裹。**

课文如下：

`;

let changed = 0;
let kept = 0;
let failed = 0;

for (const lesson of lessons) {
  if (only && lesson.id !== only) continue;
  const before = lesson.content;
  let out;
  try {
    out = execFileSync(
      "agy",
      [
        "-p",
        PROMPT + before,
        "--model",
        "gemini-3.8-flash-high",
        "--effort",
        "high",
        "--dangerously-skip-permissions",
      ],
      { encoding: "utf8", maxBuffer: 40 * 1024 * 1024, timeout: 600_000 },
    ).trim();
  } catch (error) {
    console.log(`  ✗ ${lesson.id}: agy 调用失败 — ${String(error.message).slice(0, 80)}`);
    failed += 1;
    continue;
  }
  out = out.replace(/^```(?:markdown|md)?\n/, "").replace(/\n```$/, "").trim();

  const reasons = [];
  let cursor = -1;
  for (const s of SECTIONS) {
    const at = out.indexOf(s);
    if (at === -1) reasons.push(`缺 ${s}`);
    else if (at < cursor) reasons.push(`${s} 顺序错`);
    else cursor = at;
  }

  const analogy = /## 一个类比\s*([\s\S]*?)(?=\n## |$)/u.exec(out);
  if (!analogy || !ANALOGY_WORDS.test(analogy[1])) reasons.push("类比丢了比喻词");

  /*
    The objective line is the one thing a polish reliably breaks and no gate
    catches. Flash softened five of them on the previous course, from
    「读完你能说出…」 to 「弄明白…」 — better Chinese, and no longer something
    a reader can test themselves against. It passed all three gates. So this
    step checks two things the gates do not: the form survived, and the verb
    is still one that can be self-checked.
  */
  const goal = /## 学习目标\s*\n+([^\n]+)/u.exec(out);
  const goalText = goal ? goal[1].trim() : "";
  if (!goal) reasons.push("学习目标不见了");
  else if (!/^读完你能/.test(goalText)) reasons.push(`学习目标丢了「读完你能」：「${goalText.slice(0, 18)}…」`);
  else if (/^读完你能(弄明白|了解|明白|理解|认识|懂得|知道)/u.test(goalText))
    reasons.push(`学习目标被改成不可验证的说法：「${goalText.slice(0, 20)}…」`);

  for (const b of BANNED) if (out.includes(b)) reasons.push(`出现禁用词「${b}」`);
  for (const link of before.match(/\[\[[^\]]+\]\]/gu) ?? [])
    if (!out.includes(link)) reasons.push(`丢了链接 ${link}`);

  /*
    URLs are facts; a polish must not touch them. The character class matters:
    `\S+` looks right and is wrong here, because CJK text is not whitespace, so
    it swallows the entire following clause into the "URL" and then reports the
    lesson as having lost a link it never had. That rejected a correctly
    polished lesson whose prose happened to mention `http://localhost:5173/`
    mid-sentence. Bound it to characters a URL may actually contain.
  */
  for (const url of before.match(/https?:\/\/[\w\-.~:/?#[\]@!$&'()*+,;=%]+/gu) ?? [])
    if (!out.includes(url)) reasons.push(`丢了链接 ${url.slice(0, 40)}`);

  if (out.length < before.length * 0.55) reasons.push(`太短（${out.length} vs ${before.length}）`);

  if (reasons.length) {
    console.log(`  ✗ ${lesson.id}: ${reasons.join("；")} — 保留原稿`);
    kept += 1;
  } else {
    lesson.content = out;
    console.log(`  ✓ ${lesson.id}  ${before.length} → ${out.length} 字`);
    changed += 1;
  }
}

writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`);
console.log(`\n润色 ${changed} 节，保留原稿 ${kept} 节，调用失败 ${failed} 节`);
