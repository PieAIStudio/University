import { PlayCatalog } from "@pieai/university-ui/play-catalog/PlayCatalog.js";
import blocks from "../../../../docs/reference/interaction-prototype/blocks.html?raw";
import arcade from "../../../../docs/reference/interaction-prototype/arcade.html?raw";
import index from "../../../../docs/reference/interaction-prototype/index.html?raw";
import remade from "../../../../docs/reference/interaction-prototype/remade.html?raw";
import compare from "../../../../docs/reference/interaction-prototype/compare.html?raw";
import presentation from "../../../../docs/reference/interaction-prototype/presentation.css?raw";

// Vite bundles committed source into this lazy route in both modes. No prototype
// URL, second server, course producer, account port or remote code loader exists.
const sources = { blocks, arcade, index, remade, compare };
export default function PlayCatalogRoute() {
  return <PlayCatalog sources={sources} presentation={presentation} />;
}
