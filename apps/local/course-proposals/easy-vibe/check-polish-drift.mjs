#!/usr/bin/env node
/**
 * What a structural polish guard cannot see.
 *
 * `polish.mjs` validates the shape of what flash returns: six headings, a
 * comparison word in the analogy, no banned phrase, links intact, the
 * objective still opening 读完你能. Every one of those is structure.
 *
 * The failure it cannot catch is a changed fact — 429 quietly becoming 419,
 * `strictPort` becoming `strict_port`, 0.44 becoming 0.4. Those keep the
 * shape perfectly and are exactly the errors this course cannot afford,
 * because a reader who types what the lesson says gets an error the lesson
 * does not explain.
 *
 * So this compares the polished text against the pre-polish text in git and
 * demands that three classes of token survive unchanged, as multisets:
 * numbers, inline code spans, and fenced code blocks. Prose may move freely;
 * facts may not.
 *
 * Usage:
 *   node apps/local/course-proposals/easy-vibe/check-polish-drift.mjs <ref>
 *   (ref defaults to HEAD — the commit made before the polish ran)
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";

const ref = process.argv[2] ?? "HEAD";
const dir = "apps/local/course-proposals/easy-vibe";
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".json") && !["pilot.json", "full-course.json"].includes(f))
  .sort();

/** Numbers, inline code and fenced blocks are facts; prose is not. */
function tokens(text) {
  return {
    numbers: (text.match(/\d+(?:\.\d+)?/gu) ?? []).sort(),
    inline: (text.match(/`[^`\n]+`/gu) ?? []).sort(),
    fenced: (text.match(/```[\s\S]*?```/gu) ?? []).map((s) => s.replace(/\s+/gu, "")).sort(),
  };
}

function diffMultiset(before, after) {
  const count = (xs) => xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map());
  const b = count(before);
  const a = count(after);
  const lost = [];
  const gained = [];
  for (const [k, n] of b) if ((a.get(k) ?? 0) < n) lost.push(k);
  for (const [k, n] of a) if ((b.get(k) ?? 0) < n) gained.push(k);
  return { lost, gained };
}

let checked = 0;
const problems = [];

for (const file of files) {
  let old;
  try {
    old = JSON.parse(execFileSync("git", ["show", `${ref}:${dir}/${file}`], { encoding: "utf8" }));
  } catch {
    console.log(`  · ${file} 在 ${ref} 里还不存在，跳过`);
    continue;
  }
  const now = JSON.parse(readFileSync(`${dir}/${file}`, "utf8"));
  const byId = new Map(old.lessons.map((l) => [l.id, l.content]));

  for (const lesson of now.lessons) {
    const before = byId.get(lesson.id);
    if (before === undefined || before === lesson.content) continue;
    checked += 1;
    const b = tokens(before);
    const a = tokens(lesson.content);
    for (const kind of ["numbers", "inline", "fenced"]) {
      const { lost, gained } = diffMultiset(b[kind], a[kind]);
      if (lost.length || gained.length) {
        problems.push(
          `${file} → ${lesson.id} [${kind}]\n     少了: ${lost.slice(0, 6).join(" | ") || "无"}\n     多了: ${gained.slice(0, 6).join(" | ") || "无"}`,
        );
      }
    }
  }
}

console.log(`\n比对了 ${checked} 节被润色过的课文（基准 ${ref}）`);
if (problems.length === 0) {
  console.log("✓ 数字、行内代码、代码块全部原样保留 —— 润色只动了说法，没动事实。");
  process.exit(0);
}
console.log(`\n✗ ${problems.length} 处事实性漂移：\n`);
for (const p of problems) console.log("  " + p + "\n");
process.exit(1);
