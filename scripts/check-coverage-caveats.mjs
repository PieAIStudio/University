#!/usr/bin/env node
/*
  What did this green actually cover?

  Two checks in the verify chain cannot run without the author's private study
  checkouts, and both handle that correctly on their own terms: they print
  "SOURCE FRESHNESS IS NOT PROVEN HERE" and "NOT CHECKED", then exit 0, because
  failing every fresh clone for not having someone else's disk would be worse.

  What neither of them can do is change what `pnpm verify` means. The chain
  ends in one exit code, and on a machine without those checkouts that code
  says "passed" while two of the nineteen steps did not look at anything. This
  repository has already been bitten by a gate that was green because it was
  not looking; that one at least failed loudly once found.

  So this step re-derives the same condition and states the coverage in one
  line, at the end, where the person reading the result is. It never fails: a
  bare machine is a legitimate place to run verify. It only refuses to let the
  last word be an unqualified "ok".
*/
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const studiesRoot = process.argv[2] ?? "apps/local/studies";

const initialized = existsSync(studiesRoot)
  ? readdirSync(studiesRoot)
      .filter((entry) => !entry.startsWith("."))
      .filter((entry) => statSync(join(studiesRoot, entry)).isDirectory())
      .filter((entry) => existsSync(join(studiesRoot, entry, "study.json")))
  : [];

/** The steps that go quiet when the author's course source is absent. */
const SOURCE_DEPENDENT = [
  "check:export-freshness — 已发布的 recovery 包是否还和作者的课程源一致",
  "check:lesson-links --optional — 真实课程内容里的课节链接是否指得到",
];

if (initialized.length > 0) {
  console.log(
    `coverage: 本机有 ${initialized.length} 门带 study.json 的 study` +
      `（${initialized.join("、")}），依赖课程源的检查是真的跑过的。`,
  );
  process.exit(0);
}

console.log(
  `coverage: ${studiesRoot} 下没有任何带 study.json 的 study。` +
    `verify 通过，但下面这些没有被检查过：`,
);
for (const step of SOURCE_DEPENDENT) console.log(`  · ${step}`);
console.log(
  "  这不是失败——干净 clone 本来就没有作者的课程源。" + "它只是说明这次绿灯没覆盖到哪里。",
);
process.exit(0);
