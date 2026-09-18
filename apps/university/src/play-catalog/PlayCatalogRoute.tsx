import { PlayCatalog } from "@pieai/university-ui/play-catalog/PlayCatalog.js";
import { useI18n } from "@pieai/university-ui/i18n.js";
import "./toy-play.css";
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
  const { locale, t } = useI18n();
  return (
    <>
      <a className="toy-catalog-link" href={`/play-lab/toy-3d?lang=${locale}`}>
        {t("toy.catalogLink")}
      </a>
      <PlayCatalog sources={sources} presentation={presentation} />
    </>
  );
}
