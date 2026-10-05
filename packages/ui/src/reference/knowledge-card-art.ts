// Carry the declaration-only asset module into source-consuming typechecks;
// the production bundler removes its empty runtime module.
import "../assets.js";
/** Imported from the pinned brand package, so Vite emits only these actual
 * illustrations rather than a copied icon tree or runtime placeholder. */
const brain = new URL("./assets/brain-v1.png", import.meta.url).href;
const book = new URL("./assets/book-v1.png", import.meta.url).href;
const cloud = new URL("./assets/cloud-v1.png", import.meta.url).href;
const compass = new URL("./assets/compass-v1.png", import.meta.url).href;
const energy = new URL("./assets/energy-v1.png", import.meta.url).href;
const copy = new URL("./assets/copy-v1.png", import.meta.url).href;
const gem = new URL("./assets/gem-v1.png", import.meta.url).href;
const card = new URL("./assets/card-v1.png", import.meta.url).href;
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
