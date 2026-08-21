import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

import { StableId } from "@pieai/university-core/domain/schemas.js";
import { assertSafeGitArgument, gitText } from "../git/run.js";
import { getStudyPaths } from "../studies/paths.js";
import { listSnapshots, openStudyRepository } from "../studies/snapshots.js";

/**
 * Running the version a lesson is teaching.
 *
 * Courses are pinned to a commit, and the studied project keeps moving. So the
 * app on screen stops being the app in the lesson — a button moves, a screen is
 * renamed — and the learner has no way to see the thing they are reading about.
 * The evidence was always readable (it comes out of the mirror's Git objects),
 * but reading a file is not the same as using the product.
 *
 * The mirror already holds every pinned commit, so this needs no network and
 * never touches the studied project's own checkout: the worktree is added with
 * `--git-dir <mirror>`, so nothing about the learner's branch, index, or
 * uncommitted work can be disturbed by opening a lesson's version. That is the
 * whole reason this lives here rather than being a `git checkout` someone runs
 * in the project by hand.
 *
 * UA has done exactly this since it shipped (`server/ua/adapter.ts`), but its
 * workspace is created and destroyed inside one analysis run. These checkouts
 * are for a person, so they persist until closed.
 */

interface SnapshotCheckout {
  readonly snapshotId: string;
  readonly sourceCommit: string;
  readonly path: string;
  /** False when the checkout was already there and already on the right commit. */
  readonly created: boolean;
  /** The commands that start this project, when its shape is recognisable. */
  readonly run: readonly string[];
}

interface SnapshotCheckoutSummary {
  readonly snapshotId: string;
  readonly sourceCommit: string;
  readonly createdAt: string;
  readonly status: string;
  readonly open: boolean;
}

function checkoutPath(studiesRoot: string, studyId: string, snapshotId: string): string {
  return join(getStudyPaths(studiesRoot, studyId).source.checkouts, StableId.parse(snapshotId));
}

/**
 * The snapshot to open when none is named: the newest ready one.
 *
 * Not "the one the courses are on", which sounds more precise and is worse. A
 * course carries its pin per lesson, a study can hold courses pinned to
 * different snapshots mid-refresh, and picking one of them silently would make
 * the default depend on which course the learner happened to be reading. The
 * newest ready snapshot is a fact about the study, and the caller that cares
 * about a specific lesson passes that lesson's commit.
 */
function resolveSnapshot(studiesRoot: string, studyId: string, snapshotId?: string) {
  const snapshots = listSnapshots(studiesRoot, studyId).filter(
    (snapshot) => snapshot.status === "ready",
  );
  if (snapshots.length === 0) {
    throw new Error(`Study ${studyId} has no ready snapshot to open`);
  }
  // `listSnapshots` is documented newest-first, so the newest is index 0.
  if (snapshotId === undefined) return snapshots[0]!;
  const wanted = StableId.parse(snapshotId);
  const found = snapshots.find((snapshot) => snapshot.id === wanted);
  if (!found) throw new Error(`Study ${studyId} has no ready snapshot ${wanted}`);
  return found;
}

/**
 * The snapshot holding a given commit.
 *
 * A lesson knows the commit it is pinned to and nothing about snapshot ids, so
 * this is what the reader's "open this version" arrives as. Returns undefined
 * rather than throwing when no snapshot matches: a lesson can outlive the
 * snapshot it was written against, and that is a reason to offer the reader
 * nothing, not a reason to fail the page.
 */
export function snapshotIdForCommit(
  studiesRoot: string,
  studyId: string,
  sourceCommit: string,
): string | undefined {
  return listSnapshots(studiesRoot, studyId).find(
    (snapshot) => snapshot.status === "ready" && snapshot.sourceCommit === sourceCommit,
  )?.id;
}

/**
 * How to start whatever was just checked out.
 *
 * Read off the project rather than assumed, and omitted entirely when there is
 * nothing to read. UniversityLocal studies whatever it is pointed at; guessing
 * `pnpm dev` at a project that has no such script would be worse than saying
 * nothing, because a wrong command sends the reader debugging our output
 * instead of using theirs.
 */
