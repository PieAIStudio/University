/**
 * The two map levels, both drawn inside the one Canvas the app owns.
 *
 * Text is never geometry. Every name on these maps is a DOM node positioned by
 * projecting a world point — baseline rule 7, and the reason it is a rule: a
 * Chinese IME, selectable code, a screen reader and a phone keyboard all
 * degrade to nothing inside WebGL. The canvas moves the eye; the DOM carries
 * the words.
 *
 * What the world *says* is the design decision in this file, and it is one
 * sentence: **an island shows how far its course got.** Nature is there from
 * the first visit, because a world nobody has touched still has to be worth
 * looking at — that is the screen a stranger decides on. The settlement is the
 * part progress owns. Bare clearings on a half-finished island are not an
 * oversight; they are the room the learner has left to build, and a finished
 * course reads as a village because somebody lived there long enough.
 *
 * One thing is lit. The beacon burns on exactly one island — the next course —
 * so the eight-second question the map has to answer ("where do I go now")
 * is answered by looking, not by reading.
 */
import {
  isLessonComplete,
  prerequisitesMet,
  readCourseProgress,
  spineOf,
  type AuthoringFocus,
  type ProgressSource,
  nearestLearningSegment,
} from "@pieai/university-core";
import { playSound } from "@pieai/university-ui/sound/index.js";
import { useFrame } from "@react-three/fiber";
import { Suspense, useContext, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { courseShapeOf, isFocusDimmed, type Course, type CourseNode } from "./course/course";
import {
  islandGeometryBlueprint,
  islandBlueprint,
  projectIslandBlueprint,
  sampleIslandSurface,
  type IslandBlueprint,
  type IslandUnitVisualToken,
} from "./island/island-blueprint.js";
import {
  createIslandHeightSampler,
  islandSurfacePose,
  sampleIslandTerrainTop,
} from "./island/island-geometry.js";
import { islandThemeSelectionForCourse } from "./island/kenney-recipes.js";
import { IslandDressing } from "./island/island-dressing-render.js";
import { IslandRender } from "./island/island-render.js";
import {
  islandLookFrozen,
  islandLookSeedForCourse,
  resolveIslandLookDebug,
} from "./island/island-surface-style.js";
import { hopPose, PlayerMarker, type AvatarRecipe } from "./avatar/index.js";
import { layoutStudyRoad, radiusForLessons } from "./course/layout";
import { layoutWorldArchipelago } from "./world-layout.js";
import { hueShiftForCourse, pathNodeKind, type PathNodeKind } from "./course/path-language";
import { hash } from "./island/random.js";
import { CuteCloudSea, type CloudCarrierTarget } from "./sky/cloud-sea.js";
import {
  AerialWorldPlate,
  AerialWorldPlateFallback,
  DeepSea,
  DistantGround,
} from "./sky/horizon-sea.js";
import { MapLighting } from "./sky/lighting.js";
import { SceneFog } from "./sky/scene-fog.js";
import { SkyDome, type SkyDomeStops } from "./sky/skydome.js";
import {
  buildCourseGrid,
  type HexMap,
  worldGridFootprintLessonsForStudy,
  WORLD_STUDY_GRID_CONTRACT,
} from "./grid/course-grid.js";
import { GRID_LESSON_MARKER_COLOURS } from "./grid/grid-palette.js";
import {
  composeMarkerMatrix,
  createMarkerMatrixScratch,
  LessonMarkerField,
  type GridLessonMarker,
} from "./grid/LessonMarkerField.js";
import { LearningNodeField } from "./course/LearningNodeField.js";
import { courseLearningSites, segmentsFromPlacements } from "./course/learning-sites.js";
import {
  buildMedallionFooting,
  MARKER_PLINTH_OFFSET,
  medallionBottomRing,
  medallionPoseLocals,
  type MedallionFooting,
} from "./grid/lesson-medallion.js";
import {
  buildMedallionInlays,
  groundMedallion,
  type MedallionGrounding,
  type MedallionInlays,
} from "./grid/medallion-grounding.js";
import { RemoteIslandField, type RemoteIslandPlacement } from "./island/remote-island-render.js";
import { projectWorldCourse } from "./world-course-projection.js";
import { CourseOverviewContext } from "./camera/CourseOverview.js";
import { worldCarrierHomeTarget, worldIslandCarrierTarget } from "./world-carrier.js";
import { courseAvatarIdlePosition } from "./course-avatar-idle.js";
import { MapTravelClockContext, mapTravelStartTime, recordMapTravel } from "./map-travel-clock.js";
export { worldIslandCaptionTarget } from "./world-carrier.js";

/**
 * The world's palette. Two greens for land, one warm accent for the only thing
 * that is lit, and a sea that is dark enough for a white label to sit on.
 */
/**
 * Painted sky, as three hex stops. Exported so a test can refuse a sky that
 * has collapsed back into one colour, which is how the last one went cheap.
 *
 * The zeniths were briefly darkened by about a stop each while chasing the
 * judge's background lightness spread. It worked as arithmetic and failed as a
 * picture: the archipelago's sky and sea went murky green and the painted
 * backdrop stopped reading. Spread has to come from the sun glow, the cloud
 * shading and the water, which are things a viewer sees as light, rather than
 * from pushing one end of the gradient down.
 */
export const SKY_STOPS = {
  zenith: 0x2e7fd4,
  mid: 0x8ec8ea,
  horizon: 0xf2d4b0,
} as const;

/**
 * World-only atmosphere contract. The catalogue has cloud and sky negative
 * space, not a continuous painted floor; its lower dome stays blue and its
 * far islands dissolve into the same air with no extra geometry.
 */
export const WORLD_SKY_CONTRACT = {
  visibleSea: false,
  // The catalogue is a blue-violet air volume, not a second course sunset.
  // Keeping all four stops here makes the world projection's value relation
  // explicit instead of inheriting a study climate and moving one grade.
  zenith: 0x152d76,
  mid: 0x9ccfec,
  horizon: 0xd3efff,
  nadir: 0x526fba,
  fogColor: 0x819dcc,
  fogNearRatio: 0.55,
  fogFarRatio: 3.5,
  // A one-course field can be smaller than the fixed 62-unit arrival camera.
  // Atmospheric depth is a viewing distance, not just island radius: keep
  // that nearby subject readable without changing large catalogue haze.
  minimumFogFar: 186,
} as const;

export function worldFogRange(extent: number): readonly [number, number] {
  const safeExtent = Number.isFinite(extent) ? Math.max(0, extent) : 0;
  return [
    safeExtent * WORLD_SKY_CONTRACT.fogNearRatio,
    Math.max(WORLD_SKY_CONTRACT.minimumFogFar, safeExtent * WORLD_SKY_CONTRACT.fogFarRatio),
  ];
}

export type SkyStops = SkyDomeStops;

/**
 * The course frame is a cold sky so the warm island can sit in front of it.
 *
 * The previous stops were an illustrated sunset (rose zenith, near-cream mid,
 * tan horizon). Measured 2026-09-02 on course-design 1440×900: the sky read
 * brighter than the ground and in the same hue family, so the island had no
 * silhouette and the frame had no warm/cool relation at all — post=on
 * `backgroundLightnessSpread` was 6.6 against a 40 rail, and the whole capture
 * graded to one sheet of beige.
 *
 * Read these stops against `skydome.tsx`, not against a photograph. The course
 * camera is pitched down, so its whole frame is *below* the geometric horizon
 * and the lower branch of the dome shader is what fills it: `horizon` is the
 * top of the visible sky, then `mid`, then `nadir` at the bottom of frame.
 * `zenith` is barely on screen here. That is why the value order is horizon
 * (lightest) → mid → nadir/zenith (deepest): it makes the rim bright and the
 * air under the island deep in the shot that actually ships, and it is still a
 * correct top-to-bottom sky in the upper branch the planet page uses.
 *
 * No warm stop anywhere. Real atmosphere does warm at the rim, but a warm rim
 * is exactly what collapsed the contrast here, and the reference is an
 * illustration, not a photograph.
 */
export const COURSE_SKY_STOPS: SkyStops = {
  sunProfile: "garden",
  zenith: 0x1c5aa8,
  mid: 0x3d86c9,
  horizon: 0x7fb8e0,
  // The air below the island. Deep enough to darken toward the bottom of the
  // frame, still blue so it reads as distance rather than as a dirty band.
  nadir: 0x2f5f9c,
};

/**
 * Skies a project can have. Written down, not computed.
 *
 * This used to rotate all three stops by one hash-derived hue angle, and both
 * halves of that were wrong. A sky gradient is not one hue: the zenith is blue
 * because air scatters blue, and the horizon is warm because you are looking
 * through more of it. Rotate them together and the warm horizon becomes pink
 * or yellow, the scene's fog takes that colour, and the whole world goes with
 * it — 通用课 rendered as a pink wash with a mint dome. Worse, the angle was
 * ±0.14 turn, so `buzz`, `turing-pact` and `general` landed within four
 * degrees of each other: three projects, one climate, and the promise the
 * function's own name makes was quietly broken.
 *
 * Eight authored skies instead, each one a sky. Two projects may draw the same
 * climate, which is a smaller cost than any project drawing a sky that does
 * not exist — and a project keeps its own for as long as its id does, which a
 * round-robin over the catalogue could not promise once a sixth project
 * arrived.
 */
const CLIMATES: readonly SkyStops[] = [
  // Midday, the reference. Warm sand horizon under a clean blue.
  { zenith: 0x2e7fd4, mid: 0x8ec8ea, horizon: 0xf2d4b0 },
  // Late afternoon: the blue deepens and the horizon takes on peach.
  { zenith: 0x3a5fa8, mid: 0x9fb0dd, horizon: 0xf6c39a },
  // Early morning: everything a step paler, horizon towards cream.
  { zenith: 0x4fa3c9, mid: 0xa9dcea, horizon: 0xffe6c4 },
  // Sea fog: desaturated through the whole gradient, horizon nearly bone.
  { zenith: 0x4d7f93, mid: 0xa8c6cf, horizon: 0xe8dcc9 },
  // High and dry: the deepest zenith, horizon still sand.
  { zenith: 0x1f5fb0, mid: 0x7cb4e0, horizon: 0xf0d9bd },
  // Golden hour: same blue, a horizon with real gold in it.
  { zenith: 0x2c6ba8, mid: 0x86bcd8, horizon: 0xf3c78e },
  // Cold clear: a green-leaning blue, horizon pulled towards ash.
  { zenith: 0x2c86bd, mid: 0x93cfdf, horizon: 0xecd9c2 },
  // Warm overcast: low contrast, the horizon carrying most of the light.
  { zenith: 0x5b86ab, mid: 0xb0c8d9, horizon: 0xf4dcbe },
];

/**
 * One project, one climate. `null` is the shared default dome while the
 * catalogue has no study context; a named study gets a stable authored climate.
 */
export function skyStopsForStudy(studyId: string | null): SkyStops {
  if (!studyId) return CLIMATES[0]!;
  return CLIMATES[Math.floor(hash(studyId) * CLIMATES.length) % CLIMATES.length]!;
}

const PALETTE = {
  // The sea is most of the frame, so the sea is what sets the exposure of the
  // whole product. Measured: with a near-navy sea the scene's median linear
  // luminance came out at 0.059 and its middle 90% spanned 0.052 to 0.071 —
  // an image with no midtones, which no grade can rescue, because there is
  // nothing there to expand. A shallow, lit sea puts the median where a grade
  // can work and where the land has something to be brighter than.
  sea: 0x2f89a0,
  seaDeep: 0x1c5c72,

  // Three luminance stops, zenith → horizon. v3: a dead-white sky is the
  // cheapest 3D-demo signal; a cool cyan wash was better than white and still
  // not a sky. Saturation lives at the top, warmth at the rim. The sea number
  // above is not in this list on purpose — it was measured for exposure, and
  // rewriting it to "look more like sky" is how the midtones fall out.
  skyZenith: SKY_STOPS.zenith,
  skyMid: SKY_STOPS.mid,
  skyHorizon: SKY_STOPS.horizon,
  accent: 0xffb347,
  // A locked island multiplies its vertex colours by this, so it has to stay
  // light: a dark tint reads as a hole in the sea rather than as land that is
  // not open yet, and the shape of the course tree is information a learner is
  // entitled to see before they have earned it.
  locked: 0x94a3ad,
} as const;

export interface Marker {
  readonly lessonId?: string;
  readonly learningKind?: "personal" | "challenge" | "checkpoint";
  readonly id: string;
  readonly position: THREE.Vector3;
  readonly text: string;
  readonly sub?: string;
  readonly kind: "study" | "course" | "lesson" | "unit" | "icon";
  /**
   * What clicking this label does, when it does anything.
   *
   * A label without one is a place name — the world it sits on is not somewhere
   * you can enter. A label with one is the same target the island underneath it
   * is, and the reason it has to exist is that picking in the canvas is a mouse
   * -only affordance: before this, the entire product had no keyboard path into
   * a single course, and a screen reader was handed an `aria-hidden` layer.
   */
  readonly activate?: () => void;
  /**
   * In the DOM and reachable, but not drawn until it is focused.
   *
   * A path with forty-one names on it is not a path, it is a list lying on top
   * of a picture — and every one of them truncates, so it is a list you cannot
   * read either. Only the stone you are standing on says its name out loud.
   * The rest stay here rather than being dropped because a keyboard has no
   * other way through: quiet is a visual state, never an accessibility one.
   */
  readonly quiet?: boolean;
  /** Overrides the per-kind default. Larger wins a collision. */
  readonly weight?: number;
  /**
   * Occupies space and never moves. Kind icons sit on the stone; a name
   * that covered them would look like it belonged to the wrong step.
   */
  readonly pinned?: boolean;
  /** Where the projected point sits on the box. Unit names grow right. */
  readonly origin?: "center" | "start";
  /** Accessible name for a decorative icon. */
  readonly label?: string;
  readonly locked?: boolean;
  /** Learning state remains DOM-readable as well as a scene tint. */
  readonly lessonState?: "done" | "live" | "idle" | "locked";
  readonly proved?: boolean;
  readonly courseState?: "done" | "live" | "open" | "idle";
}

interface WorldPlacement {
  readonly node: CourseNode;
  readonly position: THREE.Vector3;
  /**
   * A renderer-facing projection of the stable continuous island geometry.
   */
  readonly blueprint: IslandBlueprint;
  /** The same course grid, projected to the remote world scale. */
  readonly grid: HexMap;
  /** State hierarchy is a transform on the shared grid, not a new mesh. */
  readonly gridScale: number;
  readonly radius: number;
  /** 0 to 1 — how much of the course is finished. */
  readonly progress: number;
  readonly state: WorldIslandVisualState;
}

/**
 * State is a visual hierarchy, not only a label. The live course gets one
 * authored lift in the overview; completed, available, and locked courses
 * remain readable satellites. Keeping this mapping independent of course or
 * study ids means a different project receives the same composition language.
 */
export type WorldIslandVisualState = "done" | "live" | "open" | "idle";

export const WORLD_ISLAND_STATE_SCALE: Readonly<Record<WorldIslandVisualState, number>> = {
  done: 0.92,
  live: 1.2,
  open: 0.98,
  idle: 0.84,
};

export function worldIslandRadiusForState(lessons: number, state: WorldIslandVisualState): number {
  return radiusForLessons(lessons) * WORLD_ISLAND_STATE_SCALE[state];
}

/**
 * The state of one course to a learner who has done `progressOf` of it.
 *
 * Unlocked is not the same as next. The accent marks exactly one place — where
 * to go now — and a map that accents everything reachable has answered "what
 * could I do" instead of "what do I do", which is the question the eight-second
 * test actually asks. So `open` is as far as this goes; exactly one `open`
 * course is promoted to `live` by whoever is looking.
 */
function stateOf(
  node: CourseNode,
  siblings: readonly CourseNode[],
  progressOf: (node: CourseNode) => number,
): WorldPlacement["state"] {
  const progress = progressOf(node);
  if (progress >= 1) return "done";
  /*
    One reading of the prerequisite graph, shared with the surfaces that say the
    same thing in words. It was an inline `every(...)` here, which meant the
    island's lighting and any card describing it were two computations of one
    fact — and 「灰是信息」 only holds while the picture and the sentence agree.

    Still only lighting. `idle` dims an island; nothing here stops it being
    entered, which is V5 §12 决定 C: 「灰是信息，锁是权力；这里我们只给信息。」
  */
  const met = prerequisitesMet(
    node,
    siblings.map((peer) => ({ courseId: peer.courseId, title: peer.title })),
    (courseId) => {
      const peer = siblings.find((candidate) => candidate.courseId === courseId);
      return peer !== undefined && progressOf(peer) >= 1;
    },
  );
  return met ? "open" : "idle";
}

/**
 * The one course to open next.
 *
 * With no `studyId`, this keeps the account-wide recommendation used to choose
 * the first map on a fresh session. Once the learner has chosen a project, the
 * same selector is scoped to that project so the DOM context and the scene
 * cannot name different places.
 *
 * When it is account-wide, a project already underway wins first. Splitting
 * this out of the map made the old ordering visible for what it was: finish
 * alpha's first course and the card would send you to *beta*, because beta's
 * opening course is shallower than alpha's second one. Depth compares two
 * courses inside one spine; across projects it is not a comparison at all.
 *
 * Within that, the shallowest course a learner can actually start wins, and
 * ties break on lesson count so a one-lesson preface does not outrank the spine
 * it introduces.
 */
export function nextCourse(
  nodes: readonly CourseNode[],
  progressOf: (node: CourseNode) => number,
  studyId?: string,
): CourseNode | null {
  const candidates = studyId ? nodes.filter((node) => node.studyId === studyId) : nodes;
  const byStudy = new Map<string, CourseNode[]>();
  for (const node of candidates) {
    byStudy.set(node.studyId, (byStudy.get(node.studyId) ?? []).concat(node));
  }
  const started = new Set(
    [...byStudy.entries()]
      .filter(([, own]) => own.some((node) => progressOf(node) > 0))
      .map(([studyId]) => studyId),
  );
  const rank = (node: CourseNode) => (started.has(node.studyId) ? 0 : 1);
  return (
    candidates
      .filter((node) => stateOf(node, byStudy.get(node.studyId) ?? [], progressOf) === "open")
      .sort((a, b) => rank(a) - rank(b) || a.depth - b.depth || b.lessons - a.lessons)[0] ?? null
  );
}

/**
 * Courses on the world map.
 *
 * `study` keeps one project's road — the authoring studio still wants that
 * close-up. `catalogue` is the learner's first screen: every published course
 * in one instanced field, focused study first so the existing camera, labels
 * and live beacon still open on the course in the top bar.
 */
export type WorldPlacementScope = "study" | "catalogue";

export { buildWorldCourseGrid } from "./world-course-projection.js";

/**
 * Build the one higher-level landmass for a study from the same world grid.
 *
 * The study picker does not need 31 course silhouettes: at this height one
 * connected field is the identity cue. The study's real course/lesson volume
 * only sizes that field; its single synthetic route anchor is deliberately not
 * a second course or lesson surface.
 */
export function buildWorldStudyGrid(input: {
  readonly studyId: string;
  readonly studyTitle: string;
  readonly courseCount: number;
  readonly lessonCount: number;
}): HexMap {
  const footprintLessons = worldGridFootprintLessonsForStudy(input.courseCount, input.lessonCount);
  return buildCourseGrid({
    studyId: input.studyId,
    courseId: `study/${input.studyId}`,
    seed: `planet/study/${input.studyId}`,
    activeLessonIndex: -1,
    projection: "world",
    footprintLessons,
    worldCellFloor: WORLD_STUDY_GRID_CONTRACT.minCells,
    lessons: [
      {
        lessonId: `study/${input.studyId}/landmass-anchor`,
        unitId: `study/${input.studyId}/landmass`,
        unitIndex: 0,
        state: "idle",
      },
    ],
  });
}

function orderedStudyNodes(nodes: readonly CourseNode[], studyId: string): CourseNode[] {
  const own = nodes.filter((node) => node.studyId === studyId);
  const spine = spineOf(studyId).map((entry) => entry.courseId);
  const rank = new Map(spine.map((courseId, index) => [courseId, index]));
  return [...own].sort(
    (a, b) =>
      (rank.get(a.courseId) ?? spine.length + a.depth) -
        (rank.get(b.courseId) ?? spine.length + b.depth) || a.courseId.localeCompare(b.courseId),
  );
}

function worldStudyOrder(nodes: readonly CourseNode[], focusedStudyId: string): readonly string[] {
  const studyIds = [...new Set(nodes.map((node) => node.studyId))].sort((a, b) =>
    a.localeCompare(b),
  );
  return [focusedStudyId, ...studyIds.filter((studyId) => studyId !== focusedStudyId)];
}

export function placeWorld(
  nodes: readonly CourseNode[],
  progressOf: (node: CourseNode) => number,
  studyId: string,
  scope: WorldPlacementScope = "study",
): { readonly placements: readonly WorldPlacement[]; readonly extent: number } {
  const siblingsByStudy = new Map<string, CourseNode[]>();
  for (const node of nodes) {
    siblingsByStudy.set(node.studyId, [...(siblingsByStudy.get(node.studyId) ?? []), node]);
  }
  const orderedNodes =
    scope === "catalogue"
      ? worldStudyOrder(nodes, studyId).flatMap((entry) => orderedStudyNodes(nodes, entry))
      : orderedStudyNodes(nodes, studyId);
  const archipelago =
    scope === "catalogue"
      ? layoutWorldArchipelago(
          orderedNodes.map((node) => ({
            key: `${node.studyId}/${node.courseId}`,
            studyId: node.studyId,
            radius:
              radiusForLessons(node.lessons) * Math.max(...Object.values(WORLD_ISLAND_STATE_SCALE)),
          })),
        )
      : null;
  const laid = archipelago?.positions ?? layoutStudyRoad(orderedNodes.map((node) => node.courseId));

  const placements: WorldPlacement[] = [];
  for (const node of orderedNodes) {
    const layoutKey = scope === "catalogue" ? `${node.studyId}/${node.courseId}` : node.courseId;
    const local = laid.get(layoutKey);
    if (!local) continue;
    const baseState = stateOf(node, siblingsByStudy.get(node.studyId) ?? [], progressOf);
    const { blueprint, grid } = projectWorldCourse(
      node,
      scope,
      baseState === "done" ? "done" : "idle",
    );
    placements.push({
      node,
      position: new THREE.Vector3(local.x, 0, local.z),
      blueprint,
      grid,
      gridScale: 1,
      radius: radiusForLessons(node.lessons),
      progress: progressOf(node),
      state: baseState,
    });
  }

  // Only the focused study owns the live beacon. Other studies remain in the
  // same field as readable satellites, but a learner should never see a
  // recommendation that belongs to a different top-bar context.
  const next = placements
    .filter((entry) => entry.node.studyId === studyId)
    .filter((entry) => entry.state === "open")
    .sort((a, b) => a.node.depth - b.node.depth || b.node.lessons - a.node.lessons)[0];
  const markedStates = placements.map((entry) => {
    const state: WorldIslandVisualState = entry === next ? "live" : entry.state;
    return {
      ...entry,
      state,
      gridScale: WORLD_ISLAND_STATE_SCALE[state],
      radius: worldIslandRadiusForState(entry.node.lessons, state),
    };
  });
  // Use existing sky gaps to make the miniature readable, without rerunning
  // the ordered shoal layout when art gets richer. Each pair puts the same
  // upper bound on both radii, so their sum still leaves 0.9 world units free.
  // This changes a projection size, never course order or position.
  const marked =
    scope === "catalogue"
      ? markedStates.map((entry) => {
          const growth = Math.min(
            1.25,
            ...markedStates
              .filter((peer) => peer !== entry)
              .map((peer) =>
                Math.max(
                  1,
                  (entry.position.distanceTo(peer.position) - 0.9) / (entry.radius + peer.radius),
                ),
              ),
          );
          return { ...entry, radius: entry.radius * growth };
        })
      : markedStates;
  const extent =
    archipelago?.extent ??
    Math.max(
      ...marked.map((entry) => Math.hypot(entry.position.x, entry.position.z) + entry.radius),
      1,
    ) + 5;
  return { placements: marked, extent };
}

/** V5 M: a series page owns its courses, not the other domains' catalogue.
 * Keep the inexpensive catalogue projection/layout and one placement producer;
 * filtering the input also prevents preparing geometry for invisible series.
 */
export function placeStudyArchipelago(
  nodes: readonly CourseNode[],
  progressOf: (node: CourseNode) => number,
  studyId: string,
): ReturnType<typeof placeWorld> {
  return placeWorld(
    nodes.filter((node) => node.studyId === studyId),
    progressOf,
    studyId,
    "catalogue",
  );
}

/**
 * How much of one course's settlement reward is built, at a given progress.
 *
 * Exported because the settlement screen tells the learner what just grew, and
 * the reward capacity is deliberately derived from the course lesson count.
 * The map itself owns the island blueprint and its semantic LOD; this helper
 * only turns the same progress fraction into a stable reward number and does
 * not create another geometry or placement model.
 *
 * `progress` is `done / total` from `readCourseProgress`. This function does
 * not grade lessons itself — it only turns that fraction into a bounded reward
 * count — so the map and the reward screen stay on one number even as the
 * shells agree on what "done" means.
 */
export function settlementSize(
  _studyId: string,
  _courseId: string,
  lessons: number,
  progress: number,
) {
  const safeLessons = Math.max(1, Math.floor(lessons));
  const capacity = Math.max(18, safeLessons * 3);
  const claim = Math.max(1, Math.round(capacity * 0.45));
  return { claim, built: Math.round(progress * claim) };
}

/*
  Causeway and StoneSteps used to live here — a plank between two islands and
  a flight of slabs between two stones. Both are gone. A drawn connection
  between two things you travel between by clicking is decoration that has to
  be kept in sync with a layout, and it was reading as scaffolding rather than
  as landscape. Order carries the sequence; nothing needs to be tied together.
*/

/** Gold ring on the live stone. Opacity and scale breathe; the learner stands in it. */
/**
 * The pulse around the one live thing.
 *
 * `lift` exists because a lesson marker's group origin is the cell top. A ring
 * drawn at a fixed height off that origin stays readable above the stone.
 */
function LiveRing({ radius, lift = 0.08 }: { radius: number; lift?: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (islandLookFrozen() || prefersReducedMotion()) return;
    const ring = mesh.current;
    if (!ring) return;
    const t = (Math.sin(clock.elapsedTime * 2.2) + 1) / 2;
    const material = ring.material;
    if (material instanceof THREE.MeshBasicMaterial) material.opacity = 0.52 + t * 0.4;
    const scale = 1 + t * 0.07;
    ring.scale.set(scale, scale, scale);
  });
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, lift, 0]}>
      <ringGeometry args={[radius * 1.02, radius * 1.2, 28]} />
      <meshBasicMaterial color={PALETTE.accent} transparent opacity={0.85} />
    </mesh>
  );
}

