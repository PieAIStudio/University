/**
 * Optional SwimmerBackend identity for the delivery shell.
 *
 * Env names are the portfolio contract. Missing either one is the normal
 * case on a fresh clone: we return an unconfigured port and the learner
 * never hears about it. No console, no toast, no wall.
 *
 * Only the publishable key. A secret key in a Vite env is a leak; if one
 * shows up we treat the backend as unconfigured rather than shipping it.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createAuthClient } from "@pieai/swimmer-backend-client";
import { createIdentityPort, type IdentityPort } from "@pieai/university-core";

export const SWIMMER_CORE_URL_ENV = "VITE_SWIMMER_CORE_SUPABASE_URL";
export const SWIMMER_CORE_PUBLISHABLE_KEY_ENV = "VITE_SWIMMER_CORE_PUBLISHABLE_KEY";

type BrowserEnv = Record<string, string | boolean | undefined>;

export function readSwimmerCorePublicEnv(env: BrowserEnv): {
  readonly url: string;
  readonly publishableKey: string;
} | null {
  const url = stringValue(env[SWIMMER_CORE_URL_ENV]);
  const publishableKey = stringValue(env[SWIMMER_CORE_PUBLISHABLE_KEY_ENV]);
  if (!url || !publishableKey) return null;
  if (looksLikeSecretKey(publishableKey)) return null;
  try {
    new URL(url);
  } catch {
    return null;
  }
  return { url, publishableKey };
}

function looksLikeSecretKey(value: string): boolean {
  return value.startsWith("sb_secret_") || value.includes("service_role");
}

function stringValue(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function createOnlineSupabaseClient(env: BrowserEnv): SupabaseClient | null {
  const config = readSwimmerCorePublicEnv(env);
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

export function createOnlineIdentityPort(env: BrowserEnv): IdentityPort {
  const client = createOnlineSupabaseClient(env);
  return createIdentityPort(client ? createAuthClient(client) : null);
}

/** One browser client is shared by Auth, progress sync and Realtime. */
export const swimmerCoreClient = createOnlineSupabaseClient(
  import.meta.env as unknown as BrowserEnv,
);

export const identityPort: IdentityPort = createIdentityPort(
  swimmerCoreClient ? createAuthClient(swimmerCoreClient) : null,
);
