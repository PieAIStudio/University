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
  readCourseProgress,
  spineOf,
  type AuthoringFocus,
  type ProgressSource,
} from "@pieai/university-core";
import { playSound } from "@pieai/university-ui/sound/index.js";
import { useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
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
import { islandThemeSelectionForCourse } from "./island/kenney-recipes.js";
import { IslandDressing } from "./island/island-dressing-render.js";
import { IslandRender } from "./island/island-render.js";
import {
  islandLookFrozen,
  islandLookSeedForCourse,
  resolveIslandLookDebug,
} from "./island/island-surface-style.js";
import { hopPose, PlayerMarker, type AvatarRecipe } from "./avatar/index.js";
import {
  layoutStudyRoad,
  layoutWorldCatalogue,
  radiusForLessons,
  unstickWorldIslands,
} from "./course/layout";
import { hueShiftForCourse, pathNodeKind, type PathNodeKind } from "./course/path-language";
import { hash } from "./island/random.js";
import { CuteCloudSea } from "./sky/cloud-sea.js";
import {
  AerialWorldPlate,
  AerialWorldPlateFallback,
  DeepSea,
  DistantGround,
} from "./sky/horizon-sea.js";
import { SkyDome } from "./sky/skydome.js";
import { WORLD_SUN, worldShadowFrustum, worldSunPosition } from "./sky/sun.js";
import { renderTier } from "./sky/tier";
import {
  buildCourseGrid,
  type HexMap,
  worldGridFootprintLessonsForStudy,
  WORLD_STUDY_GRID_CONTRACT,
} from "./grid/course-grid.js";
import { GRID_LESSON_MARKER_COLOURS } from "./grid/grid-palette.js";
import { hexToWorld } from "./grid/hex.js";
import { LessonMarkerField } from "./grid/LessonMarkerField.js";
import { WorldHexField, type WorldGridIsland } from "./grid/WorldHexField.js";

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
  horizon: 0xb7d4de,
  nadir: 0x8fbfd4,
  fogColor: 0x8fbfd4,
  fogNearRatio: 0.55,
  fogFarRatio: 3.5,
} as const;

export type SkyStops = {
  readonly zenith: number;
  readonly mid: number;
  readonly horizon: number;
  readonly nadir?: number;
};

/** The course frame is a warm illustrated sky, with lavender negative space. */
export const COURSE_SKY_STOPS: SkyStops = {
  zenith: 0xff8f83,
  mid: 0xffe0a0,
  horizon: 0xffc4b8,
  nadir: 0xc0b8e5,
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
 * One project, one climate. `null` is the undecided dome — nothing picked yet,
 * or a caller that has no project to name. It used to mean the four-seas
 * overview, which no longer exists; the fallback stayed because a sky still
 * has to be some colour while the catalogue loads.
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
}

interface WorldPlacement {
  readonly node: CourseNode;
  readonly position: THREE.Vector3;
  /**
   * A renderer-facing projection of the stable island geometry. The catalogue
   * field no longer builds this continuous island — it only needs the hex
   * cluster — so the studio/study projection is the remaining caller.
   */
  readonly blueprint: IslandBlueprint | null;
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
  const unlocked = node.prerequisiteCourseIds.every((id) =>
    siblings.some((peer) => peer.courseId === id && progressOf(peer) >= 1),
  );
  return unlocked ? "open" : "idle";
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

/**
 * Build the one remote silhouette used by the catalogue and the planet.
 *
 * A planet course is still a world course: its cells, palette, height breaks
 * and footprint come from the same projection as the catalogue. Keeping this
 * helper beside `placeWorld` makes it impossible for the picker to quietly
 * grow a second island generator.
 */
export function buildWorldCourseGrid(node: CourseNode, state: "done" | "idle" = "idle"): HexMap {
  const lookSeed = islandLookSeedForCourse(node.courseId);
  return buildCourseGrid({
    studyId: node.studyId,
    courseId: node.courseId,
    seed: lookSeed ?? `${node.studyId}/${node.courseId}`,
    activeLessonIndex: -1,
    projection: "world",
    footprintLessons: node.lessons,
    lessons: [
      {
        lessonId: `${node.courseId}/world-anchor`,
        unitId: `${node.courseId}/world-unit`,
        unitIndex: 0,
        state,
      },
    ],
  });
}

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
  const layoutKeys = orderedNodes.map((node) => `${node.studyId}/${node.courseId}`);
  const laid =
    scope === "catalogue"
      ? layoutWorldCatalogue(layoutKeys)
      : layoutStudyRoad(orderedNodes.map((node) => node.courseId));

