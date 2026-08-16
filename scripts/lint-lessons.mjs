#!/usr/bin/env node
/**
 * Mechanical enforcement of the lesson shape.
 *
 * The `write-lesson` skill carries an acceptance checklist, and until now the
 * only thing enforcing it was an agent reading the list and reporting that it
 * had passed. That works for six lessons and cannot possibly hold for 481:
 * self-assessment drifts, and a rule nobody can verify is a rule that quietly
 * stops being true.
 *
 * So this checks everything that is machine-checkable, and deliberately says
 * nothing about the rest. "Is the title a question an outsider would care
 * about" needs judgement and stays with the reviewer; "does the title end in a
 * question mark" does not, and belongs here.
 *
 * Machine-owned rules include: variant/shape, prediction spine, evidence
 * tokens (token→manifest coverage, manifest→token coverage, no hand-copied
 * fence before a token), `:::detail` structure and volume, system-vocabulary
 * ban, growth of standard prose, and second-person density.
 *
 * Only lessons whose manifest declares a `variant` are linted. The other 475
 * predate the shapes, and failing them all would train everyone to ignore the
 * output.
 *
 * ## Baseline ratchet (new rules only)
 *
 * Four rules arrived after hundreds of variant lessons already shipped:
 * detail layer (26), hand-copied fence+anchor (12 hand-copy), system vocabulary
 * (27), orphan evidence citation (12 inverse). Rules 1–25 and the old hard
 * half of item 12 (every token covered by the manifest) stay hard — they pass
 * today and are never grandfathered.
 *
 * `scripts/lesson-debt.json` records, per lesson identity
 * (`study/course/unit/lesson`), which of those four currently fail and at
 * which `contentRevision`. A normal run suppresses a new-rule failure only
 * when that exact lesson is baselined for that exact rule at that exact
 * revision. Bump the revision (rewrite) and the grandfathering expires — the
 * rewritten lesson must meet the current standard. That is what makes this a
 * ratchet rather than a permanent excuse.
 *
 * Regenerate after intentional bulk exceptions (rare):
 *   node scripts/lint-lessons.mjs --update-baseline
 *
 * Usage:
 *   node scripts/lint-lessons.mjs                    # every study
 *   node scripts/lint-lessons.mjs --study turing-pact --course foundations-before-zero
 *   node scripts/lint-lessons.mjs --update-baseline  # rewrite scripts/lesson-debt.json
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? null : args[index + 1];
};
const hasFlag = (name) => args.includes(`--${name}`);
const onlyStudy = flag("study");
const onlyCourse = flag("course");
const updateBaseline = hasFlag("update-baseline");
const strict = hasFlag("strict");

/**
 * Lessons passing only because the baseline still covers them.
 *
 * @type {{ id: string, rules: string[] }[]}
 */
const stillExempt = [];

/** Checked-in debt file. Sorted on write so diffs stay reviewable. */
const BASELINE_PATH = join("scripts", "lesson-debt.json");

/**
 * New rules eligible for grandfathering. Stable keys in the baseline file —
 * not checklist item numbers, so a renumber does not silently reopen debt.
 *
 * `hand-copied-fence` is only the fence+token defect under item 12.
 * `orphan-evidence` is the inverse half of item 12 (manifest cites, no token).
 * Token→manifest coverage under the same item number is an old hard rule.
 *
 * Cards and exercises carry their own `evidence` arrays in card.json /
 * exercise.json; they never read the lesson manifest's list. This rule only
 * inspects the lesson-level array against content.md — no card/exercise
 * exemption is needed.
 */
const DEBT_RULE = {
  DETAIL: "detail",
  HAND_COPIED_FENCE: "hand-copied-fence",
  SYSTEM_VOCAB: "system-vocab",
  ORPHAN_EVIDENCE: "orphan-evidence",
  SCREENSHOT_COMMIT: "screenshot-commit",
};
const DEBT_RULE_ORDER = [
  DEBT_RULE.DETAIL,
  DEBT_RULE.HAND_COPIED_FENCE,
  DEBT_RULE.SYSTEM_VOCAB,
  DEBT_RULE.SCREENSHOT_COMMIT,
  DEBT_RULE.ORPHAN_EVIDENCE,
];

