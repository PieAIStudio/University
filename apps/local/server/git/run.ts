import { execFileSync } from "node:child_process";

/**
 * One way to run Git, shared by everything that touches a repository.
 *
 * The environment is not incidental. `GIT_LITERAL_PATHSPECS` stops a path that
 * happens to contain glob characters from matching something else;
 * `GIT_OPTIONAL_LOCKS` keeps read-only inspection from writing to a repository
 * the learner may be using; `GIT_TERMINAL_PROMPT` turns a credential prompt
 * into an error rather than a process that waits forever with nobody watching.
 *
 * These three used to be copied per call site. A copy that drifts is a copy
 * that silently loses one of those guarantees.
 */
const GIT_ENVIRONMENT = Object.freeze({
  GIT_LITERAL_PATHSPECS: "1",
  GIT_OPTIONAL_LOCKS: "0",
  GIT_TERMINAL_PROMPT: "0",
});

const MAX_GIT_OUTPUT_BYTES = 64 * 1024 * 1024;

export function gitBuffer(args: readonly string[], cwd?: string): Buffer {
  return execFileSync("git", args, {
    ...(cwd === undefined ? {} : { cwd }),
    env: { ...process.env, ...GIT_ENVIRONMENT },
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: MAX_GIT_OUTPUT_BYTES,
  });
}

export function gitText(args: readonly string[], cwd?: string): string {
  return gitBuffer(args, cwd).toString("utf8").trim();
}

/**
 * Refs and paths reach Git as arguments. A value starting with `-` would be
 * read as an option, and a NUL cannot survive the argument boundary at all.
 */
export function assertSafeGitArgument(value: string, label: string): string {
  if (value.startsWith("-") || value.includes("\0")) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return value;
}
