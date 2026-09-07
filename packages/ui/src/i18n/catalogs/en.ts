import { messages as aiPlay } from "./learning-play-ai.en.js";
import { messages as aiWorkflow } from "./learning-play-ai-workflow.en.js";
import { messages as aiQuality } from "./learning-play-ai-quality.en.js";
import { messages as aiAgentPlay } from "./learning-play-ai-agent-play.en.js";
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
  ...aiPlay,
  ...aiWorkflow,
  ...aiQuality,
  ...aiAgentPlay,
  ...learningPlayMessages,
  ...learningPlayProgram,
  ...learningPlayExtra,
} satisfies Partial<MessageCatalog>;
