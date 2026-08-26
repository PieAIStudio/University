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
const CSS_SOURCE_ROOTS = [
  join(ROOT, "apps/university/src"),
  join(ROOT, "packages/ui/src"),
  join(ROOT, "packages/world/src"),
];
const CSS_BUILD_METADATA = [
  join(ROOT, "index.html"),
  join(ROOT, "package.json"),
  join(ROOT, "pnpm-lock.yaml"),
  join(ROOT, "apps/university/index.html"),
  join(ROOT, "apps/university/package.json"),
  join(ROOT, "apps/university/vite.config.ts"),
  join(ROOT, "packages/ui/package.json"),
  join(ROOT, "packages/world/package.json"),
  join(ROOT, "apps/university/node_modules/@pieai/swimmer-ui-kit/dist/styles.css"),
];

/**
 * CSS is still one global sheet, so these selectors are known debt rather than
 * permission to add more. The counts are the selector-reference ceiling in
 * the baseline delivery build. A later CSS split can lower this ledger; a new
 * selector or a new reference must not raise it silently.
 */
const AUTHORING_CSS_BASELINE = Object.freeze({
  "airlock-clocks": 4,
  "airlock-clocks__note": 1,
  "airlock-clocks__problems": 1,
  "course-entry": 1,
  "course-entry__lesson": 1,
  "course-group": 6,
  "course-group__eyebrow": 1,
  "course-objectives": 6,
  "course-progress": 2,
  "course-units": 6,
  "empty-state": 4,
  "empty-state__mark": 2,
  "formal-course": 4,
  "formal-course__header": 5,
  "formal-course-empty": 1,
  "lesson-list": 1,
  "lesson-row": 6,
  "studio-section": 1,
  "studio-section__header": 1,
  "study-analysis-panel": 5,
  "study-analysis-panel__body": 4,
  "study-analysis-panel__summary-action": 4,
  "study-analysis-panel__summary-copy": 3,
  "study-detail": 4,
  "study-detail__header": 8,
  "study-evidence-status": 4,
  "study-evidence-status__boundary": 3,
  "study-evidence-status__metric": 3,
  "study-evidence-status__metrics": 1,
  "study-shelf": 5,
  "study-shelf__item": 7,
  "unit-card__body": 2,
  "unit-card__number": 2,
  "unit-list": 1,
  "world-landing__authoring": 2,
});

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

function sourceFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;

  const walk = (at) => {
    for (const entry of readdirSync(at)) {
      if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue;
      const path = join(at, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.(?:css|js|jsx|mjs|ts|tsx)$/.test(path)) continue;
      if (/\.(?:test|spec)\.[^.]+$/.test(path)) continue;
      out.push(path);
    }
  };

  walk(dir);
  return out;
}

function classNamesInSource(source) {
  const names = new Set();
  const classAttribute = /className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g;

  for (const match of source.matchAll(classAttribute)) {
    const value = (match[1] ?? match[2] ?? match[3]).replace(/\$\{[^}]*\}/g, " ");
    for (const name of value.split(/\s+/)) {
      if (/^[A-Za-z_][\w-]*$/.test(name)) names.add(name);
    }
  }

  return names;
}

