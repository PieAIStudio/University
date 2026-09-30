import { useI18n } from "../i18n/index.js";
import type { ReactNode } from "react";

import {
  AppShell,
  type ShellCollapseLabels,
  type ShellCounter,
  type ShellNavItem,
} from "../shell/AppShell.js";
import { GameButton } from "@pieai/swimmer-ui-kit";
import { universityNavItems } from "./slots.js";

export type { ShellCounter, ShellNavItem };

/**
 * University chrome. Both apps mount this, never `AppShell` directly.
 *
 * Slot labels and routes live in `slots.tsx`. The frozen shell stays product-
 * neutral; map commands sit beside identity, never as a fifth door.
 */
export function UniversityShell({
  mapMode = false,
  asideTitle,
  activeId,
  counters,
  aside,
  asideLabel,
  showAsideOnPhone = false,
  contextActions,
  brand,
  identity,
  children,
}: {
  readonly activeId: string;
  readonly mapMode?: boolean;
  readonly asideTitle?: string;
  readonly counters?: readonly ShellCounter[];
  readonly aside?: ReactNode;
  readonly asideLabel?: string;
  /** See AppShell: the aside stays a phone row instead of disappearing. */
  readonly showAsideOnPhone?: boolean;
  readonly contextActions?: readonly ShellNavItem[];
  readonly brand?: ReactNode;
  /**
   * The learner's avatar, at the foot of the rail. **Required, and `null` is a
   * legal answer** — that combination is the whole point.
   *
   * It used to be optional, and the delivery shell passed one while the
   * authoring shell passed nothing. Nobody forked anything; this is one
   * component and both shells render it. But an optional slot left empty is
   * indistinguishable from an optional slot nobody wanted, so the compiler saw
   * no difference, a reviewer reading either file saw no difference, and the
   * only way to find it was to open the two campuses side by side — which is
   * how it was found.
   *
   * Making it required does not stop a shell deciding it has no identity to
   * show. It stops a shell deciding that by accident: `identity={null}` is a
   * sentence somebody wrote, and omission is not.
   */
  readonly identity: ReactNode;
  readonly children: ReactNode;
}) {
  const translator = useI18n();
  const { t } = translator;
  const items = universityNavItems(translator);
  const collapseLabels: ShellCollapseLabels = {
    railName: t("map.navigation"),
    asideName: t("map.informationShort"),
    collapse: t("ui.shell.appShell.copy.收起"),
    expandRail: t("ui.shell.appShell.copy.展开导航"),
    expandAside: t("ui.shell.appShell.copy.展开上下文"),
  };
  return (
    <AppShell
      navigationLabels={{
        primary: t("product.navigation.primary"),
        tabs: t("product.navigation.tabs"),
      }}
      mapMode={mapMode}
      asideTitle={asideTitle}
      nav={items}
      tabs={items}
      activeId={activeId}
      counters={counters}
      collapseLabels={collapseLabels}
      brand={brand ?? <span className="university-shell__brand">University</span>}
      identity={
        <>
          {identity}
          {contextActions?.length ? (
            <div className="university-shell__commands">
              {contextActions.map((item) => (
                <GameButton
                  key={item.id}
                  variant="ghost"
                  static
                  data-shell-command={item.id}
                  onClick={item.onActivate}
                >
                  {item.label}
                </GameButton>
              ))}
            </div>
          ) : null}
        </>
      }
      aside={aside}
      asideLabel={asideLabel ?? t("ui.navigation.universityShell.copy.上下文")}
      showAsideOnPhone={showAsideOnPhone}
    >
      {children}
    </AppShell>
  );
}
