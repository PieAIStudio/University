import type { ShellNavItem } from "./AppShell.js";

export function itemAccessibleName(item: ShellNavItem): string {
  if (item.badgeLabel) return item.badgeLabel;
  if (typeof item.badge === "number") return `${item.label} ${item.badge}`;
  return item.label;
}
