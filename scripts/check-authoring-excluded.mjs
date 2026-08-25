#!/usr/bin/env node
/**
 * The delivery build must not contain the authoring campus.
 *
 * `src/authoring/` is kept out by a build-time constant: `AUTHORING` folds to
 * `false` under `--mode delivery`, the two branches that mount the workbench
 * become dead code, and Rollup drops the modules behind them. That is a claim
 * about a bundler's tree-shaking, and a claim nobody measures is a claim that
 * silently stops being true — a stray runtime read of `import.meta.env`, a
 * module with a side effect, an import that leaks in through a barrel, and the
 * whole workbench ships to a customer along with the loopback URLs it calls.
 *
 * So this reads the emitted JavaScript. It replaces a set of hand-written
 * two-shell alignment checks that existed because there were two shells to
 * align; with one app there is nothing to compare, and this is the one
 * property that the merge could quietly lose.
 *
 * Runs against whatever `apps/university/dist/` holds, and says so plainly when
 * there is nothing built yet rather than passing on an empty directory.
 *
 * Usage:
 *   node scripts/check-authoring-excluded.mjs
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DELIVERY_DIST = join(ROOT, "apps/university/dist/delivery");
const AUTHORING = join(ROOT, "apps/university/src/authoring");

/**
 * Names that only exist inside `src/authoring/`.
 *
 * Matched against the emitted code rather than against a source map, because a
 * production build has no source map to read and the person who deleted the
 * `sourcemap` option should not silently disable this check. Function names
 * survive minification here (Rollup keeps top-level names unless `terser` is
 * asked to mangle them, and this build does not ask); the Chinese strings
 * survive it unconditionally, which is why one of each kind is listed.
 */
function authoringFingerprints() {
  const names = new Set();
  for (const entry of readdirSync(AUTHORING)) {
    if (!/\.tsx?$/.test(entry) || /\.test\./.test(entry)) continue;
    const source = readFileSync(join(AUTHORING, entry), "utf8");
    for (const match of source.matchAll(/export function ([A-Za-z][\w]*)/g)) names.add(match[1]);
  }
  return [...names];
}

/** A phrase only the workbench says. Minification cannot touch a string. */
const AUTHORING_COPY = ["本机上的课从这里长出来", "作者工作台"];

function bundleFiles(dir) {
  const out = [];
  const walk = (at) => {
    for (const entry of readdirSync(at)) {
      const path = join(at, entry);
      if (statSync(path).isDirectory()) {
        // `content/` is the published courses, not code.
        if (entry !== "content") walk(path);
        continue;
      }
      if (extname(path) === ".js") out.push(path);
    }
  };
  walk(dir);
  return out;
}

if (!existsSync(DELIVERY_DIST)) {
  console.error(
    "authoring exclusion: apps/university/dist/delivery is missing.\n" +
      "Run `pnpm --filter @pieai/university-app build` first; this check reads the emitted bundle.",
  );
  process.exit(1);
}

const fingerprints = authoringFingerprints();
if (fingerprints.length === 0) {
  console.error("authoring exclusion: found no exported names under src/authoring/ to look for.");
  process.exit(1);
}

const found = [];
for (const file of bundleFiles(DELIVERY_DIST)) {
  const code = readFileSync(file, "utf8");
  const where = relative(ROOT, file);
  for (const name of fingerprints) {
    // Word-boundary, so `StudyShelf` does not match `StudyShelfSomethingElse`
    // and, more importantly, a coincidental substring does not fail the build.
    if (new RegExp(`\\b${name}\\b`).test(code)) found.push(`${where}: ${name}`);
  }
  for (const phrase of AUTHORING_COPY) {
    if (code.includes(phrase)) found.push(`${where}: ${JSON.stringify(phrase)}`);
  }
}

if (found.length > 0) {
  console.error(
    "authoring exclusion: the delivery bundle contains src/authoring/.\n" +
      "`AUTHORING` has to stay a build-time constant — check that nothing reads it\n" +
      "through a runtime value, and that no barrel re-exports the workbench.\n",
  );
  for (const hit of found) console.error(`  ${hit}`);
  process.exit(1);
}

console.log(`authoring exclusion: ok (${fingerprints.length} names checked)`);
