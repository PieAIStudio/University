import { applyDocumentLanguage, systemLocale } from "@pieai/swimmer-i18n-kit/browser";
import { interfaceI18n, INTERFACE_LOCALES } from "./core.js";
const LOCALE_STORAGE_KEY = "university.interface-locale";
export function readLocalePreference(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const requested = new URL(window.location.href).searchParams.get("lang");
  if (requested && INTERFACE_LOCALES.includes(requested)) return requested;
  try {
    return window.localStorage.getItem(LOCALE_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}
/** Browser-owned current selection for event handlers and non-React UI helpers.
 * Node callers import core.ts and create a translator for each request instead. */
export let interfaceTranslator = interfaceI18n.translator(
  readLocalePreference() ?? systemLocale() ?? "zh-CN",
);
export function setInterfaceLocale(locale: string | undefined) {
  interfaceTranslator = interfaceI18n.translator(locale ?? "zh-CN");
  if (typeof document !== "undefined")
    applyDocumentLanguage(interfaceTranslator.locale, interfaceTranslator.direction);
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("university:locale-change"));
  return interfaceTranslator;
}
export function writeLocalePreference(locale: string): void {
  if (!INTERFACE_LOCALES.includes(locale) || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* Preference persistence is optional. */
  }
  setInterfaceLocale(locale);
}
/** Preserve course route and unrelated query fields across the host's reload. */
export function localeNavigationUrl(currentUrl: string, locale: string): string {
  if (!INTERFACE_LOCALES.includes(locale)) throw new Error("Unsupported interface locale");
  const target = new URL(currentUrl);
  target.searchParams.set("lang", locale);
  return target.href;
}
export function subscribeInterfaceLocale(notify: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("university:locale-change", notify);
  return () => window.removeEventListener("university:locale-change", notify);
}
