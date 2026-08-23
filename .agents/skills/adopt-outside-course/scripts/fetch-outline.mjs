#!/usr/bin/env node
/**
 * 只抓提纲，不抓正文。
 *
 * 外部课程在这个流程里的角色是「目录」——它告诉我们讲什么、按什么顺序讲。
 * 正文如果落了盘，早晚有一天会被当成素材复制进课文里，而那正是不能发生的事。
 * 所以这个脚本**只写标题**：正文在终端打印一遍供人阅读，不进文件。
 *
 * 用法：
 *   node fetch-outline.mjs <url> --out outline/vibehub-product-website.md
 *   node fetch-outline.mjs <url> --show-body     # 正文打到终端，仍然不落盘
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const argv = process.argv.slice(2);
const url = argv.find((a) => !a.startsWith("--"));
const outAt = argv.indexOf("--out");
const out = outAt === -1 ? null : argv[outAt + 1];
const showBody = argv.includes("--show-body");

if (!url || !out) {
  console.error("usage: node fetch-outline.mjs <url> --out <path.md> [--show-body]");
  process.exit(2);
}

const response = await fetch(url, {
  headers: { "user-agent": "University course-outline reader (contact: PieAI Studio)" },
});
if (!response.ok) {
  console.error(`fetch failed: ${response.status} ${response.statusText}`);
  process.exit(1);
}
const html = await response.text();

const strip = (s) =>
  s
    .replace(/<[^>]+>/gu, "")
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/\s+/gu, " ")
    .trim();

// 标题层级就是提纲。这是我们唯一要留下的东西。
const headings = [];
for (const match of html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/giu)) {
  const text = strip(match[2]);
  if (text) headings.push({ level: Number(match[1]), text });
}

if (headings.length === 0) {
  console.error(
    "没抓到任何标题。这个站多半是纯 JS 渲染的 —— 自己看着网页把提纲敲进文件就行，\n" +
      "不要为它写一个抓取器，下一个来源一定是另一种形态。",
  );
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const lines = [
  `# 提纲 · ${strip((/<title[^>]*>([\s\S]*?)<\/title>/iu.exec(html) ?? [, ""])[1]) || url}`,
  "",
  `> 只有结构，没有正文。${today} 读取自 ${url}`,
  "> 这份文件是目录，不是素材。课文自己写，出处引 MDN / 官方文档。",
  "",
  ...headings.map((h) => `${"  ".repeat(Math.max(0, h.level - 1))}- ${h.text}`),
  "",
];

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, lines.join("\n"));
console.log(`提纲写入 ${out}（${headings.length} 个标题，0 字正文）`);

if (showBody) {
  const body = strip(
    (/<(?:main|article)[^>]*>([\s\S]*?)<\/(?:main|article)>/iu.exec(html) ?? [, html])[1],
  );
  console.log("\n──── 正文（只在终端，不落盘）────\n");
  console.log(body.slice(0, 6000));
}
