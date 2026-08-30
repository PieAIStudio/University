import type { messages as sourceMessages } from "./catalogs/zh-CN.js";

export type MessageKey = keyof typeof sourceMessages;
export type MessageCatalog = Record<MessageKey, string>;
export type MessageValue = string | number | Date;
export type MessageValues = Readonly<Record<string, MessageValue>>;
