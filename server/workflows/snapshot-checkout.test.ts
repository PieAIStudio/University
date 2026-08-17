import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createStudy, registerLocalGitSource } from "../studies/repository.js";
import { createCleanSnapshot } from "../studies/snapshots.js";
import {
  closeSnapshotCheckout,
  listSnapshotCheckouts,
  openSnapshotCheckout,
  snapshotIdForCommit,
} from "./snapshot-checkout.js";

function git(repository: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", repository, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function setup() {
  const container = mkdtempSync(join(tmpdir(), "university-local-checkout-"));
  const studiesRoot = join(container, "studies");
  const sourceRoot = join(container, "source");
  execFileSync("git", ["init", "-q", "-b", "main", sourceRoot]);
  git(sourceRoot, ["config", "user.name", "UniversityLocal Test"]);
  git(sourceRoot, ["config", "user.email", "test@university.local"]);
  writeFileSync(
    join(sourceRoot, "package.json"),
    `${JSON.stringify({ name: "studied", scripts: { dev: "vite" } }, null, 2)}\n`,
  );
  writeFileSync(join(sourceRoot, "app.ts"), "export const version = 'first';\n");
  git(sourceRoot, ["add", "."]);
  git(sourceRoot, ["commit", "-q", "-m", "First"]);
  createStudy(studiesRoot, { id: "sample", title: "Sample" });
  registerLocalGitSource(studiesRoot, "sample", sourceRoot);
  const first = createCleanSnapshot(studiesRoot, "sample", "HEAD");
  return { container, studiesRoot, sourceRoot, first };
}

function advance(sourceRoot: string, studiesRoot: string) {
  writeFileSync(join(sourceRoot, "app.ts"), "export const version = 'second';\n");
  git(sourceRoot, ["add", "."]);
  git(sourceRoot, ["commit", "-q", "-m", "Second"]);
  return createCleanSnapshot(studiesRoot, "sample", "HEAD");
}

describe("snapshot checkout", () => {
  it("materialises the pinned commit without touching the studied project", () => {
    const { container, studiesRoot, sourceRoot, first } = setup();
    try {
      const second = advance(sourceRoot, studiesRoot);
      // The whole point: the studied project has moved on, and the lesson's
      // version has to stay reachable anyway.
      expect(second.sourceCommit).not.toBe(first.sourceCommit);

      const checkout = openSnapshotCheckout(studiesRoot, "sample", first.id);

      expect(checkout.created).toBe(true);
      expect(readFileSync(join(checkout.path, "app.ts"), "utf8")).toContain("first");
      // The source checkout is never a party to this — no branch moved, no
      // stash happened, nothing was left detached in the learner's own repo.
      expect(git(sourceRoot, ["rev-parse", "HEAD"])).toBe(second.sourceCommit);
      expect(git(sourceRoot, ["status", "--porcelain"])).toBe("");
      expect(git(sourceRoot, ["rev-parse", "--abbrev-ref", "HEAD"])).toBe("main");
    } finally {
      rmSync(container, { recursive: true, force: true });
    }
  });

  it("opens the newest snapshot when none is named", () => {
    const { container, studiesRoot, sourceRoot, first } = setup();
    try {
      const second = advance(sourceRoot, studiesRoot);
      // `listSnapshots` is newest-first, so an off-by-one here silently opens
      // the oldest snapshot instead — which still works and is still wrong.
      expect(openSnapshotCheckout(studiesRoot, "sample").snapshotId).toBe(second.id);
      expect(second.id).not.toBe(first.id);
    } finally {
      rmSync(container, { recursive: true, force: true });
    }
  });

  it("reports an existing checkout rather than rebuilding it", () => {
    const { container, studiesRoot, first } = setup();
    try {
      const opened = openSnapshotCheckout(studiesRoot, "sample", first.id);
      // Installed dependencies live in here and take minutes to restore. A
      // second click must not be what throws them away.
      writeFileSync(join(opened.path, "node_modules_marker"), "kept\n");

      const again = openSnapshotCheckout(studiesRoot, "sample", first.id);

      expect(again.created).toBe(false);
      expect(again.path).toBe(opened.path);
      expect(existsSync(join(opened.path, "node_modules_marker"))).toBe(true);
    } finally {
      rmSync(container, { recursive: true, force: true });
    }
  });

  it("reads the run commands off the project instead of assuming them", () => {
    const { container, studiesRoot, first } = setup();
    try {
      expect(openSnapshotCheckout(studiesRoot, "sample", first.id).run).toContain("pnpm dev");

      // A studied project that is not a Node app gets no invented command.
      // Pointing someone at `pnpm dev` in a repo that has no such script sends
      // them debugging our output instead of using theirs.
      const otherSource = join(container, "prose");
      execFileSync("git", ["init", "-q", "-b", "main", otherSource]);
      git(otherSource, ["config", "user.name", "UniversityLocal Test"]);
      git(otherSource, ["config", "user.email", "test@university.local"]);
      writeFileSync(join(otherSource, "README.md"), "# Not a Node project\n");
      git(otherSource, ["add", "."]);
      git(otherSource, ["commit", "-q", "-m", "First"]);
      createStudy(studiesRoot, { id: "prose", title: "Prose" });
      registerLocalGitSource(studiesRoot, "prose", otherSource);
      createCleanSnapshot(studiesRoot, "prose", "HEAD");

      expect(openSnapshotCheckout(studiesRoot, "prose").run).toEqual([]);
    } finally {
      rmSync(container, { recursive: true, force: true });
    }
  });

  it("finds a snapshot by the commit a lesson cites, and admits when it cannot", () => {
    const { container, studiesRoot, first } = setup();
    try {
      expect(snapshotIdForCommit(studiesRoot, "sample", first.sourceCommit)).toBe(first.id);
      // A lesson can outlive the snapshot it was written against. That is a
      // reason to offer the reader nothing, not to fail the page.
      expect(snapshotIdForCommit(studiesRoot, "sample", "0".repeat(40))).toBeUndefined();
    } finally {
      rmSync(container, { recursive: true, force: true });
    }
  });

  it("closes cleanly and says so in the listing", () => {
    const { container, studiesRoot, first } = setup();
    try {
      const opened = openSnapshotCheckout(studiesRoot, "sample", first.id);
      expect(listSnapshotCheckouts(studiesRoot, "sample")[0]?.open).toBe(true);

      expect(closeSnapshotCheckout(studiesRoot, "sample", first.id).removed).toBe(true);

      expect(existsSync(opened.path)).toBe(false);
      expect(listSnapshotCheckouts(studiesRoot, "sample")[0]?.open).toBe(false);
      // Closing twice is what happens when someone deletes the directory by
      // hand and then clicks the button; it is not an error.
      expect(closeSnapshotCheckout(studiesRoot, "sample", first.id).removed).toBe(false);
    } finally {
      rmSync(container, { recursive: true, force: true });
    }
  });

  it("refuses a path that is not the snapshot it claims to be", () => {
    const { container, studiesRoot, sourceRoot, first } = setup();
    try {
      const second = advance(sourceRoot, studiesRoot);
      const opened = openSnapshotCheckout(studiesRoot, "sample", first.id);
      git(opened.path, ["checkout", "-q", "--detach", second.sourceCommit]);

      // Resetting it would be the tidy-looking answer and the wrong one: a dev
      // server may be running out of that directory right now.
      expect(() => openSnapshotCheckout(studiesRoot, "sample", first.id)).toThrow(/close it first/);
    } finally {
      rmSync(container, { recursive: true, force: true });
    }
  });
});
