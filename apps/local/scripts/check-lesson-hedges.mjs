#!/usr/bin/env node
/**
 * Catch a lesson that promises more than the code delivers.
 *
 * This exists because of one measured failure. A polish pass by a small model
 * kept every evidence anchor, every code span and every heading — and quietly
 * turned "通常能照着清单重新装" into "随时都能重新装", "项目不把它们放进 Git"
 * into "项目绝不会放进 Git", and "常在服务器上重新生成" into "完全可以现场
 * 重新生成". Across three lessons it removed ten of the author's hedges and
 * manufactured ten absolutes that were not there.
 *
 * For a beginner those are different claims. "Usually you can reinstall" and
 * "you can always reinstall" differ on the day the network is down, and the
 * second one teaches them that the failure must be their fault.
 *
 * None of it trips a linter that checks structure, because the structure was
 * perfect. So this checks the claim strength instead.
 *
 * Usage:
 *   node scripts/check-lesson-hedges.mjs <file.md> [...]
 *   node scripts/check-lesson-hedges.mjs --before old.md --after new.md
 */
import { readFileSync } from "node:fs";

/** Words an author reaches for when a thing is true most of the time. */
const HEDGE =
  /通常|常常|往往|一般来说|一般会|多数|大多|多半|可能|也许|大概|倾向于|常在|常用|默认情况下/g;

/**
 * Words that turn "most of the time" into "always". Not banned outright — a
 * lesson may legitimately say `绝不` about something that really never happens —
 * but every one of them is a claim someone has to have checked.
 */
const ABSOLUTE =
  /绝不|绝对|一定会|必然|必定|从不|永远不|全都是|根本不|根本碰不到|压根|随时都能|随时能|完全可以|无论如何|所有的都/g;

/**
 * Words this product uses as terms, where the near-synonym means a different
 * thing to a beginner.
 *
 * The third measured failure, 2026-09-10. A polish of 「关掉网，这个页面还能抠图
 * 吗？」 passed hedges, absolutes, length, second person and the structure gate,
 * and inside a `:::detail` explaining what 「发出去」 means it had rewritten
 * 「那台电脑上会多出一份拷贝」 as 「别人那边会多出一份备份」.
 *
 * A copy on someone else's machine and a backup are not the same claim, and
 * this lesson's whole point is that the reader's photo never leaves. Its own
 * prompt forbids exactly this — 「所有关于代码、文件、命令的事实陈述…你没见过
 * 这些代码，没资格改任何技术判断」 — so the model was told and did it anyway,
 * which is the argument for measuring rather than instructing.
 *
 * A list, like HEDGE and ABSOLUTE above, and grown the same way: from failures
 * somebody actually saw. It is not a dictionary and does not pretend to be —
 * it catches a term swapped for its neighbour, in both directions, and says
 * nothing about a word neither list knows.
 */
const GLOSSARY = [
  "拷贝",
  "备份",
  "模型",
  "算法",
  "程序",
  "代码",
  "文件",
  "文档",
  "目录",
  "文件夹",
  "上传",
  "下载",
  "发送",
  "提交",
  "缓存",
  "浏览器",
  "服务器",
  "网址",
  "链接",
  "命令",
  "变量",
  "函数",
  "接口",
];

/** 「只要…就」 and 「只有…才」 are the correct pairings. 「只要…才」 is not. */
const MISPAIRED = /只要[^。！？\n]{0,20}才(?![^。！？\n]{0,6}(行|对))/g;

/**
 * How much prose a lesson is, ignoring the parts a polish pass must not touch.
 *
 * Fenced code, evidence anchors and headings are excluded because they are
 * fixed by the source rather than chosen by the writer, and counting them
 * would let a lesson with one long code block hide real growth in the prose
 * around it.
 */
function proseLength(text) {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\[\[[^\]]*\]\]/g, "")
    .replace(/^#{1,6} .*$/gm, "")
    .replace(/\s+/g, "").length;
}

function scan(text) {
  return {
    hedges: text.match(HEDGE) ?? [],
    absolutes: text.match(ABSOLUTE) ?? [],
    mispaired: text.match(MISPAIRED) ?? [],
    prose: proseLength(text),
    address: (text.match(/你/g) ?? []).length,
    terms: new Set(GLOSSARY.filter((term) => text.includes(term))),
  };
}

/**
 * How much of the lesson's second person a polish may spend.
 *
 * The shape invariant is a floor — two 「你」 per thousand characters — and a
 * floor cannot see this failure. Measured 2026-09-06 across seven polished
 * lessons: six lost between 2.5% and 16.6% of their reader address, roughly in
 * proportion to the 2-5% they shortened by, which is ordinary attrition. One
 * lost **48.9%** while shortening by only 2.6% — it was not trimming, it was
 * converting 「你要的是」 into 「需要的是」 wherever it appeared. That lesson
 * still sat far above the floor and passed every other check here.
 *
 * Twenty-five percent sits above the observed normal maximum with room to
 * spare and well under the outlier, so it rejects a lesson that was quietly
 * turned back into documentation without arguing with an honest polish.
 */
