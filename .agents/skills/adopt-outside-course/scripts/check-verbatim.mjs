#!/usr/bin/env node
/**
 * 量一量：改写出来的课文，有多少还是原话。
 *
 * 这个脚本取代了一条更笨的规矩。之前的技能**禁止把原文落盘**，理由是
 * 「正文一旦存在硬盘上，早晚有人把它复制进课文」。那条规矩防住了抄袭，
 * 也顺手防住了改写——因为改写本来就需要反复读原文，而原文正是作者想清楚的地方。
 *
 * 禁止是廉价的，测量是对的。作者已经授权，我们本来就该读他的正文；
 * 需要保证的不是「没读过」，而是**「读完之后写出来的是自己的话」**。
 * 那是一个可以量的东西。
 *
 * 两个数，测的是两种不同的抄：
 *
 * - **最长逐字段**：连续多少个字和原文一模一样。抄一整句会在这里露馅。
 *   中文按字算，40 字大约是一个完整的句子。
 * - **k 元覆盖率**：把原文切成 12 字一段的滑窗，看课文有多少比例落在这些窗里。
 *   把句子拆开重排、换几个连接词，最长段会变短，但覆盖率不会——这一项抓的是那种抄。
 *
 * 专有名词、API 名、代码和引文本来就该一样，所以两个阈值都不是零。
 *
 * 用法：
 *   node check-verbatim.mjs <proposal.json> --against <source-dir-or-file> [--max-run 40] [--max-cover 0.18]
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const argv = process.argv.slice(2);
const numberFlag = (name, fallback) => {
  const at = argv.indexOf(name);
  if (at === -1) return fallback;
  const raw = Number(argv[at + 1]);
  return Number.isFinite(raw) ? raw : fallback;
};
const valueFlag = (name) => {
  const at = argv.indexOf(name);
  return at === -1 ? null : (argv[at + 1] ?? null);
};

const K = 12;
const MAX_RUN = numberFlag("--max-run", 40);
const MAX_COVER = numberFlag("--max-cover", 0.18);
const against = valueFlag("--against");
const proposalPath = argv.find(
  (a, i) => !a.startsWith("--") && argv[i - 1] !== "--against" && argv[i - 1] !== "--max-run" && argv[i - 1] !== "--max-cover",
);

if (!proposalPath || !against) {
  console.error(
    "usage: node check-verbatim.mjs <proposal.json> --against <source-dir-or-file> [--max-run 40] [--max-cover 0.18]",
  );
  process.exit(2);
}

/** Strip everything that is not prose: whitespace, punctuation, markup. */
function normalise(text) {
  return text
    .replace(/```[\s\S]*?```/g, " ") // fenced code is meant to match
    .replace(/`[^`]*`/g, " ") // inline code likewise
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

function readSource(path) {
  const st = statSync(path);
  if (st.isFile()) return readFileSync(path, "utf8");
  return readdirSync(path)
    .filter((name) => /\.(md|txt|html?)$/i.test(name))
    .map((name) => readFileSync(join(path, name), "utf8"))
    .join("\n");
}

/** Every prose string a lesson carries, flattened. */
function lessonProse(proposal) {
  const out = [];
  const walk = (node) => {
    if (typeof node === "string") {
      out.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) {
        // Ids, urls and paths are not prose and would inflate both numbers.
        if (/^(id|.*Id|url|sourceUrl|href|path|slug|kind|type)$/i.test(key)) continue;
        walk(value);
      }
    }
  };
  walk(proposal);
  return out;
}

const source = normalise(readSource(against));
const grams = new Set();
for (let i = 0; i + K <= source.length; i += 1) grams.add(source.slice(i, i + K));

const proposal = JSON.parse(readFileSync(proposalPath, "utf8"));
const pieces = lessonProse(proposal);

let worstRun = { length: 0, text: "", where: "" };
let covered = 0;
let total = 0;

for (const piece of pieces) {
  const text = normalise(piece);
  if (text.length < K) continue;
  total += text.length;
  let run = 0;
  for (let i = 0; i + K <= text.length; i += 1) {
    if (grams.has(text.slice(i, i + K))) {
      covered += 1;
      run = run === 0 ? K : run + 1;
      if (run > worstRun.length) {
        worstRun = { length: run, text: text.slice(i + K - run, i + K), where: piece.slice(0, 40) };
      }
    } else {
      run = 0;
    }
  }
}

const coverage = total === 0 ? 0 : covered / total;
const pct = (n) => `${(n * 100).toFixed(1)}%`;

console.log(`逐字检查：课文 ${total} 字，原文 ${source.length} 字`);
console.log(`  最长逐字段 ${worstRun.length} 字（上限 ${MAX_RUN}）`);
console.log(`  ${K} 字滑窗覆盖率 ${pct(coverage)}（上限 ${pct(MAX_COVER)}）`);

let failed = false;
if (worstRun.length > MAX_RUN) {
  failed = true;
  console.error(`\n✗ 有一段 ${worstRun.length} 字和原文一模一样，这是抄了一句话，不是改写：`);
  console.error(`  「${worstRun.text}」`);
  console.error(`  出现在：${worstRun.where}…`);
}
if (coverage > MAX_COVER) {
  failed = true;
  console.error(`\n✗ 覆盖率 ${pct(coverage)} 太高。句子拆开重排、换几个连接词，`);
  console.error(`  最长段会变短但覆盖率不会——这一项抓的就是那种改写。`);
}

if (failed) {
  console.error("\n原文的价值是结构和例子，不是句子。合上原文，用自己的话把这件事讲一遍。");
  process.exit(1);
}
console.log("\n✓ 是重写的，不是搬运的。");
