import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { inspectAirlock } from "./inspect.js";
import { inspectImportRisk, MAX_IMPORT_BLOB_BYTES } from "./import-gate.js";
import { promoteAirlock } from "./promote.js";
import { readSeal } from "./seal.js";

function git(root: string, args: readonly string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function makeUpstream(): string {
  const root = mkdtempSync(join(tmpdir(), "ul-airlock-upstream-"));
  git(root, ["init", "-q"]);
  git(root, ["config", "user.name", "UniversityLocal Test"]);
  git(root, ["config", "user.email", "test@university.local"]);
  writeFileSync(join(root, "README.md"), "# upstream\n");
  writeFileSync(join(root, ".gitignore"), "studies/\n");
  git(root, ["add", "-A"]);
  git(root, ["commit", "-q", "-m", "first"]);
  return root;
}

function scratch(name: string): string {
  return join(mkdtempSync(join(tmpdir(), "ul-airlock-")), name);
}

function studiesRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "ul-airlock-studies-"));
  return root;
}

describe("inspectImportRisk", () => {
  it("refuses learner data even when it somehow got tracked", () => {
    const report = inspectImportRisk([
      { path: "src/app.ts", sizeBytes: 100 },
      { path: "studies/turing-pact/learner/learning.sqlite", sizeBytes: 4096 },
    ]);
    expect(report.blocked.map((finding) => finding.path)).toEqual([
      "studies/turing-pact/learner/learning.sqlite",
    ]);
  });

  it("refuses credentials by shape rather than by directory", () => {
    const report = inspectImportRisk([
      { path: ".env", sizeBytes: 20 },
      { path: "deploy/server.pem", sizeBytes: 20 },
      { path: "config/id_ed25519", sizeBytes: 20 },
      { path: ".npmrc", sizeBytes: 20 },
    ]);
    expect(report.blocked).toHaveLength(4);
  });

  it("keeps the example env file, which is documentation", () => {
    const report = inspectImportRisk([{ path: ".env.example", sizeBytes: 20 }]);
    expect(report.blocked).toEqual([]);
  });

  it("refuses a blob too large to be source anybody studies", () => {
    const report = inspectImportRisk([
      { path: "assets/demo.mp4", sizeBytes: MAX_IMPORT_BLOB_BYTES + 1 },
    ]);
    expect(report.blocked[0]?.path).toBe("assets/demo.mp4");
  });

  it("reports the largest blob it saw even when nothing is blocked", () => {
    const report = inspectImportRisk([
      { path: "a.ts", sizeBytes: 10 },
      { path: "b.ts", sizeBytes: 900 },
    ]);
    expect(report).toMatchObject({ trackedFileCount: 2, largestBlobBytes: 900, blocked: [] });
  });
});

