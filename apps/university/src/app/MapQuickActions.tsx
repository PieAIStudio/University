import { useEffect, useRef, useState, type ReactNode } from "react";
import { GameButton, GameInput, GameModal } from "@pieai/swimmer-ui-kit";
import { interfaceTranslator, useI18n } from "@pieai/university-ui/i18n.js";
import type { CourseView } from "@pieai/university-ui/view/lesson-view.js";
import type { CourseNode } from "@pieai/university-world/course.js";
import type { MapDomain } from "./map-domain-catalog.js";
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

/**
 * The directory: every place on this level, by name. The planet lists its
 * domains, a course its lessons, and the archipelago the focused study's courses.
 */
export function mapDestinations(
  places:
    | { readonly level: "planet"; readonly domains: readonly MapDomain[] }
    | { readonly level: "course"; readonly course: CourseView }
    | { readonly level: "world"; readonly courses: readonly CourseNode[] },
  go: {
    readonly domain: (domainId: string) => void;
    readonly lesson: (lessonId: string) => void;
    readonly course: (node: CourseNode) => void;
  },
): MapDestination[] {
  if (places.level === "planet")
    return places.domains.map((domain) => ({
      id: domain.id,
      title: domain.title,
      detail: domain.description,
      select: () => go.domain(domain.id),
    }));
  if (places.level === "course")
    return places.course.units.flatMap((unit) =>
      unit.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        detail: unit.title,
        select: () => go.lesson(lesson.id),
      })),
    );
  return places.courses.map((node) => ({
    id: node.courseId,
    title: node.title,
    select: () => go.course(node),
  }));
}

/** The palette's commands, in a fixed order; a missing action is simply not offered. */
export function mapQuickCommands(actions: {
  readonly weeklyBoss: (() => void) | null;
  readonly camera: { readonly overview: () => void; readonly learningView: () => void } | null;
  readonly back: (() => void) | null;
  readonly clear: (() => void) | null;
}): MapQuickCommand[] {
  return [
    ...(actions.weeklyBoss
      ? [
          {
            id: "weekly-boss",
            title: interfaceTranslator.t("weeklyBoss.name"),
            run: actions.weeklyBoss,
          },
        ]
      : []),
    ...(actions.camera
      ? [
          {
            id: "overview",
            title: interfaceTranslator.t("map.overview"),
            run: actions.camera.overview,
          },
          {
            id: "learning-view",
            title: interfaceTranslator.t("map.resetView"),
            run: actions.camera.learningView,
          },
        ]
      : []),
    ...(actions.back
      ? [{ id: "back", title: interfaceTranslator.t("map.back"), run: actions.back }]
      : []),
    ...(actions.clear
      ? [{ id: "clear", title: interfaceTranslator.t("map.clear"), run: actions.clear }]
      : []),
  ];
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
  appearance,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly destinations: readonly MapDestination[];
  readonly commands: readonly MapQuickCommand[];
  readonly route?: ReactNode;
  readonly sourceControls?: ReactNode;
  /** The world appearance choice: an on-demand command, never map chrome. */
  readonly appearance?: ReactNode;
}) {
  const interfaceTranslator = useI18n();
  const [page, setPage] = useState<"commands" | "directory" | "route" | "help">("commands");
  const [query, setQuery] = useState("");
  const heading = interfaceTranslator.t(
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
      closeLabel={interfaceTranslator.t("map.close")}
      size="sm"
      className="map-quick-actions"
    >
      {page !== "commands" ? (
        <GameButton variant="ghost" onClick={() => setPage("commands")}>
          {interfaceTranslator.t("map.backCommands")}
        </GameButton>
      ) : null}
      {page === "commands" ? (
        <div className="map-quick-actions__commands">
          <GameButton
            variant="secondary"
            data-map-command="directory"
            onClick={() => setPage("directory")}
          >
            {interfaceTranslator.t("map.directory")}
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
              {interfaceTranslator.t("map.route")}
            </GameButton>
          ) : null}
          {sourceControls}
          {appearance}
          <GameButton variant="secondary" data-map-command="help" onClick={() => setPage("help")}>
            {interfaceTranslator.t("map.help")}
          </GameButton>
        </div>
      ) : null}
      {page === "directory" ? (
        <div className="map-quick-actions__directory">
          <GameInput
            type="search"
            aria-label={interfaceTranslator.t("map.search")}
            placeholder={interfaceTranslator.t("map.search")}
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
                    aria-label={interfaceTranslator.t("map.selectNamed", { title: item.title })}
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
            <p role="status">{interfaceTranslator.t("map.noResults")}</p>
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
      {page === "help" ? <p>{interfaceTranslator.t("map.helpBody")}</p> : null}
    </GameModal>
  );
}
