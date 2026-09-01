#!/usr/bin/env node
import { existsSync, lstatSync, readdirSync, symlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

/**
 * Give a git worktree the author's studies without risking the tracked ones.
 *
 * `apps/local/studies/.gitignore` ignores everything, and then 69 files under
 * one course were force-added anyway. That half-tracked shape is a trap: symlink
 * the study directory into a worktree and git sees a symlink where 69 tracked
 * files should be, reports every one of them as deleted, and the next
 * `git add -A` removes real course content from the repository. This was one
 * agent commit away from happening on 2026-09-01.
 *
 * So never link the study. Let git check out what it tracks, then link only the
 * paths git does not have — descending into directories that exist on both
 * sides, and stopping at anything already linked.
 */
function linkMissing(real, mirror) {
  let linked = 0;
  for (const name of readdirSync(real)) {
    const source = join(real, name);
    const target = join(mirror, name);
    if (!existsSync(target)) {
      symlinkSync(source, target);
      linked += 1;
      continue;
    }
    if (lstatSync(target).isSymbolicLink()) continue;
    if (lstatSync(source).isDirectory() && lstatSync(target).isDirectory()) {
      linked += linkMissing(source, target);
    }
  }
  return linked;
}

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const worktree = resolve(process.argv[2] ?? "");
if (!process.argv[2]) {
  console.error("usage: node scripts/link-studies-into-worktree.mjs <worktree-path>");
  process.exitCode = 1;
} else {
  const real = join(repoRoot, "apps/local/studies");
  const mirror = join(worktree, "apps/local/studies");
  if (!existsSync(mirror)) {
    console.error(`link-studies: no ${mirror} — is that a checked-out worktree?`);
    process.exitCode = 1;
  } else {
    const linked = linkMissing(real, mirror);
    console.log(`link-studies: linked ${linked} path(s) git does not track into ${worktree}.`);
  }
}
