import { translate } from "@pieai/university-ui/i18n.js";
import {
  spineOf,
  learningSegments,
  learningNodeId,
  type LearningSegment,
  type MapLearningKind,
  type ProgressDocument,
  type View,
} from "@pieai/university-core";
import type { CourseView } from "@pieai/university-ui/view/lesson-view.js";
import { learningOpportunityMarkers } from "@pieai/university-world/learning-nodes.js";
import type { ShelfStudy } from "@pieai/university-ui/content/port.js";
import {
  focusedStudyId as resolveFocusedStudy,
  type LearnerNavigationFocus,
  type StudySwitchItem,
} from "@pieai/university-ui/navigation/StudySwitcher.js";
import { spacedName } from "@pieai/university-ui/text/spaced-name.js";
import {
  type LessonPlacement,
  placeStudyArchipelago,
  worldIslandCaptionTarget,
  type Marker,
} from "@pieai/university-world/Maps.js";
import { courseMarkers } from "@pieai/university-world/course-map.js";
import type { CourseNode } from "@pieai/university-world/course.js";
import type { PlanetStudy } from "@pieai/university-world/planet.js";
import { useMemo, type Dispatch, type SetStateAction } from "react";
import { mapDomainForStudy } from "./map-domain-catalog.js";

export type PathOverlay =
  | {
      readonly kind: "learning-node";
      readonly unitId: string;
      readonly segment: LearningSegment;
      readonly nodeKind: MapLearningKind;
      readonly returnFocusTo: HTMLElement | null;
    }
  | {
      readonly kind: "node";
      readonly unitId: string;
      readonly lessonId: string;
      readonly returnFocusTo: HTMLElement | null;
    }
  | {
      readonly kind: "unit";
      readonly unitId: string;
      readonly returnFocusTo: HTMLElement | null;
    };

type LabelNodes = { readonly current: Map<string, HTMLElement> };
type World = ReturnType<typeof placeStudyArchipelago>;

interface WorldModelOptions {
  readonly courseProgress: (node: CourseNode) => number;
  readonly lessonsDone: (node: CourseNode) => number;
  readonly navigationFocus: LearnerNavigationFocus;
  readonly nodes: readonly CourseNode[] | null;
  readonly studies: readonly ShelfStudy[];
  readonly todayNode: CourseNode | null;
  readonly view: View;
}

export function studyIdForView(view: View, navigationFocus: LearnerNavigationFocus) {
  if (view.kind === "course" || view.kind === "lesson" || view.kind === "settled") {
    return view.studyId;
  }
  return navigationFocus;
}

