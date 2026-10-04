import { messages as menuDoors } from "./menu-doors.en.js";
import { messages as mapNavigation } from "./map-navigation.en.js";
import { messages as mapNodes } from "./map-nodes.en.js";
import { messages as primm } from "./primm.en.js";
import { messages as lessonReader } from "./lesson-reader.en.js";
import { messages as propFinish } from "./prop-finish.en.js";
import { messages as playGallery } from "./play-gallery.en.js";
import { messages as arcade3d } from "./arcade-3d.en.js";
import { messages as gameKit } from "./game-kit.en.js";
import { messages as accountClosure } from "./account-closure.en.js";
import { messages as gradingCopy } from "./grading-copy.en.js";
import { messages as worldNavigation } from "./world-navigation.en.js";
import { messages as readingSettings } from "./reading-settings.en.js";
import { messages as productWelcome } from "./product-welcome.en.js";
import { messages as journeyReturn } from "./journey-return.en.js";
import { messages as knowledgeAlbum } from "./knowledge-album.en.js";
import { messages as cosmetics } from "./cosmetics.en.js";
import { messages as house } from "./house.en.js";
import { messages as coreMessages } from "./en-core.js";
import { messages as realitySources } from "./reality-sources.en.js";
import { messages as accountFailures } from "./account-failures.en.js";
import { messages as productNavigation } from "./product-navigation.en.js";
import { messages as productBilling } from "./product-billing.en.js";
import { messages as productSupport } from "./product-support.en.js";
import { messages as productSave } from "./product-save.en.js";
import { messages as playDifficulty } from "./learning-play-difficulty.en.js";
import { messages as playUsability } from "./learning-play-usability.en.js";
import { messages as playSort } from "./learning-play-sort.en.js";
import { messages as aiPlay } from "./learning-play-ai.en.js";
import { messages as learningPlayMessages } from "./learning-play.en.js";
import type { MessageCatalog } from "../types.js";

/**
 * The complete English learner interface. Completeness is checked against
 * the source catalog; authoring-only terminology lives in the same catalog
 * so switching modes does not silently switch language.
 */
import { messages as purpose3d } from "./purpose-3d.en.js";
export const messages = {
  ...menuDoors,
  ...mapNavigation,
  ...mapNodes,
  ...primm,
  ...lessonReader,
  ...purpose3d,
  ...arcade3d,
  ...gameKit,
  ...playGallery,
  ...propFinish,
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
  ...journeyReturn,
  ...knowledgeAlbum,
  ...cosmetics,
  ...house,
  ...productNavigation,
  ...productBilling,
  ...productSupport,
  ...productSave,
  ...aiPlay,
  ...playUsability,
  ...playSort,
  ...playDifficulty,
  ...learningPlayMessages,
  "ui.world.domain.selected": "Selected",
  "ui.world.navigation.planets": "Learning planets",
  "ui.world.navigation.archipelago": "Course archipelago",
  "ui.world.navigation.island": "Course island",
} satisfies Partial<MessageCatalog>;