const MARKER_ORIGIN = new THREE.Vector3(0, 0, 0);

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * The learner's avatar hops to the node it was sent to.
 *
 * Two groups, because the ring and the avatar want different halves of the
 * motion: the ring is a mark on the ground and must stay on it, while only the
 * avatar leaves it. The squash also lives on its own group so it composes with
 * the scale `PlayerMarker` derives from the recipe's height instead of
 * overwriting it — a taller avatar would otherwise be normalised twice.
 *
 * Picking a node opens the card that offers to enter, not the lesson itself,
 * so this plays over a step the learner was taking anyway and never sits
 * between a click and its answer.
 */
export function LearnerMarker({
  position,
  initialPosition,
  recipe,
  signedIn,
  showRing = true,
  surface,
  travelKey = null,
}: {
  readonly position: THREE.Vector3;
  /** The first visible point, used when a cloud starts away from its target. */
  readonly initialPosition?: THREE.Vector3;
  readonly recipe: AvatarRecipe | null;
  readonly signedIn: boolean;
  readonly showRing?: boolean;
  /** Development-only evidence key; omitted by callers outside the map. */
  readonly surface?: "world" | "planet" | "course";
  readonly travelKey?: string | null;
}) {
  const travelClock = useContext(MapTravelClockContext);
  const travel = useRef<THREE.Group>(null);
  const lift = useRef<THREE.Group>(null);
  const initialPoint = useRef((initialPosition ?? position).clone());
  const from = useRef(initialPoint.current.clone());
  const target = useRef(initialPoint.current.clone());
  const startedAt = useRef<number | null>(null);
  const finishedAt = useRef<number | null>(null);
  const sequence = useRef(0);
  const reportOwner = useRef({});

  useEffect(() => {
    if (!import.meta.env.DEV || !surface) return;
    return () => {
      const bag = globalThis as unknown as {
        __avatarMotion?: Record<string, { readonly owner?: object }>;
      };
      if (bag.__avatarMotion?.[surface]?.owner === reportOwner.current) {
        delete bag.__avatarMotion[surface];
      }
    };
  }, [surface]);

  useLayoutEffect(() => {
    const ground = travel.current;
    if (ground && !target.current.equals(position)) {
      /*
        Retarget from wherever the avatar is now rather than from the node it
        set out from. A learner who picks a third island mid-flight should see
        one continuous move, not a rewind.
      */
      from.current.copy(ground.position);
      target.current.copy(position);
      // A real choice predates React's commit. Catch up that scheduling time
      // together with the carrier, without shortening the 420ms trajectory.
      startedAt.current = mapTravelStartTime(travelClock, travelKey, performance.now());
      finishedAt.current = null;
      sequence.current += 1;
    }
  }, [position.x, position.y, position.z, travelClock, travelKey]);

  useFrame(() => {
    if (islandLookFrozen()) return;
    const ground = travel.current;
    const body = lift.current;
    if (!ground || !body) return;
    if (startedAt.current === null) {
      ground.position.copy(position);
      if (import.meta.env.DEV && surface) {
        const bag = globalThis as unknown as {
          __avatarMotion?: Record<string, unknown>;
        };
        bag.__avatarMotion ??= {};
        bag.__avatarMotion[surface] = {
          owner: reportOwner.current,
          sequence: sequence.current,
          inFlight: false,
          startedAtPerformanceMs: null,
          finishedAt: finishedAt.current,
          position: ground.position.toArray(),
          target: target.current.toArray(),
        };
      }
      return;
    }

    const elapsedMs = Math.max(0, performance.now() - startedAt.current);
    const pose = hopPose({
      from: from.current,
      to: target.current,
      elapsedMs,
      reducedMotion: prefersReducedMotion(),
    });
    ground.position.set(pose.position.x, pose.position.y, pose.position.z);
    body.position.y = pose.lift;
    body.scale.set(1, pose.stretch, 1);
    if (pose.done) {
      startedAt.current = null;
      finishedAt.current = typeof performance === "undefined" ? null : performance.now();
    }
    if (import.meta.env.DEV && surface) {
      const bag = globalThis as unknown as {
        __avatarMotion?: Record<string, unknown>;
      };
      bag.__avatarMotion ??= {};
      bag.__avatarMotion[surface] = {
        owner: reportOwner.current,
        sequence: sequence.current,
        inFlight: startedAt.current !== null,
        startedAtPerformanceMs: startedAt.current,
        finishedAt: finishedAt.current,
        position: ground.position.toArray(),
        target: target.current.toArray(),
      };
    }
  });

  return (
    <group
      ref={travel}
      name={surface ? `learner-marker-${surface}` : "learner-marker"}
      position={initialPoint.current}
    >
      <group ref={lift}>
        <PlayerMarker position={MARKER_ORIGIN} recipe={recipe} signedIn={signedIn} />
      </group>
      {/* The ring is a navigation cue on the ground; only the avatar leaves it. */}
      {showRing ? <LiveRing radius={0.72} /> : null}
    </group>
  );
}

