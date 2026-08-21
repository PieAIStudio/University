/**
 * The mute button.
 *
 * Small, and it has to exist. A product that makes noise without an obvious
 * way to stop it is a product people mute at the operating system, which loses
 * every other sound on their machine as well.
 */
import { useState } from "react";

import { isSoundEnabled, playSound, writeSoundEnabled } from "./sound.js";

export function SoundToggle({ className }: { className?: string }) {
  const [on, setOn] = useState(isSoundEnabled);
  return (
    <button
      type="button"
      className={`sound-toggle${on ? " sound-toggle--on" : ""}${className ? ` ${className}` : ""}`}
      aria-pressed={on}
      title={on ? "关掉声音" : "打开声音"}
      aria-label={on ? "关掉声音" : "打开声音"}
      onClick={() => {
        const next = !on;
        setOn(next);
        writeSoundEnabled(next);
        // Play *after* enabling, so turning it on demonstrates what was turned
        // on. Turning it off stays silent, which is the whole request.
        if (next) playSound("ui.press");
      }}
    >
      {on ? "🔊" : "🔈"}
    </button>
  );
}
