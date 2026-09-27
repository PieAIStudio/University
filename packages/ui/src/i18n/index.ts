import { checkCompleteness } from "@pieai/swimmer-i18n-kit";
import { applyDocumentLanguage, systemLocale } from "@pieai/swimmer-i18n-kit/browser";
import { sharedRuntime } from "./runtime.js";
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { messages as enMessages } from "./catalogs/en.js";
import { messages as sourceMessages } from "./catalogs/zh-CN.js";
import type { MessageCatalog, MessageKey, MessageValues, MessageValue } from "./types.js";

export type { MessageCatalog, MessageKey, MessageValue, MessageValues } from "./types.js";

export const SOURCE_LOCALE = "zh-CN" as const;
export const ENGLISH_LOCALE = "en" as const;
const LOCALE_STORAGE_KEY = "university.interface-locale";
export type LocaleDirection = "ltr" | "rtl";

export interface LocaleDefinition {
  readonly direction: LocaleDirection;
  readonly displayNameKey: MessageKey;
  readonly messages: Partial<MessageCatalog>;
}

export type LocaleRegistry = Readonly<Record<string, LocaleDefinition>>;

export const LOCALE_REGISTRY = {
  [SOURCE_LOCALE]: {
    direction: "ltr",
    displayNameKey: "locale.zhCN.name",
    messages: sourceMessages,
  },
  [ENGLISH_LOCALE]: {
    direction: "ltr",
    displayNameKey: "locale.en.name",
    messages: enMessages,
  },
} as const satisfies LocaleRegistry;

export interface LocaleCompleteness {
  readonly complete: boolean;
  readonly missingKeys: readonly MessageKey[];
  readonly extraKeys: readonly string[];
}

const PLURAL_CATEGORIES = ["zero", "one", "two", "few", "many", "other"] as const;
export type PluralCategory = (typeof PLURAL_CATEGORIES)[number];

export interface Translator {
  readonly locale: string;
  readonly direction: LocaleDirection;
  t<K extends MessageKey>(key: K, values?: MessageValues): string;
  number(value: number, options?: Intl.NumberFormatOptions): string;
  date(value: Date | number | string, options?: Intl.DateTimeFormatOptions): string;
  plural<K extends MessageKey>(
    count: number,
    forms: Readonly<Partial<Record<PluralCategory, K>> & { other: K }>,
    values?: MessageValues,
  ): string;
}

/** Compare a candidate against the source catalog without mutating either. */
export function localeCompleteness(
  candidate: Partial<Record<string, string>>,
  source: MessageCatalog = sourceMessages,
): LocaleCompleteness {
  return checkCompleteness(source, candidate) as LocaleCompleteness;
}

export function isLocaleComplete(
  candidate: Partial<Record<string, string>>,
  source: MessageCatalog = sourceMessages,
): boolean {
  return localeCompleteness(candidate, source).complete;
}

/** Only complete locales can be presented as a language choice. */
export function availableLocales(registry: LocaleRegistry = LOCALE_REGISTRY): readonly string[] {
  return Object.entries(registry)
    .filter(([, definition]) => isLocaleComplete(definition.messages))
    .map(([locale]) => locale)
    .sort((left, right) => left.localeCompare(right));
}

function matchingLocale(requestedLocale: string | undefined, registry: LocaleRegistry): string {
  return sharedRuntime(registry).resolve(requestedLocale ?? SOURCE_LOCALE);
}

export function resolveLocale(
  requestedLocale: string | undefined,
  registry: LocaleRegistry = LOCALE_REGISTRY,
): string {
  return matchingLocale(requestedLocale, registry);
}

function browserLocale(): string | undefined {
  return systemLocale();
}

