#!/usr/bin/env node
/**
 * A stylesheet `packages/ui` ships must reach the app that renders it.
 *
 * This used to check two things. The first was that a class a shared component
 * emits is not styled by exactly one shell — which had happened three times,
 * because two apps meant two stylesheets, and a rule written into one of them
 * dressed one campus and left the other bare. There is one app now, and one
 * `styles.css`, so that class of defect has nowhere left to live: the lopsided
 * list is gone, and so is the baseline that was ratcheting it down.
 *
 * The second check survives unchanged, because it is about a sheet nobody
 * imports rather than about two apps. Three were in that state:
 * `choice-block.css` and `practice.css` were not in the exports map at all,
 * and `loading-trivia.css` was exported and imported by nobody. So the answer
 * options on the practice screen were bare `<button>` elements wearing the
 * user agent's 1px padding, on the screen where the learning happens, with the
 * correct CSS sitting in the repository the whole time.
 *
 * The rule is deliberately blunt: every sheet, always. The app either wears the
 * shared package's look or that look does not exist. A few kilobytes of unused
 * CSS is far cheaper than one more screen dressed in the repository and naked
 * in the browser.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const UI = join(ROOT, "packages/ui/src");
const ENTRY = join(ROOT, "apps/university/src/main.tsx");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

function unreachableStylesheets() {
  const sheets = walk(UI)
    .filter((path) => extname(path) === ".css")
    .map((path) => path.slice(`${UI}/`.length));
  const exportsMap = JSON.parse(
    readFileSync(join(ROOT, "packages/ui/package.json"), "utf8"),
  ).exports;
  const entry = readFileSync(ENTRY, "utf8");
  const problems = [];
  for (const sheet of sheets.sort()) {
    if (!exportsMap[`./${sheet}`]) {
      problems.push(`${sheet} — not in packages/ui exports, so the app cannot import it`);
      continue;
    }
    if (!entry.includes(`@pieai/university-ui/${sheet}`)) {
      problems.push(`${sheet} — apps/university/src/main.tsx does not import it`);
    }
  }
  return problems;
}

const unreachable = unreachableStylesheets();
if (unreachable.length > 0) {
  console.error(
    "shared styles: a packages/ui stylesheet is not reaching the app.\n" +
      "Add it to the exports map and import it from apps/university/src/main.tsx.\n",
  );
  for (const problem of unreachable) console.error(`  ${problem}`);
  process.exit(1);
}

/**
 * V4 §01: the app must not grow a second lesson reader.
 *
 * Settlement, grading and language composition may live under
 * `src/lesson/`; the screen that renders a lesson may not. The host that wires
 * the shared reader to this build's ports is `src/screens/LessonScreen.tsx` —
 * a host, not a reader, and one directory away on purpose so the difference is
 * visible from a file listing.
 */
function forbiddenReaders() {
  const names = new Set(["Lesson.tsx", "LessonReader.tsx", "LessonScreen.tsx"]);
  const dir = join(ROOT, "apps/university/src/lesson");
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir)
    .filter((name) => names.has(name))
    .map((name) => `apps/university/src/lesson/${name}`);
}

const readers = forbiddenReaders();
if (readers.length > 0) {
  console.error(
    "shared styles: the app is carrying its own lesson reader.\n" +
      "It renders packages/ui LessonReader. Delete the duplicate.\n",
  );
  for (const hit of readers) console.error(`  ${hit}`);
  process.exit(1);
}

console.log(`shared styles: ok (${walk(UI).filter((p) => extname(p) === ".css").length} sheets)`);
