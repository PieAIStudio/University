export {
  createUniversityBackend,
  createOnlineSupabaseClient,
  createSupabaseProgressRemoteStore,
  readSwimmerBackendPublicEnv,
  readSwimmerCorePublicEnv,
  SWIMMER_BACKEND_PUBLISHABLE_KEY_ENV,
  SWIMMER_BACKEND_SUPABASE_URL_ENV,
  SWIMMER_CORE_PUBLISHABLE_KEY_ENV,
  SWIMMER_CORE_URL_ENV,
  type BrowserEnv,
  type UniversityBackend,
} from "./browser.js";
export { bindProgressToIdentity } from "./session.js";
