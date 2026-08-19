import { existsSync } from "node:fs";
import { join } from "node:path";

import type { AirlockSeal } from "@pieai/university-core/domain/schemas.js";
import { gitText } from "../git/run.js";
import { inspectUpstreamIdentity, readSeal } from "./seal.js";

type AirlockVerdict = "sealed" | "blocked";

interface AirlockInspection {
  readonly verdict: AirlockVerdict;
  readonly seal: AirlockSeal;
  readonly problems: readonly string[];
  readonly upstream: UpstreamClock | null;
}

interface UpstreamClock {
  readonly headCommit: string;
  readonly dirtyCount: number;
  /** How many upstream commits the airlock has not been promoted to yet. */
  readonly commitsAhead: number | null;
}

/**
 * Checks the airlock against its own seal before anything teaches from it.
 *
 * The failure this prevents is quiet: a checkout that was edited, reset, or
 * refilled still looks like a repository, and an analysis run on it would
 * produce evidence that cites a commit the code no longer matches. Every
 * problem found is reported rather than thrown one at a time, because a person
 * fixing this wants the whole list, not the first line of it.
 */
export function inspectAirlock(airlockRoot: string): AirlockInspection {
  const seal = readSeal(airlockRoot);
  const problems: string[] = [];

  if (!existsSync(join(airlockRoot, ".git"))) {
    return {
      verdict: "blocked",
      seal,
      problems: [`airlock 里没有 Git 仓库：${airlockRoot}`],
      upstream: null,
    };
  }

  const head = readOrNull(["rev-parse", "--verify", "HEAD"], airlockRoot);
  if (head !== seal.promotedCommit) {
    problems.push(`airlock 的 HEAD 与封条不符：${head ?? "读不到"} ≠ ${seal.promotedCommit}`);
  }
  const tree = readOrNull(["rev-parse", "--verify", "HEAD^{tree}"], airlockRoot);
  if (tree !== seal.promotedTree) {
    problems.push(`airlock 的目录树与封条不符：${tree ?? "读不到"} ≠ ${seal.promotedTree}`);
  }

  const dirty = readOrNull(["status", "--porcelain=v1", "--untracked-files=all"], airlockRoot);
  if (dirty === null) {
    problems.push("读不到 airlock 的工作区状态");
  } else if (dirty.length > 0) {
    const count = dirty.split("\n").filter(Boolean).length;
    problems.push(`airlock 被改动过（${count} 处）。它必须保持只读；请重新提升以还原。`);
  }

  // A repository that borrows objects is not independent: the upstream can
  // garbage-collect them away underneath it.
  const alternates = join(airlockRoot, ".git", "objects", "info", "alternates");
  if (existsSync(alternates)) {
    problems.push("airlock 借用了上游的 Git 对象，不是独立副本；请删掉重新提升。");
  }

  let upstream: UpstreamClock | null = null;
  try {
    const identity = inspectUpstreamIdentity(seal.upstream.root);
    if (identity.rootCommit !== seal.upstream.rootCommit) {
      problems.push(
        `上游路径 ${seal.upstream.root} 现在是另一个仓库的历史；封条记录的根提交是 ${seal.upstream.rootCommit ?? "未知"}`,
      );
    }
    if (identity.objectFormat !== seal.upstream.objectFormat) {
      problems.push(`上游的 Git 对象格式变了：${identity.objectFormat}`);
    }
    upstream = readUpstreamClock(identity.root, seal.promotedCommit);
  } catch {
    problems.push(`上游仓库现在读不到：${seal.upstream.root}`);
  }

  return { verdict: problems.length === 0 ? "sealed" : "blocked", seal, problems, upstream };
}

function readUpstreamClock(upstreamRoot: string, promotedCommit: string): UpstreamClock {
  const headCommit = gitText(["rev-parse", "--verify", "HEAD"], upstreamRoot);
  const dirty = gitText(["status", "--porcelain=v1", "-z", "--untracked-files=all"], upstreamRoot);
  const dirtyCount = dirty.split("\0").filter(Boolean).length;
  // The promoted commit can be missing from the upstream after a rebase, and a
  // count nobody can compute is better reported as unknown than as zero.
  const ahead = readOrNull(
    ["rev-list", "--count", `${promotedCommit}..${headCommit}`],
    upstreamRoot,
  );
  return {
    headCommit,
    dirtyCount,
    commitsAhead: ahead === null ? null : Number(ahead),
  };
}

function readOrNull(args: readonly string[], cwd: string): string | null {
  try {
    return gitText(args, cwd);
  } catch {
    return null;
  }
}
