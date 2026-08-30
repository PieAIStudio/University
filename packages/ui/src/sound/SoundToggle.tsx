/**
 * The mute button.
 *
 * Small, and it has to exist. A product that makes noise without an obvious
 * way to stop it is a product people mute at the operating system, which loses
 * every other sound on their machine as well.
 */
import { translate } from "../i18n/index.js";
import { useEffect, useState } from "react";
import type { ProgressPort } from "@pieai/university-core";

import { isSoundEnabled, playSound, writeSoundEnabled } from "./sound.js";

export function SoundToggle({
  className,
  progress,
}: {
  readonly className?: string;
  readonly progress?: ProgressPort;
}) {
  const [on, setOn] = useState(
    () => progress?.accountData().preferences.soundEnabled ?? isSoundEnabled(),
  );
  useEffect(() => {
    if (!progress) return;
    return progress.subscribe(() => {
      const next = progress.accountData().preferences.soundEnabled;
      setOn(next);
      writeSoundEnabled(next);
    });
  }, [progress]);
  return (
    <button
      type="button"
      className={`sound-toggle${on ? " sound-toggle--on" : ""}${className ? ` ${className}` : ""}`}
      aria-pressed={on}
      title={
        on
          ? translate("ui.sound.soundToggle.copy.关掉声音")
          : translate("ui.sound.soundToggle.copy.打开声音")
      }
      aria-label={
        on
          ? translate("ui.sound.soundToggle.copy.关掉声音")
          : translate("ui.sound.soundToggle.copy.打开声音")
      }
      onClick={() => {
        const next = !on;
        setOn(next);
        writeSoundEnabled(next);
        if (progress) {
          progress.setAccountPreferences({
            ...progress.accountData().preferences,
            soundEnabled: next,
          });
        }
        // Play *after* enabling, so turning it on demonstrates what was turned
        // on. Turning it off stays silent, which is the whole request.
        if (next) playSound("ui.press");
      }}
    >
      {on ? "🔊" : "🔈"}
    </button>
  );
}