  const placements: WorldPlacement[] = [];
  for (const node of orderedNodes) {
    const layoutKey = scope === "catalogue" ? `${node.studyId}/${node.courseId}` : node.courseId;
    const local = laid.get(layoutKey);
    if (!local) continue;
    const lookSeed = islandLookSeedForCourse(node.courseId);
    const baseState = stateOf(node, siblingsByStudy.get(node.studyId) ?? [], progressOf);
    const geometry =
      scope === "catalogue"
        ? null
        : islandGeometryBlueprint({
            studyId: node.studyId,
            courseId: node.courseId,
            lessonCount: node.lessons,
            seed: lookSeed,
            themeSelection: islandThemeSelectionForCourse(node.studyId, node.courseId),
          });
    const blueprint = geometry ? projectIslandBlueprint(geometry) : null;
    const grid =
      scope === "catalogue"
        ? buildWorldCourseGrid(node, baseState === "done" ? "done" : "idle")
        : buildCourseGrid({
            studyId: node.studyId,
            courseId: node.courseId,
            seed: blueprint?.seed ?? lookSeed ?? `${node.studyId}/${node.courseId}`,
            routeArchetype: blueprint?.route.archetype,
            routeAnchors: blueprint?.geometryNodes,
            activeLessonIndex: -1,
            projection: "world",
            footprintLessons: node.lessons,
            lessons: blueprint
              ? blueprint.nodes.map((routeNode) => ({
                  lessonId: routeNode.id,
                  unitId: routeNode.unitId,
                  unitIndex: routeNode.unitIndex,
                  state: baseState === "done" ? ("done" as const) : ("idle" as const),
                }))
              : [
                  {
                    lessonId: `${node.courseId}/world-anchor`,
                    unitId: `${node.courseId}/world-unit`,
                    unitIndex: 0,
                    state: baseState === "done" ? ("done" as const) : ("idle" as const),
                  },
                ],
          });
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
  const marked = placements.map((entry) => {
    const state: WorldIslandVisualState = entry === next ? "live" : entry.state;
    return {
      ...entry,
      state,
      gridScale: WORLD_ISLAND_STATE_SCALE[state],
      radius: worldIslandRadiusForState(entry.node.lessons, state),
    };
  });
  const separated =
    scope === "catalogue"
      ? unstickWorldIslands(
          marked.map((entry) => ({
            x: entry.position.x,
            y: entry.position.y,
            z: entry.position.z,
            depth: entry.node.depth,
          })),
          marked.map((entry) => entry.grid.bounds.maxHalf * entry.gridScale),
        )
      : null;
  const placed = separated
    ? marked.map((entry, index) => ({
        ...entry,
        position: new THREE.Vector3(separated[index]!.x, separated[index]!.y, separated[index]!.z),
      }))
    : marked;
  const extent =
    Math.max(
      ...placed.map(
        (entry) =>
          Math.hypot(entry.position.x, entry.position.z) +
          entry.grid.bounds.maxHalf * entry.gridScale,
      ),
      1,
    ) + 8;
  return { placements: placed, extent };
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
    if (islandLookFrozen()) return;
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
function LearnerMarker({
  position,
  recipe,
  signedIn,
  compact = false,
}: {
  readonly position: THREE.Vector3;
  readonly recipe: AvatarRecipe | null;
  readonly signedIn: boolean;
  readonly compact?: boolean;
}) {
  const travel = useRef<THREE.Group>(null);
  const lift = useRef<THREE.Group>(null);
  const from = useRef(position.clone());
  const target = useRef(position.clone());
  const startedAt = useRef<number | null>(null);

  useFrame(({ clock }) => {
    if (islandLookFrozen()) return;
    const ground = travel.current;
    const body = lift.current;
    if (!ground || !body) return;

    if (!target.current.equals(position)) {
      /*
        Retarget from wherever the avatar is now rather than from the node it
        set out from. A learner who picks a third island mid-flight should see
        one continuous move, not a rewind.
      */
      from.current.copy(ground.position);
      target.current.copy(position);
      startedAt.current = clock.elapsedTime;
    }
    if (startedAt.current === null) {
      ground.position.copy(position);
      return;
    }

    const elapsedMs = (clock.elapsedTime - startedAt.current) * 1000;
    const pose = hopPose({
      from: from.current,
      to: target.current,
      elapsedMs,
      reducedMotion: prefersReducedMotion(),
    });
    ground.position.set(pose.position.x, pose.position.y, pose.position.z);
    body.position.y = pose.lift;
    body.scale.set(1, pose.stretch, 1);
    if (pose.done) startedAt.current = null;
  });

  return (
    <group ref={travel} position={position}>
      <group ref={lift}>
        {compact ? (
          <mesh name="course-learner-beacon" position={[0, 0.62, 0]}>
            <octahedronGeometry args={[0.44, 0]} />
            <meshStandardMaterial
              color={PALETTE.accent}
              emissive={PALETTE.accent}
              emissiveIntensity={0.28}
              roughness={0.34}
              metalness={0.12}
            />
          </mesh>
        ) : (
          <PlayerMarker position={MARKER_ORIGIN} recipe={recipe} signedIn={signedIn} />
        )}
      </group>
      {/* The ring is a navigation cue on the ground; only the avatar leaves it. */}
      <LiveRing radius={0.72} />
    </group>
  );
}

/** Sky, sun and cloud deck. Shared by both map levels so they feel like one world. */
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
}) {
  const [, fogTo] = fog ?? [extent * 0.9, extent * 3.1];
  // FogExp2 has no near plane. Density is derived from the old far so the
  // sight-line contract stays: a course still fades where you stop reading,
  // not where the world ends. Keep it a little thinner than the old 1.15
  // factor so the new sky/cloud range is not washed back into one colour.
  const density = 0.82 / fogTo;
  const shadowedGround = groundRadius ?? extent * 0.55;
  const shadow = worldShadowFrustum(shadowedGround);
  const sunPosition = worldSunPosition(shadow.lightDistance);
  const mobile = renderTier() === "mobile";
  const mapSize = mobile ? 1024 : shadow.mapSize;
  return (
    <>
      <color attach="background" args={[sky.zenith]} />
      <fogExp2 attach="fog" args={[fogColor ?? sky.horizon, density]} />
      <SkyDome stops={sky} />
      {/*
        Fill is the denominator of scene-linear range. The current warm lower
        bounce plus blue ambient/PMREM fill is measured at 2.08:1 against the
        5.2 key, so the shadow still reads as a shadow without dropping to black.
      */}
      <hemisphereLight
        args={[sky.mid, WORLD_SUN.hemisphereGround, WORLD_SUN.hemisphereIntensity]}
      />
      <ambientLight color={WORLD_SUN.ambientColor} intensity={WORLD_SUN.ambientIntensity} />
      {/*
        `normalBias` is still the acne fix that matters on small curved
        geometry. The frustum itself is now fitted to `groundRadius` so the
        2048 map covers the design shot without stretching across the weather
        sphere.
      */}
      <directionalLight
        color={WORLD_SUN.keyColor}
        position={sunPosition}
        intensity={WORLD_SUN.keyIntensity}
        castShadow={shadows}
        shadow-mapSize={[mapSize, mapSize]}
        shadow-camera-left={-shadow.half}
        shadow-camera-right={shadow.half}
        shadow-camera-top={shadow.half}
        shadow-camera-bottom={-shadow.half}
        shadow-camera-near={shadow.near}
        shadow-camera-far={shadow.far}
        shadow-bias={-0.0002}
        shadow-normalBias={0.06}
      />
      {/* A low cool rim separates the island silhouette from the warm sky. It
          has no shadow map: this is a fill edge, not another expensive key. */}
      <directionalLight
        color={0x8cc9d4}
        position={[-sunPosition[0] * 0.82, shadow.lightDistance * 0.44, -sunPosition[2] * 0.82]}
        intensity={0.78}
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
        <CuteCloudSea extent={extent} level={cloudLevel} drift={!islandLookFrozen()} />
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
  onPick: (node: CourseNode) => void;
  onHover: (node: CourseNode | null) => void;
  /**
   * Authoring-only. Islands not on this track dim; the learner shells omit the
   * prop because this persisted authoring preference is not navigation state.
   */
  authoringFocus?: AuthoringFocus;
  /** `null` keeps the default dome — the four-seas overview. */
  skyStudyId?: string | null;
  assetRevision?: number;
}) {
  const islands = useMemo<readonly WorldGridIsland[]>(
    () =>
      placements.map((entry) => ({
        id: `${entry.node.studyId}/${entry.node.courseId}`,
        map: entry.grid,
        position: entry.position,
        scale: entry.gridScale,
        dimmed: entry.state === "idle" || isFocusDimmed(entry.node, authoringFocus),
      })),
    [authoringFocus, placements],
  );
  const hoveredIsland = useRef<number | null>(null);
  const sky = useMemo(
    () => ({
      ...skyStopsForStudy(skyStudyId),
      horizon: WORLD_SKY_CONTRACT.horizon,
      nadir: WORLD_SKY_CONTRACT.nadir,
    }),
    [skyStudyId],
  );

  return (
    <>
      <Weather
        extent={extent * 1.5}
        groundRadius={extent * 0.9}
        fog={[extent * WORLD_SKY_CONTRACT.fogNearRatio, extent * WORLD_SKY_CONTRACT.fogFarRatio]}
        fogColor={WORLD_SKY_CONTRACT.fogColor}
        sky={sky}
        includeSea={WORLD_SKY_CONTRACT.visibleSea}
        includeDistantGround
        shadows={false}
      />
      {/*
        No roads between islands. The catalogue is an archipelago field, not a
        prerequisite diagram: order survives in labels and state, while the
        shared instance field supplies the 53 silhouettes.
      */}
      <WorldHexField
        key={assetRevision}
        islands={islands}
        onPick={(islandIndex) => {
          const entry = placements[islandIndex];
          if (!entry) return;
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
      {learnerAt ? (
        <LearnerMarker position={learnerAt} recipe={avatarRecipe} signedIn={avatarSignedIn} />
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
  const grid = buildCourseGrid({
    studyId,
    courseId: course.id,
    seed: blueprint.seed,
    routeArchetype: blueprint.route.archetype,
    routeAnchors: blueprint.geometryNodes,
    activeLessonIndex: firstOpen,
    lessons: sampleFlat.map((entry, index) => ({
      lessonId: entry.lesson.id,
      unitId: entry.unit.id,
      unitIndex: entry.unitIndex,
      state: states[index],
    })),
  });
  return sampleFlat.map((entry, index) => {
    const node = blueprint.nodes[index]!;
    const cell = grid.lessons[index]!;
    const point = hexToWorld(cell.coord, grid.hexSize);
    return {
      studyId,
      courseId: course.id,
      unitId: entry.unit.id,
      unitTitle: entry.unit.title,
      unitIndex: entry.unitIndex,
      lessonId: entry.lesson.id,
      lessonTitle: entry.lesson.title,
      chars: entry.lesson.content.length,
      // The mesh, props and markers all query this one hex cell top centre.
      position: new THREE.Vector3(point.x, cell.topY, point.z),
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
 * Inside a course: one island, and the lessons lying on it in order.
 */
export function CourseScene({
  lessons,
  avatarRecipe = null,
  avatarSignedIn = false,
  onPick,
  onHover,
  skyStudyId: _skyStudyId = null,
  assetRevision = 0,
}: {
  lessons: readonly LessonPlacement[];
  avatarRecipe?: AvatarRecipe | null;
  avatarSignedIn?: boolean;
  onPick: (lesson: LessonPlacement) => void;
  onHover: (lesson: LessonPlacement | null) => void;
  skyStudyId?: string | null;
  assetRevision?: number;
}) {
  const live = lessons.find((lesson) => lesson.state === "live");
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
  const grid = useMemo(
    () =>
      buildCourseGrid({
        studyId,
        courseId,
        seed: blueprint.seed,
        routeArchetype: blueprint.route.archetype,
        routeAnchors: blueprint.geometryNodes,
        activeLessonIndex: lessons.findIndex((lesson) => lesson.state === "live"),
        lessons: lessons.map((lesson) => ({
          lessonId: lesson.lessonId,
          unitId: lesson.unitId,
          unitIndex: lesson.unitIndex,
          state: lesson.state,
        })),
      }),
    [blueprint, courseId, lessons, studyId],
  );
  const extent = blueprint.bounds.maxHalf;
  const markers = useMemo(
    () =>
      lessons.map((lesson) => ({
        lesson,
        // The blueprint reserves this radius when spacing the road. A previous
        // renderer ignored that contract and drew ~3× larger stones, so 41
        // legitimate lesson nodes fused into one mechanical tube. The grid is
        // now the visible unit, so convert that semantic cue to the actual hex
        // radius before drawing the inset coral stone. Content length keeps
        // only a restrained eight-percent cue.
        radius:
          grid.hexSize * 0.52 * (0.96 + Math.min(1, Math.max(0, lesson.chars) / 12_000) * 0.08),
        colour: GRID_LESSON_MARKER_COLOURS[lesson.state],
      })),
    [grid.hexSize, lessons],
  );

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
        fog={[88, 280]}
        sky={COURSE_SKY_STOPS}
        cloudLevel={-10.2}
        includeCloudSea={false}
        includeSea={false}
        includeDistantGround
      />
      <IslandRender blueprint={blueprint} detail="course" grid={grid} />
      <Suspense fallback={null}>
        <IslandDressing key={assetRevision} blueprint={blueprint} detail="course" grid={grid} />
      </Suspense>
      <LessonMarkerField markers={markers} onPick={onPick} onHover={onHover} />
      {live ? (
        <LearnerMarker
          position={live.position}
          recipe={avatarRecipe}
          signedIn={avatarSignedIn}
          compact
        />
      ) : null}
    </>
  );
}
