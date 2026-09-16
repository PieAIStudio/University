import { messages as accountClosure } from "./account-closure.en.js";
import { messages as gradingCopy } from "./grading-copy.en.js";
import { messages as worldNavigation } from "./world-navigation.en.js";
import { messages as readingSettings } from "./reading-settings.en.js";
import { messages as productWelcome } from "./product-welcome.en.js";
import { messages as coreMessages } from "./en-core.js";
import { messages as realitySources } from "./reality-sources.en.js";
import { messages as accountFailures } from "./account-failures.en.js";
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
 * The complete English learner interface. Completeness is checked against
 * the source catalog; authoring-only terminology lives in the same catalog
 * so switching modes does not silently switch language.
 */
export const messages = {
  ...accountClosure,
  ...worldNavigation,
  ...readingSettings,
  ...gradingCopy,
  ...accountFailures,
  "locale.zhCN.nativeName": "简体中文",
  ...coreMessages,
  "product.settings.interfaceLanguage": "Interface language",
  ...realitySources,
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
