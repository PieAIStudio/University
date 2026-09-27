import { createI18n, LANGUAGES, type LanguageDefinition } from "@pieai/swimmer-i18n-kit";
import { messages as source } from "./catalogs/zh-CN.js";
import type { LocaleRegistry } from "./index.js";

/** Legacy text conversion only; new catalogs should use ICU directly. */
export function legacyMessageToIcu(message: string): string {
  const literal = (text: string) =>
    text.replaceAll("'", "''").replace(/[{}]/g, (char) => `'${char}'`);
  let offset = 0;
  let result = "";
  for (const match of message.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)) {
    result += literal(message.slice(offset, match.index)) + `{${match[1]}}`;
    offset = match.index + match[0].length;
  }
  return result + literal(message.slice(offset));
}

const convert = (catalog: Readonly<Partial<Record<string, string>>>) =>
  Object.fromEntries(
    Object.entries(catalog)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([key, value]) => [key, legacyMessageToIcu(value)]),
  );
const sourceCatalog = convert(source);
function build(registry: LocaleRegistry) {
  const languages: Record<string, LanguageDefinition> = { ...LANGUAGES };
  for (const [locale, definition] of Object.entries(registry)) {
    languages[locale] = {
      nativeName: locale,
      direction: definition.direction,
      fallback: ["en", "zh-CN"],
      status: "active",
    };
  }
  return createI18n({
    sourceLocale: "zh-CN",
    defaultLocale: "en",
    source: sourceCatalog,
    catalogs: Object.fromEntries(
      Object.entries(registry).map(([locale, definition]) => [
        locale,
        convert(definition.messages),
      ]),
    ),
    registry: languages,
  });
}
const instances = new WeakMap<LocaleRegistry, ReturnType<typeof build>>();
export function sharedRuntime(registry: LocaleRegistry) {
  let instance = instances.get(registry);
  if (!instance) {
    instance = build(registry);
    instances.set(registry, instance);
  }
  return instance;
}
