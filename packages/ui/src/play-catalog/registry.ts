import { toPath, type ActivityKind } from "@pieai/university-core";
import { AI_MODES, FOUNDATION_MODES } from "../learning-play/LearningPlayLab.js";
import type { MessageKey } from "../i18n/types.js";
import { SAMPLE_PATHS } from "./sample-paths.js";

export const CATALOG_GROUPS = ["native", "paths", "blocks", "arcade", "history"] as const;
export type CatalogGroup = (typeof CATALOG_GROUPS)[number];
export type PrototypeSource = "blocks" | "arcade" | "index" | "remade" | "compare";
export type PrototypeSources = Readonly<Record<PrototypeSource, string>>;
export type NativeKind = Exclude<ActivityKind, "interaction-path">;
export interface CatalogEntry {
  readonly id: string;
  readonly group: CatalogGroup;
  readonly name: MessageKey;
  readonly action: MessageKey;
  readonly controls: MessageKey;
  readonly scope: MessageKey;
  readonly nativeKind?: NativeKind;
  readonly href?: string;
  readonly source?: PrototypeSource;
  readonly prototypeId?: string;
  readonly rhythm?: "session" | "short";
}

/** Read the committed build registrations, not a copied total or a second game list. */
export function prototypeRegistrations(source: string): readonly { id: string; title: string }[] {
  const registrations = [
    ...source.matchAll(
      /\{\s*id:\s*"([\w-]+)",\s*title:\s*"([^"]+)",\s*from:\s*"[^"]*",\s*build:\s*\w+/g,
    ),
  ].map((match) => ({ id: match[1]!, title: match[2]! }));
  if (
    !registrations.length ||
    new Set(registrations.map((entry) => entry.id)).size !== registrations.length
  )
    throw new Error("Prototype build registrations are missing or duplicated");
  return registrations;
}

// A session is a structural distinction, never a measured duration claim.
const SESSION_IDS = new Set(["forge", "shift", "defenseline", "invaders", "cloze-tetris"]);
const itemKey = (id: string, field: "name" | "action" | "controls") =>
  `gallery.item.${id}.${field}` as MessageKey;

export function createCatalog(sources: PrototypeSources): readonly CatalogEntry[] {
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
  const research: CatalogEntry[] = (["blocks", "arcade"] as const).flatMap((source) =>
    prototypeRegistrations(sources[source]).map(({ id }) => ({
      id: `${source}:${id}`,
      group: source,
      source,
      prototypeId: id,
      name: itemKey(id, "name"),
      action: itemKey(id, "action"),
      controls: itemKey(id, "controls"),
      scope: "gallery.researchScope",
      rhythm: source === "arcade" && SESSION_IDS.has(id) ? "session" : "short",
    })),
  );
  const history: CatalogEntry[] = (["index", "remade", "compare"] as const).map((source) => ({
    id: `history:${source}`,
    group: "history",
    source,
    name: `gallery.history.${source}.name`,
    action: `gallery.history.${source}.action`,
    controls: "gallery.archiveControls",
    scope: "gallery.archiveScope",
  }));
  return [...native, ...paths, ...research, ...history];
}

export function filterCatalog(
  entries: readonly CatalogEntry[],
  group: CatalogGroup | "all",
  query: string,
  label: (key: MessageKey) => string,
): readonly CatalogEntry[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter(
    (entry) =>
      (group === "all" || entry.group === group) &&
      terms.every((term) =>
        `${entry.id} ${label(entry.name)} ${label(entry.action)} ${label(entry.controls)}`
          .toLocaleLowerCase()
          .includes(term),
      ),
  );
}
