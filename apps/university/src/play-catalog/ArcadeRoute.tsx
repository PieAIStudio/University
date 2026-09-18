import { useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { useI18n } from "@pieai/university-ui/i18n.js";
import { TOY_MODES, type ToyMode } from "@pieai/university-world/toy-play.js";
import { ArcadePlayer } from "./ArcadePlayer.js";
import "./arcade3d.css";

export default function ArcadeRoute() {
  const { t, locale } = useI18n();
  const [mode, setMode] = useState<ToyMode>(() => {
    const requested = new URLSearchParams(location.search).get("game");
    return TOY_MODES.find((m) => m === requested) ?? "invaders";
  });
  return (
    <section className="arcade3d__standalone">
      <a href={`/play-lab/catalog?group=three&lang=${locale}`}>{t("arcade3d.catalog")}</a>
      <h1>{t("arcade3d.title")}</h1>
      <p>{t("arcade3d.intro")}</p>
      <nav className="arcade3d__modes" aria-label={t("arcade3d.title")}>
        {TOY_MODES.map((m) => (
          <GameButton
            key={m}
            static
            sound={false}
            variant={mode === m ? "primary" : "secondary"}
            aria-pressed={mode === m}
            onClick={() => {
              setMode(m);
              const url = new URL(location.href);
              url.searchParams.set("game", m);
              history.replaceState(history.state, "", url);
            }}
          >
            {t(`arcade3d.${m}`)}
          </GameButton>
        ))}
      </nav>
      <ArcadePlayer key={mode} mode={mode} />
    </section>
  );
}
