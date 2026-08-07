#!/usr/bin/env node
/**
 * Which English words the lessons use that the lexicon cannot explain.
 *
 * Detection can only surface a word the lexicon defines, so coverage has two
 * separate limits and they need separate names. "No anchors on this lesson" is
 * now impossible — the detector reads the text. "This word has no gloss" is
 * still very possible, and it is invisible from inside the app: the learner
 * just never sees the word offered, and cannot tell that from the word not
 * being there.
 *
 * This turns that silence into a ranked list, so the lexicon grows toward what
 * the courses actually say rather than toward whatever occurred to an author.
 *
 * Usage:
 *   node scripts/vocabulary-coverage.mjs [studyId] [--limit 40]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);
const studyId = args.find((value) => !value.startsWith("--")) ?? "turing-pact";
const limitFlag = args.indexOf("--limit");
const limit = limitFlag === -1 ? 40 : Number(args[limitFlag + 1] ?? 40);

const lexicon = JSON.parse(readFileSync(join(root, "data/vocabulary/en.json"), "utf8"));
const known = new Set(lexicon.entries.map((entry) => entry.headword.toLowerCase()));

/**
 * Same regions the renderer refuses to annotate. Counting words inside code
 * would rank identifiers — `const`, `src`, `tsx` — above the prose words a
 * learner is actually reading.
 */
const PROTECTED = [
  /^[ \t]*(`{3,}|~{3,})[\s\S]*?^[ \t]*\1[ \t]*$/gm,
  /`[^`\n]+`/g,
  /\]\([^)\n]*\)/g,
  /<[^>\n]+>/g,
  /^[ \t]*\|.*\|[ \t]*$/gm,
];

function stripCode(text) {
  let out = text;
  for (const pattern of PROTECTED) out = out.replace(pattern, (match) => " ".repeat(match.length));
  return out;
}

/** Reverse of the detector's suffix rules, so `files` counts toward `file`. */
function baseForm(word) {
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("es") && /(?:s|sh|ch|x|z)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  if (word.endsWith("ing")) return word.slice(0, -3);
  if (word.endsWith("ed")) return word.slice(0, -2);
  return word;
}

function* lessonContents(studyRoot) {
  const coursesDir = join(studyRoot, "courses");
  if (!existsSync(coursesDir)) return;
  for (const course of readdirSync(coursesDir)) {
    const unitsDir = join(coursesDir, course, "units");
    if (!existsSync(unitsDir)) continue;
    for (const unit of readdirSync(unitsDir)) {
      const lessonsDir = join(unitsDir, unit, "lessons");
      if (!existsSync(lessonsDir)) continue;
      for (const lesson of readdirSync(lessonsDir)) {
        const revisions = join(lessonsDir, lesson, "revisions");
        if (!existsSync(revisions)) continue;
        const latest = readdirSync(revisions)
          .map(Number)
          .filter((value) => Number.isInteger(value))
          .sort((a, b) => b - a)[0];
        const file = join(revisions, String(latest), "content.md");
        if (existsSync(file)) yield readFileSync(file, "utf8");
      }
    }
  }
}

const counts = new Map();
let lessons = 0;
for (const content of lessonContents(join(root, "studies", studyId))) {
  lessons += 1;
  const seen = new Set();
  for (const match of stripCode(content).matchAll(/[A-Za-z][A-Za-z-]{2,}/g)) {
    const word = match[0].toLowerCase();
    if (word.includes("-")) continue;
    const base = known.has(word) ? word : baseForm(word);
    if (known.has(base)) continue;
    // Lessons, not hits: a word repeated eight times in one lesson is one
    // lesson's worth of evidence that it matters.
    if (seen.has(base)) continue;
    seen.add(base);
    counts.set(base, (counts.get(base) ?? 0) + 1);
  }
}

const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
console.log(`study: ${studyId}  lessons: ${lessons}  lexicon: ${known.size} senses`);
console.log(`top ${ranked.length} undefined words, by how many lessons use them:\n`);
for (const [word, lessonCount] of ranked) {
  console.log(`  ${String(lessonCount).padStart(4)}  ${word}`);
}
