import { useCallback, useEffect, useRef, useState } from "react";
import type { IdentityStatus, ProgressDocument, View } from "@pieai/university-core";
import {
  isWelcomeEntry,
  readWelcomeAcknowledged,
  shouldShowWelcome,
  writeWelcomeAcknowledged,
} from "./welcome-policy.js";
import { trackEvent } from "../analytics/productAnalytics.js";

export function useWelcome(
  view: View,
  progress: ProgressDocument,
  identityKind: IdentityStatus["kind"],
) {
  const [entryEligible] = useState(
    () => typeof window !== "undefined" && isWelcomeEntry(new URL(window.location.href)),
  );
  const [acknowledged, setAcknowledged] = useState(readWelcomeAcknowledged);
  const shown = useRef(false);
  const visible =
    view.kind === "world" &&
    shouldShowWelcome({ entryEligible, acknowledged, identityKind, progress });
  useEffect(() => {
    if (visible && !shown.current) {
      shown.current = true;
      trackEvent({ name: "welcome_shown" });
    }
  }, [visible]);
  useEffect(() => {
    // Native links can remount App. An already visited lesson must not turn
    // into a first-arrival interruption when its learner returns to the map.
    if (view.kind !== "world") {
      writeWelcomeAcknowledged();
      setAcknowledged(true);
    }
  }, [view.kind]);
  const dismiss = useCallback((destination: "lesson" | "map" | "account") => {
    setAcknowledged(true);
    writeWelcomeAcknowledged();
    trackEvent({ name: "welcome_exited", destination });
  }, []);
  return { visible, dismiss };
}
