#!/usr/bin/env node
/**
 * Does the code a lesson prints actually appear in the source it cites?
 *
 * `lint-lessons.mjs` checks that every `[[evidence:path:lines]]` token falls
 * inside a range the manifest already declares. That stops invented line
 * numbers. It does not — and cannot, without reading the repository — check
 * that the code block sitting above the token was really copied from those
 * lines. A lesson can quote code that is subtly wrong, or right code against
 * the wrong range, and pass every existing gate.
 *
 * So this reads the pinned snapshot itself. For each code fence immediately
 * followed by an evidence token, every non-trivial line of the fence must
 * appear somewhere in the cited file. Lines are compared with whitespace
 * collapsed, because a lesson legitimately re-indents an excerpt.
 *
 * Deliberately checks "in the file", not "in the exact range": lessons often
 * cite the range a mechanism lives in while quoting a signature from three
 * lines above it, and flagging that would be noise. What this catches is the
 * thing that matters — code in a lesson that is not in the repository at all.
 *
 * Usage:
 *   node scripts/check-lesson-anchors.mjs <study> [sinceISO]
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const [study, sinceRaw] = process.argv.slice(2);
if (!study) {
  console.error("usage: check-lesson-anchors.mjs <study> [sinceISO]");
  process.exit(2);
}
const since = sinceRaw ? new Date(sinceRaw).getTime() : null;

const GIT_DIR = join("studies", study, "source", "repository.git");
if (!existsSync(GIT_DIR)) {
  console.error(`no pinned repository at ${GIT_DIR}`);
  process.exit(2);
}

const fileCache = new Map();
function sourceOf(commit, path) {
  const key = `${commit}:${path}`;
  if (fileCache.has(key)) return fileCache.get(key);
  let text = null;
  try {
    text = execFileSync("git", ["-C", GIT_DIR, "show", key], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch {
    text = null;
  }
  fileCache.set(key, text);
  return text;
}

/**
 * Collapse whitespace, and drop a trailing comma.
 *
 * An excerpt's last line loses the comma the real file has after it — quoting
 * `"verify": "pnpm verify:web"` from a longer object is correct, and reporting
 * it as absent from the file is pure noise. Fourteen such reports across 383
 * blocks, none of them real, is how a checker teaches you to ignore it.
 */
const norm = (s) => s.replace(/\s+/g, " ").trim().replace(/,$/, "");

/**
 * A line the author visibly abridged. `package.json`'s lint script is 200
 * characters of file list; printing it whole would teach nothing, and the
 * ellipsis tells the reader something was cut. Honest, so not a mismatch.
 */
const isAbridged = (line) => /\.\.\.|…/.test(line);

/** Fences whose content is illustrative, matching the linter's own exemptions. */
const ILLUSTRATIVE = new Set(["", "text", "txt", "md", "markdown", "mermaid"]);

const problems = [];
const notes = [];
let lessonsChecked = 0;
let anchorsChecked = 0;

