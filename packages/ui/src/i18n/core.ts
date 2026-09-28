import { createI18n } from "@pieai/swimmer-i18n-kit";
import { messages as source } from "./catalogs/zh-CN.js";
import { messages as english } from "./catalogs/en.js";
import type { MessageContracts } from "./contracts.js";

/** Product catalogs only. Safe for request-scoped Node mail/grading translators. */
export const interfaceI18n = createI18n<typeof source, MessageContracts>({
  sourceLocale: "zh-CN",
  defaultLocale: "en",
  source,
  catalogs: { en: english },
});
// I18nKit 0.2: `completeness` is key coverage only; a menu offers what is selectable.
export const INTERFACE_LOCALES = ["zh-CN", "en"].filter(
  (locale) => interfaceI18n.catalogStatus(locale).selectable,
);
export type InterfaceTranslator = ReturnType<typeof interfaceI18n.translator>;
export type { MessageKey, MessageCatalog } from "./types.js";