describe("promoteAirlock", () => {
  it("creates a sealed checkout at an exact commit", () => {
    const upstream = makeUpstream();
    const airlock = scratch("airlock");
    const receipt = promoteAirlock({
      airlockRoot: airlock,
      upstreamRoot: upstream,
      studiesRoot: studiesRoot(),
    });

    expect(receipt.disposition).toBe("created");
    expect(receipt.seal.promotedCommit).toBe(git(upstream, ["rev-parse", "HEAD"]));
    expect(receipt.seal.previousCommit).toBeNull();
    expect(existsSync(join(airlock, "README.md"))).toBe(true);
    expect(inspectAirlock(airlock).verdict).toBe("sealed");
  });

  /**
   * The airlock must not borrow the upstream's objects. Git's own clone
   * documentation warns that a shared copy can be corrupted when the source
   * garbage-collects — and the whole reason the airlock exists is that the
   * upstream keeps moving while an analysis reads the copy.
   */
  it("owns its objects instead of borrowing the upstream's", () => {
    const upstream = makeUpstream();
    const airlock = scratch("airlock");
    promoteAirlock({ airlockRoot: airlock, upstreamRoot: upstream, studiesRoot: studiesRoot() });
    expect(existsSync(join(airlock, ".git", "objects", "info", "alternates"))).toBe(false);
  });

  it("is idempotent while the upstream has not moved", () => {
    const upstream = makeUpstream();
    const airlock = scratch("airlock");
    const options = { airlockRoot: airlock, upstreamRoot: upstream, studiesRoot: studiesRoot() };
    promoteAirlock(options);
    expect(promoteAirlock(options).disposition).toBe("already-current");
  });

  it("advances to a newer commit and remembers where it came from", () => {
    const upstream = makeUpstream();
    const airlock = scratch("airlock");
    const options = { airlockRoot: airlock, upstreamRoot: upstream, studiesRoot: studiesRoot() };
    const first = promoteAirlock(options);

    writeFileSync(join(upstream, "README.md"), "# upstream, revised\n");
    git(upstream, ["commit", "-qam", "second"]);

    const second = promoteAirlock(options);
    expect(second.disposition).toBe("advanced");
    expect(second.seal.previousCommit).toBe(first.seal.promotedCommit);
    expect(inspectAirlock(airlock).verdict).toBe("sealed");
  });

  /**
   * Teaching from a working tree means today's lesson can contradict itself
   * tomorrow with nothing recording why. The refusal is the feature; the
   * acknowledgement exists so the receipt can name what was left out.
   */
  it("refuses a dirty upstream until the exclusion is acknowledged", () => {
    const upstream = makeUpstream();
    const airlock = scratch("airlock");
    writeFileSync(join(upstream, "README.md"), "# edited but not committed\n");
    const options = { airlockRoot: airlock, upstreamRoot: upstream, studiesRoot: studiesRoot() };

    expect(() => promoteAirlock(options)).toThrow(/未提交改动/);

    const receipt = promoteAirlock({ ...options, acknowledgeDirtyExcluded: true });
    expect(receipt.upstreamDirty).toBe(true);
    expect(receipt.seal.scan.excludedDirtyPaths.join(" ")).toContain("README.md");
  });

  it("refuses to import a tracked secret rather than routing around it", () => {
    const upstream = makeUpstream();
    writeFileSync(join(upstream, ".env"), "TOKEN=hunter2\n");
    git(upstream, ["add", "-f", ".env"]);
    git(upstream, ["commit", "-q", "-m", "oops"]);

    expect(() =>
      promoteAirlock({
        airlockRoot: scratch("airlock"),
        upstreamRoot: upstream,
        studiesRoot: studiesRoot(),
      }),
    ).toThrow(/\.env/);
  });

  it("refuses to sit inside the project it is a copy of", () => {
    const upstream = makeUpstream();
    expect(() =>
      promoteAirlock({
        airlockRoot: join(upstream, "airlock"),
        upstreamRoot: upstream,
        studiesRoot: studiesRoot(),
      }),
    ).toThrow(/互相包含/);
  });

  it("refuses to sit inside the learner's own data directory", () => {
    const upstream = makeUpstream();
    const studies = studiesRoot();
    expect(() =>
      promoteAirlock({
        airlockRoot: join(studies, "airlock"),
        upstreamRoot: upstream,
        studiesRoot: studies,
      }),
    ).toThrow(/互相包含/);
  });

  it("refuses to take over a directory that already holds something else", () => {
    const upstream = makeUpstream();
    const airlock = scratch("airlock");
    mkdirSync(airlock, { recursive: true });
    writeFileSync(join(airlock, "someone-elses-file.txt"), "hello\n");
    expect(() =>
      promoteAirlock({
        airlockRoot: airlock,
        upstreamRoot: upstream,
        studiesRoot: studiesRoot(),
      }),
    ).toThrow(/非空目录/);
  });

  /**
   * A path is not an identity. Without pinning the upstream's Git directory, a
   * directory that was deleted and refilled would keep promoting happily and
   * every later lesson would cite the wrong project.
   */
  it("refuses when the upstream path now holds a different repository", () => {
    const upstream = makeUpstream();
    const airlock = scratch("airlock");
    promoteAirlock({ airlockRoot: airlock, upstreamRoot: upstream, studiesRoot: studiesRoot() });

    rmSync(upstream, { recursive: true, force: true });
    mkdirSync(upstream, { recursive: true });
    git(upstream, ["init", "-q"]);
    git(upstream, ["config", "user.name", "Someone Else"]);
    git(upstream, ["config", "user.email", "other@university.local"]);
    writeFileSync(join(upstream, "README.md"), "# a different project\n");
    git(upstream, ["add", "-A"]);
    git(upstream, ["commit", "-q", "-m", "different"]);

    expect(() =>
      promoteAirlock({
        airlockRoot: airlock,
        upstreamRoot: upstream,
        studiesRoot: studiesRoot(),
      }),
    ).toThrow(/属于另一个仓库/);
  });
});

describe("inspectAirlock", () => {
  it("reports how far the airlock is behind the upstream", () => {
    const upstream = makeUpstream();
    const airlock = scratch("airlock");
    promoteAirlock({ airlockRoot: airlock, upstreamRoot: upstream, studiesRoot: studiesRoot() });

    writeFileSync(join(upstream, "README.md"), "# moved on\n");
    git(upstream, ["commit", "-qam", "second"]);

    const inspection = inspectAirlock(airlock);
    expect(inspection.verdict).toBe("sealed");
    expect(inspection.upstream?.commitsAhead).toBe(1);
    expect(inspection.upstream?.dirtyCount).toBe(0);
  });

  it("counts uncommitted upstream work without letting it into the airlock", () => {
    const upstream = makeUpstream();
    const airlock = scratch("airlock");
    promoteAirlock({ airlockRoot: airlock, upstreamRoot: upstream, studiesRoot: studiesRoot() });
    writeFileSync(join(upstream, "scratch.txt"), "work in progress\n");

    const inspection = inspectAirlock(airlock);
    expect(inspection.upstream?.dirtyCount).toBe(1);
    expect(existsSync(join(airlock, "scratch.txt"))).toBe(false);
  });

  it("blocks once someone has edited the airlock", () => {
    const upstream = makeUpstream();
    const airlock = scratch("airlock");
    promoteAirlock({ airlockRoot: airlock, upstreamRoot: upstream, studiesRoot: studiesRoot() });

    writeFileSync(join(airlock, "README.md"), "# edited in place\n");
    const inspection = inspectAirlock(airlock);
    expect(inspection.verdict).toBe("blocked");
    expect(inspection.problems.join(" ")).toContain("被改动过");
  });

  it("blocks when the checkout no longer matches the sealed commit", () => {
    const upstream = makeUpstream();
    const airlock = scratch("airlock");
    promoteAirlock({ airlockRoot: airlock, upstreamRoot: upstream, studiesRoot: studiesRoot() });

    writeFileSync(join(upstream, "README.md"), "# moved on\n");
    git(upstream, ["commit", "-qam", "second"]);
    const newer = git(upstream, ["rev-parse", "HEAD"]);
    git(airlock, ["fetch", "--depth=1", upstream, newer]);
    git(airlock, ["checkout", "--detach", "--force", newer]);

    const inspection = inspectAirlock(airlock);
    expect(inspection.verdict).toBe("blocked");
    expect(inspection.problems.join(" ")).toContain("HEAD 与封条不符");
    // The seal still names what should be there, so the fix is obvious.
    expect(readSeal(airlock).promotedCommit).not.toBe(newer);
  });
});