const VARIANTS = {
  现象: { open: "现象", middle: ["为什么是这样"] },
  对比: { open: "两个东西", middle: ["逐条对照", "什么时候用哪个"] },
  溯源: { open: "你看到的结果", middle: ["一站一站往回走"] },
  决策: { open: "情境和约束", middle: ["代价和收益", "什么时候该反过来"] },
  术语: { open: "一句真实出现的话", middle: ["三个真实用例", "它不是什么"] },
};

const GUESS_LINE = "随便猜，猜错不影响任何进度。";
const BANNED = ["显然", "简单来说", "众所周知"];

/**
 * System vocabulary the reader must never see.
 *
 * Collocations, not bare words. A studied project may legitimately have its own
 * snapshots and its own evidence — `AiBudgetSnapshot` is that project's noun,
 * and a lesson about it has to say so. Banning bare 证据/快照 would flag those
 * lessons for teaching their actual subject. What is banned is this app talking
 * to the reader about itself.
 *
 * Longer phrases first so a line with「固定快照」is reported once under that
 * phrase rather than twice.
 */
const SYSTEM_VOCAB = [
  "固定快照",
  "本课依据",
  "这节课的证据",
  "当成证据",
  "阅读层级",
  "标准模式",
  "细讲模式",
  "内容修订",
  "本课",
];

/**
 * Regions the shape rules do not apply inside — a lesson may show its own syntax.
 *
 * Multi-line fences are blanked **line by line** so newline positions stay put.
 * Replacing a whole fence with one flat run of spaces would collapse every later
 * line number and make "fix the word on line N" unusable.
 */
function stripCode(text) {
  return text
    .replace(/^[ \t]*(`{3,}|~{3,})[\s\S]*?^[ \t]*\1[ \t]*$/gm, (m) =>
      m
        .split("\n")
        .map((line) => " ".repeat(line.length))
        .join("\n"),
    )
    .replace(/`[^`\n]+`/g, (m) => " ".repeat(m.length));
}

/** Blank `[[evidence:…]]` tokens the same way code is blanked (keep offsets). */
function stripEvidenceTokens(text) {
  return text.replace(/\[\[evidence:[^\]\n]+\]\]/g, (m) => " ".repeat(m.length));
}

/**
 * Excise closed `:::detail` blocks (opening line through closing `:::`).
 * Unclosed blocks are left in place so other checks still see the raw text;
 * `checkDetailBlocks` reports them separately.
 */
function withoutDetailBlocks(text) {
  return text.replace(
    /^:::detail(?:\[[^\]]*\])?(?:\{[^}\n]*\})?[ \t]*\n[\s\S]*?^:::[ \t]*$/gm,
    "\n",
  );
}

/**
 * Standard prose length for the growth ceiling: body with `:::detail` blocks
 * removed. Adding a detail layer is new structure, not padding.
 */
function standardProseLength(text) {
  return withoutDetailBlocks(text).length;
}

/**
 * Standard prose characters for the detail-volume ratio: detail blocks out,
 * then code fences out (same idea as `stripCode`, but removed rather than
 * blanked so fence bytes do not inflate the denominator).
 */