/** Sky, fog, and cloud deck. The shared light rig lives in `sky/lighting.tsx`. */
export function Weather({
  extent,
  fog,
  fogColor,
  sky = SKY_STOPS,
  cloudLevel = -5.2,
  groundRadius,
  includeCloudSea = true,
  includeSea = true,
  includeDistantGround = false,
  shadows = true,
  carrierTarget,
  carrierSurface,
  carrierTravelKey,
  cloudFrame,
}: {
  extent: number;
  /**
   * Where the world fades, in world units.
   *
   * Defaults to a fraction of `extent`, which is correct when the camera frames
   * the whole thing at once — the archipelago. A road is the case where it is
   * not: the course is three hundred units long and you can see forty of it, so
   * here the fog has to be told the sight line rather than the size. Derived
   * from `extent` it would begin further away than anything ever drawn, which
   * is a fog that costs a uniform and does nothing.
   */
  fog?: readonly [number, number];
  /** Atmosphere colour; world maps use the lower blue air instead of a sea tint. */
  fogColor?: number;
  sky?: SkyStops;
  /** Vertical centre of the cloud layer; course islands have deeper roots. */
  cloudLevel?: number;
  /**
   * Radius of the ground the design camera actually sees. Weather `extent`
   * sizes the sky, clouds and sea; the shadow camera must not inherit that
   * larger sphere or every tree collapses into a handful of texels.
   */
  groundRadius?: number;
  /** The course grid supplies its own three depth-aware cloud batches. */
  includeCloudSea?: boolean;
  /** Course shots use the painted sky as negative space around the island. */
  includeSea?: boolean;
  /** A faint far ground plane adds depth below the floating silhouette. */
  includeDistantGround?: boolean;
  /** The remote field skips the shadow map; hex cliffs already carry their own dark. */
  shadows?: boolean;
  /** Optional target for the last existing cloud puff, measured at bunny feet. */
  carrierTarget?: CloudCarrierTarget | null;
  /** Development-only evidence key for the carrier motion. */
  carrierSurface?: "world" | "planet";
  carrierTravelKey?: string | null;
  cloudFrame?: { readonly radius: number; readonly floor: number };
}) {
  const [, fogTo] = fog ?? [extent * 0.9, extent * 3.1];
  // FogExp2 has no near plane. Density is derived from the old far so the
  // sight-line contract stays: a course still fades where you stop reading,
  // not where the world ends. Keep it a little thinner than the old 1.15
  // factor so the new sky/cloud range is not washed back into one colour.
  const density = 0.82 / fogTo;
  const shadowedGround = groundRadius ?? extent * 0.55;
  return (
    <>
      <color attach="background" args={[sky.zenith]} />
      <SceneFog colour={fogColor ?? sky.horizon} density={density} />
      <SkyDome stops={sky} />
      <MapLighting
        groundRadius={shadowedGround}
        skyMid={sky.mid}
        shadows={shadows}
        sunProfile={sky.sunProfile}
      />
      {includeSea ? (
        <Suspense
          fallback={<AerialWorldPlateFallback extent={extent} level={cloudLevel} visible />}
        >
          <AerialWorldPlate extent={extent} level={cloudLevel} visible />
        </Suspense>
      ) : null}
      {includeSea ? <DeepSea extent={extent} level={cloudLevel} /> : null}
      {includeDistantGround ? <DistantGround extent={extent} level={cloudLevel} /> : null}
      {includeCloudSea ? (
        <CuteCloudSea
          extent={extent}
          level={cloudLevel}
          drift={!islandLookFrozen()}
          carrierTarget={carrierTarget}
          carrierSurface={carrierSurface}
          carrierTravelKey={carrierTravelKey}
          frame={cloudFrame}
        />
      ) : null}
    </>
  );
}

