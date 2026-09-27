export { interfaceI18n, INTERFACE_LOCALES } from "./core.js";
export type { InterfaceTranslator, MessageKey, MessageCatalog } from "./core.js";
export {
  interfaceTranslator,
  setInterfaceLocale,
  readLocalePreference,
  writeLocalePreference,
  localeNavigationUrl,
} from "./browser.js";
export { InterfaceProvider, InterfaceLanguageProvider, useI18n } from "./react.js";
