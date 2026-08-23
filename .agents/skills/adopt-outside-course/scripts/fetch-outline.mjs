#!/usr/bin/env node
/**
 * 抓一门外部课程：提纲总是要，正文按需要。
 *
 * 这个脚本原来**拒绝把正文写进文件**，理由是「正文一旦落盘，早晚有人把它
 * 复制进课文」。那条规矩防住了抄袭，也顺手防住了改写——因为把一件事重新讲
 * 一遍，本来就需要反复读原文，而原文正是作者想清楚的地方。授权已经拿到了，
 * 我们本来就该读他的正文。
 *
 * 禁止是廉价的，测量是对的。需要保证的不是「没读过」，而是**读完之后写出来的
 * 是自己的话**——那是 `check-verbatim.mjs` 能量的东西。
 *
 * 正文写进 `--body-out`，那个目录应当被 gitignore：它是**原料，不是内容**。
 * 文件头会写上这句话，因为六个月后翻到它的人不会记得。
 *
 * 用法：
 *   node fetch-outline.mjs <url> --out outline/vibehub.md
 *   node fetch-outline.mjs <url> --out outline/vibehub.md --body-out source/vibehub.md
 *   node fetch-outline.mjs <url> --show-body     # 只打到终端
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const argv = process.argv.slice(2);
const url = argv.find((a) => !a.startsWith("--"));
const outAt = argv.indexOf("--out");
const out = outAt === -1 ? null : argv[outAt + 1];
const showBody = argv.includes("--show-body");

const bodyOutAt = argv.indexOf("--body-out");
const bodyOut = bodyOutAt === -1 ? null : argv[bodyOutAt + 1];
const render = argv.includes("--render");

if (!url || !out) {
  console.error(
    "usage: node fetch-outline.mjs <url> --out <path.md> [--body-out <path.md>] [--render] [--show-body]",
  );
  process.exit(2);
}

/*
  Half the sites worth adopting from render their lessons in the browser.
  VibeHub is one: a plain fetch of a course page returns a shell whose entire
  body is 「正在载入路线」 — six characters — and an outline built from that is
  a nav menu wearing a syllabus's name. `--render` drives a real browser
  instead, which is also the only honest way to see what a reader sees.
*/
async function fetchHtml() {
  if (!render) {
    const response = await fetch(url, {
      headers: { "user-agent": "University course reader (contact: PieAI Studio)" },
    });
    if (!response.ok) {
      console.error(`取不到 ${url}：HTTP ${response.status}`);
      process.exit(1);
    }
    return response.text();
  }
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 2400 } });
    await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    // Lazy sections below the fold only mount once they are scrolled to.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 800) {
        window.scrollTo(0, y);
        await new Promise((done) => setTimeout(done, 120));
      }
    });
    await page.waitForTimeout(800);
    return await page.content();
  } finally {
    await browser.close();
  }
}

const html = await fetchHtml();

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
  `> 只有结构。${today} 读取自 ${url}`,
  "> 正文用 --body-out 单独抓，那份是原料。出处永远引 MDN / 官方文档。",
  "",
  ...headings.map((h) => `${"  ".repeat(Math.max(0, h.level - 1))}- ${h.text}`),
  "",
];

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, lines.join("\n"));
console.log(`提纲写入 ${out}（${headings.length} 个标题，0 字正文）`);

const body = strip(
  (/<(?:main|article)[^>]*>([\s\S]*?)<\/(?:main|article)>/iu.exec(html) ?? [, html])[1],
);

if (bodyOut) {
  /*
    The header is load-bearing. Six months from now somebody opens this file
    looking for something to paste, and the only thing standing between them
    and a copyright problem is a sentence at the top saying what it is.
  */
  mkdirSync(dirname(bodyOut), { recursive: true });
  writeFileSync(
    bodyOut,
    [
      `# 原文 · ${url}`,
      "",
      `> ${today} 抓取。**这是原料，不是内容。**`,
      "> 作者已授权改写。改写的意思是合上这份文件、用自己的话讲一遍，",
      "> 不是把句子换几个词。`check-verbatim.mjs` 会量出来差别。",
      "> 出处永远引 MDN / RFC / 官方文档，**绝不引这一份**。",
      "",
      body,
      "",
    ].join("\n"),
  );
  console.log(`正文写入 ${bodyOut}（${body.length} 字，原料，不要提交）`);
}

if (showBody) {
  console.log("\n──── 正文 ────\n");
  console.log(body.slice(0, 6000));
}
