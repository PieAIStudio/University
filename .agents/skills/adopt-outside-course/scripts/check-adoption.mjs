#!/usr/bin/env node
/**
 * 通用课特有的门禁。
 *
 * `apps/local/scripts/check-proposal-shape.mjs` 管所有课都要守的形状。
 * 这一个只管通用课多出来的那几条，其中第一条是不能破的：
 *
 *   出处必须指向权威原始资料，绝不能指向被参考的那门课。
 *
 * 这条既是和原作者说好的边界，也是个质量闸——一个说法找不到权威出处，
 * 通常是因为它其实是某个人的经验，而经验不该当事实讲。
 *
 * `--verify-urls` 会真的去请求每一条出处。这一条值得单独说：
 * 一个看起来完全合理、实际不存在的 MDN 链接，是 AI 写课最典型的错误，
 * 而它在人工评审里几乎发现不了 —— 因为链接看起来就该是那样。
 *
 * 用法：
 *   node check-adoption.mjs <proposal.json> [...]
 *   node check-adoption.mjs <proposal.json> --verify-urls
 *   node check-adoption.mjs <proposal.json> --forbid extra-host.com,another.org
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * One list, shared with the persist-time schema. Duplicating it here used to
 * mean a host could pass adoption and then fail `course create`, or the other
 * way around — both are the same rule, so they read the same file.
 */
const hosts = JSON.parse(
  readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../../packages/core/src/domain/url-evidence-hosts.json",
    ),
    "utf8",
  ),
);
const AUTHORITY_HOSTS = hosts.authorityHosts;
const FORBIDDEN_HOSTS = hosts.forbiddenHosts;
const AUTHORITY_TAGS = hosts.authorityTags;

const argv = process.argv.slice(2);
const forbidAt = argv.indexOf("--forbid");
const extraForbidden =
  forbidAt === -1 ? [] : (argv[forbidAt + 1] ?? "").split(",").map((h) => h.trim()).filter(Boolean);
// `--forbid` 不在时，`forbidAt + 1` 是 0，会把第一个文件路径当成参数值吃掉。
// `apps/local/scripts/check-proposal-shape.mjs` 的注释里写着提防过这一脚，我照样踩了。
const valueAt = forbidAt === -1 ? -1 : forbidAt + 1;
const paths = argv.filter(
  (value, index) => index !== forbidAt && index !== valueAt && !value.startsWith("--"),
);

if (paths.length === 0) {
  console.error("usage: node check-adoption.mjs <proposal.json> [...] [--forbid host,host]");
  process.exit(2);
}

const forbidden = [...FORBIDDEN_HOSTS, ...extraForbidden];
const verifyUrls = argv.includes("--verify-urls");

/** 每条出处真的请求一次。编出来的 MDN 链接看起来和真的一模一样。 */
async function verify(urls) {
  const dead = [];
  await Promise.all(
    [...urls].map(async (url) => {
      try {
        const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
        if (!res.ok) dead.push(`${url} → HTTP ${res.status}`);
      } catch (error) {
        dead.push(`${url} → ${(error && error.message) || error}`);
      }
    }),
  );
  return dead;
}

let failed = false;
for (const path of paths) {
  const proposal = JSON.parse(readFileSync(path, "utf8"));
  const problems = check(proposal);
  if (verifyUrls) {
    const dead = await verify(collectUrls(proposal));
    for (const entry of dead) problems.push(`出处打不开：${entry}`);
  }
  if (problems.length === 0) {
    console.log(`ok  ${path}`);
    continue;
  }
  failed = true;
  console.error(`\n${path} — ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  ${problem}`);
}
process.exit(failed ? 1 : 0);

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** `docs.python.org` 命中 `python.org`，但 `notmdn.org` 不命中 `mdn.org`。 */
function hostMatches(host, allowed) {
  return host === allowed || host.endsWith(`.${allowed}`);
}

function unitsOf(proposal) {
  if (proposal.course) return proposal.course.units ?? [];
  if (proposal.unit && proposal.lessons) return [{ ...proposal.unit, lessons: proposal.lessons }];
  return null;
}

function checkEvidence(evidence, where, problems) {
  for (const [index, reference] of (evidence ?? []).entries()) {
    const at = `${where}: evidence[${index}]`;
    const url = reference.sourceUrl;

    if (!url) {
      problems.push(`${at}: 通用课的出处必须带 sourceUrl（指向 MDN / RFC / 官方文档）`);
      continue;
    }
    const host = hostOf(url);
    if (!host) {
      problems.push(`${at}: sourceUrl 不是一个合法的 URL：${JSON.stringify(url)}`);
      continue;
    }

    // 这是这个脚本存在的头号理由。
    const banned = forbidden.find((entry) => hostMatches(host, entry));
    if (banned) {
      problems.push(
        `${at}: 出处指向 ${banned} —— 通用课绝不能引用被参考的那门课，把它换成权威原始资料`,
      );
      continue;
    }

    if (!AUTHORITY_HOSTS.some((entry) => hostMatches(host, entry))) {
      problems.push(
        `${at}: ${host} 不在权威出处清单里。` +
          `确认它是官方文档 / 规范之后，把它加进 AUTHORITY_HOSTS，不要就地放行`,
      );
    }
    if (reference.sourceAuthority && !AUTHORITY_TAGS.includes(reference.sourceAuthority)) {
      problems.push(
        `${at}: sourceAuthority "${reference.sourceAuthority}" 不在 ${AUTHORITY_TAGS.join(" / ")} 里`,
      );
    }
  }
}

/*
  这里曾经有一个 checkAnalogy：它要求每节课有 `## 一个类比` 小节，并且检查
  里面出现了比喻说法。那个小节已经随旧骨架一起退休，`write-lesson` 现在明令
  禁止这个标题——所以这个检查在每一节现行课文上都会提前返回，然后报告一次
  它根本没做的检查。挂在不存在的标题上的探针，比没有探针更坏。

  它想守的东西没有消失：「先解释，再使用」现在由
  apps/local/scripts/check-proposal-shape.mjs 的 analogy-order 守着，
  边界从「类比段之前」改成了「答案段之前」。
*/
function check(proposal) {
  const problems = [];
  const units = unitsOf(proposal);
  if (!units) return ["既不是 course 也不是 unit + lessons —— 这不是一份课程 proposal"];

  for (const unit of units) {
    for (const lesson of unit.lessons ?? []) {
      const where = `lesson ${lesson.id}`;
      checkEvidence(lesson.evidence, where, problems);
      for (const card of lesson.cards ?? []) {
        checkEvidence(card.evidence, `${where} → card ${card.id}`, problems);
      }
      for (const exercise of lesson.exercises ?? []) {
        checkEvidence(exercise.evidence, `${where} → exercise ${exercise.id}`, problems);
      }
    }
  }
  return problems;
}

/** 一份 proposal 里出现过的全部出处 URL，去重。 */
function collectUrls(proposal) {
  const urls = new Set();
  const take = (evidence) => {
    for (const reference of evidence ?? []) if (reference.sourceUrl) urls.add(reference.sourceUrl);
  };
  for (const unit of unitsOf(proposal) ?? []) {
    for (const lesson of unit.lessons ?? []) {
      take(lesson.evidence);
      for (const card of lesson.cards ?? []) take(card.evidence);
      for (const exercise of lesson.exercises ?? []) take(exercise.evidence);
    }
  }
  return urls;
}
