import { messages as learningPlayProgram } from "./learning-play-program.en.js";
import { messages as learningPlayExtra } from "./learning-play-extra.en.js";
import { messages as learningPlayMessages } from "./learning-play.en.js";
import type { MessageCatalog } from "../types.js";

/**
 * Translation scaffold only. An incomplete locale is intentionally not
 * selectable; keeping this file empty makes the work still visible to the
 * completeness gate without showing a half-translated product.
 */
export const messages = {
  ...learningPlayMessages,
  ...learningPlayProgram,
  ...learningPlayExtra,
} satisfies Partial<MessageCatalog>;
