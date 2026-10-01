import { toPath, type ActivityKind } from "@pieai/university-core";
import { AI_MODES, FOUNDATION_MODES } from "../learning-play/LearningPlayLab.js";
import type { PlainMessageKey } from "../i18n/types.js";
import { SAMPLE_PATHS } from "./sample-paths.js";
import { THREE_GAMES, type ThreeGame } from "./three-games.js";
export { THREE_GAMES, type ThreeGame } from "./three-games.js";

export const CATALOG_GROUPS = ["native", "paths", "three"] as const;
export type CatalogGroup = (typeof CATALOG_GROUPS)[number];
export type NativeKind = Exclude<ActivityKind, "interaction-path" | "primm">;
export interface CatalogEntry {
  readonly id: string;
  readonly group: CatalogGroup;
  readonly name: PlainMessageKey;
  readonly action: PlainMessageKey;
  readonly controls: PlainMessageKey;
  readonly scope: PlainMessageKey;
  readonly nativeKind?: NativeKind;
  readonly href?: string;
  readonly rhythm?: "session" | "short";
  readonly threeMode?: ThreeGame;
}

const itemKey = (id: string, field: "name" | "action" | "controls") =>
  `gallery.item.${id}.${field}` as PlainMessageKey;

/**
 * What the play lab offers: the lesson actions, the sample lessons and the
 * island games. The research prototypes, history pages and earlier 3D editions
 * were deleted on 2026-10-01 (Owner G3); their screenshots stay in
 * docs/reference/interaction-components/album.html.
 */
export function createCatalog(): readonly CatalogEntry[] {
  const native: CatalogEntry[] = [...FOUNDATION_MODES, ...AI_MODES].map((kind) => ({
    id: `native:${kind}`,
    group: "native",
    nativeKind: kind,
    name: itemKey(kind, "name"),
    action: itemKey(kind, "action"),
    controls: itemKey(kind, "controls"),
    scope: "gallery.nativeScope",
  }));
  const paths: CatalogEntry[] = SAMPLE_PATHS.map(({ id, unitId }) => ({
    id: `path:${id}`,
    group: "paths",
    name: `gallery.lesson.${id}`,
    action: "gallery.pathAction",
    controls: "gallery.pathControls",
    scope: "gallery.pathsScope",
    href: toPath({
      kind: "lesson",
      studyId: "ai-literacy",
      courseId: "understanding-ai",
      unitId,
      lessonId: id,
    }),
  }));
  // Assembled from the game kit (ADR-0011): content from the lessons, the
  // learner's avatar as the hero.
  const controls: Readonly<Record<ThreeGame, PlainMessageKey>> = {
    courtyard: "intercept.controls",
    links: "links.controls",
    snake: "snake.controls",
    moles: "moles.controls",
    runner: "runner.controls",
    blocks: "blocks.controls",
  };
  const three: CatalogEntry[] = THREE_GAMES.map((mode) => ({
    id: `three:${mode}`,
    group: "three",
    threeMode: mode,
    name: `arcade3d.${mode}`,
    action: `gallery.three.${mode}`,
    controls: controls[mode],
    scope: "gameKit.result.boundary",
    rhythm: "session",
  }));
  return [...native, ...paths, ...three];
}

export function filterCatalog(
  entries: readonly CatalogEntry[],
  group: CatalogGroup | "all",
  query: string,
  label: (key: PlainMessageKey) => string,
): readonly CatalogEntry[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter(
    (entry) =>
      (group === "all" || entry.group === group) &&
      terms.every((term) =>
        `${entry.id} ${label(entry.name)} ${label(entry.action)} ${label(entry.controls)} ${entry.threeMode ? label("gallery.three.kit") : ""}`
          .toLocaleLowerCase()
          .includes(term),
      ),
  );
}
