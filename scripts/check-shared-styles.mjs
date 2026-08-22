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
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
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

console.log(`shared styles: ok (${baseline.length} known, none added)`);
