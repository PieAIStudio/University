import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";

import { AirlockSealSchema, type AirlockSeal } from "../../src/domain/schemas.js";
import { isPathInside } from "../config/load-config.js";
import { gitText } from "../git/run.js";
import { writeJsonAtomically } from "../storage/atomic-json.js";

export const AIRLOCK_TOOL_VERSION = "1.0.0";
const SEAL_FILENAME = "university-local-airlock.json";

/**
 * The seal lives in `.git/`, not in the checkout.
 *
 * It describes the repository rather than belonging to it, and the airlock's
 * central promise is that its working tree is byte-identical to the commit it
 * was promoted to. A seal sitting in the tree would break that promise the
 * moment it was written: `git status` would report an untracked file, and the
 * airlock would fail its own tamper check on the very first promotion.
 */
export function getSealPath(airlockRoot: string): string {
  return join(airlockRoot, ".git", SEAL_FILENAME);
}

export function readSeal(airlockRoot: string): AirlockSeal {
  const path = getSealPath(airlockRoot);
  if (!existsSync(path)) {
    throw new Error(`这个目录还不是 airlock（缺少 ${SEAL_FILENAME}）：${airlockRoot}`);
  }
  return AirlockSealSchema.parse(JSON.parse(readFileSync(path, "utf8")) as unknown);
}

export function writeSeal(seal: AirlockSeal): void {
  writeJsonAtomically(getSealPath(seal.airlockRoot), seal);
}

export function sealExists(airlockRoot: string): boolean {
  return existsSync(getSealPath(airlockRoot));
}

export interface UpstreamIdentity {
  readonly root: string;
  readonly commonDir: string;
  readonly rootCommit: string | null;
  readonly objectFormat: "sha1" | "sha256";
}

/**
 * Who the upstream repository is, in terms that survive a rename.
 *
 * The identity that matters is the root commit. A path cannot serve — a
 * directory can be deleted and refilled with a different project, and the
 * `.git` path would come back identical while the contents are a stranger's.
 * The root commit is content-addressed, so it changes exactly when the history
 * being promoted is a different history.
 *
 * A repository can have several root commits (a merged-in unrelated history);
 * the earliest by sort order is used so the answer is stable rather than
 * dependent on how Git happens to walk. It is `null` only for a shallow clone,
 * where no root is reachable — identity then cannot be established, and the
 * caller says so instead of pretending.
 */
export function inspectUpstreamIdentity(candidate: string): UpstreamIdentity {
  const root = realpathSync.native(gitText(["rev-parse", "--show-toplevel"], candidate));
  const commonDir = realpathSync.native(
    gitText(["rev-parse", "--path-format=absolute", "--git-common-dir"], root),
  );
  const objectFormat = gitText(["rev-parse", "--show-object-format"], root);
  if (objectFormat !== "sha1" && objectFormat !== "sha256") {
    throw new Error(`不认识的 Git 对象格式：${objectFormat}`);
  }
  let rootCommit: string | null = null;
  try {
    const roots = gitText(["rev-list", "--max-parents=0", "HEAD"], root)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .sort();
    rootCommit = roots[0] ?? null;
  } catch {
    rootCommit = null;
  }
  return { root, commonDir, rootCommit, objectFormat };
}

/**
 * Where an airlock may live.
 *
 * The whole point of an airlock is to be a source that is *not* tangled with
 * the learner's data or with the live checkout, so the same containment rule
 * that `assertSeparatedRoots` applies to studies applies here — stated once,
 * for both directions, against real paths rather than the strings the caller
 * typed.
 */
export function assertAirlockLocation(input: {
  readonly airlockRoot: string;
  readonly upstreamRoot: string;
  readonly studiesRoot: string;
}): void {
  const pairs: readonly (readonly [string, string, string])[] = [
    [input.airlockRoot, input.upstreamRoot, "被学项目"],
    [input.airlockRoot, input.studiesRoot, "学习数据目录"],
  ];
  for (const [airlock, other, label] of pairs) {
    if (isPathInside(airlock, other) || isPathInside(other, airlock)) {
      throw new Error(`airlock 不能与${label}互相包含：${airlock} ↔ ${other}`);
    }
  }
}
