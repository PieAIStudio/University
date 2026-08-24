export {
  createUniversityBackend,
  createOnlineSupabaseClient,
  createSupabaseProgressRemoteStore,
  readSwimmerCorePublicEnv,
  SWIMMER_CORE_PUBLISHABLE_KEY_ENV,
  SWIMMER_CORE_URL_ENV,
  type BrowserEnv,
  type UniversityBackend,
} from "./browser.js";
export { bindProgressToIdentity } from "./session.js";
