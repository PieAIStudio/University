import { useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { useI18n } from "@pieai/university-ui/i18n.js";
import { THREE_GAMES, type ThreeGame } from "@pieai/university-ui/play-catalog/three-games.js";
import { ThreePlayer } from "./ThreePlayer.js";
import "./arcade3d.css";

export default function ArcadeRoute() {
  const { t, locale } = useI18n();
  const [mode, setMode] = useState<ThreeGame>(() => {
    const requested = new URLSearchParams(location.search).get("game");
    return THREE_GAMES.find((m) => m === requested) ?? "sky-invaders";
  });
  return (
    <section className="arcade3d__standalone">
      <a href={`/play-lab/catalog?group=three&lang=${locale}`}>{t("arcade3d.catalog")}</a>
      <h1>{t("arcade3d.title")}</h1>
      <p>{t("arcade3d.intro")}</p>
      <nav className="arcade3d__modes" aria-label={t("arcade3d.title")}>
        {THREE_GAMES.map((m) => (
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
      <p>
        {t(
          ["invaders", "stack", "cloze-tetris"].includes(mode)
            ? "gallery.three.retained"
            : "gallery.three.new",
        )}
      </p>
      <ThreePlayer key={mode} mode={mode} />
    </section>
  );
}