const root = join("studies", study, "courses");
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
      const rev = JSON.parse(readFileSync(latestPath, "utf8")).contentRevision;
      const revDir = join(dir, "revisions", String(rev));
      const contentPath = join(revDir, "content.md");
      const manifestPath = join(revDir, "manifest.json");
      if (!existsSync(contentPath) || !existsSync(manifestPath)) continue;

      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      if (!manifest.variant) continue;
      if (since !== null && statSync(contentPath).mtimeMs < since) continue;

      const id = `${course}/${unit}/${lesson}`;
      const content = readFileSync(contentPath, "utf8");
      lessonsChecked++;

      // Every evidence entry must point at a file that exists at the pinned
      // commit, over lines that file actually has.
      //
      // The product's own `validateTargetEvidence` checks only that the
      // snapshot id and source commit match the target — not that the path
      // resolves or the range is in bounds. That is survivable while rewrites
      // carry existing arrays forward untouched, but a NEW course picks its own
      // citations, and a hallucinated path would be written to disk and only
      // discovered by a reader hitting a blank evidence panel.
      for (const e of manifest.evidence ?? []) {
        const src = sourceOf(e.sourceCommit, e.sourcePath);
        if (src === null) {
          problems.push(
            `MISSING ${id}: evidence cites ${e.sourcePath}, absent at ${e.sourceCommit.slice(0, 10)}`,
          );
          continue;
        }
        const lines = src.split("\n").length;
        if (e.lineEnd > lines || e.lineStart < 1 || e.lineStart > e.lineEnd) {
          problems.push(
            `RANGE ${id}: evidence cites ${e.sourcePath}:${e.lineStart}-${e.lineEnd}, file has ${lines} lines`,
          );
        }
      }

      // A fence, then the evidence token that must follow it.
      const fenceRe = /^[ \t]*(`{3,})([^\n]*)\n([\s\S]*?)^[ \t]*\1[ \t]*$/gm;
      let m;
      while ((m = fenceRe.exec(content)) !== null) {
        const lang = m[2].trim().toLowerCase();
        if (ILLUSTRATIVE.has(lang)) continue;
        const body = m[3];
        const after = content.slice(m.index + m[0].length, m.index + m[0].length + 260);
        const token = /\[\[evidence:([^\]:]+):([0-9]+)(?:-([0-9]+))?\]\]/.exec(after);
        if (!token) continue; // the linter already reports an unanchored fence
        const [, path] = token;

        const entry = (manifest.evidence ?? []).find((e) => e.sourcePath === path);
        if (!entry) {
          problems.push(`${id}: anchor cites ${path}, which the manifest does not list`);
          continue;
        }
        const source = sourceOf(entry.sourceCommit, path);
        if (source === null) {
          problems.push(
            `${id}: ${path} does not exist at pinned commit ${entry.sourceCommit.slice(0, 10)}`,
          );
          continue;
        }
        anchorsChecked++;

        const haystack = new Set(source.split("\n").map(norm));
        const missing = body
          .split("\n")
          .map(norm)
          // Punctuation-only and very short lines carry no signal and match
          // everywhere; comparing them produces neither hits nor useful misses.
          .filter((line) => line.length > 12 && !/^[)\]};,.]+$/.test(line))
          .filter((line) => !haystack.has(line));

        // A comment line that is not in the source is nearly always an
        // elision marker or a teaching annotation the author added — honest,
        // and useful to the reader. A non-comment line that is not in the
        // source is the thing worth stopping for: code presented as the
        // repository's that the repository does not contain. Separate them, or
        // the annotations bury the one signal this script exists to produce.
        const isAnnotation = (l) => /^(\/\/|#|\/\*|\*)/.test(l) || isAbridged(l);
        const annotations = missing.filter(isAnnotation);
        const mismatches = missing.filter((l) => !isAnnotation(l));

        if (mismatches.length > 0) {
          problems.push(
            `MISMATCH ${id}: ${mismatches.length} line(s) in a ${lang} block are not in ${path}\n` +
              mismatches
                .slice(0, 3)
                .map((l) => `      ${JSON.stringify(l.slice(0, 90))}`)
                .join("\n"),
          );
        } else if (annotations.length > 0) {
          notes.push(
            `${id}: ${annotations.length} added comment line(s) in a ${lang} block (${path})`,
          );
        }
      }
    }
  }
}

console.log(`${study}: ${lessonsChecked} lessons, ${anchorsChecked} anchored code blocks checked`);
if (notes.length > 0) {
  console.log(
    `\n${notes.length} lesson(s) with added comment lines (elisions or annotations, informational):`,
  );
  notes.forEach((n) => console.log("  " + n));
}
if (problems.length === 0) {
  console.log("\nno quoted code line is absent from the source it cites.");
  process.exit(0);
}
console.log(`\n${problems.length} problem(s):\n`);
problems.forEach((p) => console.log("  " + p));
process.exit(1);
