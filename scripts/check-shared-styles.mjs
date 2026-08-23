#!/usr/bin/env node
/**
 * A class a shared component emits must not be styled by exactly one shell.
 *
 * `packages/ui` components are rendered by both apps. When their CSS lives in
 * one app's stylesheet, that app looks right and the other renders the same
 * markup with nothing on it — and nothing reports it, because no import is
 * missing, no type is wrong and no test can see a stylesheet.
 *
 * It has happened three times: the counter row, the 「今天」 card, and
 * `MarkdownContent`, whose evidence figures rendered at their intrinsic 1288px
 * inside a 457px column in the delivery shell and were cut off at the viewport
 * edge for as long as that code existed.
 *
 * So the rule this checks is narrow and mechanical: if a class name appears in
 * exactly one app's CSS and nowhere in `packages/ui`, the other shell has
 * unstyled markup or dead markup, and both are worth a look.
 *
 * It is a ratchet, not a wall. `shared-styles-baseline.json` holds what was
 * already true when the check was written; only new entries fail. Fixing one
 * means deleting its line from the baseline, which is the point — the list can
 * only get shorter.
 */
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const BASELINE = join(ROOT, "scripts/shared-styles-baseline.json");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

function read(paths, ext) {
  return paths.filter((p) => ext.includes(extname(p))).map((p) => readFileSync(p, "utf8"));
}

/**
 * Class names a component writes as a plain literal.
 *
 * Deliberately ignores anything with a `${…}` in it. A composed name cannot be
 * matched against a stylesheet without evaluating it, and a check that guesses
 * is a check nobody trusts.
 */
function emittedClasses(sources) {
  const names = new Set();
  const keep = (blob) => {
    for (const name of blob.split(/\s+/)) {
      // A name spliced from a variable cannot be matched against a stylesheet
      // without evaluating it, so those words are dropped rather than guessed.
      if (/^[a-z][\w-]*$/.test(name)) names.add(name);
    }
  };
  for (const src of sources) {
    for (const m of src.matchAll(/className="([^"]*)"/g)) keep(m[1]);
    for (const m of src.matchAll(/className=\{`([^`]*)`\}/g)) keep(m[1].replace(/\$\{[^}]*\}/g, " "));
  }
  return names;
}

function styles(paths) {
  return read(paths, [".css"]).join("\n");
}

const uiFiles = walk(join(ROOT, "packages/ui/src"));
const emitted = emittedClasses(read(uiFiles, [".tsx"]));
const uiCss = styles(uiFiles);
const localCss = styles(walk(join(ROOT, "apps/local/src")));
const onlineCss = styles(walk(join(ROOT, "apps/online/src")));

const hits = (css, name) => new RegExp(`\\.${name}(?![\\w-])`).test(css);

const lopsided = [];
for (const name of [...emitted].sort()) {
  if (hits(uiCss, name)) continue;
  const inLocal = hits(localCss, name);
  const inOnline = hits(onlineCss, name);
  if (inLocal !== inOnline) lopsided.push(`${name} (${inLocal ? "local" : "online"} only)`);
}

/**
 * A stylesheet in `packages/ui` that no shell imports styles nothing.
 *
 * This is the failure the class-name check above cannot see, because the rules
 * *are* in `packages/ui` — they are simply never loaded. Three sheets were in
 * that state: `choice-block.css` and `practice.css` were not in the exports
 * map at all, and `loading-trivia.css` was exported and imported by nobody. So
 * the answer options on the practice screen were bare `<button>` elements
 * wearing the user agent's 1px padding, in both shells, on the screen where
 * the learning happens, with the correct CSS sitting in the repository.
 *
 * The rule is deliberately blunt: every sheet, every shell, always. A shell
 * either wears the shared package's look or that look does not exist. A few
 * kilobytes of unused CSS is far cheaper than one more screen that is dressed
 * in one shell and naked in the other.
 */
function unreachableStylesheets() {
  const sheets = walk(join(ROOT, "packages/ui/src"))
    .filter((p) => extname(p) === ".css")
    .map((p) => p.slice(join(ROOT, "packages/ui/src/").length));
  const exportsMap = JSON.parse(readFileSync(join(ROOT, "packages/ui/package.json"), "utf8")).exports;
  const entries = {
    "apps/online": readFileSync(join(ROOT, "apps/online/src/main.tsx"), "utf8"),
    "apps/local": readFileSync(join(ROOT, "apps/local/src/main.tsx"), "utf8"),
  };
  const problems = [];
  for (const sheet of sheets.sort()) {
    if (!exportsMap[`./${sheet}`]) {
      problems.push(`${sheet} — not in packages/ui exports, so no app can import it`);
      continue;
    }
    for (const [app, source] of Object.entries(entries)) {
      if (!source.includes(`@pieai/university-ui/${sheet}`)) {
        problems.push(`${sheet} — ${app}/src/main.tsx does not import it`);
      }
    }
  }
  return problems;
}

const unreachable = unreachableStylesheets();
if (unreachable.length > 0 && !process.argv.includes("--write-baseline")) {
  console.error(
    "shared styles: a packages/ui stylesheet is not reaching a shell.\n" +
      "Add it to the exports map and import it from both apps' main.tsx.\n",
  );
  for (const problem of unreachable) console.error(`  ${problem}`);
  process.exit(1);
}

if (process.argv.includes("--write-baseline")) {
  writeFileSync(BASELINE, JSON.stringify(lopsided, null, 2) + "\n");
  console.log(`shared styles: baseline written, ${lopsided.length} known`);
  process.exit(0);
}

let baseline = [];
try {
  baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
} catch {
  console.error("shared styles: no baseline. Run with --write-baseline once.");
  process.exit(1);
}

const known = new Set(baseline);
const added = lopsided.filter((entry) => !known.has(entry));
const fixed = baseline.filter((entry) => !lopsided.includes(entry));

if (added.length > 0) {
  console.error(
    "shared styles: a packages/ui component's class is styled by only one shell.\n" +
      "The other shell renders that markup with nothing on it.\n" +
      "Move the rules to a stylesheet in packages/ui that both shells import —\n" +
      "nine components already do this; see apps/*/src/main.tsx.\n",
  );
  for (const entry of added) console.error(`  ${entry}`);
  process.exit(1);
}

if (fixed.length > 0) {
  console.error(
    `shared styles: ${fixed.length} baseline entries no longer apply. ` +
      "Run `node scripts/check-shared-styles.mjs --write-baseline` so the list shrinks.\n",
  );
  for (const entry of fixed) console.error(`  ${entry}`);
  process.exit(1);
}

/**
 * V4 §01: a shell must not grow a second lesson reader. Settlement, grading
 * and language composition may live under apps/<shell>/src/lesson; the screen
 * that renders a lesson may not.
 */
function forbiddenShellReaders() {
  const names = new Set(["Lesson.tsx", "LessonReader.tsx", "LessonScreen.tsx"]);
  const hits = [];
  for (const app of ["apps/local/src/lesson", "apps/online/src/lesson"]) {
    const dir = join(ROOT, app);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
    for (const name of readdirSync(dir)) {
      if (names.has(name)) hits.push(`${app}/${name}`);
    }
  }
  return hits;
}

const readers = forbiddenShellReaders();
if (readers.length > 0) {
  console.error(
    "shared styles: a shell is carrying its own lesson reader.\n" +
      "Both shells render packages/ui LessonReader. Delete the duplicate.\n",
  );
  for (const hit of readers) console.error(`  ${hit}`);
  process.exit(1);
}

console.log(`shared styles: ok (${baseline.length} known, none added)`);
