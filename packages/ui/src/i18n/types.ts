import type { messages as sourceMessages } from "./catalogs/zh-CN.js";
export type MessageKey = keyof typeof sourceMessages;
export type MessageCatalog = Record<MessageKey, string>;

import type { MessageContracts } from "./contracts.js";
/** Keys whose ICU messages require no interpolation values. */
export type PlainMessageKey = {
  [K in MessageKey]: keyof MessageContracts[K] extends never ? K : never;
}[MessageKey];
