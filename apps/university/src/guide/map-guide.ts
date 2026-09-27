import { interfaceTranslator } from "@pieai/university-ui/i18n.js";
import type { Marker } from "@pieai/university-world/Maps.js";

/**
 * What 涟 answers on the map (ADR-0012, phase one): a fixed set of questions
 * whose answers are read from the map the learner is looking at, never
 * generated. Each answer may name one place — a label on the map or an entry
 * in the navigation — and the guide points at it; it never invents a place
 * and never acts on its own. The one action it offers is the place's own.
 */
export type MapGuideView = "world" | "course";
export type MapGuideQuestion = "start" | "challenge" | "review" | "compare" | "shortcuts";

/** A place the guide may point at. Ids are the map's and the rail's own. */
export type MapGuidePlace =
  | { readonly kind: "marker"; readonly markerId: string; readonly label: string }
  | { readonly kind: "nav"; readonly navId: "practice" | "more"; readonly label: string };

export interface MapGuideAnswer {
  readonly question: MapGuideQuestion;
  readonly text: string;
  readonly place: MapGuidePlace | null;
  /** The place's own action — what clicking it would do — and its name. */
  readonly go: { readonly label: string; readonly run: () => void } | null;
}

/** The map as the guide reads it. */
export interface MapGuideMap {
  readonly view: MapGuideView;
  /**
   * Who is looking at which map: account, study, view and course. Anything
   * the guide said or selected under one scope expires under the next.
   */
  readonly scope: string;
  readonly markers: readonly Marker[];
  /** A lesson's full title: a course view's live stone only says 「开始」. */
  readonly lessonTitle: (lessonId: string) => string | undefined;
  /** University's own count for an island, or null before its course loads. */
  readonly courseProgress?: (
    courseId: string,
  ) => { readonly done: number; readonly total: number } | null;
}

export function mapGuideQuestions(view: MapGuideView): readonly MapGuideQuestion[] {
  return view === "course"
    ? ["start", "challenge", "review", "shortcuts"]
    : ["start", "review", "compare", "shortcuts"];
}

/**
 * The assistance scope for one map: account, study, view and course, in
 * the identity alphabet SwimmerNerveKit accepts. A new scope is a new map.
 */
export function mapGuideScope(parts: readonly (string | null | undefined)[]): string {
  const id = parts.map((part) => (part ?? "-").replace(/[^A-Za-z0-9._:-]+/g, "-") || "-").join("/");
  return `map/${id}`.slice(0, 160);
}

/** The registry identity of a map label: the marker's own id, never a position. */
export function markerTargetId(markerId: string): string {
  return `marker:${markerId}`;
}

/** The navigation entry exists twice — the rail at a desk, the tab bar below. */
export function navTargetIds(navId: string): readonly string[] {
  return [`nav:rail:${navId}`, `nav:tabs:${navId}`];
}

export function placeTargetIds(place: MapGuidePlace): readonly string[] {
  return place.kind === "marker" ? [markerTargetId(place.markerId)] : navTargetIds(place.navId);
}

/**
 * How a map label is registered: its name, and for an island the facts
 * University already shows about it. The description is the only thing a
 * comparison of two islands reads, so it says nothing University did not
 * decide — no order between courses, no score.
 */
export function markerDescriptor(
  marker: Marker,
  { lessonTitle, courseProgress }: Pick<MapGuideMap, "lessonTitle" | "courseProgress">,
): { readonly label: string; readonly description?: string } {
  const label = (marker.lessonId && lessonTitle(marker.lessonId)) || marker.label || marker.text;
  if (marker.kind !== "course" || !marker.courseState) return { label };
  const count = courseProgress?.(marker.id);
  const facts = [
    interfaceTranslator.t(`ui.world.courseState.${marker.courseState}`),
    count && count.total > 0
      ? interfaceTranslator.t("map.guide.compare.progress", {
          done: count.done,
          total: count.total,
        })
      : null,
  ].filter((fact): fact is string => Boolean(fact));
  return { label, description: facts.join(" · ") };
}

/** Islands a comparison can be made of: the map's course labels. */
export function comparableMarkers(markers: readonly Marker[]): readonly Marker[] {
  return markers.filter((marker) => marker.kind === "course");
}

/** The stone the road opens on, or the island the map calls "live". */
function startMarker(view: MapGuideView, markers: readonly Marker[]): Marker | null {
  if (view === "course")
    return markers.find((m) => m.kind === "lesson" && m.lessonState === "live") ?? null;
  return (
    markers.find((m) => m.kind === "course" && m.courseState === "live") ??
    markers.find((m) => m.kind === "course" && m.courseState === "open") ??
    null
  );
}

/** The first game challenge a learner can reach, else the first one on the road. */
function challengeMarker(markers: readonly Marker[]): Marker | null {
  const challenges = markers.filter((m) => m.learningKind === "challenge");
  return challenges.find((m) => !m.locked) ?? challenges[0] ?? null;
}

export function mapGuideAnswer(
  question: MapGuideQuestion,
  { view, markers, lessonTitle }: Pick<MapGuideMap, "view" | "markers" | "lessonTitle">,
  onShortcuts: () => void,
): MapGuideAnswer {
  if (question === "start") {
    const marker = startMarker(view, markers);
    if (!marker)
      return {
        question,
        text: interfaceTranslator.t("map.guide.a.startNone"),
        place: null,
        go: null,
      };
    const title = (marker.lessonId && lessonTitle(marker.lessonId)) || marker.text;
    return {
      question,
      text: interfaceTranslator.t(
        view === "course" ? "map.guide.a.startLesson" : "map.guide.a.startCourse",
        {
          title,
        },
      ),
      place: { kind: "marker", markerId: marker.id, label: title },
      go: marker.activate
        ? { label: interfaceTranslator.t("map.guide.go.select"), run: marker.activate }
        : null,
    };
  }
  if (question === "challenge") {
    const marker = challengeMarker(markers);
    if (!marker)
      return {
        question,
        text: interfaceTranslator.t("map.guide.a.challengeNone"),
        place: null,
        go: null,
      };
    return {
      question,
      text: interfaceTranslator.t(
        marker.locked ? "map.guide.a.challengeLocked" : "map.guide.a.challengeOpen",
      ),
      place: { kind: "marker", markerId: marker.id, label: marker.label ?? marker.text },
      go: marker.activate
        ? { label: interfaceTranslator.t("map.guide.go.look"), run: marker.activate }
        : null,
    };
  }
  if (question === "compare") {
    return { question, text: interfaceTranslator.t("map.guide.a.compare"), place: null, go: null };
  }
  if (question === "review") {
    return {
      question,
      text: interfaceTranslator.t("map.guide.a.review"),
      place: {
        kind: "nav",
        navId: "practice",
        label: interfaceTranslator.t("map.guide.place.practice"),
      },
      go: null,
    };
  }
  return {
    question,
    text: interfaceTranslator.t("map.guide.a.shortcuts"),
    place: { kind: "nav", navId: "more", label: interfaceTranslator.t("map.guide.place.more") },
    go: { label: interfaceTranslator.t("map.guide.go.shortcuts"), run: onShortcuts },
  };
}
