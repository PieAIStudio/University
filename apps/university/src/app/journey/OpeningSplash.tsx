import { useCallback, useEffect, useState } from "react";
import { GameSplash } from "@pieai/swimmer-ui-kit";
import { useI18n } from "@pieai/university-ui/i18n.js";
import type { View } from "@pieai/university-core";
import {
  isSplashEntry,
  rememberSplashVisit,
  splashPoints,
  splashStorage,
  splashVisit,
} from "./splash-policy";
import "./opening-splash.css";

/** App-launch admission only. Neither a language choice nor a learning record. */
export function useOpeningAdmission(view: View) {
  const [pending, setPending] = useState(() => {
    if (typeof window === "undefined") return false;
    const navigation = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    return isSplashEntry(view, new URL(location.href), document.referrer, navigation?.type);
  });
  const enter = useCallback(() => setPending(false), []);
  return { pending, enter };
}

/** University supplies truthful claims and measured work; UIKit owns the whole screen. */
export function OpeningSplash({
  progress,
  ready,
  mode = "opening",
  onStart,
  autoStart = false,
}: {
  readonly progress: number;
  readonly ready: boolean;
  readonly mode?: "opening" | "transition";
  readonly onStart?: () => void;
  /** Native shells may opt in; the browser never guesses a native host from its user agent. */
  readonly autoStart?: boolean;
}) {
  const t = useI18n();
  const [visit] = useState(() => splashVisit(splashStorage()));
  useEffect(() => {
    if (mode === "opening") rememberSplashVisit(splashStorage(), visit);
  }, [mode, visit]);
  const points = mode === "transition" ? [splashPoints(visit)[0]!] : splashPoints(visit);
  const percent = Math.round(
    Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0)) * 100,
  );
  return (
    <GameSplash
      className={
        mode === "opening"
          ? "university-splash university-splash--opening"
          : "university-splash loading-trivia"
      }
      title="University"
      lines={points.map((point) => ({
        text: t.t(point === "why" ? "product.value.whyAi" : `product.splash.${point}`),
        highlight: t.t(`product.splash.highlight.${point}`),
      }))}
      progress={progress}
      progressLabel={t.t("product.splash.progress", { percent })}
      ready={ready}
      mode={mode}
      startLabel={t.t("product.splash.start")}
      onStart={onStart}
      autoStart={autoStart}
    />
  );
}
