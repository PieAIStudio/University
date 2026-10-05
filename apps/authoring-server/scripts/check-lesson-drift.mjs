#!/usr/bin/env node
/**
 * The acceptance checks a wave has to survive, in one command.
 *
 * The linter already covers structure, hash, evidence coverage, and 「你」
 * density. This covers what it cannot see:
 *
 *   1. the evidence / card / exercise arrays were carried forward unchanged
 *      — the single rule that keeps hundreds of rewrites safe
 *   2. length ratio, because the 115% ceiling does not apply to a lesson whose
 *      previous revision had no `variant`, which is every lesson being
 *      converted — so padding has no machine gate at all
 *
 * Usage:
 *   node scripts/check-lesson-drift.mjs <study> [sinceISO]
 *
 * With `sinceISO`, only lessons whose latest content.md was written after that
 * moment are reported in the ratio table — i.e. just this wave.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const [study, sinceRaw] = process.argv.slice(2);
if (!study) {
  console.error("usage: check-lesson-drift.mjs <study> [sinceISO]");
  process.exit(2);
}
const since = sinceRaw ? new Date(sinceRaw).getTime() : null;

/**
 * The lesson with its fenced code removed.
 *
 * Total growth turned out to be the wrong thing to measure. A lesson whose old
 * revision was 770 characters of bullet-point conclusions — no code at all —
 * grew 2.3x by quoting the two real functions it was describing. That is the
 * rewrite working, not padding, and a ratio gate flags it as a defect.
 *
 * Padding is always prose. Quoted code is verified against the pinned source
 * by check-lesson-anchors.mjs, so it cannot be invented; the only place an agent can
 * add interesting-but-irrelevant material is the prose around it. Measuring
 * prose alone puts the number on the thing the rule is actually about.
 *
 * Measured in characters, matching `lint-lessons.mjs`, which compares
 * `content.length` on a utf8-decoded string. An agent that reports the ratio in
 * bytes will understate it by roughly 15% on Chinese prose — one already did.
 */
const proseOnly = (text) => text.replace(/^[ \t]*(`{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm, "");

const root = join("studies", study, "courses");
const drift = [];
const ratios = [];
let rewritten = 0;
let total = 0;

for (const course of readdirSync(root).sort()) {
  const unitsDir = join(root, course, "units");
  if (!existsSync(unitsDir)) continue;
  for (const unit of readdirSync(unitsDir).sort()) {
    const lessonsDir = join(unitsDir, unit, "lessons");
    if (!existsSync(lessonsDir)) continue;
    for (const lesson of readdirSync(lessonsDir)) {
      const dir = join(lessonsDir, lesson);
      if (!statSync(dir).isDirectory()) continue;
      const latestPath = join(dir, "latest.json");
      if (!existsSync(latestPath)) continue;
      total++;

      const rev = JSON.parse(readFileSync(latestPath, "utf8")).contentRevision;
      const curDir = join(dir, "revisions", String(rev));
      const curManifestPath = join(curDir, "manifest.json");
      if (!existsSync(curManifestPath)) continue;
      const cur = JSON.parse(readFileSync(curManifestPath, "utf8"));
      if (cur.variant) rewritten++;
      if (rev < 2) continue;

      const id = `${course}/${unit}/${lesson}`;

      // Nothing to say about a lesson that has not been rewritten yet: a
      // pre-rewrite `course revise` that legitimately added evidence or cards
      // is not drift, and this check is only about what a rewrite touched.
      if (!cur.variant) continue;

      // 1 — the arrays that must survive a rewrite untouched.
      //
      // The baseline is the LAST revision that still had no `variant`, not
      // revision 1. A lesson may legitimately have been enriched before the
      // rewrites began — `course revise` can add evidence and cards, and one
      // lesson was — and comparing against revision 1 would report that old,
      // intentional change as fresh drift on every future wave. Comparing
      // against the last pre-rewrite revision asks the question we actually
      // care about: did *the rewrite* touch these arrays?
      //
      // Using `rev - 1` instead would let a lesson revised twice launder a
      // change through an intermediate revision.
      let baseRev = null;
      for (let r = rev - 1; r >= 1; r--) {
        const p = join(dir, "revisions", String(r), "manifest.json");
        if (!existsSync(p)) continue;
        if (!JSON.parse(readFileSync(p, "utf8")).variant) {
          baseRev = r;
          break;
        }
      }
      const basePath =
        baseRev === null ? null : join(dir, "revisions", String(baseRev), "manifest.json");
      if (basePath && existsSync(basePath)) {
        const base = JSON.parse(readFileSync(basePath, "utf8"));
        for (const [field, a, b] of [
          ["evidence", base.evidence, cur.evidence],
          ["cards", base.cardIds ?? base.cards, cur.cardIds ?? cur.cards],
          ["exercises", base.exerciseIds ?? base.exercises, cur.exerciseIds ?? cur.exercises],
        ]) {
          if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) {
            drift.push(`${field.toUpperCase()} CHANGED: ${id}`);
          }
        }
      }

      // 2 — growth, for the lessons this wave actually wrote.
      const curContent = join(curDir, "content.md");
      const prevContent = join(dir, "revisions", String(rev - 1), "content.md");
      if (!cur.variant || !existsSync(curContent) || !existsSync(prevContent)) continue;
      if (since !== null && statSync(curContent).mtimeMs < since) continue;
      const beforeRaw = readFileSync(prevContent, "utf8");
      const afterRaw = readFileSync(curContent, "utf8");
      ratios.push([
        proseOnly(afterRaw).length / Math.max(proseOnly(beforeRaw).length, 1),
        id,
        cur.variant,
        beforeRaw.length,
        afterRaw.length,
        afterRaw.length / beforeRaw.length,
      ]);
    }
  }
}

console.log(`${study}: ${rewritten}/${total} rewritten`);

console.log(`\n--- evidence / card / exercise drift ---`);
if (drift.length === 0) console.log("none");
else drift.forEach((d) => console.log("  " + d));

if (ratios.length > 0) {
  ratios.sort((a, b) => b[0] - a[0]);
  console.log(`\n--- length ratios (${ratios.length} lessons in scope) ---`);
  for (const [r, id, variant, before, after, totalRatio] of ratios) {
    const flag = r > 2.0 ? " <<< PROSE OVER 2.0x" : "";
    console.log(
      `prose ${r.toFixed(2)}x  total ${totalRatio.toFixed(2)}x  ${String(before).padStart(5)}->${String(after).padStart(5)}  [${variant}]  ${id}${flag}`,
    );
  }
  const median = ratios[Math.floor(ratios.length / 2)][0];
  const over = ratios.filter((r) => r[0] > 2.0).length;
  console.log(`\nmedian ${median.toFixed(2)}x, over 2.0x: ${over}`);
}

process.exit(drift.length > 0 || ratios.some((r) => r[0] > 2.0) ? 1 : 0);
