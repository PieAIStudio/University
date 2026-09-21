#!/usr/bin/env node
/*
  Two rules `e2e/README.md` already states, now with something that notices.

  Both were written on 2026-09-13 (`4e5126de`). Nine specs carrying ordering
  letters in their filenames arrived on 09-15, 09-16 and 09-19 — three separate
  waves, all after the rule, none of them malicious. A rule nothing checks is a
  preference, and preferences lose to whatever the last person did.

  This gate does not clean up what is already here. Renaming the nine would
  orphan the filename anchors in `e2e/experience-ledger.json`, which is a
  hand-kept record of findings and the reason the README also says historical
  case IDs must stay searchable. That trade is a separate decision with its own
  migration. What this gate does is stop the list from growing, and keep the
  four catalogue exceptions countable rather than ambient.
*/
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const E2E = "e2e";

/** Filenames that carried ordering letters before the gate existed.
 *  Their case IDs are anchors in `e2e/experience-ledger.json`; renaming them
 *  is a migration, not a rename. Nothing may be added here. */
const LETTER_PREFIXED_BEFORE_THE_GATE = new Set([
  "AA.map-navigation.spec.ts",
  "AB.map-route-state.spec.ts",
  "W.ai-literacy.spec.ts",
  "X.ai-literacy-english.spec.ts",
  "Y.english-campus.spec.ts",
  "Z.account-app.spec.ts",
  "Z.account-closure.spec.ts",
  "Z.account-feedback.spec.ts",
  "Z.account-flow.spec.ts",
]);

/** Specs that still read the baked catalogue directly instead of asking
 *  `harness/catalogue.ts` for a role. Each one pins a course identity, so a
 *  change to which course sits where scatters into several unrelated reds.
 *  This list may only shrink. */
const DIRECT_CATALOGUE_READERS_BEFORE_THE_GATE = new Set([
  "AA.map-navigation.spec.ts",
  "W.ai-literacy.spec.ts",
  "X.ai-literacy-english.spec.ts",
  "Y.english-campus.spec.ts",
]);

const ORDERING_LETTERS = /(^|\/)[A-Z]{1,2}\./;
const BAKED_CATALOGUE = "apps/university/content";

/** Playwright's testMatch collects spec files at every depth under `e2e`, so
 *  the rules have to reach as far as the runner does: `harness/click.spec.ts`
 *  lives one level down and a top-level-only scan would never see it. */
function specsUnder(dir, prefix = "") {
  return readdirSync(join(E2E, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? specsUnder(join(dir, entry.name), `${prefix}${entry.name}/`)
      : entry.name.endsWith(".spec.ts")
        ? [`${prefix}${entry.name}`]
        : [],
  );
}
const specs = specsUnder(".");
const problems = [];

for (const name of specs) {
  if (ORDERING_LETTERS.test(name) && !LETTER_PREFIXED_BEFORE_THE_GATE.has(name)) {
    problems.push(
      `${name}: 文件名用了排序字母前缀。e2e/README.md 要求描述性的 ` +
        `<feature>.spec.ts；case ID 放在测试标题里，不放在文件名里。`,
    );
  }
  if (
    readFileSync(join(E2E, name), "utf8").includes(BAKED_CATALOGUE) &&
    !DIRECT_CATALOGUE_READERS_BEFORE_THE_GATE.has(name)
  ) {
    problems.push(
      `${name}: 直接读了 ${BAKED_CATALOGUE}。harness/catalogue.ts 是唯一的目录读取者；` +
        `按角色取课，不要在 spec 里钉死某一门课的身份。`,
    );
  }
}

/** A grandfather list that outlives what it excused is its own kind of lie. */
for (const stale of [...LETTER_PREFIXED_BEFORE_THE_GATE].filter((n) => !specs.includes(n))) {
  problems.push(`豁免名单里的 ${stale} 已经不存在了——把它从名单里删掉。`);
}
for (const name of DIRECT_CATALOGUE_READERS_BEFORE_THE_GATE) {
  if (!specs.includes(name)) {
    problems.push(`豁免名单里的 ${name} 已经不存在了——把它从名单里删掉。`);
    continue;
  }
  if (!readFileSync(join(E2E, name), "utf8").includes(BAKED_CATALOGUE)) {
    problems.push(
      `${name} 已经不再直接读目录了——把它从 DIRECT_CATALOGUE_READERS_BEFORE_THE_GATE 里删掉。`,
    );
  }
}

if (problems.length === 0) {
  console.log(
    `e2e contracts: ok（${specs.length} 个 spec；` +
      `${LETTER_PREFIXED_BEFORE_THE_GATE.size} 个历史字母前缀、` +
      `${DIRECT_CATALOGUE_READERS_BEFORE_THE_GATE.size} 个历史目录直读，两份名单都只许变短）`,
  );
  process.exit(0);
}
for (const problem of problems) console.log(`  ${problem}`);
process.exit(1);
