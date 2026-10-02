import type { ReactNode } from "react";

/**
 * Inline glyphs for the shell. ClayIcon resolves to `/assets/game/ui/clay/...`
 * which neither app serves, and those PNGs cannot take an active-state tint;
 * `currentColor` can.
 */

function Glyph({ children }: { readonly children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** House — the learn/home slot. */
export function HomeIcon() {
  return (
    <Glyph>
      <path
        fill="currentColor"
        d="M12 3.15 2.7 10.9a1 1 0 0 0 .65 1.75H5.5V20a1 1 0 0 0 1 1h3.75v-6.35h3.5V21H17.5a1 1 0 0 0 1-1v-7.35h2.15a1 1 0 0 0 .65-1.75L12 3.15Z"
      />
    </Glyph>
  );
}

/** Open book — the codex/library slot. */
export function CodexIcon() {
  return (
    <Glyph>
      <path
        fill="currentColor"
        d="M4.2 4.4h6.7c.6 0 1.1.3 1.4.8L12 5.7l-.3-.5c.3-.5.8-.8 1.4-.8h6.7c.9 0 1.6.7 1.6 1.6v12.2c0 .9-.7 1.6-1.6 1.6h-6.2L12 18.6l-1.6 1.2H4.2c-.9 0-1.6-.7-1.6-1.6V6c0-.9.7-1.6 1.6-1.6Zm.9 1.7v11.5h4.7l1.4-1.1V6.1H5.1Zm8.8 0v10.4l1.4 1.1h4.7V6.1H13.9Z"
      />
    </Glyph>
  );
}

/** Two stacked cards — the practice slot. */
export function PracticeIcon() {
  return (
    <Glyph>
      <path
        fill="currentColor"
        d="M8.2 4.2h10.3A2.5 2.5 0 0 1 21 6.7v.9h-1.7V6.7c0-.45-.35-.8-.8-.8H8.2V4.2Zm-2.4 3.2h10.3A2.5 2.5 0 0 1 18.6 9.9v9.4a2.5 2.5 0 0 1-2.5 2.5H5.8A2.5 2.5 0 0 1 3.3 19.3V9.9a2.5 2.5 0 0 1 2.5-2.5Z"
      />
    </Glyph>
  );
}

/** Person — the profile slot. */
export function ProfileIcon() {
  return (
    <Glyph>
      <path
        fill="currentColor"
        d="M12 3.2a4.4 4.4 0 1 1 0 8.8 4.4 4.4 0 0 1 0-8.8ZM5.1 20.7c.5-3.7 3.3-6 6.9-6s6.4 2.3 6.9 6a1.1 1.1 0 0 1-1.1 1.3H6.2a1.1 1.1 0 0 1-1.1-1.3Z"
      />
    </Glyph>
  );
}

/** Speech bubble — a note about this screen, not a destination. */
export function FeedbackIcon() {
  return (
    <Glyph>
      <path
        fill="currentColor"
        d="M5.2 4.4h13.6A2.6 2.6 0 0 1 21.4 7v7.4a2.6 2.6 0 0 1-2.6 2.6h-6.2L7.4 20.8v-3.8H5.2A2.6 2.6 0 0 1 2.6 14.4V7a2.6 2.6 0 0 1 2.6-2.6Z"
      />
    </Glyph>
  );
}

/** Floating island — the project/switcher counter. */
export function IslandIcon() {
  return (
    <Glyph>
      <path
        fill="currentColor"
        d="M12 4.2 15.6 11h4.6L17 17.2H7L3.8 11h4.6L12 4.2Zm-8.4 14c2.1 1.2 4.6 1.3 8.4.1 3.8 1.2 6.3 1.1 8.4-.1v1.7c-2.2 1.3-5 1.5-8.4.2-3.4 1.3-6.2 1.1-8.4-.2V18.2Z"
      />
    </Glyph>
  );
}

/** Flame — the streak counter. */
export function StreakIcon() {
  return (
    <Glyph>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M12.2 2s5.8 5.6 5.8 11.1A6 6 0 0 1 7.4 9.6C9.2 9.8 10.6 7.8 12.2 2Zm-.3 8.4c-1.4 2-2.4 3.3-2.4 5.1a2.7 2.7 0 0 0 5.4 0c0-1.6-.9-3.2-3-5.1Z"
      />
    </Glyph>
  );
}
