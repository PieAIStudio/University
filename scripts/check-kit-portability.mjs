#!/usr/bin/env node
/**
 * Can `packages/ui/src/shell/**` be lifted into SwimmerUIKit unchanged?
 *
 * The app chrome — three-column shell, nav rail, tab bar, counter strip — was
 * built here rather than upstream on purpose: the first version of a
 * navigation rail is always wrong, and round-tripping each revision through a
 * published package is a bad way to find the second version. The plan is to
 * graduate it once the shape settles.
 *
 * That plan survives exactly as long as the code stays portable, and portable
 * is not a thing anyone can remember to be. One `import { Lesson } from
 * "../view/lesson-view.js"` for a type that was convenient, and the chrome
 * quietly becomes a University package with a generic name — which is the
 * anti-reference SwimmerUIKit's own PRODUCT.md names first: "product-specific
 * logic inside shared components".
 *
 * So the graduation test is mechanical and runs in the gate:
 *
 *   1. No relative import may leave `shell/`. It composes only itself.
 *   2. No `@pieai/university-*` import. That is the product, by definition.
 *   3. No renderer. `packages/ui` is at zero `three` and the chrome is the
 *      furthest thing from a reason to change that.
 *   4. Bare imports are limited to an allowlist, so a new runtime dependency
 *      is a decision someone makes here rather than one that arrives with a
 *      convenience.
 *
 * What this does NOT check is the other half of portability: no University
 * nouns in props, no hardcoded Chinese. Those are conventions a reader
 * enforces, and a regex that tried would fail on the comments. The import
 * graph is the part a machine can hold.
 *
 * Usage: node scripts/check-kit-portability.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SHELL = join(ROOT, "packages", "ui", "src", "shell");

const SOURCE_EXTS = new Set([".ts", ".tsx"]);

/** Static import/export, side-effect import, dynamic import. */
const SPECIFIER_RE = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;

/**
 * Anything the chrome may reach for. React and its DOM renderer are peers of
 * any React kit; floating-ui positions the flyout and is already a dependency
 * of the kit's own surfaces; vitest only appears in tests.
 */
const ALLOWED_BARE = [/^react$/, /^react-dom(\/.*)?$/, /^@floating-ui\//, /^vitest$/];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SOURCE_EXTS.has(extname(entry))) out.push(full);
  }
  return out;
}

const failures = [];

for (const file of walk(SHELL)) {
  const source = readFileSync(file, "utf8");
  const where = relative(ROOT, file);
  for (const match of source.matchAll(SPECIFIER_RE)) {
    const spec = match[1];

    if (spec.startsWith(".")) {
      const target = resolve(join(file, ".."), spec);
      if (!target.startsWith(SHELL)) {
        failures.push(`${where}: "${spec}" leaves shell/ — the chrome composes only itself`);
      }
      continue;
    }

    if (spec.startsWith("@pieai/university-")) {
      failures.push(`${where}: "${spec}" is the product; the chrome must not know it exists`);
      continue;
    }

    if (spec === "three" || spec.startsWith("three/") || spec.startsWith("@react-three/")) {
      failures.push(`${where}: "${spec}" is a renderer; packages/ui stays at zero three`);
      continue;
    }

    if (!ALLOWED_BARE.some((allowed) => allowed.test(spec))) {
      failures.push(
        `${where}: "${spec}" is a new runtime dependency for the chrome. ` +
          `If it belongs, add it to ALLOWED_BARE here and say why.`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("kit portability: packages/ui/src/shell can no longer graduate as-is\n");
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(
    "\nThe chrome is meant to move into SwimmerUIKit once its shape settles.\n" +
      "Product-specific composition belongs in packages/ui/src/navigation instead.",
  );
  process.exit(1);
}

console.log("kit portability: ok");