export function WorldScene({
  placements,
  learnerAt,
  avatarRecipe = null,
  avatarSignedIn = false,
  extent,
  selectedCourseKey = null,
  onPick,
  onHover,
  authoringFocus,
  skyStudyId = null,
  assetRevision = 0,
}: {
  placements: readonly WorldPlacement[];
  /**
   * How far the catalogue field reaches from the origin. The weather and
   * shadow frustum still size from the actual projected field, not a hard-coded
   * world radius.
   */
  extent: number;
  learnerAt: THREE.Vector3 | null;
  avatarRecipe?: AvatarRecipe | null;
  avatarSignedIn?: boolean;
  /** `studyId/courseId` while a card is open; null returns above the learning focus. */
  selectedCourseKey?: string | null;
  onPick: (node: CourseNode) => void;
  onHover: (node: CourseNode | null) => void;
  /**
   * Authoring-only. Islands not on this track dim; the learner shells omit the
   * prop because this persisted authoring preference is not navigation state.
   */
  authoringFocus?: AuthoringFocus;
  /** `null` keeps the shared default dome while no study is selected. */
  skyStudyId?: string | null;
  assetRevision?: number;
}) {
  const remoteIslands = useMemo<readonly RemoteIslandPlacement[]>(
    () =>
      placements.map((entry) => ({
        id: `${entry.node.studyId}/${entry.node.courseId}`,
        blueprint: entry.blueprint,
        position: entry.position,
        scale: 1,
        radius: entry.radius,
        dimmed: entry.state === "idle" || isFocusDimmed(entry.node, authoringFocus),
      })),
    [authoringFocus, placements],
  );
  const travelClock = useContext(MapTravelClockContext);
  const hoveredIsland = useRef<number | null>(null);
  const cloudLevel = -5.2;
  const weatherExtent = extent * 1.5;
  const cloudOrigin = useMemo(
    () => worldCarrierHomeTarget(placements, learnerAt, weatherExtent, cloudLevel),
    [placements, learnerAt, weatherExtent],
  );
  const cloudHomeTarget = useMemo<CloudCarrierTarget>(
    () => worldCarrierHomeTarget(placements, learnerAt, weatherExtent, cloudLevel),
    [placements, learnerAt, weatherExtent],
  );
  const selectedPlacement = useMemo(
    () =>
      selectedCourseKey
        ? (placements.find(
            (entry) => `${entry.node.studyId}/${entry.node.courseId}` === selectedCourseKey,
          ) ?? null)
        : null,
    [placements, selectedCourseKey],
  );
  const carrierTarget = useMemo<CloudCarrierTarget>(
    () =>
      selectedPlacement
        ? worldIslandCarrierTarget(selectedPlacement, weatherExtent, cloudLevel)
        : cloudHomeTarget,
    [cloudHomeTarget, selectedPlacement, weatherExtent],
  );
  const carrierPosition = useMemo(() => new THREE.Vector3(...carrierTarget), [carrierTarget]);
  const carrierInitialPosition = useMemo(() => new THREE.Vector3(...cloudOrigin), [cloudOrigin]);
  const sky = useMemo(
    () => ({
      ...skyStopsForStudy(skyStudyId),
      zenith: WORLD_SKY_CONTRACT.zenith,
      mid: WORLD_SKY_CONTRACT.mid,
      horizon: WORLD_SKY_CONTRACT.horizon,
      nadir: WORLD_SKY_CONTRACT.nadir,
      sunProfile: "catalogue" as const,
    }),
    [skyStudyId],
  );

  return (
    <>
      <Weather
        extent={weatherExtent}
        groundRadius={extent * 0.9}
        fog={worldFogRange(extent)}
        fogColor={WORLD_SKY_CONTRACT.fogColor}
        sky={sky}
        cloudLevel={cloudLevel}
        includeSea={WORLD_SKY_CONTRACT.visibleSea}
        includeDistantGround
        shadows={false}
        carrierTarget={carrierTarget}
        carrierSurface="world"
        carrierTravelKey={selectedPlacement?.node.courseId ?? null}
        cloudFrame={{
          radius: Math.max(
            3,
            ...remoteIslands.map((island) => island.radius ?? island.blueprint.bounds.maxHalf),
          ),
          floor: Math.min(
            -2,
            ...remoteIslands.map(
              (island) =>
                island.position.y +
                (island.lift ?? 0) -
                (island.blueprint.underside.depth / island.blueprint.bounds.maxHalf) *
                  (island.radius ?? island.blueprint.bounds.maxHalf) *
                  (island.scale ?? 1) *
                  1.08,
            ),
          ),
        }}
      />
      {/*
        No roads between islands. The catalogue is an archipelago field, not a
        prerequisite diagram: order survives in labels and state, while the
        shared remote field supplies the 53 continuous silhouettes.
      */}
      <RemoteIslandField
        key={assetRevision}
        islands={remoteIslands}
        onPick={(islandIndex) => {
          const entry = placements[islandIndex];
          if (!entry) return;
          recordMapTravel(travelClock, entry.node.courseId, performance.now());
          playSound("map.select");
          onPick(entry.node);
        }}
        onHover={(islandIndex) => {
          if (islandIndex === hoveredIsland.current) return;
          hoveredIsland.current = islandIndex;
          const entry = islandIndex === null ? undefined : placements[islandIndex];
          if (entry) playSound("map.hover");
          onHover(entry?.node ?? null);
        }}
      />
      {placements.length > 0 ? (
        <LearnerMarker
          position={carrierPosition}
          initialPosition={carrierInitialPosition}
          recipe={avatarRecipe}
          signedIn={avatarSignedIn}
          showRing={selectedPlacement !== null}
          surface="world"
          travelKey={selectedPlacement?.node.courseId ?? null}
        />
      ) : null}
    </>
  );
}

