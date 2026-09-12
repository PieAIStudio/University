import { messages as productWelcome } from "./product-welcome.en.js";
import { messages as productNavigation } from "./product-navigation.en.js";
import { messages as productBilling } from "./product-billing.en.js";
import { messages as productSave } from "./product-save.en.js";
import { messages as qualityDifficulty } from "./learning-play-quality-difficulty.en.js";
import { messages as workflowDifficulty } from "./learning-play-workflow-difficulty.en.js";
import { messages as playDifficulty } from "./learning-play-difficulty.en.js";
import { messages as qualityUsability } from "./learning-play-quality-usability.en.js";
import { messages as workflowUsability } from "./learning-play-workflow-usability.en.js";
import { messages as playUsability } from "./learning-play-usability.en.js";
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
  ...productWelcome,
  ...productNavigation,
  ...productBilling,
  ...productSave,
  ...aiPlay,
  ...aiWorkflow,
  ...aiQuality,
  ...aiAgentPlay,
  ...playUsability,
  ...playDifficulty,
  ...qualityDifficulty,
  ...workflowDifficulty,
  ...qualityUsability,
  ...workflowUsability,
  ...learningPlayMessages,
  ...learningPlayProgram,
  ...learningPlayExtra,
  "ui.world.domain.selected": "Selected",
  "ui.world.navigation.planets": "Learning planets",
  "ui.world.navigation.archipelago": "Course archipelago",
  "ui.world.navigation.island": "Course island",
} satisfies Partial<MessageCatalog>;
