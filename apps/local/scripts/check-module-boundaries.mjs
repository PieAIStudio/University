#!/usr/bin/env node
/**
 * Mechanical enforcement of the browser / server / shared-schema boundary,
 * plus the acyclic order of browser-side layers under `src/`.
 *
 * This repository has exactly one intentional cross-line import:
 * `server/**` may reach into `src/domain/**` (shared Zod schemas) and nowhere
 * else under `src/`. Everything else under `src/` is browser-only; `server/**`
 * never belongs in the browser bundle.
 *
 * That contract used to hold only by accident. Someone once put a browser-only
 * module in `src/domain/`, it imported a type from a `.tsx` file, and
 * `tsconfig.server.json` — which includes `src/domain` and has no `jsx` flag —
 * refused to compile. The next violation might not be so lucky. A rule nobody
 * can verify is a rule that quietly stops being true.
 *
 * The same sentence applies one level inward: the browser tree was split into
 * layers (`shell/`, `lesson/`, …) with a clean acyclic order. Without a check,
 * the next edit can add a back-edge that only becomes obvious once it closes a
 * cycle. Rule 4 freezes that order so back-edges fail here, not later.
 *
 * So this scans import/export/dynamic-import specifiers under `src/**` and
 * `server/**` (tests excluded) and fails on any of the four rules below. It
 * resolves relative paths first: a naive string match on `"../src/"` misses
 * nested modules and misjudges `"@pieai/university-core/domain/..."` from inside `src/`.
 *
 * Usage:
 *   node scripts/check-module-boundaries.mjs
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "src");
const SERVER = join(ROOT, "server");
const DOMAIN = join(SRC, "domain");

const SOURCE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

/**
 * Specifiers we care about: static import/export, side-effect import, dynamic
 * import, and `typeof import("...")` type queries. Package and `node:` imports
 * are not relative and never cross these trees, so they are ignored.
 */
const SPECIFIER_RE = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;

/**
 * Browser-side layers under `src/`, shallow → deep.
 *
 * Derived from non-test relative imports as of the rule's introduction:
 *   shell    → evidence, review, markdown, api, view
 *   lesson   → review, markdown, evidence, language, api, view
 *   review   → markdown, evidence, language, api, view
 *   markdown → evidence, language, view
 *   evidence → api, view
 *   language → (none)
 *   api      → view
 *   view     → (none)
 *
 * A layer may import a later (deeper) layer or the same layer; never an earlier
 * one. `src/domain/` is intentionally absent — it is the shared schema core
 * enforced by rule 3, not a browser composition layer. Loose files at the top
 * of `src/` (App.tsx, main.tsx, …) are not layers and are exempt.
 *
 * `evidence` sits below `markdown` because that is the direction the code
 * actually runs: an evidence component depends on nothing but `api` and `view`,
 * while lesson prose has to render a pinned-source block inline. The reverse
 * import — evidence reaching into markdown — is still a failure here, which is
 * the coupling worth preventing.
 */
const BROWSER_LAYER_ORDER = [
  "shell",
  "lesson",
  "review",
  "markdown",
  "evidence",
  "language",
  "api",
  "view",
];

const BROWSER_LAYER_INDEX = new Map(BROWSER_LAYER_ORDER.map((name, i) => [name, i]));

function isTestFile(name) {
  return /\.test\./.test(name);
}

function isSourceFile(name) {
  return SOURCE_EXTS.has(extname(name)) && !isTestFile(name);
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
  return rel === "" || (!rel.startsWith(`..${sep}`) && !rel.startsWith("..") && rel !== "..");
}

/**
 * Resolve a relative specifier the way this repo writes them: NodeNext-style
 * `.js` ends map onto `.ts`/`.tsx` sources; bare paths try the usual extensions
 * and `index` files. Returns the best existing path, or the logical path when
 * nothing is on disk (still enough to judge which tree it aimed at).
 */
function resolveSpecifier(fromFile, specifier) {
  if (!specifier.startsWith(".")) return null;

  const base = resolve(dirname(fromFile), specifier);
  const candidates = [];

  const pushVariants = (pathWithoutKnownExt) => {
    for (const ext of [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]) {
      candidates.push(pathWithoutKnownExt + ext);
    }
    for (const ext of [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]) {
      candidates.push(join(pathWithoutKnownExt, `index${ext}`));
    }
  };

  const ext = extname(base);
  if (ext === ".js" || ext === ".jsx" || ext === ".mjs" || ext === ".cjs") {
    const stem = base.slice(0, -ext.length);
    pushVariants(stem);
    candidates.push(base);
  } else if (ext === ".ts" || ext === ".tsx") {
    candidates.push(base);
  } else {
    pushVariants(base);
    candidates.push(base);
  }

  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  // Prefer a TypeScript guess when the target is missing: `./foo.js` → `./foo.ts`
  // so a not-yet-created file still lands in the right tree for the rule text.
  if (ext === ".js") return `${base.slice(0, -3)}.ts`;
  if (ext === ".jsx") return `${base.slice(0, -4)}.tsx`;
  return base;
}

function lineAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

function repoPath(abs) {
  return relative(ROOT, abs).split(sep).join("/");
}

function collectSpecifiers(source) {
  const found = [];
  SPECIFIER_RE.lastIndex = 0;
  let match;
  while ((match = SPECIFIER_RE.exec(source)) !== null) {
    found.push({ specifier: match[1], index: match.index });
  }
  return found;
}

/**
 * Named browser layer for a path under `src/<layer>/...`, or null when the
 * file is loose at the top of `src/`, under an unlisted directory (e.g.
 * `domain/`), or outside `src/` entirely.
 */
function browserLayerOf(absPath) {
  if (!isInside(absPath, SRC)) return null;
  const rel = relative(SRC, absPath);
  if (!rel || rel.startsWith(`..`)) return null;
  const top = rel.split(sep)[0];
  // A top-level file like `src/App.tsx` has top === the filename itself.
  if (!BROWSER_LAYER_INDEX.has(top)) return null;
  // Require at least one path segment under the layer directory.
  if (rel === top) return null;
  return top;
}

const RULES = {
  srcNoServer: {
    id: 1,
    why: "src/** must never import from server/** — the browser cannot run server code, and an import that type-checks would still fail at runtime.",
  },
  serverOnlyDomain: {
    id: 2,
    why: "server/** may import from src/domain/** and nothing else under src/ — src/domain/ is the shared schema boundary; everything else under src/ is browser-only.",
  },
  domainClosed: {
    id: 3,
    why: "src/domain/** must not import from any .tsx file, and must not import from outside src/domain/ — it is compiled by tsconfig.server.json, which has no --jsx, so a .tsx (or other browser-only) import there breaks the server build.",
  },
  browserLayerOrder: {
    id: 4,
    why: "a browser layer may import only from itself or from a deeper layer in BROWSER_LAYER_ORDER — an import that reaches upward reintroduces the coupling the layer split removed, and is much harder to unpick once it closes a cycle.",
  },
};

const violations = [];

function fail(file, line, specifier, rule) {
  violations.push({
    file: repoPath(file),
    line,
    specifier,
    ruleId: rule.id,
    why: rule.why,
  });
}

for (const file of [...walk(SRC), ...walk(SERVER)]) {
  const source = readFileSync(file, "utf8");
  const inSrc = isInside(file, SRC);
  const inServer = isInside(file, SERVER);
  const inDomain = isInside(file, DOMAIN);
  const fromLayer = browserLayerOf(file);

  for (const { specifier, index } of collectSpecifiers(source)) {
    const resolved = resolveSpecifier(file, specifier);
    if (!resolved) continue;

    const line = lineAt(source, index);
    const targetInSrc = isInside(resolved, SRC);
    const targetInServer = isInside(resolved, SERVER);
    const targetInDomain = isInside(resolved, DOMAIN);
    const targetExt = extname(resolved);

    // Rule 1 — browser tree must not reach server.
    if (inSrc && targetInServer) {
      fail(file, line, specifier, RULES.srcNoServer);
    }

    // Rule 2 — server may share schemas only.
    if (inServer && targetInSrc && !targetInDomain) {
      fail(file, line, specifier, RULES.serverOnlyDomain);
    }

    // Rule 3 — domain is the server-compiled shared core.
    if (inDomain) {
      if (targetExt === ".tsx" || targetExt === ".jsx") {
        fail(file, line, specifier, RULES.domainClosed);
      } else if (specifier.startsWith(".") && !targetInDomain) {
        // Relative imports that leave src/domain (into the rest of src/, into
        // server/, or anywhere else in the repo). Package imports are non-relative
        // and already filtered out by resolveSpecifier.
        fail(file, line, specifier, RULES.domainClosed);
      }
    }

    // Rule 4 — browser layers stay acyclic and one-way (shallow → deep).
    if (fromLayer) {
      const toLayer = browserLayerOf(resolved);
      if (toLayer && toLayer !== fromLayer) {
        const fromIndex = BROWSER_LAYER_INDEX.get(fromLayer);
        const toIndex = BROWSER_LAYER_INDEX.get(toLayer);
        if (fromIndex > toIndex) {
          fail(file, line, specifier, RULES.browserLayerOrder);
        }
      }
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
