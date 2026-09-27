import { createI18n } from "@pieai/swimmer-i18n-kit";
import source from "./catalogs/zh-CN/messages.json" with { type: "json" };
import english from "./catalogs/en/messages.json" with { type: "json" };
import type { MessageContracts } from "./contracts.js";
export const coreI18n = createI18n<typeof source, MessageContracts>({
  sourceLocale: "zh-CN",
  source,
  catalogs: { en: english },
});
export type CoreMessageKey = keyof MessageContracts;
export type CorePlainMessageKey = {
  [K in CoreMessageKey]: keyof MessageContracts[K] extends never ? K : never;
}[CoreMessageKey];