export function useWorldModel({
  courseProgress,
  lessonsDone,
  navigationFocus,
  nodes,
  studies,
  todayNode,
  view,
}: WorldModelOptions) {
  /**
   * One state: the study in the top bar is the sea the camera is looking at.
   *
   * These used to be independent, which is how the top bar said TuringPact
   * while the map showed Buzz. A course URL names the study; on the world
   * map the next course is the default until the learner picks another sea.
   */
  const focusedStudyId = useMemo(() => {
    /* A course, lesson, or settlement URL is the learner's current project;
       only the world map gets a transient selection from the switcher. */
    const chosen = studyIdForView(view, navigationFocus);
    /*
      The map shows one project and may never show none. Today's course names
      the project; an account with nothing started falls back to the first
      project in the catalogue. Null now means one thing only: the catalogue
      is empty.
    */
    return resolveFocusedStudy(
      studies.map((entry) => entry.id),
      chosen,
      todayNode?.studyId,
    );
  }, [view, navigationFocus, todayNode, studies]);

  /**
   * A series is an independent archipelago (V5 M). The full catalogue remains
   * available through the planet and switcher; its other courses must not be
   * prepared or rendered behind this series' labels.
   * While picking a region on the planet, even the selected archipelago is
   * hidden. Do not rebuild that layout and its hidden DOM labels on this
   * pointer path. Entering the series prepares the same cached identities;
   * the Stage itself remains mounted, so its WebGL context is not replaced.
   */
  const planetOpen = view.kind === "planet";
  const world = useMemo(
    () =>
      !planetOpen && nodes && focusedStudyId
        ? placeStudyArchipelago(nodes, courseProgress, focusedStudyId)
        : null,
    [nodes, courseProgress, focusedStudyId, planetOpen],
  );

  /**
   * Where the little figure stands, which is a question about the project on
   * screen and not about the catalogue. In a project nobody has opened there is
   * no live course, so the head of the road is the honest answer.
   */
  const learnerAt = useMemo(() => {
    if (!world) return null;
    const live = world.placements.find((entry) => entry.state === "live");
    return (live ?? world.placements[0])?.position ?? null;
  }, [world]);

  const studyItems: readonly StudySwitchItem[] = useMemo(
    () =>
      studies.map((study) => {
        const own = (nodes ?? []).filter((node) => node.studyId === study.id);
        const done = own.reduce((sum, node) => sum + lessonsDone(node), 0);
        const total = own.reduce((sum, node) => sum + node.lessons, 0);
        return {
          id: study.id,
          title: study.title,
          courseCount: own.length || study.courses.length,
          done,
          total,
        };
      }),
    [studies, nodes, lessonsDone],
  );

  /**
   * The same four rows the switcher shows, plus what the planet's detail card
   * needs. It is a second projection of one source rather than a second source:
   * every number here is counted off `nodes`, and the course names are the
   * spine order the map already walks.
   *
   * Route positioning comes from the author's study manifest through Shelf,
   * in both modes. Counts and the ordered course names remain derived from
   * the actual graph; the shell does not invent a case or teaching promise.
   */
  const planetStudies: readonly PlanetStudy[] = useMemo(
    () =>
      studies.map((study) => {
        const own = (nodes ?? []).filter((node) => node.studyId === study.id);
        const ranked = spineOf(study.id).map((entry) => entry.courseId);
        const rank = new Map(ranked.map((courseId, index) => [courseId, index]));
        const ordered = [...own].sort(
          (a, b) =>
            (rank.get(a.courseId) ?? ranked.length + a.depth) -
            (rank.get(b.courseId) ?? ranked.length + b.depth),
        );
        return {
          id: study.id,
          title: study.title,
          ...(study.description ? { description: study.description } : {}),
          courseCount: own.length || study.courses.length,
          domain: mapDomainForStudy(study.id),
          lessonCount: own.reduce((sum, node) => sum + node.lessons, 0),
          lessonsDone: own.reduce((sum, node) => sum + lessonsDone(node), 0),
          courses: ordered.map((node) => ({
            id: node.courseId,
            title: node.title,
            lessonCount: node.lessons,
            depth: node.depth,
          })),
          courseTitles: ordered.map((node) => node.title),
        };
      }),
    [studies, nodes, lessonsDone],
  );

  /**
   * The way back out of a course.
   *
   * It used to say 「回到世界地图」 and the boss was right that it is not one: a
   * world would be everything, and what is behind this button is one project's
   * islands. A category word alone — 系列地图, 课程地图 — still leaves the reader
   * working out which series, and the name is right there to be used. So the
   * button names the place it goes to.
   */
  const backToMapLabel = useMemo(() => {
    const studyId =
      view.kind === "course" || view.kind === "lesson" || view.kind === "settled"
        ? view.studyId
        : focusedStudyId;
    const title = studies.find((entry) => entry.id === studyId)?.title;
    return title
      ? translate("app.app.worldmodel.copy.回到value0地图", { value0: spacedName(title) })
      : translate("app.app.worldmodel.copy.回到课程地图");
  }, [view, focusedStudyId, studies]);

  return {
    focusedStudyId,
    world,
    learnerAt,
    studyItems,
    planetStudies,
    backToMapLabel,
  };
}

interface WorldMarkersOptions {
  readonly course?: CourseView | null;
  readonly proofs?: ProgressDocument["provenLessons"];
  readonly labelNodes: LabelNodes;
  readonly lessons: readonly LessonPlacement[];
  readonly setCourseAvatarTarget?: (lesson: LessonPlacement) => void;
  readonly onCoursePick: () => void;
  readonly setPathOverlay: Dispatch<SetStateAction<PathOverlay | null>>;
  readonly setPicked: Dispatch<SetStateAction<CourseNode | null>>;
  readonly view: View;
  readonly world: World | null;
}

