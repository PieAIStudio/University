export {
  createUniversityBackend,
  createOnlineSupabaseClient,
  createSupabaseProgressRemoteStore,
  readSwimmerBackendPublicEnv,
  /** @deprecated Use readSwimmerBackendPublicEnv. */
  readSwimmerCorePublicEnv,
  SWIMMER_BACKEND_PUBLISHABLE_KEY_ENV,
  SWIMMER_BACKEND_SUPABASE_URL_ENV,
  /** @deprecated Use SWIMMER_BACKEND_PUBLISHABLE_KEY_ENV. */
  SWIMMER_CORE_PUBLISHABLE_KEY_ENV,
  /** @deprecated Use SWIMMER_BACKEND_SUPABASE_URL_ENV. */
  SWIMMER_CORE_URL_ENV,
  type BrowserEnv,
  type UniversityBackend,
} from "./browser.js";
export {
  createPaymentOrderId,
  createSupabasePaymentRemote,
  UNIVERSITY_PAYMENT_APP_ID,
} from "./payment.js";
export { bindProgressToIdentity } from "./session.js";
