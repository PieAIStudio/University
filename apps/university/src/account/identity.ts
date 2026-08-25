/** The shared browser Backend/Auth assembly, kept at the old import path. */
import { createUniversityBackend, type BrowserEnv } from "@pieai/university-backend/browser.js";

export {
  createOnlineSupabaseClient,
  readSwimmerCorePublicEnv,
  SWIMMER_CORE_PUBLISHABLE_KEY_ENV,
  SWIMMER_CORE_URL_ENV,
} from "@pieai/university-backend/browser.js";
export type { BrowserEnv } from "@pieai/university-backend/browser.js";

const backend = createUniversityBackend(import.meta.env as unknown as BrowserEnv);

export const swimmerCoreClient = backend.client;
export const identityPort = backend.identityPort;

/** Kept for callers/tests that construct an isolated identity port. */
export function createOnlineIdentityPort(env: BrowserEnv) {
  return createUniversityBackend(env).identityPort;
}