export interface LessonPlacement {
  readonly studyId: string;
  readonly courseId: string;
  readonly unitId: string;
  readonly unitTitle: string;
  readonly unitIndex: number;
  readonly lessonId: string;
  readonly lessonTitle: string;
  readonly chars: number;
  readonly position: THREE.Vector3;
  readonly state: "done" | "live" | "idle" | "locked";
  readonly kind: PathNodeKind;
  /** Grass hue offset for this course, from `hueShiftForCourse`. */
  readonly hueShift: number;
  /**
   * The serialisable island identity that placed this lesson. Keeping the
   * object on the placement lets the course renderer consume the exact same
   * blueprint that was built from real lesson/unit ids instead of regenerating
   * a parallel layout from a count.
   */
  readonly blueprint: IslandBlueprint;
  readonly visualToken: IslandUnitVisualToken;
}

export function placeCourse(
  studyId: string,
  course: Course,
  source: ProgressSource,
): LessonPlacement[] {
  const shape = courseShapeOf(course, studyId);
  const { next } = readCourseProgress(shape, source);
  const flat = course.units.flatMap((unit, unitIndex) =>
    unit.lessons.map((lesson, slot) => ({ unit, unitIndex, lesson, slot })),
  );
  const lookDebug = resolveIslandLookDebug();
  const lookSample = lookDebug.shot?.startsWith("course-") === true && lookDebug.seed === course.id;
  const sampleFlat =
    lookSample && lookDebug.lessonCount !== undefined
      ? flat.slice(0, Math.min(flat.length, lookDebug.lessonCount))
      : flat;
  if (sampleFlat.length === 0) return [];
  const geometry = islandGeometryBlueprint({
    studyId,
    courseId: course.id,
    lessonCount: sampleFlat.length,
    seed:
      lookSample && lookDebug.layoutSeed
        ? lookDebug.layoutSeed
        : islandLookSeedForCourse(course.id),
    routeArchetype: lookSample ? (lookDebug.routeArchetype ?? undefined) : undefined,
    themeSelection: islandThemeSelectionForCourse(studyId, course.id),
  });
  const blueprint = projectIslandBlueprint(geometry, {
    lessonIds: sampleFlat.map(({ lesson }) => lesson.id),
    unitIds: sampleFlat.map(({ unit }) => unit.id),
  });
  const hueShift = hueShiftForCourse(studyId, course.id);
  const firstOpen = next
    ? sampleFlat.findIndex(
        (entry) => entry.unit.id === next.unitId && entry.lesson.id === next.lessonId,
      )
    : -1;
  const states = sampleFlat.map((entry, index) => {
    const lessonShape = shape.units[entry.unitIndex]!.lessons[entry.slot]!;
    const done = isLessonComplete(
      source.completionOf(
        {
          studyId,
          courseId: course.id,
          unitId: entry.unit.id,
          lessonId: entry.lesson.id,
        },
        lessonShape,
      ),
    );
    return done
      ? ("done" as const)
      : index === firstOpen
        ? ("live" as const)
        : index > firstOpen + 3
          ? ("locked" as const)
          : ("idle" as const);
  });
  return sampleFlat.map((entry, index) => {
    const node = blueprint.nodes[index]!;
    const surface = sampleIslandTerrainTop(blueprint, "course", node.x, node.z);
    return {
      studyId,
      courseId: course.id,
      unitId: entry.unit.id,
      unitTitle: entry.unit.title,
      unitIndex: entry.unitIndex,
      lessonId: entry.lesson.id,
      lessonTitle: entry.lesson.title,
      chars: entry.lesson.content.length,
      // Markers sit on the same rendered triangle-top dressing samples, not
      // the analytic height field the mesh approximates.
      position: new THREE.Vector3(node.x, surface.y, node.z),
      state: states[index]!,
      kind: pathNodeKind({
        variant: entry.lesson.variant,
        exercises: entry.lesson.exercises.length,
        cards: entry.lesson.cards.length,
        slot: entry.slot,
        unitLength: entry.unit.lessons.length,
      }),
      hueShift,
      blueprint,
      visualToken: node.visualToken,
    };
  });
}