/** Class names owned by authoring code, minus names emitted by shared code. */
function authoringCssClassNames() {
  const authoring = new Set();
  const other = new Set();
  const files = CSS_SOURCE_ROOTS.flatMap((root) => sourceFiles(root));
  const authoringPrefix = `${AUTHORING}/`;

  for (const file of files) {
    if (!/\.(?:js|jsx|mjs|ts|tsx)$/.test(file)) continue;
    const target = file.startsWith(authoringPrefix) ? authoring : other;
    for (const name of classNamesInSource(readFileSync(file, "utf8"))) target.add(name);
  }

  return [...authoring].filter((name) => !other.has(name)).sort();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cssSelectorReferences(css, classNames) {
  const references = new Map();
  for (const name of classNames) {
    const pattern = new RegExp(`\\.${escapeRegExp(name)}(?![\\w-])`, "g");
    const count = [...css.matchAll(pattern)].length;
    if (count > 0) references.set(name, count);
  }
  return references;
}

function cssBuildInputs() {
  const generatedContent = `${join(ROOT, "apps/university/src/content")}/`;
  const sourceInputs = CSS_SOURCE_ROOTS.flatMap((root) => sourceFiles(root)).filter(
    (path) => !path.startsWith(generatedContent),
  );
  return [...new Set([...sourceInputs, ...CSS_BUILD_METADATA])].filter((path) => existsSync(path));
}

function checkCssFreshness(cssFiles) {
  const inputs = cssBuildInputs();
  if (inputs.length === 0) {
    return [
      "authoring exclusion: could not find any CSS build inputs to compare against the emitted CSS.",
    ];
  }

  const newestInput = inputs
    .map((path) => ({ path, mtimeMs: statSync(path).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  const stale = cssFiles.filter((path) => statSync(path).mtimeMs <= newestInput.mtimeMs);
  if (stale.length === 0) return [];

  const inputLabel = `${relative(ROOT, newestInput.path)} (${new Date(newestInput.mtimeMs).toISOString()})`;
  return [
    "authoring exclusion: delivery CSS is stale.",
    `The newest CSS build input is ${inputLabel}; emitted CSS must be newer.`,
    "Run `pnpm --filter @pieai/university-app build` first; this check reads the emitted bundle.",
    ...stale.map(
      (path) => `  ${relative(ROOT, path)} (${new Date(statSync(path).mtimeMs).toISOString()})`,
    ),
  ];
}

/** A phrase only the workbench says. Minification cannot touch a string. */
const AUTHORING_COPY = ["本机上的课从这里长出来", "作者工作台"];

/**
 * SwimmerAIKit is server-only. The delivery app may call the grading service,
 * but its emitted JavaScript must never contain the kit, its transport, or the
 * server key name. This is checked on the artifact because a source-only
 * import scan cannot see a dependency that leaked through a barrel.
 */
const SERVER_ONLY_AI_FINGERPRINTS = [
  "@pieai/swimmer-ai-kit",
  "createOpenRouterChatTransport",
  "createStructuredOutputClient",
  "OPENROUTER_API_KEY",
];

function bundleFiles(dir, extension = ".js") {
  const out = [];
  const walk = (at) => {
    for (const entry of readdirSync(at)) {
      const path = join(at, entry);
      if (statSync(path).isDirectory()) {
        // `content/` is the published courses, not code.
        if (entry !== "content") walk(path);
        continue;
      }
      if (extname(path) === extension) out.push(path);
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

const cssFiles = bundleFiles(DELIVERY_DIST, ".css");
if (cssFiles.length === 0) {
  console.error(
    "authoring exclusion: apps/university/dist/delivery contains no CSS artifact.\n" +
      "Run `pnpm --filter @pieai/university-app build` first; this check reads the emitted bundle.",
  );
  process.exit(1);
}

const cssFreshnessErrors = checkCssFreshness(cssFiles);
if (cssFreshnessErrors.length > 0) {
  console.error(cssFreshnessErrors.join("\n"));
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

const aiBoundaryLeaks = [];
for (const file of bundleFiles(DELIVERY_DIST)) {
  const code = readFileSync(file, "utf8");
  const where = relative(ROOT, file);
  for (const fingerprint of SERVER_ONLY_AI_FINGERPRINTS) {
    if (code.includes(fingerprint)) aiBoundaryLeaks.push(`${where}: ${fingerprint}`);
  }
}

if (aiBoundaryLeaks.length > 0) {
  console.error(
    "browser AI boundary: delivery bundle contains server-only SwimmerAIKit material.\n" +
      "The browser may send an authenticated answer to the grading service, but it must never bundle the model transport or its key name.\n",
  );
  for (const leak of aiBoundaryLeaks) console.error(`  ${leak}`);
  process.exit(1);
}

console.log("browser AI boundary: ok (server-only kit and key fingerprints absent)");

const authoringCssNames = authoringCssClassNames();
if (authoringCssNames.length === 0) {
  console.error("authoring exclusion: found no class names owned by src/authoring to look for.");
  process.exit(1);
}

const cssReferences = new Map();
for (const file of cssFiles) {
  const css = readFileSync(file, "utf8");
  for (const [name, count] of cssSelectorReferences(css, authoringCssNames)) {
    cssReferences.set(name, (cssReferences.get(name) ?? 0) + count);
  }
}

const cssProblems = [];
const authoringCssNameSet = new Set(authoringCssNames);
for (const name of Object.keys(AUTHORING_CSS_BASELINE)) {
  if (!authoringCssNameSet.has(name)) {
    cssProblems.push(`${name}: baseline entry is no longer authoring-only; remove it`);
  }
}
for (const [name, count] of cssReferences) {
  const baseline = AUTHORING_CSS_BASELINE[name] ?? 0;
  if (count > baseline) {
    cssProblems.push(`${name}: ${count} selector references (baseline ${baseline})`);
  }
}

if (cssProblems.length > 0) {
  console.error(
    "authoring exclusion: the delivery CSS contains new src/authoring selectors.\n" +
      "Keep the baseline as a ceiling; move new authoring CSS behind the authoring build instead of widening it.\n",
  );
  for (const problem of cssProblems) console.error(`  ${problem}`);
  process.exit(1);
}

const leakedCssNames = [...cssReferences].filter(([, count]) => count > 0).length;
const leakedCssReferences = [...cssReferences.values()].reduce((sum, count) => sum + count, 0);
console.log(`authoring exclusion: ok (${fingerprints.length} names checked)`);
console.log(
  `authoring css: ok (${leakedCssNames} legacy selector names, ${leakedCssReferences} references; ceiling ${Object.values(AUTHORING_CSS_BASELINE).reduce((sum, count) => sum + count, 0)})`,
);