function standardProseCharCount(text) {
  return withoutDetailBlocks(text)
    .replace(/^[ \t]*(`{3,}|~{3,})[\s\S]*?^[ \t]*\1[ \t]*$/gm, "")
    .replace(/`[^`\n]+`/g, "").length;
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

/**
 * Does `[[evidence:path:line]]` point at something the manifest actually cites?
 *
 * A wrong range fails silently at render time: the resolver only honours a
 * range the manifest already pins to the snapshot commit, so an invented line
 * number shows up as literal text in the middle of a lesson. Six lessons could
 * be checked by eye. Several hundred cannot.
 */
/**
 * Parse `[[evidence:…]]` tokens into path + line span. Malformed tokens are
 * left out; `checkEvidenceTokens` already reports them.
 * @returns {{ path: string, start: number, end: number, token: string }[]}
 */
function parseEvidenceTokens(content) {
  const tokens = [];
  for (const match of content.matchAll(/\[\[evidence:([^\]\n]+)\]\]/g)) {
    const token = match[1];
    const at = token.lastIndexOf(":");
    if (at === -1) continue;
    const path = token.slice(0, at);
    const span = token.slice(at + 1);
    const [rawStart, rawEnd] = span.split("-");
    const start = Number(rawStart);
    const end = rawEnd === undefined ? start : Number(rawEnd);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1) continue;
    tokens.push({ path, start, end, token });
  }
  return tokens;
}

function checkEvidenceTokens(content, manifest, fail) {
  const citations = manifest.evidence ?? [];
  for (const match of content.matchAll(/\[\[evidence:([^\]\n]+)\]\]/g)) {
    const token = match[1];
    const at = token.lastIndexOf(":");
    const path = at === -1 ? token : token.slice(0, at);
    const span = at === -1 ? "" : token.slice(at + 1);
    const [rawStart, rawEnd] = span.split("-");
    const start = Number(rawStart);
    const end = rawEnd === undefined ? start : Number(rawEnd);
    if (at === -1 || !Number.isInteger(start) || !Number.isInteger(end) || start < 1) {
      fail(12, `证据锚点格式不对：[[evidence:${token}]]`);
      continue;
    }
    const covering = citations.filter((citation) => citation.sourcePath === path);
    if (covering.length === 0) {
      fail(12, `锚点指向 manifest 没有引用的文件：${path}`);
      continue;
    }
    // A citation with no line range covers the whole file, matching the resolver.
    const inside = covering.some(
      (citation) =>
        citation.lineStart == null ||
        citation.lineEnd == null ||
        (start >= citation.lineStart && end <= citation.lineEnd),
    );
    if (!inside) {
      const ranges = covering.map((c) => `${c.lineStart}-${c.lineEnd}`).join(", ");
      fail(12, `锚点 ${path}:${span} 落在 manifest 引用范围之外（manifest: ${ranges}）`);
    }
  }
}

/**
 * Inverse of token→manifest coverage: every manifest `evidence` entry must be
 * reached by at least one `[[evidence:path:lines]]` token in content.md.
 *
 * The evidence rail is gone. A cited file with no inline token is invisible to
 * the reader — the lesson claims to rest on it, and nobody can open it. Match
 * on `sourcePath`; a token whose range lies anywhere inside the cited range
 * counts (same containment as the forward check). Whole-file citations (no
 * line range) are covered by any token on that path.
 *
 * Grandfathered as `orphan-evidence` until a rewrite bumps contentRevision.
 */
function checkOrphanEvidence(content, manifest, fail) {
  const citations = manifest.evidence ?? [];
  const tokens = parseEvidenceTokens(content);
  for (const citation of citations) {
    const path = citation.sourcePath;
    const covered = tokens.some(
      (token) =>
        token.path === path &&
        (citation.lineStart == null ||
          citation.lineEnd == null ||
          (token.start >= citation.lineStart && token.end <= citation.lineEnd)),
    );
    if (covered) continue;
    const range =
      citation.lineStart == null || citation.lineEnd == null
        ? "（整文件）"
        : `${citation.lineStart}-${citation.lineEnd}`;
    fail(
      12,
      `manifest 引用了 ${path}:${range}，但 content.md 里没有 [[evidence:…]] 锚到这个范围。证据栏已移除，读者看不到这条引用——要么加锚点，要么从 manifest.evidence 删掉。`,
      DEBT_RULE.ORPHAN_EVIDENCE,
    );
  }
}

/**
 * Project source must appear only as `[[evidence:]]`. A fence whose next
 * non-empty line is a token means the same source is stored twice — the
 * hand-typed copy is verified by nothing. Delete the fence; keep the token.
 *
 * Fences that are *not* followed by a token stay legal: illustrative examples,
 * commands, pseudo-code, counter-examples.
 */
