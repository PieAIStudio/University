import { useEffect, useRef, useState, type ReactNode } from "react";
import { GameButton, GameInput, GameModal } from "@pieai/swimmer-ui-kit";
import { translate as t } from "@pieai/university-ui/i18n.js";
import { isMapSpace } from "./map-keyboard.js";
import "./map-navigation.css";

export interface MapDestination {
  readonly id: string;
  readonly title: string;
  readonly detail?: string;
  readonly select: () => void;
}
export interface MapQuickCommand {
  readonly id: string;
  readonly title: string;
  readonly run: () => void;
}

/** Scoped keyboard access is an alternative, never a second permanent map HUD. */
export function useMapShortcuts(enabled: boolean, routeKey: string) {
  const [open, setOpen] = useState(false);
  const returnTo = useRef<HTMLElement | null>(null);
  const show = () => {
    returnTo.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => {
      const target = returnTo.current;
      if (target?.isConnected && target.getClientRects().length)
        target.focus({ preventScroll: true });
      else
        document
          .querySelector<HTMLElement>('[data-map-surface="true"]')
          ?.focus({ preventScroll: true });
    });
  };
  useEffect(() => {
    setOpen(false);
  }, [routeKey]);
  useEffect(() => {
    if (!enabled) return;
    const key = (event: KeyboardEvent) => {
      if (isMapSpace(event)) {
        event.preventDefault();
        show();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [enabled]);
  return { open: enabled && open, show, close };
}

export function MapQuickActions({
  open,
  onClose,
  destinations,
  commands,
  route,
  sourceControls,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly destinations: readonly MapDestination[];
  readonly commands: readonly MapQuickCommand[];
  readonly route?: ReactNode;
  readonly sourceControls?: ReactNode;
}) {
  const [page, setPage] = useState<"commands" | "directory" | "route" | "help">("commands");
  const [query, setQuery] = useState("");
  const heading = t(
    page === "directory"
      ? "map.directory"
      : page === "route"
        ? "map.route"
        : page === "help"
          ? "map.help"
          : "map.shortcuts",
  );
  useEffect(() => {
    if (open) setPage("commands");
  }, [open]);
  useEffect(() => {
    if (!open) return;
    // Native search inputs consume Escape to clear their value before a dialog
    // receives cancel. This palette's Escape means close, not erase the query.
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.isComposing || event.defaultPrevented) return;
      if (!(event.target instanceof Element) || !event.target.closest(".map-quick-actions")) return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", escape, true);
    return () => document.removeEventListener("keydown", escape, true);
  }, [open, onClose]);
  const filtered = destinations.filter((item) =>
    `${item.title} ${item.detail ?? ""}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <GameModal
      keepMounted
      open={open}
      onClose={onClose}
      title={heading}
      closeLabel={t("map.close")}
      size="sm"
      className="map-quick-actions"
    >
      {page !== "commands" ? (
        <GameButton variant="ghost" onClick={() => setPage("commands")}>
          {t("map.backCommands")}
        </GameButton>
      ) : null}
      {page === "commands" ? (
        <div className="map-quick-actions__commands">
          <GameButton
            variant="secondary"
            data-map-command="directory"
            onClick={() => setPage("directory")}
          >
            {t("map.directory")}
          </GameButton>
          {commands.map((command) => (
            <GameButton
              key={command.id}
              variant="secondary"
              data-map-command={command.id}
              onClick={() => {
                onClose();
                command.run();
              }}
            >
              {command.title}
            </GameButton>
          ))}
          {route ? (
            <GameButton
              variant="secondary"
              data-map-command="route"
              onClick={() => setPage("route")}
            >
              {t("map.route")}
            </GameButton>
          ) : null}
          {sourceControls}
          <GameButton variant="secondary" data-map-command="help" onClick={() => setPage("help")}>
            {t("map.help")}
          </GameButton>
        </div>
      ) : null}
      {page === "directory" ? (
        <div className="map-quick-actions__directory">
          <GameInput
            type="search"
            aria-label={t("map.search")}
            placeholder={t("map.search")}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          {filtered.length ? (
            <ul>
              {filtered.map((item) => (
                <li key={item.id}>
                  <GameButton
                    variant="ghost"
                    fullWidth
                    data-map-destination={item.id}
                    aria-label={t("map.selectNamed", { title: item.title })}
                    onClick={() => {
                      onClose();
                      item.select();
                    }}
                  >
                    <span>
                      {item.title}
                      {item.detail ? <small>{item.detail}</small> : null}
                    </span>
                  </GameButton>
                </li>
              ))}
            </ul>
          ) : (
            <p role="status">{t("map.noResults")}</p>
          )}
        </div>
      ) : null}
      {/* Closing a palette must not erase the route questionnaire. Each real
          course has a keyed child; hiding this page preserves its own inputs. */}
      {route ? (
        <div className="map-quick-actions__route" hidden={page !== "route"}>
          {route}
        </div>
      ) : null}
      {page === "help" ? <p>{t("map.helpBody")}</p> : null}
    </GameModal>
  );
}
