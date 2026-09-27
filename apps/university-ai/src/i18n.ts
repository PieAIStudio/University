import { AsyncLocalStorage } from "node:async_hooks";
import { createI18n } from "@pieai/swimmer-i18n-kit";
import source from "./catalogs/zh-CN/messages.json" with { type: "json" };
import type { MessageContracts } from "./i18n-contracts.js";
/** Service copy is independent from browser and course catalogs. Only complete locales resolve. */
export const serviceI18n = createI18n<typeof source, MessageContracts>({
  sourceLocale: "zh-CN",
  source,
  catalogs: {},
});
export const serviceLocaleContext = new AsyncLocalStorage<
  ReturnType<typeof serviceI18n.translator>
>();
const sourceTranslator = serviceI18n.translator("zh-CN");
export const serviceTranslator = () => serviceLocaleContext.getStore() ?? sourceTranslator;
