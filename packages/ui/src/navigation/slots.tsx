import type { ReactNode } from "react";

import type { ShellNavItem } from "../shell/AppShell.js";
import {
  CodexIcon,
  HomeIcon,
  IslandIcon,
  LeagueIcon,
  MoreIcon,
  PlanIcon,
  PracticeIcon,
  ProfileIcon,
  QuestsIcon,
} from "../shell/icons.js";

/**
 * University's slot list. One copy, both shells.
 *
 * The chrome in `shell/` is product-neutral; this file is the opposite — routes,
 * Chinese labels, University nouns. Apps must not write a second list.
 */

function Glyph({ children }: { readonly children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** Stacked lines — the 2D catalogue, distinct from the open-book library icon. */
function CatalogIcon() {
  return (
    <Glyph>
      <path
        fill="currentColor"
        d="M4.4 5.2h15.2v1.8H4.4V5.2Zm0 4.6h15.2v1.8H4.4V9.8Zm0 4.6h15.2v1.8H4.4v-1.8Zm0 4.6h10.4v1.8H4.4v-1.8Z"
      />
    </Glyph>
  );
}

/** Calendar tick — review, distinct from the stacked-card practice icon. */
function ReviewIcon() {
  return (
    <Glyph>
      <path
        fill="currentColor"
        d="M7.2 3.4h1.8v1.6h6V3.4h1.8v1.6H19a1.8 1.8 0 0 1 1.8 1.8v12.4A1.8 1.8 0 0 1 19 21H5a1.8 1.8 0 0 1-1.8-1.8V6.8A1.8 1.8 0 0 1 5 5h2.2V3.4Zm11.4 6.2H5.4v9.6h13.2V9.6Zm-8.6 2.1 1.3 1.3 3.7-3.7 1.3 1.3-5 5-2.6-2.6 1.3-1.3Z"
      />
    </Glyph>
  );
}

/** Star — the shortlist. */
function FavouritesIcon() {
  return (
    <Glyph>
      <path
        fill="currentColor"
        d="M12 3.4 14.4 9l6 .6-4.5 4.1 1.3 5.9L12 16.7 6.8 19.6l1.3-5.9L3.6 9.6l6-.6L12 3.4Z"
      />
    </Glyph>
  );
}

/** Gear — settings. Not in the frozen shell set. */
function SettingsIcon() {
  return (
    <Glyph>
      <path
        fill="currentColor"
        d="M12 8.4a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2Zm8.2 2.7-.2-1.6.2-1.6-2.1-.7-.6-1.5.9-2-1.7-1.7-2 .9-1.5-.6L12.3 2h-1.6l-.7 2.1-1.5.6-2-.9-1.7 1.7.9 2-1.5.6-2.1.7.2 1.6-.2 1.6 2.1.7.6 1.5-.9 2 1.7 1.7 2-.9 1.5.6.7 2.1h1.6l.7-2.1 1.5-.6 2 .9 1.7-1.7-.9-2 1.5-.6 2.1-.7Z"
      />
    </Glyph>
  );
}

export const MORE_CHILDREN: readonly ShellNavItem[] = [
  { id: "catalog", label: "目录", icon: <CatalogIcon />, href: "#/catalog" },
  { id: "review", label: "复习", icon: <ReviewIcon />, href: "#/review" },
  { id: "favourites", label: "收藏", icon: <FavouritesIcon />, href: "#/favourites" },
  { id: "settings", label: "设置", icon: <SettingsIcon />, href: "#/settings" },
];

/** Local-only flyout entry. Passed in through `extraMoreItems`, never forked in. */
export const STUDIO_MORE_ITEM: ShellNavItem = {
  id: "studio",
  label: "作者工作台",
  icon: <IslandIcon />,
  href: "#/studio",
};

export const RAIL_ITEMS: readonly ShellNavItem[] = [
  { id: "learn", label: "学习", icon: <HomeIcon />, href: "#/" },
  { id: "library", label: "图鉴", icon: <CodexIcon />, href: "#/library" },
  { id: "practice", label: "练习", icon: <PracticeIcon />, href: "#/practice" },
  { id: "league", label: "排行榜", icon: <LeagueIcon />, href: "#/league" },
  { id: "quests", label: "任务", icon: <QuestsIcon />, href: "#/quests" },
  { id: "plan", label: "会员", icon: <PlanIcon />, href: "#/plans" },
  { id: "profile", label: "个人档案", icon: <ProfileIcon />, href: "#/me" },
  {
    id: "more",
    label: "更多",
    icon: <MoreIcon />,
    href: "#/more",
    children: MORE_CHILDREN,
  },
];

export const TAB_ITEMS: readonly ShellNavItem[] = [
  { id: "learn", label: "学习", icon: <HomeIcon />, href: "#/" },
  { id: "quests", label: "任务", icon: <QuestsIcon />, href: "#/quests" },
  { id: "league", label: "排行榜", icon: <LeagueIcon />, href: "#/league" },
  { id: "library", label: "图鉴", icon: <CodexIcon />, href: "#/library" },
  { id: "plan", label: "会员", icon: <PlanIcon />, href: "#/plans" },
  { id: "profile", label: "我", icon: <ProfileIcon />, href: "#/me" },
];

export function railItemsWithExtra(
  extraMoreItems?: readonly ShellNavItem[],
): readonly ShellNavItem[] {
  if (!extraMoreItems?.length) return RAIL_ITEMS;
  return RAIL_ITEMS.map((item) =>
    item.id === "more"
      ? { ...item, children: [...(item.children ?? []), ...extraMoreItems] }
      : item,
  );
}
