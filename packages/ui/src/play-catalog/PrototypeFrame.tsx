import { useEffect, useMemo, useRef, useState } from "react";
import { GameButton, GameHudActions } from "@pieai/swimmer-ui-kit";
import { translate as t } from "../i18n/index.js";
import { isSoundEnabled, writeSoundEnabled } from "../sound/index.js";
import { buildPrototypeDocument } from "./prototype-document.js";

export function PrototypeFrame({
  source,
  presentation,
  entryId,
  title,
}: {
  readonly source: string;
  readonly presentation: string;
  readonly entryId?: string;
  readonly title: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(() => !isSoundEnabled());
  const [loaded, setLoaded] = useState(0);
  const srcDoc = useMemo(
    () => buildPrototypeDocument(source, presentation, entryId),
    [source, presentation, entryId],
  );
  useEffect(() => {
    const target = frame.current?.contentWindow;
    const update = () => {
      const style = getComputedStyle(document.documentElement);
      const tokens: Record<string, string> = {};
      for (let index = 0; index < style.length; index++) {
        const key = style.item(index);
        if (key.startsWith("--game-ui-")) tokens[key] = style.getPropertyValue(key).trim();
      }
      target?.postMessage(
        {
          type: "university-prototype-settings",
          paused,
          muted,
          theme: document.documentElement.dataset.gameUiTheme === "night" ? "night" : "light",
          tokens,
        },
        "*",
      );
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-game-ui-theme", "style"],
    });
    return () => observer.disconnect();
  }, [paused, muted, loaded]);
  useEffect(() => {
    const element = frame.current;
    const target = element?.contentWindow;
    // StrictMode replays effects without removing this iframe. Sending a
    // terminal stop during that replay races srcdoc startup and can leave a
    // visible game with permanently disabled input. Stop only a removed frame.
    return () =>
      queueMicrotask(() => {
        if (element && !element.isConnected)
          target?.postMessage({ type: "university-prototype-settings", stop: true }, "*");
      });
  }, []);
  return (
    <div className="play-catalog__prototype">
      <GameHudActions label={t("gallery.controls")}>
        <GameButton
          sound={false}
          static
          variant="secondary"
          onClick={() => setPaused(!paused)}
          aria-pressed={paused}
        >
          {t(paused ? "gallery.resume" : "gallery.pause")}
        </GameButton>
        <GameButton
          sound={false}
          static
          variant="ghost"
          aria-pressed={!muted}
          onClick={() => {
            writeSoundEnabled(muted);
            setMuted(!muted);
          }}
        >
          {t(muted ? "gallery.unmute" : "gallery.mute")}
        </GameButton>
      </GameHudActions>
      {paused ? <p role="status">{t("gallery.paused")}</p> : null}
      <iframe
        ref={frame}
        title={title}
        srcDoc={srcDoc}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        allow="camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; clipboard-read 'none'; clipboard-write 'none'"
        onLoad={() => setLoaded((value) => value + 1)}
      />
    </div>
  );
}