const ADDRESS_LOSS_ALLOWANCE = 0.25;

/**
 * How much longer a polished lesson may be than its source.
 *
 * Zero would be the honest number and it is unusable: 「因此」 becoming
 * 「所以你会看到」 is exactly the change this pass is for, and it costs
 * characters. Three percent is the slack that buys those rewrites without
 * buying a new paragraph. Measured: told not to grow at all, the model grew
 * three lessons by 7 to 9 percent; told the same thing with the two rules
 * attached, it came out 1.6 percent shorter.
 */
const GROWTH_ALLOWANCE = 0.03;

const args = process.argv.slice(2);
let failed = false;

if (args[0] === "--before" && args[2] === "--after") {
  const before = scan(readFileSync(args[1], "utf8"));
  const after = scan(readFileSync(args[3], "utf8"));
  const lostHedges = before.hedges.length - after.hedges.length;
  const gained = after.absolutes.length - before.absolutes.length;
  console.log(`让步词 ${before.hedges.length} → ${after.hedges.length}`);
  console.log(`绝对化 ${before.absolutes.length} → ${after.absolutes.length}`);
  if (lostHedges > 0) {
    console.error(`✗ 丢了 ${lostHedges} 个让步词。作者每一个都是故意放的。`);
    failed = true;
  }
  if (gained > 0) {
    console.error(`✗ 新增 ${gained} 处绝对化：${[...new Set(after.absolutes)].join(" ")}`);
    failed = true;
  }
  if (after.mispaired.length > before.mispaired.length) {
    console.error(`✗ 新增关联词误配（「只要…才」）：${after.mispaired.join(" | ")}`);
    failed = true;
  }
  const growth = before.prose > 0 ? (after.prose - before.prose) / before.prose : 0;
  console.log(`正文字数 ${before.prose} → ${after.prose}（${(growth * 100).toFixed(1)}%）`);
  if (growth > GROWTH_ALLOWANCE) {
    console.error(
      `✗ 正文长了 ${(growth * 100).toFixed(1)}%，超过 ${GROWTH_ALLOWANCE * 100}%。` +
        `润色是换说法，不是加内容——多出来的通常是模型自己想讲的。`,
    );
    failed = true;
  }
  const addressLoss = before.address > 0 ? (before.address - after.address) / before.address : 0;
  console.log(
    `第二人称「你」 ${before.address} → ${after.address}（${(addressLoss * -100).toFixed(1)}%）`,
  );
  if (addressLoss > ADDRESS_LOSS_ALLOWANCE) {
    console.error(
      `✗ 少了 ${(addressLoss * 100).toFixed(1)}% 的「你」，超过 ${ADDRESS_LOSS_ALLOWANCE * 100}%。` +
        `这不是变短带走的——是把对着一个人说的话改回了文档腔。`,
    );
    failed = true;
  }
  const droppedTerms = [...before.terms].filter((term) => !after.terms.has(term));
  const addedTerms = [...after.terms].filter((term) => !before.terms.has(term));
  console.log(`术语 ${before.terms.size} → ${after.terms.size}`);
  if (droppedTerms.length > 0) {
    console.error(
      `✗ 原文用过的术语在润色版里没有了：${droppedTerms.join(" ")}。` +
        `换说法可以，换术语不行——读者是靠这些词把两件事分开的。`,
    );
    failed = true;
  }
  if (addedTerms.length > 0) {
    console.error(
      `✗ 润色版引入了原文没有的术语：${addedTerms.join(" ")}。` +
        `润色者没读过这些代码，没有资格替课文改技术判断。`,
    );
    failed = true;
  }
  if (!failed) {
    console.log("✓ 让步强度未被削弱，正文没有变长，仍然对着读者说话，术语一个没换");
  }
} else {
  for (const path of args) {
    const found = scan(readFileSync(path, "utf8"));
    const problems = [];
    if (found.absolutes.length > 0) {
      problems.push(`绝对化 ${found.absolutes.length}：${[...new Set(found.absolutes)].join(" ")}`);
    }
    if (found.mispaired.length > 0) {
      problems.push(`关联词误配：${found.mispaired.join(" | ")}`);
    }
    if (problems.length > 0) {
      console.error(`✗ ${path}`);
      for (const p of problems) console.error(`    ${p}`);
      failed = true;
    } else {
      console.log(`✓ ${path}  （让步词 ${found.hedges.length}）`);
    }
  }
}

process.exit(failed ? 1 : 0);