/**
 * The surface of one island, sized to hold its own road.
 *
 * A course used to be a chain of small islands in the air, one per lesson, tied
 * together with planks. That put the course's structure in the sky and made
 * every lesson look like a destination, when a lesson is a step. So there is
 * one island — the course — and the lessons are markers lying on it.
 *
 * The island is a unit-radius lathe scaled per axis, which is why a long course
 * is a long ridge rather than a bigger circle: the ground follows the road, and
 * the road's length is the number of lessons. Rough on purpose; the shape of
 * the terrain is not carrying information yet.
 */
export function courseIslandScale(lessons: number, studyId = "course", courseId = "course") {
  const blueprint = islandBlueprint({
    studyId,
    courseId,
    lessonCount: Math.max(1, Math.floor(lessons)),
  });
  return { x: blueprint.bounds.halfX, y: 1, z: blueprint.bounds.halfZ };
}

/**
 * Where the ground is under a point on the course island.
 *
 * The blueprint, the terrain mesh, the trail and every marker ask this same
 * continuous rule. That is why a world-map icon can become course ground
 * without a second height approximation or a marker hovering over the turf.
 */
export function courseSurfaceY(
  x: number,
  z: number,
  lessons: number,
  studyId = "course",
  courseId = "course",
): number {
  return sampleIslandSurface(
    islandBlueprint({
      studyId,
      courseId,
      lessonCount: Math.max(1, Math.floor(lessons)),
    }),
    x,
    z,
  ).y;
}

