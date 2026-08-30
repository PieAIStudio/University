import type { MessageCatalog } from "../types.js";

/**
 * Translation scaffold only. An incomplete locale is intentionally not
 * selectable; keeping this file empty makes the work still visible to the
 * completeness gate without showing a half-translated product.
 */
export const messages = {} satisfies Partial<MessageCatalog>;
