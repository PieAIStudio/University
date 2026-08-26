#!/usr/bin/env node
/**
 * Keep every WebGL Canvas mount visible and intentional.
 *
 * The app has one world renderer and three small avatar viewports. This gate
 * reads source files only, strips comments and strings, and compares actual
 * JSX opening tags with the registry below. A fifth viewport must update this
 * registry before it can pass verification; generated `dist/` output is never
 * part of the scan.
 *
 * Usage: node scripts/check-canvas-registry.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE_ROOTS = [join(ROOT, "apps"), join(ROOT, "packages")];
const SOURCE_EXTENSIONS = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const IGNORED_DIRECTORIES = new Set([".git", "dist", "node_modules"]);
// The study checkouts are somebody else's repository, cloned onto this machine
// for a learner to read. Their `<Canvas>` mounts are not ours to register, and
// they only exist on a machine that has actually registered a study — so a gate
// that walked into them would pass in CI and fail on the author's laptop.
const IGNORED_PATHS = new Set([join(ROOT, "apps", "local", "studies")]);

const CANVAS_MOUNTS = [
  {
    path: "packages/world/src/Stage.tsx",
    purpose: "world, map and planet renderer",
  },
  {
    path: "packages/world/src/avatar/AvatarChip.tsx",
    purpose: "persistent navigation avatar",
  },
  {
    path: "apps/university/src/app/ProfileAvatar.tsx",
    purpose: "profile-page avatar",
  },
  {
    path: "apps/university/src/avatar-lab/AvatarLab.tsx",
    purpose: "avatar-workshop preview",
  },
];

function walk(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    if (IGNORED_DIRECTORIES.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (IGNORED_PATHS.has(path)) continue;
    if (entry.isDirectory()) {
      walk(path, files);
    } else if (SOURCE_EXTENSIONS.has(extname(entry.name))) {
      files.push(path);
    }
  }
  return files;
}

/** Replace comments and quoted text while preserving line breaks for readable failures. */
function stripNonCode(source) {
  let output = "";
  let state = "code";

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (state === "code") {
      if (character === "/" && next === "/") {
        output += "  ";
        index += 1;
        state = "line-comment";
      } else if (character === "/" && next === "*") {
        output += "  ";
        index += 1;
        state = "block-comment";
      } else if (character === "'" || character === '"' || character === "`") {
        output += " ";
        state = character;
      } else {
        output += character;
      }
      continue;
    }

    if (state === "line-comment") {
      if (character === "\n") {
        output += "\n";
        state = "code";
      } else {
        output += " ";
      }
      continue;
    }

    if (state === "block-comment") {
      if (character === "*" && next === "/") {
        output += "  ";
        index += 1;
        state = "code";
      } else {
        output += character === "\n" ? "\n" : " ";
      }
      continue;
    }

    if (character === "\\") {
      output += "  ";
      index += 1;
    } else if (character === state) {
      output += " ";
      state = "code";
    } else {
      output += character === "\n" ? "\n" : " ";
    }
  }

  return output;
}

function canvasMountsInSource() {
  return SOURCE_ROOTS.flatMap((directory) => walk(directory))
    .flatMap((file) => {
      const source = stripNonCode(readFileSync(file, "utf8"));
      return [...source.matchAll(/<Canvas\b/g)].map(() => relative(ROOT, file));
    })
    .sort((left, right) => left.localeCompare(right));
}

function unmatched(values, registered) {
  const remaining = [...registered];
  return values.filter((value) => {
    const index = remaining.indexOf(value);
    if (index === -1) return true;
    remaining.splice(index, 1);
    return false;
  });
}

const expected = CANVAS_MOUNTS.map(({ path }) => path).sort((left, right) =>
  left.localeCompare(right),
);
const actual = canvasMountsInSource();
const unexpected = unmatched(actual, expected);
const missing = unmatched(expected, actual);

if (unexpected.length > 0 || missing.length > 0) {
  console.error("canvas registry: mismatch");
  if (unexpected.length > 0) {
    console.error("  unregistered source mounts:");
    for (const path of unexpected) console.error(`    - ${path}`);
  }
  if (missing.length > 0) {
    console.error("  registered mounts not found in source:");
    for (const path of missing) console.error(`    - ${path}`);
  }
  process.exit(1);
}

console.log(`canvas registry: ok (${CANVAS_MOUNTS.length} registered mounts)`);
for (const { path, purpose } of CANVAS_MOUNTS) console.log(`  - ${path} — ${purpose}`);