function checkHandCopiedSource(content, fail) {
  const fences = [...content.matchAll(/^[ \t]*(`{3,}|~{3,})([^\n]*)\n[\s\S]*?^[ \t]*\1[ \t]*$/gm)];
  for (const fence of fences) {
    const after = content.slice(fence.index + fence[0].length);
    const next = after.split("\n").find((line) => line.trim() !== "");
    if (!next || !/\[\[evidence:[^\]\n]+\]\]/.test(next)) continue;
    const firstLine = content.slice(0, fence.index).split("\n").length;
    const lang = fence[2].trim() || "无语言";
    fail(
      12,
      `第 ${firstLine} 行代码块（${lang}）后面紧跟 [[evidence:…]]——手抄源码再加锚点是重复存放。删掉这个代码块，只保留锚点；token 自己会渲染真实快照。`,
      DEBT_RULE.HAND_COPIED_FENCE,
    );
  }
}

/**
 * `:::detail` second reading level — mechanical parts only.
 *
 * Zero blocks is reported separately from "too little volume" so a batch can
 * count "not started" without conflating it with "started but thin".
 */
function checkDetailBlocks(content, fail) {
  const lines = content.split("\n");
  const blocks = [];
  let open = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (open === null) {
      // `{.class}` and friends are legal remark-directive attributes and render
      // fine. Leaving them out of this pattern did not produce a wrong error —
      // it produced silence: the line matched the loose `anyOpener` guard below
      // but never opened a block, so block count, titles, and volume were all
      // measured against zero blocks and every detail rule passed vacuously.
      const start = /^:::detail(?:\[([^\]]*)\])?(?:\{[^}\n]*\})?[ \t]*$/.exec(line);
      if (start) {
        open = { startLine: i + 1, title: start[1] === undefined ? null : start[1], body: [] };
      } else if (/^:::detail\b/.test(line)) {
        // Something meant to be a detail block that this parser cannot read.
        // Failing loudly beats the silent pass that hid a whole missing layer.
        fail(
          26,
          `第 ${i + 1} 行的 :::detail 写法解析不了：「${line.trim()}」。用 :::detail[读者会问的问句？] 或 :::detail[问句？]{.attr}。`,
          DEBT_RULE.DETAIL,
        );
      }
      continue;
    }
    if (/^:::[ \t]*$/.test(line)) {
      blocks.push({ ...open, body: open.body.join("\n") });
      open = null;
      continue;
    }
    open.body.push(line);
  }

  if (open !== null) {
    fail(
      26,
      `第 ${open.startLine} 行的 :::detail 没有闭合的 :::。补上单独一行的 :::，否则收起/展开会坏掉。`,
      DEBT_RULE.DETAIL,
    );
  }

  if (blocks.length === 0 && open === null) {
    // Only "none yet" when nothing is half-open either — an unclosed opener
    // already failed above and is not "zero blocks".
    const anyOpener = /^:::detail\b/m.test(content);
    if (!anyOpener) {
      fail(
        26,
        `还没有 :::detail 块（0 块）。每节课需要详细讲解层：在引发疑问的句子后插入 :::detail[读者会问的问句？]…:::，全部 detail 正文合计至少占标准正文字数的 60%。`,
        DEBT_RULE.DETAIL,
      );
      return;
    }
  }

  if (blocks.length > 8) {
    fail(
      26,
      `:::detail 有 ${blocks.length} 块，上限 8。超过说明这节课想讲的太多——拆成两节课，不要再加块。`,
      DEBT_RULE.DETAIL,
    );
  }

  for (const block of blocks) {
    if (block.title === null) {
      fail(
        26,
        `第 ${block.startLine} 行 :::detail 没有标题。写成 :::detail[读者会问的问句？]（标题必须以问号结尾）。`,
        DEBT_RULE.DETAIL,
      );
    } else if (block.title.trim() === "") {
      fail(
        26,
        `第 ${block.startLine} 行 :::detail 标题为空。写成 :::detail[读者会问的问句？]。`,
        DEBT_RULE.DETAIL,
      );
    } else if (!/[？?]\s*$/.test(block.title)) {
      fail(
        26,
        `第 ${block.startLine} 行 :::detail 标题不是问句：「${block.title}」。改成读者真的会问的那句话，并以问号结尾。`,
        DEBT_RULE.DETAIL,
      );
    }
  }

  if (blocks.length === 0) return;

  const detailChars = blocks.reduce((n, b) => n + b.body.length, 0);
  const standardChars = standardProseCharCount(content);
  if (standardChars === 0) return;
  const ratio = detailChars / standardChars;
  if (ratio < 0.6) {
    fail(
      26,
      `detail 正文合计 ${detailChars} 字，标准正文 ${standardChars} 字（${Math.round(ratio * 100)}%，下限 60%）。该展开的术语/跳步/不显然结论还没展开——按 write-lesson「哪里该开块」补块，不要灌水凑字。`,
      DEBT_RULE.DETAIL,
    );
  }
}

/**
 * The reader does not know this app exists. System words in prose are a defect.
 * Tokens and code fences are stripped first so `[[evidence:…]]` never trips
 * the check via the English word "evidence".
 */
function checkSystemVocabulary(content, fail) {
  const prose = stripEvidenceTokens(stripCode(content));
  const lines = prose.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    let line = lines[i];
    if (!line.trim()) continue;
    for (const word of SYSTEM_VOCAB) {
      const pattern = word === "revision" ? /revision/i : null;
      const hit = pattern ? pattern.test(line) : line.includes(word);
      if (!hit) continue;
      fail(
        27,
        `第 ${i + 1} 行出现了系统词汇「${word}」。读者不知道本 App 存在——删掉或改成读者世界里的说法（「本课」写成「这节课」）。`,
        DEBT_RULE.SYSTEM_VOCAB,
        DEBT_RULE.SCREENSHOT_COMMIT,
      );
      // Blank the match so a longer phrase already reported does not also fire
      // its shorter substring on the same line (e.g. 固定快照 → 快照).
      if (pattern) {
        line = line.replace(/revision/gi, " ".repeat(8));
      } else {
        line = line.split(word).join(" ".repeat(word.length));
      }
    }
  }
}

/**
 * Warmth is phrasing, not extra material.
 *
 * Adding interesting-but-irrelevant content to make a lesson feel friendlier
 * measurably lowers retention and transfer, and it is what "make it warmer"
 * turns into when nobody is checking. Length is the mechanical shadow of that
 * mistake: a rewrite that only changes how sentences sound does not need more
 * room, so growth means content was added.
 *
 * Measured on standard prose only (body with `:::detail` blocks removed).
 * Adding a detail layer is new structure, not padding, and must not count.
 *
 * The ceiling applies only once a lesson is already in the new shape. Going
 * from the old skeleton to this one roughly doubles a lesson — measured across
 * the first 41, the median ratio was 2.03 — because the new shape has to hold a
 * prediction and its answer. That growth is the point, not the defect.
 */
function checkGrowth(content, previous, fail) {
  if (!previous?.hadVariant) return;
  const prevLen = previous.standardLength;
  if (!prevLen) return;
  const ratio = standardProseLength(content) / prevLen;
  if (ratio > 1.15) {
    fail(
      24,
      `标准正文比上一版长了 ${Math.round((ratio - 1) * 100)}%（上限 15%；不含 :::detail）。语气变暖不该加内容——检查是不是加了与机制无关的故事或例子。`,
    );
  }
}

/** The personalization principle, as the one thing about it a script can see. */
function checkSecondPerson(prose, fail) {
  const count = (prose.match(/你/g) ?? []).length;
  const density = (count / prose.length) * 1000;
  if (density < 2) {
    fail(
      25,
      `每千字只有 ${density.toFixed(1)} 个「你」（下限 2.0，共 ${count} 个）。对着读者说话，不是对着空气讲课。`,
    );
  }
}

/**
 * What a file's first bytes say it is, independent of what it is named.
 *
 * A screenshot saved as JPEG under a `.png` name passes every size and hash
 * check — those are computed from the file itself, so they agree with any lie
 * the manifest tells about its type. Only the leading bytes can disagree, and
 * the server checks them when serving, which means the failure lands on a
 * reader looking at a broken image instead of on the author who could fix it.
 */
function sniffMime(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (bytes.subarray(0, 2).equals(Buffer.from([0xff, 0xd8]))) return "image/jpeg";
  if (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return "image/webp";
  if (/^\s*(?:<\?xml[^>]*>\s*)?<svg(?:\s|>)/i.test(bytes.toString("utf8", 0, 2048)))
    return "image/svg+xml";
  if (bytes.subarray(4, 8).toString("ascii") === "ftyp") return "video/mp4";
  if (bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return "video/webm";
  return "无法识别的字节";
}

/** @param {string} manifestPath @param {{assets?: unknown[]}} manifest @param {Function} fail */
function checkAssetsAreServable(manifestPath, manifest, fail) {
  const root = dirname(manifestPath);
  for (const asset of manifest.assets ?? []) {
    const file = join(root, asset.path);
    if (!existsSync(file)) {
      fail(28, `资产文件不存在：${asset.path}（id ${asset.id}）`);
      continue;
    }
    const bytes = readFileSync(file);
    if (bytes.byteLength !== asset.bytes) {
      fail(28, `资产大小对不上：${asset.path} 声明 ${asset.bytes} 字节，实际 ${bytes.byteLength}`);
    }
    const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    if (asset.sha256 !== digest) fail(28, `资产 sha256 对不上：${asset.path}`);
    const actual = sniffMime(bytes);
    if (actual !== asset.mime) {
      fail(
        28,
        `资产 ${asset.path} 声明 ${asset.mime}，实际字节是 ${actual} —— 服务端会拒绝它，读者看到裂图`,
      );
    }
  }
}

/**
 * A screenshot has to be of the version the lesson teaches.
 *
 * `capture.sourceCommit` is required and format-checked, and until now nothing
 * anywhere compared it to anything — so it recorded a claim, not a fact. That
 * matters more for pictures than for code: a citation can be re-read from the
 * pinned blob and checked against the prose, while a screenshot is opaque. If
 * it drifts, the only thing that notices is a reader who ends up looking at a
 * screen the project no longer has.
 *
 * The rule is exact equality with the lesson's own commit, which is meaningful
 * because across the whole shelf no lesson cites more than one: 561 of 561 pin
 * every citation to a single commit, so "the lesson's commit" is unambiguous.
 *
 * Ratcheted rather than hard. Fixing an offender means rebuilding the studied
 * project at that commit, running it, and re-shooting — real work that cannot
 * happen inside a lint run. Existing cases become recorded debt; new ones fail.
 */
function checkScreenshotCommit(manifest, fail) {
  const commits = new Set((manifest.evidence ?? []).map((entry) => entry.sourceCommit));
  if (commits.size !== 1) return;
  const lessonCommit = [...commits][0];
  for (const asset of manifest.assets ?? []) {
    const captured = asset.capture?.sourceCommit;
    if (!captured || captured === lessonCommit) continue;
    fail(
      29,
      `截图 ${asset.id} 拍于 ${captured.slice(0, 12)}，但本课的代码钉在 ${lessonCommit.slice(0, 12)}——` +
        `读者会同时看到两个版本的项目。需要在课文钉住的那个版本上重拍。`,
      DEBT_RULE.SCREENSHOT_COMMIT,
    );
  }
}

function lintLesson({ contentPath, manifestPath, content, manifest, id, previous }) {
  const problems = [];
  /** @param {number} item @param {string} message @param {string|null} [debtRule] */
  const fail = (item, message, debtRule = null) => problems.push({ item, message, debtRule });
  const prose = stripCode(content);
  const sections = sectionsOf(prose);

  // 1 — variant declared in the manifest, absent from the prose.
  const variant = manifest.variant;
  const shape = VARIANTS[variant];
  if (!shape)
    return [{ item: 1, message: `manifest variant 不是五种之一：${variant}`, debtRule: null }];
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

  // 12 — hand-copied project source (fence + evidence token) is a defect;
  //      every evidence token must be covered by the manifest (hard);
  //      every manifest citation must be anchored by a token (ratcheted).
  checkHandCopiedSource(content, fail);
  checkEvidenceTokens(content, manifest, fail);
  checkOrphanEvidence(content, manifest, fail);

  // 26 — detail layer structure and volume.
  checkDetailBlocks(content, fail);

  // 27 — system vocabulary out of the reader's world.
  checkSystemVocabulary(content, fail);

  checkGrowth(content, previous, fail);
  checkSecondPerson(prose, fail);

  // 23 — the bytes match what the manifest says they are.
  const digest = `sha256:${createHash("sha256").update(content).digest("hex")}`;
  if (manifest.contentHash !== digest) {
    fail(
      23,
      `contentHash 对不上（manifest ${manifest.contentHash?.slice(0, 20)}… 实际 ${digest.slice(0, 20)}…）`,
    );
  }

  // 28 — a picture the reader can actually see.
  checkAssetsAreServable(manifestPath, manifest, fail);

  // 29 — a picture of the version this lesson actually teaches.
  checkScreenshotCommit(manifest, fail);

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
        // Reading order, not directory order. `readdirSync` returns lesson ids
        // alphabetically, which is not the order a learner meets them in — the
        // rotation check (item 22) needs the real sequence or it invents
        // violations between lessons that are not actually adjacent, and misses
        // ones that are.
        const unitManifestPath = join(unitsRoot, unitId, "unit.json");
        const authoredOrder = existsSync(unitManifestPath)
          ? (JSON.parse(readFileSync(unitManifestPath, "utf8")).lessonIds ?? null)
          : null;
        const lessonIds = authoredOrder ?? readdirSync(lessonsRoot);
        for (const lessonId of lessonIds) {
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
          // The revision before this one, so the growth check has something to
          // compare against — and can tell a structural rewrite from a reword.
          const priorPath = join(revisions, String(latest - 1));
          const priorContent = join(priorPath, "content.md");
          const priorManifest = join(priorPath, "manifest.json");
          const previous =
            existsSync(priorContent) && existsSync(priorManifest)
              ? {
                  standardLength: standardProseLength(readFileSync(priorContent, "utf8")),
                  hadVariant: Boolean(JSON.parse(readFileSync(priorManifest, "utf8")).variant),
                }
              : null;
          const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
          yield {
            // Stable identity for the baseline file — never an array offset.
            id: `${studyId}/${courseId}/${unitId}/${lessonId}`,
            contentRevision: manifest.contentRevision ?? latest,
            contentPath,
            manifestPath,
            previous,
            content: readFileSync(contentPath, "utf8"),
            manifest,
          };
        }
      }
    }
  }
}

/**
 * Load checked-in debt. Missing file means no suppressions (new failures fail).
 * Map: lesson id → { contentRevision, rules: Set<string> }
 */
function loadBaseline(path) {
  if (!existsSync(path)) return new Map();
  const doc = JSON.parse(readFileSync(path, "utf8"));
  const map = new Map();
  for (const entry of doc.entries ?? []) {
    if (!entry?.id || entry.contentRevision == null || !Array.isArray(entry.rules)) continue;
    map.set(entry.id, {
      contentRevision: entry.contentRevision,
      rules: new Set(entry.rules.filter((r) => DEBT_RULE_ORDER.includes(r))),
    });
  }
  return map;
}

/** Suppress only when id + contentRevision + rule all match. */
function isSuppressed(baseline, lessonId, contentRevision, debtRule) {
  const entry = baseline.get(lessonId);
  if (!entry) return false;
  if (entry.contentRevision !== contentRevision) return false;
  return entry.rules.has(debtRule);
}

/**
 * Write a stable, sorted baseline so humans can review the diff.
 * Keys ordered by lesson id; rules in DEBT_RULE_ORDER.
 *
 * Rule arrays are written on one line (`"rules": ["detail", …]`), matching
 * oxfmt's compact style so `--update-baseline` does not trip `format:check`.
 */
function writeBaselineFile(path, collected) {
  const entries = [...collected.entries()]
    .map(([id, { contentRevision, rules }]) => ({
      id,
      contentRevision,
      rules: DEBT_RULE_ORDER.filter((r) => rules.has(r)),
    }))
    .filter((e) => e.rules.length > 0)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const pretty = JSON.stringify({ version: 1, entries }, null, 2);
  // oxfmt collapses short string arrays onto one line; match that style here.
  const compact = pretty.replace(/"rules": \[\n(?:\s+"[^"]+",?\n)+\s*\]/g, (block) => {
    const rules = [...block.matchAll(/"([^"]+)"/g)]
      .map((m) => m[1])
      .filter((name) => name !== "rules");
    return `"rules": [${rules.map((name) => `"${name}"`).join(", ")}]`;
  });
  writeFileSync(path, `${compact}\n`, "utf8");
  return entries.length;
}

const baseline = updateBaseline ? new Map() : loadBaseline(BASELINE_PATH);
/**
 * When regenerating: a full scan rebuilds from scratch. A filtered
 * `--study`/`--course` run merges into the existing file so other lessons'
 * debt is not wiped by accident.
 * @type {Map<string, { contentRevision: number, rules: Set<string> }>}
 */
const nextBaseline =
  updateBaseline && (onlyStudy || onlyCourse) ? loadBaseline(BASELINE_PATH) : new Map();

let checked = 0;
let failed = 0;
const rotation = new Map();

// Active suppressions this run (unique lessons per debt rule).
const debtExempt = {
  [DEBT_RULE.DETAIL]: 0,
  [DEBT_RULE.HAND_COPIED_FENCE]: 0,
  [DEBT_RULE.SYSTEM_VOCAB]: 0,
  [DEBT_RULE.ORPHAN_EVIDENCE]: 0,
};

for (const lesson of lessons("studies")) {
  // Lessons without a variant predate the shapes; linting them would be noise.
  if (!lesson.manifest.variant) continue;
  checked += 1;

  // study/course/unit — first three segments of the stable id.
  const unitKey = lesson.id.split("/").slice(0, 3).join("/");
  const run = rotation.get(unitKey) ?? [];
  run.push(lesson.manifest.variant);
  rotation.set(unitKey, run);

  const problems = lintLesson(lesson);
  const reportable = [];
  /** @type {Set<string>} */
  const suppressedRules = new Set();
  /** @type {Set<string>} */
  const failingDebtRules = new Set();

  for (const problem of problems) {
    if (!problem.debtRule) {
      reportable.push(problem);
      continue;
    }
    failingDebtRules.add(problem.debtRule);
    // --update-baseline rebuilds from today's failures; treat them as exempt
    // for this run so regenerating the file alone can clear the gate.
    const exempt =
      updateBaseline || isSuppressed(baseline, lesson.id, lesson.contentRevision, problem.debtRule);
    if (exempt) {
      suppressedRules.add(problem.debtRule);
    } else {
      reportable.push(problem);
    }
  }

  if (updateBaseline) {
    if (failingDebtRules.size > 0) {
      nextBaseline.set(lesson.id, {
        contentRevision: lesson.contentRevision,
        rules: failingDebtRules,
      });
    } else {
      // Fixed (or never debt) under this scan — drop any stale exemption.
      nextBaseline.delete(lesson.id);
    }
  }

  for (const rule of suppressedRules) {
    if (rule in debtExempt) debtExempt[rule] += 1;
  }
  if (suppressedRules.size > 0 && !updateBaseline) {
    stillExempt.push({ id: lesson.id, rules: [...suppressedRules].sort() });
  }

  if (reportable.length > 0) {
    failed += 1;
    console.log(`\n✗ ${lesson.id}  [${lesson.manifest.variant}]`);
    for (const { item, message } of reportable) console.log(`    ${item}. ${message}`);
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

if (updateBaseline) {
  const n = writeBaselineFile(BASELINE_PATH, nextBaseline);
  console.log(`\n已写入 baseline ${BASELINE_PATH}（${n} 节课有存量豁免）。`);
}

console.log(`\n${checked} 节课已检查，${failed} 节有问题。`);
console.log(
  `存量豁免：无 detail ${debtExempt[DEBT_RULE.DETAIL]} / 手抄 fence ${debtExempt[DEBT_RULE.HAND_COPIED_FENCE]} / 系统词汇 ${debtExempt[DEBT_RULE.SYSTEM_VOCAB]} / 孤儿证据 ${debtExempt[DEBT_RULE.ORPHAN_EVIDENCE]}（改写后自动失效）`,
);
if (checked === 0) console.log("（没有带 variant 的课文——尚未按新辩体重写。）");

/*
 * --strict: a grandfathered lesson is a lesson nobody has rewritten yet.
 *
 * Without this, finishing a course looks identical to skipping a lesson in it:
 * both print「0 节有问题」. That is not hypothetical — a 41-lesson upgrade
 * reported 41/41 complete while one lesson kept its exemption from an older
 * revision, so the linter told the agent it was already fine and it was left
 * carrying every defect the upgrade existed to remove.
 *
 * The default run stays lenient because the debt is real and shrinks slowly.
 * Use --strict as the "this scope is finished" gate, where any surviving
 * exemption means it is not.
 */
if (strict && stillExempt.length > 0) {
  console.log(`\n✗ --strict：${stillExempt.length} 节课只是因为存量豁免才通过，并没有被改写。`);
  for (const { id, rules } of stillExempt) console.log(`    ${id}  (${rules.join(", ")})`);
  console.log("\n改写它们并新建 revision，豁免会自动失效。不要改 baseline。");
  process.exit(1);
}
process.exit(failed > 0 ? 1 : 0);
