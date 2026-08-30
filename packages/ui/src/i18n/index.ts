import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";

import { messages as enMessages } from "./catalogs/en.js";
import { messages as sourceMessages } from "./catalogs/zh-CN.js";
import type { MessageCatalog, MessageKey, MessageValues, MessageValue } from "./types.js";

export type { MessageCatalog, MessageKey, MessageValue, MessageValues } from "./types.js";

export const SOURCE_LOCALE = "zh-CN" as const;
export const ENGLISH_LOCALE = "en" as const;
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

function languageCodeOf(locale: string): string {
  return locale.split("-")[0]?.toLowerCase() ?? locale.toLowerCase();
}

/** Compare a candidate against the source catalog without mutating either. */
export function localeCompleteness(
  candidate: Partial<Record<string, string>>,
  source: MessageCatalog = sourceMessages,
): LocaleCompleteness {
  const sourceKeys = new Set(Object.keys(source));
  const candidateKeys = new Set(Object.keys(candidate));
  const missingKeys = [...sourceKeys].filter((key): key is MessageKey => !candidateKeys.has(key));
  const extraKeys = [...candidateKeys].filter((key) => !sourceKeys.has(key));
  missingKeys.sort((left, right) => left.localeCompare(right));
  extraKeys.sort((left, right) => left.localeCompare(right));
  return { complete: missingKeys.length === 0 && extraKeys.length === 0, missingKeys, extraKeys };
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
  if (!requestedLocale) return SOURCE_LOCALE;
  const normalized = requestedLocale.replaceAll("_", "-").toLowerCase();
  const exact = Object.keys(registry).find((locale) => locale.toLowerCase() === normalized);
  if (exact && isLocaleComplete(registry[exact]!.messages)) return exact;

  const requestedLanguage = languageCodeOf(normalized);
  const languageMatch = Object.keys(registry).find(
    (locale) =>
      languageCodeOf(locale) === requestedLanguage && isLocaleComplete(registry[locale]!.messages),
  );
  return languageMatch ?? SOURCE_LOCALE;
}

export function resolveLocale(
  requestedLocale: string | undefined,
  registry: LocaleRegistry = LOCALE_REGISTRY,
): string {
  return matchingLocale(requestedLocale, registry);
}

function browserLocale(): string | undefined {
  return typeof navigator === "undefined" ? undefined : navigator.language;
}

function formatValue(locale: string, value: MessageValue): string {
  if (value instanceof Date) return new Intl.DateTimeFormat(locale).format(value);
  if (typeof value === "number") return new Intl.NumberFormat(locale).format(value);
  return value;
}

function interpolate(locale: string, message: string, values: MessageValues | undefined): string {
  if (!values) return message;
  return message.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (match, name: string) => {
    const value = values[name];
    return value === undefined ? match : formatValue(locale, value);
  });
}

export function createTranslator(
  requestedLocale: string | undefined = browserLocale(),
  registry: LocaleRegistry = LOCALE_REGISTRY,
): Translator {
  const locale = matchingLocale(requestedLocale, registry);
  const definition = registry[locale] ?? registry[SOURCE_LOCALE]!;
  return {
    locale,
    direction: definition.direction,
    t(key, values) {
      const message = definition.messages[key] ?? sourceMessages[key];
      if (message === undefined) {
        throw new Error(`Missing source message: ${String(key)}`);
      }
      return interpolate(locale, message, values);
    },
    number(value, options) {
      return new Intl.NumberFormat(locale, options).format(value);
    },
    date(value, options) {
      const dateValue = value instanceof Date ? value : new Date(value);
      return new Intl.DateTimeFormat(locale, options).format(dateValue);
    },
    plural(count, forms, values) {
      const category = new Intl.PluralRules(locale).select(count) as PluralCategory;
      const key = forms[category] ?? forms.other;
      return interpolate(locale, definition.messages[key] ?? sourceMessages[key]!, {
        count,
        ...values,
      });
    },
  };
}

let activeTranslator = createTranslator();

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
  document.documentElement.lang = translator.locale;
  document.documentElement.dir = translator.direction;
}

const I18nContext = createContext<Translator>(activeTranslator);

export function I18nProvider({
  locale,
  children,
}: {
  readonly locale?: string;
  readonly children: ReactNode;
}) {
  const translator = useMemo(() => createTranslator(locale), [locale]);
  useEffect(() => {
    activeTranslator = translator;
    applyLocaleToDocument(translator);
  }, [translator]);
  return createElement(I18nContext.Provider, { value: translator }, children);
}

export function useI18n(): Translator {
  return useContext(I18nContext);
}

/** Testable document hook for shells that need to apply a locale without a provider. */
export function applyDocumentLocale(requestedLocale?: string): Translator {
  const translator = setActiveLocale(requestedLocale);
  applyLocaleToDocument(translator);
  return translator;
}
