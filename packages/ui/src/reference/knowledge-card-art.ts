// Carry the declaration-only asset module into source-consuming typechecks;
// the production bundler removes its empty runtime module.
import "../assets.js";
/** Imported from the pinned brand package, so Vite emits only these actual
 * illustrations rather than a copied icon tree or runtime placeholder. */
import brain from "@pieai/swimmer-ui-kit/assets/game/ui/clay/phase03-clay-kit/icons/function/brain-v1.png";
import book from "@pieai/swimmer-ui-kit/assets/game/ui/clay/phase03-clay-kit/icons/function/book-v1.png";
import cloud from "@pieai/swimmer-ui-kit/assets/game/ui/clay/phase03-clay-kit/icons/function/cloud-v1.png";
import compass from "@pieai/swimmer-ui-kit/assets/game/ui/clay/phase03-clay-kit/icons/function/compass-v1.png";
import energy from "@pieai/swimmer-ui-kit/assets/game/ui/clay/phase03-clay-kit/icons/function/energy-v1.png";
import copy from "@pieai/swimmer-ui-kit/assets/game/ui/clay/phase03-clay-kit/icons/function/copy-v1.png";
import gem from "@pieai/swimmer-ui-kit/assets/game/ui/clay/phase03-clay-kit/icons/function/gem-v1.png";
import card from "@pieai/swimmer-ui-kit/assets/game/ui/clay/phase03-clay-kit/icons/function/card-v1.png";
import type { ConceptCategory } from "@pieai/university-core";

export const KNOWLEDGE_CARD_ART: Record<ConceptCategory, string> = {
  ai: brain,
  frontend: book,
  backend: cloud,
  product: compass,
  technology: energy,
  git: copy,
  design: gem,
};
export const KNOWLEDGE_CARD_BACK = card;