function runHint(path: string): readonly string[] {
  const manifestPath = join(path, "package.json");
  if (!existsSync(manifestPath)) return [];
  let manifest: { scripts?: Record<string, unknown>; packageManager?: unknown };
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as typeof manifest;
  } catch {
    return [];
  }
  const scripts = manifest.scripts ?? {};
  const script = ["dev", "start", "preview"].find((name) => typeof scripts[name] === "string");
  if (!script) return [];
  const agent =
    typeof manifest.packageManager === "string" && manifest.packageManager.startsWith("yarn")
      ? "yarn"
      : typeof manifest.packageManager === "string" && manifest.packageManager.startsWith("npm")
        ? "npm run"
        : "pnpm";
  return [
    `cd ${path}`,
    // `--ignore-scripts` because a postinstall in someone else's project is
    // arbitrary code that the learner did not ask to run just to look at a UI.
    "pnpm install --frozen-lockfile --ignore-scripts",
    `${agent} ${script}`,
  ];
}

/** Every snapshot of a study, and whether it is currently checked out. */
export function listSnapshotCheckouts(
  studiesRoot: string,
  studyId: string,
): readonly SnapshotCheckoutSummary[] {
  return listSnapshots(studiesRoot, studyId).map((snapshot) => ({
    snapshotId: snapshot.id,
    sourceCommit: snapshot.sourceCommit,
    createdAt: snapshot.createdAt,
    status: snapshot.status,
    open: existsSync(checkoutPath(studiesRoot, studyId, snapshot.id)),
  }));
}

/**
 * Materialises a snapshot as a runnable directory, or reports the one already
 * there. Idempotent on purpose: the caller is a person who may well ask twice,
 * and re-cloning a checkout they had already installed into would throw away
 * the slow part for nothing.
 */
export function openSnapshotCheckout(
  studiesRoot: string,
  studyId: string,
  snapshotId?: string,
): SnapshotCheckout {
  const snapshot = resolveSnapshot(studiesRoot, studyId, snapshotId);
  const repository = openStudyRepository(studiesRoot, studyId);
  const path = checkoutPath(studiesRoot, studyId, snapshot.id);
  const commit = assertSafeGitArgument(snapshot.sourceCommit, "source commit");

  if (existsSync(path)) {
    let head: string;
    try {
      head = gitText(["-C", path, "rev-parse", "HEAD"]);
    } catch {
      throw new Error(`Checkout path exists but is not a Git worktree: ${path}`);
    }
    if (head !== commit) {
      // Refuse rather than reset. Whatever is there was put there by something,
      // and silently moving a directory someone may have a dev server running
      // out of is not a repair.
      throw new Error(
        `Checkout at ${path} is on ${head}, not the snapshot's ${commit}; close it first`,
      );
    }
    return {
      snapshotId: snapshot.id,
      sourceCommit: commit,
      path,
      created: false,
      run: runHint(path),
    };
  }

  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  // Stale registrations accumulate when a checkout directory is deleted by hand
  // rather than closed; without this, Git refuses to reuse the path.
  gitText(["--git-dir", repository, "worktree", "prune", "--expire", "now"]);
  gitText(["--git-dir", repository, "worktree", "add", "--detach", path, commit]);
  return { snapshotId: snapshot.id, sourceCommit: commit, path, created: true, run: runHint(path) };
}

/** Removes a checkout and its Git registration. Silent when there is none. */
export function closeSnapshotCheckout(
  studiesRoot: string,
  studyId: string,
  snapshotId?: string,
): { readonly snapshotId: string; readonly path: string; readonly removed: boolean } {
  const snapshot = resolveSnapshot(studiesRoot, studyId, snapshotId);
  const repository = openStudyRepository(studiesRoot, studyId);
  const path = checkoutPath(studiesRoot, studyId, snapshot.id);
  if (!existsSync(path)) return { snapshotId: snapshot.id, path, removed: false };

  try {
    gitText(["--git-dir", repository, "worktree", "remove", "--force", path]);
  } catch {
    // A worktree Git will not remove — usually because installing dependencies
    // left files it does not know about — is still just a directory.
    rmSync(path, { recursive: true, force: true });
  }
  gitText(["--git-dir", repository, "worktree", "prune", "--expire", "now"]);
  if (existsSync(path)) throw new Error(`Checkout cleanup failed: ${path}`);
  return { snapshotId: snapshot.id, path, removed: true };
}
