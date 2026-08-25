#!/usr/bin/env node
/**
 * The authoring server is not the browser, and the browser is not the server.
 *
 * This used to be four rules over two trees, because this package held both a
 * loopback server and a browser app and the line between them ran through one
 * `src/` directory. The browser half is `apps/university` now — one app, two
 * modes — so three of those rules describe a tree that no longer exists. What
 * survives is the rule that mattered: neither side may import the other.
 *
 * It is worth checking rather than remembering. `server/**` runs on Node with
 * `fs` and SQLite under it; `apps/university/src/**` is bundled for a browser.
 * An import either way type-checks fine and fails at runtime — the server
 * would try to bundle React, or the bundle would try to open a file — and both
 * failures land a long way from the line that caused them.
 *
 * The shared contract between them is `@pieai/university-core`, which is a
 * package and therefore not a relative import from either tree.
 *
 * Usage:
 *   node scripts/check-module-boundaries.mjs
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";

const HERE = resolve(import.meta.dirname, "..");
const REPO = resolve(HERE, "../..");
const SERVER = join(HERE, "server");
const APP = join(REPO, "apps/university/src");

const SOURCE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

/**
 * Specifiers we care about: static import/export, side-effect import, dynamic
 * import, and `typeof import("...")` type queries. Package and `node:` imports
 * are not relative and never cross these trees, so they are ignored.
 */
const SPECIFIER_RE = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;

function isSourceFile(name) {
  return SOURCE_EXTS.has(extname(name)) && !/\.test\./.test(name);
}

/** Walk a tree; yield absolute paths of non-test source files. */
function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
      continue;
    }
    if (entry.isFile() && isSourceFile(entry.name)) yield full;
  }
}

function isInside(file, dir) {
  const rel = relative(dir, file);
  return rel === "" || (!rel.startsWith(`..${sep}`) && !rel.startsWith(".."));
}

/**
 * Resolve a relative specifier the way this repo writes them: NodeNext-style
 * `.js` ends map onto `.ts`/`.tsx` sources. Returns the logical path when
 * nothing is on disk — still enough to judge which tree it aimed at.
 */
function resolveSpecifier(fromFile, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(fromFile), specifier);
  const ext = extname(base);
  const stem = /^\.(js|jsx|mjs|cjs)$/.test(ext) ? base.slice(0, -ext.length) : base;
  const candidates = [];
  for (const candidate of [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]) {
    candidates.push(stem + candidate, join(stem, `index${candidate}`));
  }
  candidates.push(base);
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return base;
}

function lineAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

const RULES = {
  serverStaysOffTheBrowser: {
    id: 1,
    why: "apps/local/server/** must not import from apps/university/src/** — the server runs on Node with the filesystem under it, and the app is bundled for a browser. Share through @pieai/university-core.",
  },
  appStaysOffTheServer: {
    id: 2,
    why: "apps/university/src/** must not import from apps/local/** — the browser cannot run server code, and an import that type-checks would still fail at runtime. Talk to it over /api, or share through @pieai/university-core.",
  },
};

const violations = [];

for (const [tree, other, rule] of [
  [SERVER, APP, RULES.serverStaysOffTheBrowser],
  [APP, HERE, RULES.appStaysOffTheServer],
]) {
  for (const file of walk(tree)) {
    const source = readFileSync(file, "utf8");
    SPECIFIER_RE.lastIndex = 0;
    let match;
    while ((match = SPECIFIER_RE.exec(source)) !== null) {
      const resolved = resolveSpecifier(file, match[1]);
      if (!resolved || !isInside(resolved, other)) continue;
      violations.push({
        file: relative(REPO, file).split(sep).join("/"),
        line: lineAt(source, match.index),
        specifier: match[1],
        ruleId: rule.id,
        why: rule.why,
      });
    }
  }
}

if (violations.length === 0) {
  console.log("module boundaries: ok");
  process.exit(0);
}

console.error(`module boundaries: ${violations.length} violation(s)\n`);
for (const v of violations) {
  console.error(`${v.file}:${v.line}`);
  console.error(`  import ${JSON.stringify(v.specifier)}`);
  console.error(`  rule ${v.ruleId}: ${v.why}`);
  console.error("");
}
process.exit(1);
