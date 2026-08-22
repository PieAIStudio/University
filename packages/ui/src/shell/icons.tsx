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

/** Medal with a ribbon — the league slot. */
export function LeagueIcon() {
  return (
    <Glyph>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M12 2.2a5.8 5.8 0 1 1 0 11.6A5.8 5.8 0 0 1 12 2.2Zm0 2.4a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8ZM8.7 13.3 6.6 21.4 12 18.6l5.4 2.8-2.1-8.1-1.6.4L12 14.4l-1.7-.7-1.6-.4Z"
      />
    </Glyph>
  );
}

/** Target — the quests slot. */
export function QuestsIcon() {
  return (
    <Glyph>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2.2a7.8 7.8 0 1 0 0 15.6A7.8 7.8 0 0 0 12 4.2Zm0 2.6a5.2 5.2 0 1 1 0 10.4A5.2 5.2 0 0 1 12 6.8Zm0 2.5a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4Z"
      />
    </Glyph>
  );
}

/** Crown — the plan/membership slot. */
export function PlanIcon() {
  return (
    <Glyph>
      <path
        fill="currentColor"
        d="M3.2 16.2 5.1 7.4l4.1 3.6L12 4.6l2.8 6.4 4.1-3.6 1.9 8.8H3.2Zm.6 1.8h16.4v2.4H3.8V18Z"
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

/** Three dots — the more slot. */
export function MoreIcon() {
  return (
    <Glyph>
      <path
        fill="currentColor"
        d="M5.5 10.4a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Zm6.5 0a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Zm6.5 0a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Z"
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

/** Gem — the credit counter. */
export function CreditIcon() {
  return (
    <Glyph>
      <path
        fill="currentColor"
        d="M7.2 3.4h9.6L21 9.4 12 21.2 3 9.4l4.2-6Zm1.1 1.7L6.2 9h11.6l-2.1-3.9H8.3Z"
      />
    </Glyph>
  );
}

/** Bolt — the energy/quota counter. */
export function EnergyIcon() {
  return (
    <Glyph>
      <path fill="currentColor" d="M13.4 2.2 6 13.4h5.3l-1.6 8.4 7.8-12.1h-5.4l1.3-7.5Z" />
    </Glyph>
  );
}
