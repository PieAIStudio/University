import { existsSync, readFileSync, rmSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";

import { z } from "zod";

import { writeJsonAtomically } from "../storage/atomic-json.js";

/**
 * Six hours. An analysis is a long external run, not a function call: the CLI
 * hands an invocation to a host and exits, so nothing stays alive to hold a
 * lock or send a heartbeat. The lease therefore has to outlive the process that
 * took it, and the timeout has to be longer than a realistic run rather than
 * longer than a realistic function.
 */
export const UA_LEASE_TTL_MS = 6 * 60 * 60 * 1000;

const UaLeaseSchema = z
  .object({
    schemaVersion: z.literal(1),
    owner: z.string().min(1).max(200),
    acquiredAt: z.string(),
    expiresAt: z.string(),
  })
  .strict();

type UaLease = z.infer<typeof UaLeaseSchema>;

export class UaBusyError extends Error {
  readonly lease: UaLease;
  constructor(lease: UaLease) {
    super(
      [
        `这次分析正被另一个宿主运行：${lease.owner}`,
        `租约到 ${lease.expiresAt} 过期。`,
        "如果那个宿主已经不在了，用 --takeover 显式接管。",
      ].join("\n"),
    );
    this.name = "UaBusyError";
    this.lease = lease;
  }
}

function describeUaOwner(): string {
  return `${hostname()}:${process.pid}`;
}

function leasePath(analysisRoot: string): string {
  return join(analysisRoot, "lease.json");
}

export function readUaLease(analysisRoot: string): UaLease | null {
  const path = leasePath(analysisRoot);
  if (!existsSync(path)) return null;
  try {
    return UaLeaseSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    // A lease nobody can parse cannot be proven to belong to anyone, so it
    // protects nothing and must not be allowed to block the work forever.
    return null;
  }
}

/**
 * Claims the right to drive one analysis.
 *
 * Two hosts resuming the same `preparing` analysis both rebuild the same
 * workspace and both write into the same data directory, and whichever
 * finishes second silently wins. Nothing downstream can detect that, because
 * the output looks like one complete run.
 *
 * Re-acquiring an unexpired lease you already hold is a normal resume and
 * extends it. Taking one that belongs to somebody else requires `takeover`,
 * because the only party who knows whether the other host really died is the
 * person at the keyboard.
 */
export function acquireUaLease(
  analysisRoot: string,
  options: { readonly owner?: string; readonly takeover?: boolean; readonly now?: Date } = {},
): UaLease {
  const owner = options.owner ?? describeUaOwner();
  const now = options.now ?? new Date();
  const existing = readUaLease(analysisRoot);
  if (existing && existing.owner !== owner && !options.takeover) {
    if (new Date(existing.expiresAt).getTime() > now.getTime()) throw new UaBusyError(existing);
  }
  const lease = UaLeaseSchema.parse({
    schemaVersion: 1,
    owner,
    acquiredAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + UA_LEASE_TTL_MS).toISOString(),
  });
  writeJsonAtomically(leasePath(analysisRoot), lease);
  return lease;
}

/**
 * Drops the lease once the analysis reaches a state nobody resumes from.
 * Releasing is best-effort on purpose: a finalize that succeeded must not be
 * reported as failed because a lock file could not be deleted.
 */
export function releaseUaLease(analysisRoot: string): void {
  try {
    rmSync(leasePath(analysisRoot), { force: true });
  } catch {
    // An expired lease is indistinguishable from a released one to every
    // caller, so a leftover file costs a timeout, not correctness.
  }
}
