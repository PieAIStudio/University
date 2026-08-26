/** The shared browser Backend/Auth assembly, kept at the old import path. */
import { createUniversityBackend, type BrowserEnv } from "@pieai/university-backend/browser.js";

export {
  createOnlineSupabaseClient,
  readSwimmerBackendPublicEnv,
  SWIMMER_BACKEND_PUBLISHABLE_KEY_ENV,
  SWIMMER_BACKEND_SUPABASE_URL_ENV,
} from "@pieai/university-backend/browser.js";
export {
  readSwimmerCorePublicEnv,
  SWIMMER_CORE_PUBLISHABLE_KEY_ENV,
  SWIMMER_CORE_URL_ENV,
} from "@pieai/university-backend/browser.js";
export type { BrowserEnv } from "@pieai/university-backend/browser.js";

const backend = createUniversityBackend(import.meta.env as unknown as BrowserEnv);

export const swimmerBackendClient = backend.client;
/** @deprecated Use swimmerBackendClient. */
export const swimmerCoreClient = swimmerBackendClient;
export const identityPort = backend.identityPort;

/** Kept for callers/tests that construct an isolated identity port. */
export function createOnlineIdentityPort(env: BrowserEnv) {
  return createUniversityBackend(env).identityPort;
}
