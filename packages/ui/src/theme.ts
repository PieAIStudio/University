import { translate } from "./i18n/index.js";
import type { ThemePreference } from "@pieai/university-core";

export type ResolvedTheme = "light" | "dark";

export const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";

export const THEME_PREFERENCE_OPTIONS = [
  {
    id: "light",
    label: translate("ui.theme.copy.浅色"),
    description: translate("ui.theme.copy.暖色纸面-适合明亮环境"),
  },
  {
    id: "dark",
    label: translate("ui.theme.copy.深色"),
    description: translate("ui.theme.copy.深色纸面-适合昏暗环境"),
  },
  {
    id: "system",
    label: translate("ui.theme.copy.跟随系统"),
    description: translate("ui.theme.copy.按设备的浅色-深色设置"),
  },
] as const satisfies readonly {
  id: ThemePreference;
  label: string;
  description: string;
}[];

export function resolvedThemeOf(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "dark") return "dark";
  if (preference === "light") return "light";
  return systemPrefersDark ? "dark" : "light";
}

export function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(SYSTEM_THEME_QUERY).matches
  );
}

export function subscribeSystemTheme(listener: () => void): () => void {
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    const media = window.matchMedia(SYSTEM_THEME_QUERY);
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }
    media.addListener(listener);
    return () => media.removeListener(listener);
  }
  return () => undefined;
}

function rootOf(root?: HTMLElement): HTMLElement | null {
  return root ?? (typeof document === "undefined" ? null : document.documentElement);
}

/** Keep browser chrome on the same surface as the active kit theme. */
function updateThemeColor(root: HTMLElement | null): void {
  if (!root) return;
  const document = root.ownerDocument;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) return;
  const background = document.defaultView
    ?.getComputedStyle(root)
    .getPropertyValue("--game-ui-bg")
    .trim();
  if (background) meta.content = background;
}

/** Apply the one resolved theme attribute that SwimmerUIKit consumes. */
export function applyThemePreference(
  preference: ThemePreference,
  root?: HTMLElement,
): ResolvedTheme {
  const resolved = resolvedThemeOf(preference, systemPrefersDark());
  const target = rootOf(root);
  target?.setAttribute("data-game-ui-theme", resolved === "dark" ? "night" : "light");
  updateThemeColor(target);
  return resolved;
}

/** Keep a system-following document in step with OS theme changes. */
export function watchThemePreference(preference: ThemePreference, root?: HTMLElement): () => void {
  const update = () => applyThemePreference(preference, root);
  update();

  return preference === "system" ? subscribeSystemTheme(update) : () => undefined;
}
