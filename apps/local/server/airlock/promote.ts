import { mkdirSync, readdirSync } from "node:fs";
import { dirname } from "node:path";

import { AirlockSealSchema, type AirlockSeal } from "../../src/domain/schemas.js";
import { canonicalizePotentialPath } from "../config/load-config.js";
import { assertSafeGitArgument, gitBuffer, gitText } from "../git/run.js";
import { describeImportRefusal, inspectImportRisk, type ImportCandidate } from "./import-gate.js";
import {
  AIRLOCK_TOOL_VERSION,
  assertAirlockLocation,
  inspectUpstreamIdentity,
  readSeal,
  sealExists,
  writeSeal,
} from "./seal.js";

interface PromoteAirlockInput {
  readonly airlockRoot: string;
  readonly upstreamRoot: string;
  readonly studiesRoot: string;
  readonly reference?: string;
  /** Required when the upstream has uncommitted work; the receipt names it. */
  readonly acknowledgeDirtyExcluded?: boolean;
  readonly now?: Date;
}

interface PromoteAirlockReceipt {
  readonly schemaVersion: 1;
  readonly operation: "airlock-promote";
  readonly disposition: "created" | "advanced" | "already-current";
  readonly seal: AirlockSeal;
  readonly upstreamDirty: boolean;
}

/**
 * Lists the tree exactly as it will be imported, with blob sizes.
 *
 * `-l` is what makes sizes available; without it the import gate would have to
 * guess, and a size limit you cannot measure is not a limit.
 */
function listTreeEntries(repositoryRoot: string, commit: string): readonly ImportCandidate[] {
  const output = gitBuffer(["ls-tree", "-r", "-l", "-z", commit], repositoryRoot);
  return output
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((record) => {
      const tab = record.indexOf("\t");
      if (tab < 0) throw new Error("Git 返回了无法解析的树条目");
      const header = record.slice(0, tab).match(/^(\d+) (blob|tree|commit) ([a-f0-9]+)\s+(-|\d+)$/);
      const path = record.slice(tab + 1);
      if (!header || !path) throw new Error("Git 返回了不完整的树条目");
      const rawSize = header[4];
      return { path, sizeBytes: rawSize === "-" ? null : Number(rawSize) };
    });
}

function dirtyPaths(repositoryRoot: string): readonly string[] {
  return gitText(["status", "--porcelain=v1", "-z", "--untracked-files=all"], repositoryRoot)
    .split("\0")
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

/**
 * Fetches one immutable commit into the airlock and checks it out detached.
 *
 * Deliberately not `git clone`. A local clone may hardlink objects into the
 * source, and a `--shared` clone depends on the source's objects outright —
 * Git's own documentation warns that the source garbage-collecting can then
 * corrupt the copy. Fetching an exact commit into a repository the airlock owns
 * keeps the two object stores genuinely separate, which is the only reason the
 * airlock is safe to analyse while the upstream keeps moving.
 */
function materialize(airlockRoot: string, upstreamRoot: string, commit: string): void {
  mkdirSync(dirname(airlockRoot), { recursive: true, mode: 0o700 });
  mkdirSync(airlockRoot, { recursive: true, mode: 0o700 });
  gitText(["init", "--quiet"], airlockRoot);
  gitText(["fetch", "--no-tags", "--force", "--depth=1", upstreamRoot, commit], airlockRoot);
  gitText(["checkout", "--detach", "--force", commit], airlockRoot);
  // A promotion replaces the tree wholesale; anything left from a previous
  // commit would make the checkout dirty and fail its own doctor check.
  gitText(["clean", "-xdff"], airlockRoot);
}

/**
 * Moves the airlock to an exact upstream commit, or refuses and explains why.
 *
 * Nothing else writes to an airlock. That is what lets `inspectAirlock` treat
 * any difference from the seal as tampering rather than as ordinary drift.
 */
export function promoteAirlock(input: PromoteAirlockInput): PromoteAirlockReceipt {
  const airlockRoot = canonicalizePotentialPath(input.airlockRoot);
  const upstream = inspectUpstreamIdentity(input.upstreamRoot);
  const studiesRoot = canonicalizePotentialPath(input.studiesRoot);
  assertAirlockLocation({ airlockRoot, upstreamRoot: upstream.root, studiesRoot });

  if (sealExists(airlockRoot)) {
    const existing = readSeal(airlockRoot);
    const sealedIdentity = existing.upstream.rootCommit;
    if (sealedIdentity === null || upstream.rootCommit === null) {
      throw new Error("无法确认上游仓库身份（历史是浅克隆，读不到根提交）。为安全起见拒绝提升。");
    }
    if (sealedIdentity !== upstream.rootCommit) {
      throw new Error(
        `这个 airlock 属于另一个仓库（原根提交 ${sealedIdentity.slice(0, 12)}）；换仓库请另建目录`,
      );
    }
  } else if (readdirSyncSafe(airlockRoot).some((entry) => entry !== ".git")) {
    // A bare `.git` is either an interrupted promotion or an empty repository,
    // and re-initialising either is harmless. Anything else in the directory
    // belongs to somebody, and an airlock must not adopt it.
    throw new Error(`拒绝在非空目录上新建 airlock：${airlockRoot}`);
  }

  const reference = assertSafeGitArgument(input.reference ?? "HEAD", "reference");
  const commit = gitText(["rev-parse", "--verify", `${reference}^{commit}`], upstream.root);
  const tree = gitText(["rev-parse", "--verify", `${commit}^{tree}`], upstream.root);

  const dirty = dirtyPaths(upstream.root);
  if (dirty.length > 0 && input.acknowledgeDirtyExcluded !== true) {
    throw new Error(
      [
        `被学项目有 ${dirty.length} 处未提交改动。airlock 只收已提交的 commit，`,
        "所以这些改动不会进入教材。确认这一点后加 --acknowledge-dirty-excluded 重试，",
        "或者先提交它们。",
      ].join("\n"),
    );
  }

  const risk = inspectImportRisk(listTreeEntries(upstream.root, commit));
  if (risk.blocked.length > 0) throw new Error(describeImportRefusal(risk));

  const previous = sealExists(airlockRoot) ? readSeal(airlockRoot) : null;
  if (previous?.promotedCommit === commit && previous.promotedTree === tree) {
    return {
      schemaVersion: 1,
      operation: "airlock-promote",
      disposition: "already-current",
      seal: previous,
      upstreamDirty: dirty.length > 0,
    };
  }

  materialize(airlockRoot, upstream.root, commit);

  const seal = AirlockSealSchema.parse({
    schemaVersion: 1,
    airlockRoot,
    upstream,
    allowedRef: reference,
    promotedCommit: commit,
    promotedTree: tree,
    previousCommit: previous?.promotedCommit ?? null,
    promotedAt: (input.now ?? new Date()).toISOString(),
    toolVersion: AIRLOCK_TOOL_VERSION,
    scan: {
      trackedFileCount: risk.trackedFileCount,
      largestBlobBytes: risk.largestBlobBytes,
      excludedDirtyPaths: dirty.slice(0, 2000),
    },
  });
  writeSeal(seal);

  return {
    schemaVersion: 1,
    operation: "airlock-promote",
    disposition: previous ? "advanced" : "created",
    seal,
    upstreamDirty: dirty.length > 0,
  };
}

function readdirSyncSafe(path: string): readonly string[] {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}
