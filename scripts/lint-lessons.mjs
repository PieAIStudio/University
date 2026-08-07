#!/usr/bin/env node
/**
 * Mechanical enforcement of the lesson shape.
 *
 * The `write-lesson` skill carries a 25-item acceptance checklist, and until
 * now the only thing enforcing it was an agent reading the list and reporting
 * that it had passed. That works for six lessons and cannot possibly hold for
 * 481: self-assessment drifts, and a rule nobody can verify is a rule that
 * quietly stops being true.
 *
 * So this checks everything that is machine-checkable, and deliberately says
 * nothing about the rest. "Is the title a question an outsider would care
 * about" needs judgement and stays with the reviewer; "does the title end in a
 * question mark" does not, and belongs here.
 *
 * Only lessons whose manifest declares a `variant` are linted. The other 475
 * predate the shapes, and failing them all would train everyone to ignore the
 * output.
 *
 * Usage:
 *   node scripts/lint-lessons.mjs                    # every study
 *   node scripts/lint-lessons.mjs --study turing-pact --course foundations-before-zero
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? null : args[index + 1];
};
const onlyStudy = flag("study");
const onlyCourse = flag("course");

const VARIANTS = {
  现象: { open: "现象", middle: ["为什么是这样"] },
  对比: { open: "两个东西", middle: ["逐条对照", "什么时候用哪个"] },
  溯源: { open: "你看到的结果", middle: ["一站一站往回走"] },
  决策: { open: "情境和约束", middle: ["代价和收益", "什么时候该反过来"] },
  术语: { open: "一句真实出现的话", middle: ["三个真实用例", "它不是什么"] },
};

const GUESS_LINE = "随便猜，猜错不影响任何进度。";
const BANNED = ["显然", "简单来说", "众所周知"];

/** Regions the shape rules do not apply inside — a lesson may show its own syntax. */
function stripCode(text) {
  return text
    .replace(/^[ \t]*(`{3,}|~{3,})[\s\S]*?^[ \t]*\1[ \t]*$/gm, (m) => " ".repeat(m.length))
    .replace(/`[^`\n]+`/g, (m) => " ".repeat(m.length));
}

function sectionsOf(prose) {
  return [...prose.matchAll(/^##[ \t]+(.+?)[ \t]*$/gm)].map((m) => m[1].trim());
}

/**
 * Text belonging to `## name`, up to the next `##`.
 *
 * Split rather than a lookahead regex: with the `m` flag `$` matches the end of
 * every line, so `(?=^##|$)` terminates the body at the first newline and every
 * section looks empty. That bug reported all six lessons as missing text they
 * plainly contained.
 */
function sectionBody(prose, name) {
  const parts = prose.split(/^##[ \t]+/m);
  for (const part of parts.slice(1)) {
    const newline = part.indexOf("\n");
    const heading = (newline === -1 ? part : part.slice(0, newline)).trim();
    if (heading === name) {
      return newline === -1 ? "" : part.slice(newline + 1);
    }
  }
  return "";
}

/**
 * Headings are matched exactly.
 *
 * A tolerant match sounds kind and is not: `## 答案（他们选了什么）` and
 * `## 答案` would both pass here while two different agents produced
 * structurally different files, and every downstream tool would need the same
 * tolerance or disagree about where a section starts.
 */
function matches(heading, name) {
  return heading === name;
}

function lintLesson({ contentPath, manifestPath, content, manifest, id }) {
  const problems = [];
  const fail = (item, message) => problems.push({ item, message });
  const prose = stripCode(content);
  const sections = sectionsOf(prose);

  // 1 — variant declared in the manifest, absent from the prose.
  const variant = manifest.variant;
  const shape = VARIANTS[variant];
  if (!shape) return [{ item: 1, message: `manifest variant 不是五种之一：${variant}` }];
  if (/<!--\s*variant/i.test(content)) {
    fail(1, "content.md 里还有 <!-- variant --> 注释，它会当作正文显示出来");
  }

  // 2 — the title is at least shaped like a question.
  const title = /^#[ \t]+(.+)$/m.exec(content)?.[1]?.trim() ?? "";
  if (!/[？?]\s*$/.test(title)) fail(2, `标题不是问句（不以问号结尾）：${title || "缺 H1"}`);

  // 3, 4 — the variant's sections, in order, with its mandatory ones present.
  const required = [shape.open, "先猜一下", "答案", ...shape.middle, "自检", "一句话"];
  let cursor = -1;
  for (const name of required) {
    const at = sections.findIndex((heading, i) => i > cursor && matches(heading, name));
    if (at === -1) {
      fail(3, `${variant} 变体缺少章节「${name}」（或顺序不对）`);
      break;
    }
    cursor = at;
  }

  // 5, 6, 7 — exactly one prediction, open-ended, with the verbatim invitation.
  const guessCount = sections.filter((name) => name === "先猜一下").length;
  if (guessCount !== 1) fail(5, `「先猜一下」出现了 ${guessCount} 次，必须恰好 1 次`);
  const guessBody = sectionBody(prose, "先猜一下");
  if (!guessBody.includes(GUESS_LINE)) fail(7, `「先猜一下」里缺少原句：${GUESS_LINE}`);
  if (/^[ \t]*[-*][ \t]*[A-Da-d][.、)]/m.test(guessBody) || /^[ \t]*[A-D][.、)]/m.test(guessBody)) {
    fail(6, "预测题看起来是选择题；选项会把答案泄漏出去");
  }

  // 9 — the answer is the very next section.
  const guessAt = sections.indexOf("先猜一下");
  if (guessAt !== -1 && !matches(sections[guessAt + 1] ?? "", "答案")) {
    fail(9, `「先猜一下」后面不是「答案」，而是「${sections[guessAt + 1] ?? "（没有了）"}」`);
  }

  // 14b — the self-check must not resolve itself.
  const selfCheck = sectionBody(prose, "自检");
  if (/\*\*答[：:]\*\*|^答[：:]/m.test(selfCheck)) {
    fail(14, "「自检」里印了答案；自检只出题，答案由下面的练习题批改");
  }

  // 15, 16 — link budget and placement.
  const links = [...prose.matchAll(/\[\[lesson:/g)];
  if (links.length > 3) fail(15, `跨课链接 ${links.length} 个，上限 3 个`);
  for (const name of [shape.open, "先猜一下"]) {
    if (/\[\[lesson:/.test(sectionBody(prose, name))) {
      fail(16, `「${name}」里有跨课链接；这一段的任务是制造悬念，不该把人送走`);
    }
  }

  // 20 — words that skip the explanation.
  for (const word of BANNED) {
    if (prose.includes(word)) fail(20, `出现了禁用词「${word}」`);
  }

  // 21 — one bold sentence to keep.
  const closing = sectionBody(prose, "一句话").trim();
  if (!/^\*\*[\s\S]+\*\*$/.test(closing)) fail(21, "「一句话」不是单独一句加粗的话");
  else if ((closing.match(/[。！？]/g) ?? []).length > 1) fail(21, "「一句话」超过一句");

  // 12 — every code block quoting a real file is anchored.
  //
  // `text` / `md` / `mermaid` fences are excluded: those are syntax demos and
  // diagrams, which quote nothing and have no line to point at. Anything else
  // is assumed to be lifted from the studied repository, because that is what a
  // lesson here is for.
  const ILLUSTRATIVE = new Set(["", "text", "txt", "md", "markdown", "mermaid"]);
  const fences = [...content.matchAll(/^[ \t]*(`{3,})([^\n]*)\n[\s\S]*?^[ \t]*\1[ \t]*$/gm)];
  for (const fence of fences) {
    if (ILLUSTRATIVE.has(fence[2].trim().toLowerCase())) continue;
    const tail = content.slice(fence.index + fence[0].length).slice(0, 220);
    if (!/\[\[evidence:/.test(tail)) {
      fail(12, `代码块（${fence[2].trim() || "无语言"}）后面没有 [[evidence:...]] 锚点`);
      break;
    }
  }

  // 23 — the bytes match what the manifest says they are.
  const digest = `sha256:${createHash("sha256").update(content).digest("hex")}`;
  if (manifest.contentHash !== digest) {
    fail(
      23,
      `contentHash 对不上（manifest ${manifest.contentHash?.slice(0, 20)}… 实际 ${digest.slice(0, 20)}…）`,
    );
  }

  return problems;
}

function* lessons(studiesRoot) {
  if (!existsSync(studiesRoot)) return;
  for (const studyId of readdirSync(studiesRoot)) {
    if (onlyStudy && studyId !== onlyStudy) continue;
    const coursesRoot = join(studiesRoot, studyId, "courses");
    if (!existsSync(coursesRoot)) continue;
    for (const courseId of readdirSync(coursesRoot)) {
      if (onlyCourse && courseId !== onlyCourse) continue;
      const unitsRoot = join(coursesRoot, courseId, "units");
      if (!existsSync(unitsRoot)) continue;
      for (const unitId of readdirSync(unitsRoot)) {
        const lessonsRoot = join(unitsRoot, unitId, "lessons");
        if (!existsSync(lessonsRoot)) continue;
        for (const lessonId of readdirSync(lessonsRoot)) {
          const revisions = join(lessonsRoot, lessonId, "revisions");
          if (!existsSync(revisions)) continue;
          const latest = readdirSync(revisions)
            .map(Number)
            .filter(Number.isInteger)
            .sort((a, b) => b - a)[0];
          if (latest === undefined) continue;
          const contentPath = join(revisions, String(latest), "content.md");
          const manifestPath = join(revisions, String(latest), "manifest.json");
          if (!existsSync(contentPath) || !existsSync(manifestPath)) continue;
          yield {
            id: `${courseId}/${unitId}/${lessonId}`,
            contentPath,
            manifestPath,
            content: readFileSync(contentPath, "utf8"),
            manifest: JSON.parse(readFileSync(manifestPath, "utf8")),
          };
        }
      }
    }
  }
}

let checked = 0;
let failed = 0;
const rotation = new Map();

for (const lesson of lessons("studies")) {
  // Lessons without a variant predate the shapes; linting them would be noise.
  if (!lesson.manifest.variant) continue;
  checked += 1;

  const unitKey = lesson.id.split("/").slice(0, 2).join("/");
  const run = rotation.get(unitKey) ?? [];
  run.push(lesson.manifest.variant);
  rotation.set(unitKey, run);

  const problems = lintLesson(lesson);
  if (problems.length > 0) {
    failed += 1;
    console.log(`\n✗ ${lesson.id}  [${lesson.manifest.variant}]`);
    for (const { item, message } of problems) console.log(`    ${item}. ${message}`);
  }
}

// 22 — three of the same shape in a row makes a unit feel like one long lesson.
for (const [unitKey, run] of rotation) {
  for (let i = 2; i < run.length; i += 1) {
    if (run[i] === run[i - 1] && run[i] === run[i - 2]) {
      failed += 1;
      console.log(`\n✗ ${unitKey}`);
      console.log(`    22. 连续三节都是「${run[i]}」变体`);
      break;
    }
  }
}

console.log(`\n${checked} 节课已检查，${failed} 节有问题。`);
if (checked === 0) console.log("（没有带 variant 的课文——尚未按新辩体重写。）");
process.exit(failed > 0 ? 1 : 0);
