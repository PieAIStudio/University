/**
 * The learner's current rights, without owning a store or a network client.
 *
 * This is a read model. A shell supplies identity state, whether it has a
 * usable remote adapter, and an optional server grant. No course identifier,
 * revision, or content decision is allowed in this shape: published content
 * is governed by ContentPort, while this model governs AI and sync only.
 */

import type { IdentityStatus } from "../ports/identity.js";

import {
  BILLING_CONFIG,
  defaultPlanOf,
  planById,
  type AiEntitlementConfig,
  type BillingConfig,
  type PlanId,
} from "./plans.js";

export type EntitlementSource = "baseline" | "remote";

export type SyncUnavailableReason = "not-signed-in" | "remote-unavailable" | "not-included";

export interface EntitlementGrant {
  /** The server-selected plan; unknown plans fail back to the baseline. */
  readonly planId: PlanId;
}

export interface EntitlementReadInput {
  readonly identity: IdentityStatus;
  /** True when the shell has a usable remote adapter for account data. */
  readonly remoteAvailable: boolean;
  /** Optional remote fact. It is ignored unless identity and remote are usable. */
  readonly grant?: EntitlementGrant | null;
}

export interface EntitlementReadModel {
  readonly planId: PlanId;
  readonly source: EntitlementSource;
  readonly ai: AiEntitlementConfig;
  readonly sync: {
    /** Whether the selected plan includes sync. */
    readonly entitled: boolean;
    /** Whether this session can use that right now. */
    readonly available: boolean;
    readonly reason: "available" | SyncUnavailableReason;
  };
}

/**
 * Resolve the rights without making a request.
 *
 * Missing env, signed-out sessions, missing grants, and unknown grants all
 * have deterministic behavior: use the configured baseline, keep local
 * learning available, and never pretend that sync is active without both an
 * account and a remote adapter.
 */
export function readEntitlements(
  input: EntitlementReadInput,
  config: BillingConfig = BILLING_CONFIG,
): EntitlementReadModel {
  const baseline = defaultPlanOf(config);
  const signedIn = input.identity.kind === "signed_in";
  const remoteGrant =
    signedIn && input.remoteAvailable && input.grant
      ? planById(input.grant.planId, config)
      : undefined;
  const plan = remoteGrant ?? baseline;
  const source: EntitlementSource = remoteGrant ? "remote" : "baseline";

  const reason = !signedIn
    ? "not-signed-in"
    : !input.remoteAvailable
      ? "remote-unavailable"
      : !plan.sync.included
        ? "not-included"
        : "available";

  return {
    planId: plan.id,
    source,
    ai: plan.ai,
    sync: {
      entitled: plan.sync.included,
      available: reason === "available",
      reason,
    },
  };
}
