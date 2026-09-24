import { translate } from "@pieai/university-ui/i18n.js";
import type { Marker } from "@pieai/university-world/Maps.js";

/**
 * What 涟 answers on the map (ADR-0012, phase one): a fixed set of questions
 * whose answers are read from the map the learner is looking at, never
 * generated. Each answer may name one place — a label on the map or an entry
 * in the navigation — and the guide points at it; it never invents a place
 * and never acts on its own. The one action it offers is the place's own.
 */
export type MapGuideView = "world" | "course";
export type MapGuideQuestion = "start" | "challenge" | "review" | "shortcuts";

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
  readonly markers: readonly Marker[];
  /** A lesson's full title: a course view's live stone only says 「开始」. */
  readonly lessonTitle: (lessonId: string) => string | undefined;
}

export function mapGuideQuestions(view: MapGuideView): readonly MapGuideQuestion[] {
  return view === "course"
    ? ["start", "challenge", "review", "shortcuts"]
    : ["start", "review", "shortcuts"];
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
  { view, markers, lessonTitle }: MapGuideMap,
  onShortcuts: () => void,
): MapGuideAnswer {
  if (question === "start") {
    const marker = startMarker(view, markers);
    if (!marker)
      return { question, text: translate("map.guide.a.startNone"), place: null, go: null };
    const title = (marker.lessonId && lessonTitle(marker.lessonId)) || marker.text;
    return {
      question,
      text: translate(view === "course" ? "map.guide.a.startLesson" : "map.guide.a.startCourse", {
        title,
      }),
      place: { kind: "marker", markerId: marker.id, label: title },
      go: marker.activate
        ? { label: translate("map.guide.go.select"), run: marker.activate }
        : null,
    };
  }
  if (question === "challenge") {
    const marker = challengeMarker(markers);
    if (!marker)
      return { question, text: translate("map.guide.a.challengeNone"), place: null, go: null };
    return {
      question,
      text: translate(marker.locked ? "map.guide.a.challengeLocked" : "map.guide.a.challengeOpen"),
      place: { kind: "marker", markerId: marker.id, label: marker.label ?? marker.text },
      go: marker.activate ? { label: translate("map.guide.go.look"), run: marker.activate } : null,
    };
  }
  if (question === "review") {
    return {
      question,
      text: translate("map.guide.a.review"),
      place: { kind: "nav", navId: "practice", label: translate("map.guide.place.practice") },
      go: null,
    };
  }
  return {
    question,
    text: translate("map.guide.a.shortcuts"),
    place: { kind: "nav", navId: "more", label: translate("map.guide.place.more") },
    go: { label: translate("map.guide.go.shortcuts"), run: onShortcuts },
  };
}