/**
 * Lesson stones are the coral pavers on the ivory road. Their colour comes
 * from the one reviewed accent ramp, never a second invented orange. Live is
 * the lightest step so the next lesson still reads first; every other stone
 * stays in the same hue so the path matches the reference instead of turning
 * into a row of dark tokens.
 */

/* The renderer owns the single route ribbon; no second trail is drawn here. */

/**
 * How far the rigid medallion may be raised so its chamfer stays in the air.
 * Ground contact is the footing, not this number.
 */
const MARKER_MAX_RAISE = 0.12;

export interface CourseLessonLayout {
  readonly idlePosition: THREE.Vector3 | null;
  readonly markers: readonly GridLessonMarker[];
  readonly footing: MedallionFooting;
  readonly inlays: MedallionInlays;
  readonly recoveries: readonly {
    readonly lessonId: string;
    readonly grounding: MedallionGrounding;
  }[];
}

/**
 * Lesson medallions plus the one footing mesh that meets the drawn ground.
 *
 * Radius, ids, positions and ordering stay as authored. The rigid disc is
 * posed so the chamfer is visible; the footing closes the seam underneath.
 */
export function layoutCourseLessons(
  blueprint: IslandBlueprint,
  lessons: readonly LessonPlacement[],
): CourseLessonLayout {
  const ground = createIslandHeightSampler(blueprint);
  try {
    const locals = medallionPoseLocals();
    const recoveries: { lessonId: string; grounding: MedallionGrounding }[] = [];
    const markers: GridLessonMarker[] = lessons.map((lesson) => {
      const radius =
        blueprint.route.nodeRadius *
        (0.96 + Math.min(1, Math.max(0, lesson.chars) / 12_000) * 0.08);
      const pose = islandSurfacePose(blueprint, "course", lesson.position.x, lesson.position.z, {
        radius,
        originOffset: radius * MARKER_PLINTH_OFFSET,
        maxEmbed: radius * MARKER_MAX_RAISE,
        locals,
        heightAt: ground.heightAt,
        originY: lesson.position.y,
      });
      const grounding = groundMedallion({
        position: lesson.position,
        radius,
        normal: new THREE.Vector3(...pose.normal),
        lift: pose.lift,
        heightAt: ground.heightAt,
        surface: ground.index,
      });
      if (grounding.mode !== "plane") recoveries.push({ lessonId: lesson.lessonId, grounding });
      return {
        lesson,
        radius,
        colour: GRID_LESSON_MARKER_COLOURS[lesson.state],
        sigil: lesson.visualToken.sigil,
        unitIndex: lesson.unitIndex,
        ...(grounding.mode === "inlay" ? { grounding: "inlay" as const } : {}),
        surface: {
          normal: grounding.normal,
          lift: grounding.lift,
        },
      };
    });
    const matrix = new THREE.Matrix4();
    const scratch = createMarkerMatrixScratch();
    const ring = medallionBottomRing();
    const rings = markers
      .filter((marker) => marker.grounding !== "inlay")
      .map((marker) => {
        composeMarkerMatrix(marker, MARKER_PLINTH_OFFSET, marker.radius, matrix, scratch);
        return ring.map((point) =>
          new THREE.Vector3(point.x, point.y, point.z).applyMatrix4(matrix),
        );
      });
    const footing = buildMedallionFooting(rings, ground.heightAt, ground.index);
    const inlays = buildMedallionInlays(
      markers.flatMap((marker, markerIndex) =>
        marker.grounding === "inlay"
          ? [
              {
                markerIndex,
                position: marker.lesson.position,
                radius: marker.radius,
                sigil: marker.sigil,
                state: marker.lesson.state,
              },
            ]
          : [],
      ),
      ground.index,
    );
    const idlePosition = courseAvatarIdlePosition(
      lessons,
      blueprint.route.nodeRadius,
      ground.heightAt,
    );
    return { markers, footing, inlays, recoveries, idlePosition };
  } finally {
    ground.dispose();
  }
}