export function useWorldMarkers({
  course,
  proofs,
  labelNodes,
  lessons,
  setCourseAvatarTarget,
  onCoursePick,
  setPathOverlay,
  setPicked,
  view,
  world,
}: WorldMarkersOptions) {
  const markers: readonly Marker[] = useMemo(() => {
    if (view.kind === "course" || view.kind === "lesson") {
      const regular = courseMarkers(lessons, {
        // No picking from inside the reader: choosing a stone you are already
        // standing on is not a choice.
        onPick:
          view.kind === "lesson"
            ? undefined
            : (lesson) => {
                setCourseAvatarTarget?.(lesson);
                setPathOverlay({
                  kind: "node",
                  unitId: lesson.unitId,
                  lessonId: lesson.lessonId,
                  returnFocusTo: labelNodes.current.get(lesson.lessonId) ?? null,
                });
              },
      });
      const annotated = regular.map((marker) => {
        if (!marker.lessonId) return marker;
        const lesson = course?.units
          .flatMap((unit) => unit.lessons)
          .find((item) => item.id === marker.lessonId);
        const proof = proofs?.[`${view.studyId}/${view.courseId}/${marker.lessonId}`];
        const valid =
          proof &&
          lesson &&
          (proof.contentRevision === undefined || proof.contentRevision === lesson.contentRevision);
        if (!valid || marker.lessonState === "done") return marker;
        return {
          ...marker,
          proved: true,
          text: marker.kind === "icon" ? "◇" : marker.text,
          label: `${lesson.title} · ${translate("mapNodes.proven")}`,
        };
      });
      if (view.kind === "lesson" || !course) return annotated;
      return [
        ...annotated,
        ...learningOpportunityMarkers(lessons, learningSegments(course), (segment, nodeKind) => {
          setPathOverlay({
            kind: "learning-node",
            unitId: segment.unitId,
            segment,
            nodeKind,
            returnFocusTo: labelNodes.current.get(learningNodeId(segment, nodeKind)) ?? null,
          });
        }),
      ];
    }
    if (!world) return [];
    /*
      The study badge stays in the top bar. The catalogue field uses one shared
      world, so a second floating title would compete with course labels rather
      than orient the learner.
    */
    const focusedStudyId = world.placements[0]?.node.studyId ?? "";
    const ranked = spineOf(focusedStudyId).map((entry) => entry.courseId);
    const rank = new Map(ranked.map((courseId, index) => [courseId, index]));
    const live = world.placements.find((entry) => entry.state === "live");
    const liveIndex = live ? (rank.get(live.node.courseId) ?? -1) : -1;
    return world.placements.map((entry) => ({
      id: entry.node.courseId,
      position: worldIslandCaptionTarget(entry),
      text: entry.node.title,
      kind: "course" as const,
      courseState: entry.state,
      /*
        Greyed, never blocked. A course whose prerequisites are unmet is dimmed
        and says what it assumes you have done — and still opens when clicked.
        Locking it out would keep exactly the learner this whole mechanism
        exists for, the one who already knows the earlier material, standing
        outside the door. Dimming is information; locking is permission, and
        only the first is ours to give (V5 decision 12C).
      */
      locked: entry.state === "idle",
      sub:
        entry.node.isBeingRewritten === true
          ? translate("app.app.worldmodel.copy.改写中")
          : undefined,
      // The map has one answer to "what next". The remaining mobile budget
      // follows the authored road, not projected depth, so a nearer-looking
      // later island cannot displace the courses immediately around it.
      weight:
        entry.state === "live"
          ? 4
          : liveIndex >= 0 && rank.has(entry.node.courseId)
            ? Math.max(0, 4 - Math.abs((rank.get(entry.node.courseId) ?? 0) - liveIndex))
            : 0,
      // Same target as the island, so a label and the shape under it cannot
      // disagree about what selecting a course means.
      activate: () => {
        // Picking opens the course card. It must not retarget the catalogue
        // origin — that rebuilds every island under the pointer.
        onCoursePick();
        setPicked(entry.node);
      },
    }));
  }, [
    course,
    proofs,
    world,
    lessons,
    view,
    onCoursePick,
    setPicked,
    setPathOverlay,
    setCourseAvatarTarget,
    labelNodes,
  ]);

  return markers;
}
