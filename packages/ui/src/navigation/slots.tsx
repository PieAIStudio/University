import type { InterfaceTranslator } from "../i18n/index.js";
import { toPath } from "@pieai/university-core";
import { HomeIcon, CodexIcon, PracticeIcon, ProfileIcon } from "../shell/icons.js";
import type { ShellNavItem } from "../shell/AppShell.js";

/** V7 station 7: one list of four labelled doors, on both widths and both modes.
 * Read labels during render: changing language does not change route identity.
 * Contextual map commands and author tools are not fifth primary destinations. */
export function universityNavItems(t: InterfaceTranslator): readonly ShellNavItem[] {
  return [
    { id: "learn", label: t.t("doors.learn"), href: toPath({ kind: "world" }), icon: <HomeIcon /> },
    {
      id: "review",
      label: t.t("doors.review"),
      href: toPath({ kind: "review" }),
      icon: <PracticeIcon />,
    },
    {
      id: "library",
      label: t.t("doors.library"),
      href: toPath({ kind: "library", tab: "concepts" }),
      icon: <CodexIcon />,
    },
    { id: "profile", label: t.t("doors.me"), href: toPath({ kind: "me" }), icon: <ProfileIcon /> },
  ];
}
