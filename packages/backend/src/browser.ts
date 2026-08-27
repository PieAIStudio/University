import { createAuthClient } from "@pieai/swimmer-backend-client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  createPaymentPort,
  createIdentityPort,
  mergeProgress,
  parseProgress,
  type IdentityPort,
  type PaymentPort,
  type ProgressDocument,
  type ProgressRemoteStore,
} from "@pieai/university-core";
import { createPaymentOrderId, createSupabasePaymentRemote } from "./payment.js";

/** Canonical browser-facing SwimmerBackend environment names. */
export const SWIMMER_BACKEND_SUPABASE_URL_ENV = "VITE_SWIMMER_BACKEND_SUPABASE_URL";
export const SWIMMER_BACKEND_PUBLISHABLE_KEY_ENV = "VITE_SWIMMER_BACKEND_PUBLISHABLE_KEY";

export type BrowserEnv = Record<string, string | boolean | undefined>;

export interface UniversityBackend {
  readonly client: SupabaseClient | null;
  readonly identityPort: IdentityPort;
  readonly paymentPort: PaymentPort;
  readonly progressRemoteStore: ProgressRemoteStore | null;
}

/**
 * The only browser-side SwimmerBackend assembly for both shells.
 *
 * The local shell is allowed to be opened without a configured cloud during
 * authoring, but it must not grow a second adapter or a second database
 * contract. Once a learner signs in, both shells bind the same progress port
 * to this same remote row and the local browser cache becomes only an offline
 * queue.
 */
export function createUniversityBackend(env: BrowserEnv): UniversityBackend {
  const client = createOnlineSupabaseClient(env);
  const identityPort = createIdentityPort(client ? createAuthClient(client) : null);
  return {
    client,
    identityPort,
    paymentPort: createPaymentPort({
      identity: identityPort,
      transport: client ? createSupabasePaymentRemote(client) : null,
      orderIdFactory: createPaymentOrderId,
    }),
    progressRemoteStore: client ? createSupabaseProgressRemoteStore(client) : null,
  };
}

export function readSwimmerBackendPublicEnv(env: BrowserEnv): {
  readonly url: string;
  readonly publishableKey: string;
} | null {
  const candidate = {
    url: stringValue(env[SWIMMER_BACKEND_SUPABASE_URL_ENV]),
    publishableKey: stringValue(env[SWIMMER_BACKEND_PUBLISHABLE_KEY_ENV]),
  };
  if (
    !candidate?.url ||
    !candidate.publishableKey ||
    looksLikeSecretKey(candidate.publishableKey)
  ) {
    return null;
  }
  const { url, publishableKey } = candidate;
  try {
    new URL(url);
  } catch {
    return null;
  }
  return { url, publishableKey };
}

export function createOnlineSupabaseClient(env: BrowserEnv): SupabaseClient | null {
  const config = readSwimmerBackendPublicEnv(env);
  if (!config) return null;
  try {
    return createClient(config.url, config.publishableKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  } catch {
    return null;
  }
}

function looksLikeSecretKey(value: string): boolean {
  return value.startsWith("sb_secret_") || value.includes("service_role");
}

function stringValue(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

type ProgressRow = { readonly document: unknown; readonly revision: number | string | null };
type RevisionRow = { readonly revision: number | string | null };

/**
 * SwimmerBackend's single University learner row.
 *
 * Progress, cards, words, marks and answer/host records are one mergeable
 * document. That is intentionally the existing `progress` row rather than a
 * second product-specific table: one user, one RLS boundary, one revision
 * counter. The remote migration still has to be provisioned by the backend
 * owner; this adapter is the client-side contract used by both shells. Saves
 * use a revision-guarded update and merge once more inside the adapter, so two
 * computers saving at the same time cannot silently erase one another.
 */
export function createSupabaseProgressRemoteStore(client: SupabaseClient): ProgressRemoteStore {
  const table = () => client.schema("university").from("progress");

  return {
    async load(userId): Promise<ProgressDocument | null> {
      const { data, error } = await table()
        .select("document")
        .eq("user_id", userId)
        .maybeSingle<ProgressRow>();
      if (error) throw error;
      if (!data) return null;
      return parseProgress(JSON.stringify(data.document));
    },

    async save(userId, document): Promise<void> {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { data: current, error: readError } = await table()
          .select("document, revision")
          .eq("user_id", userId)
          .maybeSingle<ProgressRow>();
        if (readError) throw readError;
        const currentRevision = current?.revision == null ? 0 : Number(current.revision);
        if (
          !Number.isSafeInteger(currentRevision) ||
          currentRevision < 0 ||
          currentRevision >= Number.MAX_SAFE_INTEGER
        ) {
          throw new Error("progress revision is outside the browser-safe integer range");
        }
        const merged = current
          ? mergeProgress(parseProgress(JSON.stringify(current.document)), document)
          : document;

        if (!current) {
          const { error: insertError } = await table().insert({
            user_id: userId,
            document: merged,
            revision: 1,
          });
          if (!insertError) return;
          if (insertError.code !== "23505") throw insertError;
          continue;
        }

        const { data: saved, error: saveError } = await table()
          .update({ document: merged, revision: currentRevision + 1 })
          .eq("user_id", userId)
          .eq("revision", currentRevision)
          .select("revision")
          .maybeSingle<RevisionRow>();
        if (saveError) throw saveError;
        if (saved) return;
        // Another computer won the revision. Pull its document, merge again,
        // and retry against the newer revision.
      }
      throw new Error("progress changed on another computer; retrying did not converge");
    },
  };
}