export function readLocalePreference(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const requested = new URL(window.location.href).searchParams.get("lang");
  if (requested === SOURCE_LOCALE || requested === ENGLISH_LOCALE) return requested;
  try {
    return window.localStorage.getItem(LOCALE_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function writeLocalePreference(locale: string): void {
  if (typeof window === "undefined") return;
  if (!availableLocales().includes(locale)) return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage is optional. The explicit URL choice can survive a reload.
  }
  setActiveLocale(locale);
  window.dispatchEvent(new CustomEvent("university:locale-change", { detail: locale }));
}

/** A language switch keeps the course/settings route and every unrelated query. */
export function localeNavigationUrl(currentUrl: string, locale: string): string {
  if (locale !== SOURCE_LOCALE && locale !== ENGLISH_LOCALE) {
    throw new Error("Unsupported interface locale");
  }
  const target = new URL(currentUrl);
  target.searchParams.set("lang", locale);
  return target.href;
}

function formatValue(locale: string, value: MessageValue): string {
  if (value instanceof Date) return new Intl.DateTimeFormat(locale).format(value);
  if (typeof value === "number") return new Intl.NumberFormat(locale).format(value);
  return value;
}

export function createTranslator(
  requestedLocale: string | undefined = browserLocale(),
  registry: LocaleRegistry = LOCALE_REGISTRY,
): Translator {
  const runtime = sharedRuntime(registry);
  const shared = runtime.translator(requestedLocale ?? SOURCE_LOCALE);
  const translateMessage = (key: MessageKey, values?: MessageValues) => {
    // Existing University callers use preformatted {{name}} interpolation.
    const original = registry[shared.locale]?.messages[key] ?? sourceMessages[key];
    const parameters: Record<string, string> = {};
    for (const match of original?.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g) ?? []) {
      parameters[match[1]!] = match[0];
    }
    for (const [name, value] of Object.entries(values ?? {})) {
      parameters[name] = formatValue(shared.locale, value);
    }
    return shared.t(key, parameters);
  };
  return {
    locale: shared.locale,
    direction: shared.direction,
    t: translateMessage,
    number: shared.number,
    date: shared.date,
    plural(count, forms, values) {
      const category = new Intl.PluralRules(shared.locale).select(count) as PluralCategory;
      return translateMessage(forms[category] ?? forms.other, { count, ...values });
    },
  };
}

let activeTranslator = createTranslator(readLocalePreference() ?? browserLocale());

export function setActiveLocale(requestedLocale: string | undefined): Translator {
  activeTranslator = createTranslator(requestedLocale);
  return activeTranslator;
}

export function activeLocale(): string {
  return activeTranslator.locale;
}

/** Imperative access for pure helpers and data tables outside React render. */
export function translate<K extends MessageKey>(key: K, values?: MessageValues): string {
  return activeTranslator.t(key, values);
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return activeTranslator.number(value, options);
}

export function formatDate(
  value: Date | number | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  return activeTranslator.date(value, options);
}

export function formatPlural<K extends MessageKey>(
  count: number,
  forms: Readonly<Partial<Record<PluralCategory, K>> & { other: K }>,
  values?: MessageValues,
): string {
  return activeTranslator.plural(count, forms, values);
}

function applyLocaleToDocument(translator: Translator): void {
  if (typeof document === "undefined") return;
  applyDocumentLanguage(translator.locale, translator.direction);
}

const I18nContext = createContext<Translator | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  readonly locale?: string;
  readonly children: ReactNode;
}) {
  const [storedLocale, setStoredLocale] = useState(() => readLocalePreference());
  useEffect(() => {
    const onChange = (event: Event) => setStoredLocale((event as CustomEvent<string>).detail);
    window.addEventListener("university:locale-change", onChange);
    return () => window.removeEventListener("university:locale-change", onChange);
  }, []);
  const translator = useMemo(
    () => createTranslator(locale ?? storedLocale ?? browserLocale()),
    [locale, storedLocale],
  );
  useEffect(() => {
    activeTranslator = translator;
    applyLocaleToDocument(translator);
  }, [translator]);
  return createElement(I18nContext.Provider, { value: translator }, children);
}

export function useI18n(): Translator {
  return useContext(I18nContext) ?? activeTranslator;
}

/** Testable document hook for shells that need to apply a locale without a provider. */
export function applyDocumentLocale(requestedLocale?: string): Translator {
  const translator = setActiveLocale(requestedLocale);
  applyLocaleToDocument(translator);
  return translator;
}