export function courseLessonMarkers(
  blueprint: IslandBlueprint,
  lessons: readonly LessonPlacement[],
): readonly GridLessonMarker[] {
  const layout = layoutCourseLessons(blueprint, lessons);
  layout.footing.geometry?.dispose();
  layout.inlays.geometry?.dispose();
  return layout.markers;
}

/**
 * Inside a course: one island, and the lessons lying on it in order.
 */
export function CourseScene({
  lessons,
  avatarRecipe = null,
  avatarSignedIn = false,
  avatarLessonId = null,
  onPick,
  onHover,
  skyStudyId: _skyStudyId = null,
  assetRevision = 0,
}: {
  lessons: readonly LessonPlacement[];
  avatarRecipe?: AvatarRecipe | null;
  avatarSignedIn?: boolean;
  /** The cell selected before opening a lesson, retained through settlement. */
  avatarLessonId?: string | null;
  onPick: (lesson: LessonPlacement) => void;
  onHover: (lesson: LessonPlacement | null) => void;
  skyStudyId?: string | null;
  assetRevision?: number;
}) {
  const overview = useContext(CourseOverviewContext);
  const travelClock = useContext(MapTravelClockContext);
  const avatarLesson = avatarLessonId
    ? (lessons.find((lesson) => lesson.lessonId === avatarLessonId) ?? null)
    : null;
  const avatarAt = avatarLesson;
  const studyId = lessons[0]?.studyId ?? "course";
  const courseId = lessons[0]?.courseId ?? "course";
  const blueprint = useMemo(
    () =>
      lessons[0]?.blueprint ??
      islandBlueprint({
        studyId,
        courseId,
        lessonCount: Math.max(1, lessons.length),
        lessonIds: lessons.map((lesson) => lesson.lessonId),
        unitIds: lessons.map((lesson) => lesson.unitId),
        themeSelection: islandThemeSelectionForCourse(studyId, courseId),
      }),
    [courseId, lessons, studyId],
  );
  const extent = blueprint.bounds.maxHalf;
  const layout = useMemo(() => layoutCourseLessons(blueprint, lessons), [blueprint, lessons]);
  const markers = layout.markers;
  /*
    Only the segment the learner is in draws its three objects, matching the
    chips: V5 shows the nearby nodes and keeps the rest in the course's list.
  */
  const learningSites = useMemo(() => {
    const nearby = nearestLearningSegment(
      segmentsFromPlacements(lessons),
      lessons.find((lesson) => lesson.state === "live")?.lessonId,
    );
    return nearby
      ? courseLearningSites(lessons).filter((site) => site.segment.id === nearby.id)
      : [];
  }, [lessons]);
  useEffect(() => {
    return () => {
      layout.footing.geometry?.dispose();
      layout.inlays.geometry?.dispose();
    };
  }, [layout]);

  return (
    <>
      {/*
        Sight line past the readable markers, not the length of the road. Fog
        used to start at 52, which ate locked nodes into the same grey as "far
        away". Locked is a colour treatment; fog only takes the ones you have
        already stopped reading.
      */}
      {/*
        `Weather` already lays a cloud sea *under* the islands. A CloudField
        used to sit here as well, centred five lessons ahead of the learner —
        which was five islands away when lessons were islands, and is five
        metres away now that they are markers on one. It rendered as a white
        blob lying on the ground covering three of them.
      */}
      <Weather
        extent={extent * 1.6}
        groundRadius={extent}
        fog={
          overview
            ? [
                Math.max(88, overview.distance + overview.radius * 1.1),
                Math.max(280, overview.distance + overview.radius * 6),
              ]
            : [88, 280]
        }
        sky={COURSE_SKY_STOPS}
        cloudLevel={-10.2}
        includeCloudSea={false}
        includeSea={false}
        includeDistantGround
      />
      <IslandRender blueprint={blueprint} detail="course" />
      <Suspense fallback={null}>
        <IslandDressing key={assetRevision} blueprint={blueprint} detail="course" />
      </Suspense>
      <LessonMarkerField
        markers={markers}
        footing={layout.footing.geometry}
        inlays={layout.inlays}
        onPick={(lesson) => {
          recordMapTravel(travelClock, lesson.lessonId, performance.now());
          onPick(lesson);
        }}
        onHover={onHover}
      />
      <LearningNodeField sites={learningSites} />
      {avatarAt || layout.idlePosition ? (
        <LearnerMarker
          position={(avatarAt?.position ?? layout.idlePosition)!}
          recipe={avatarRecipe}
          signedIn={avatarSignedIn}
          showRing={avatarAt !== null}
          surface="course"
          travelKey={avatarAt?.lessonId ?? null}
        />
      ) : null}
    </>
  );
}
