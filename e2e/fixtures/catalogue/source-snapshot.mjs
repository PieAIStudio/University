import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { testProcessEnvironment } from "../../process-environment.mjs";

/** Tiny, real Git fixture. Never uses the University's Git database, identity,
 * hooks, source checkout or network. Original file provenance lives beside it. */
export function createSourceSnapshot(root, files) {
  mkdirSync(root, { recursive: true });
  const git = (...args) =>
    execFileSync("git", ["-c", "core.autocrlf=false", "-c", "commit.gpgsign=false", ...args], {
      cwd: root,
      env: testProcessEnvironment({
        GIT_AUTHOR_NAME: "University test catalogue",
        GIT_AUTHOR_EMAIL: "test-catalogue@example.invalid",
        GIT_COMMITTER_NAME: "University test catalogue",
        GIT_COMMITTER_EMAIL: "test-catalogue@example.invalid",
        GIT_AUTHOR_DATE: "2026-10-02T00:00:00Z",
        GIT_COMMITTER_DATE: "2026-10-02T00:00:00Z",
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: "/dev/null",
      }),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git("init", "--quiet", "--initial-branch=main", "--object-format=sha1");
  for (const [name, text] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    const target = resolve(root, name);
    if (!target.startsWith(`${resolve(root)}${sep}`) || name.split("/").includes(".git"))
      throw new Error(`Unsafe test source path: ${name}`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
  }
  git("add", "--all");
  const tree = git("write-tree");
  const commit = git(
    "commit-tree",
    tree,
    "-m",
    "Frozen cited source files for University E2E only",
  );
  git("update-ref", "refs/heads/main", commit);
  return commit;
}
