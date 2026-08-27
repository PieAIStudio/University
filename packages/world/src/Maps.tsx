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
import { IslandRender, UnitSigil } from "./island/island-render.js";
import { islandLookFrozen, islandLookSeedForCourse } from "./island/island-surface-style.js";
import { hopPose, PlayerMarker, type AvatarRecipe } from "./avatar/index.js";
import { layoutStudyRoad, radiusForLessons } from "./course/layout";
import { hueShiftForCourse, pathNodeKind, type PathNodeKind } from "./course/path-language";
import { hash } from "./island/random.js";
import { CuteCloudSea } from "./sky/cloud-sea.js";
import { AerialWorldPlate, AerialWorldPlateFallback, DeepSea } from "./sky/horizon-sea.js";
import { SkyDome } from "./sky/skydome.js";
import { WORLD_SUN, worldShadowFrustum, worldSunPosition } from "./sky/sun.js";
import { renderTier } from "./sky/tier";

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

export type SkyStops = { readonly zenith: number; readonly mid: number; readonly horizon: number };

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
   * A renderer-facing projection of the stable island geometry. The world only
   * has course summary data, so its node ids are synthetic; the course projects
   * real lesson/unit ids onto the same geometry base.
   */
  readonly blueprint: IslandBlueprint;
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
 * The one course to open next, across every project.
 *
 * Lifted out of `placeWorld` when the map stopped showing every project at
 * once. Two different questions were being answered by one number: "where am I
 * standing on this map" is local to the project you are looking at, and "what
 * should I do today" is not — a learner who wanders into Buzz to have a look
 * has not stopped being three lessons from finishing TuringPact. The 「今天」
 * card asks the second question, so it gets its own answer.
 *
 * A project already underway wins first. Splitting this out of the map made the
 * old ordering visible for what it was: finish alpha's first course and the
 * card would send you to *beta*, because beta's opening course is shallower
 * than alpha's second one. Depth compares two courses inside one spine; across
 * projects it is not a comparison at all. Somebody halfway into a project is
 * telling you which project they are doing.
 *
 * Within that, the shallowest course a learner can actually start wins, and
 * ties break on lesson count so a one-lesson preface does not outrank the spine
 * it introduces.
 */
export function nextCourse(
  nodes: readonly CourseNode[],
  progressOf: (node: CourseNode) => number,
): CourseNode | null {
  const byStudy = new Map<string, CourseNode[]>();
  for (const node of nodes) {
    byStudy.set(node.studyId, (byStudy.get(node.studyId) ?? []).concat(node));
  }
  const started = new Set(
    [...byStudy.entries()]
      .filter(([, own]) => own.some((node) => progressOf(node) > 0))
      .map(([studyId]) => studyId),
  );
  const rank = (node: CourseNode) => (started.has(node.studyId) ? 0 : 1);
  return (
    nodes
      .filter((node) => stateOf(node, byStudy.get(node.studyId) ?? [], progressOf) === "open")
      .sort((a, b) => rank(a) - rank(b) || a.depth - b.depth || b.lessons - a.lessons)[0] ?? null
  );
}

/**
 * One project's courses, laid out around the origin.
 *
 * This used to place all four projects at once, on a ring, in one sea — and it
 * was the boss who worked out why that was wrong. Two reasons, both real:
 * dragging the map a little too far lands you among another project's islands
 * with the top bar still naming the one you left, and a single ground plate
 * stretched over four projects has to cover roughly three times the distance,
 * at which point its resolution stops holding up and you can see it repeat.
 *
 * So a project is a place, not a region of a bigger place. The way to another
 * project is to say so — the switcher, or the planet — not to keep dragging and
 * hope. Nothing else is in this scene, which is also why the pan has no fence:
 * there is nothing on the other side of it to wander into.
 */
export function placeWorld(
  nodes: readonly CourseNode[],
  progressOf: (node: CourseNode) => number,
  studyId: string,
): { readonly placements: readonly WorldPlacement[]; readonly extent: number } {
  const own = nodes.filter((node) => node.studyId === studyId);

  // Teaching order, not graph order. The spine is authored and validated as a
  // legal linear extension of the prerequisites, so walking it is walking the
  // graph. A course missing from the spine (a draft, an import that has not
  // been slotted yet) falls in behind the spine by depth, so it is on the road
  // rather than at the origin.
  const spine = spineOf(studyId).map((entry) => entry.courseId);
  const rank = new Map(spine.map((courseId, index) => [courseId, index]));
  const ordered = [...own]
    .sort(
      (a, b) =>
        (rank.get(a.courseId) ?? spine.length + a.depth) -
          (rank.get(b.courseId) ?? spine.length + b.depth) || a.courseId.localeCompare(b.courseId),
    )
    .map((node) => node.courseId);
  const laid = layoutStudyRoad(ordered);
  const extent =
    Math.max(...[...laid.values()].map((point) => Math.hypot(point.x, point.z)), 1) + 8;

  const placements: WorldPlacement[] = [];
  for (const node of own) {
    const local = laid.get(node.courseId);
    if (!local) continue;
    const geometry = islandGeometryBlueprint({
      studyId: node.studyId,
      courseId: node.courseId,
      lessonCount: node.lessons,
      seed: islandLookSeedForCourse(node.courseId),
      themeSelection: islandThemeSelectionForCourse(node.studyId, node.courseId),
    });
    const blueprint = projectIslandBlueprint(geometry);
    placements.push({
      node,
      position: new THREE.Vector3(local.x, 0, local.z),
      blueprint,
      radius: radiusForLessons(node.lessons),
      progress: progressOf(node),
      state: stateOf(node, own, progressOf),
    });
  }

  // The live course is this project's own next, not the whole catalogue's. On
  // a map that only shows one project, an accent pointing at a course that is
  // not in the frame would be a light with nothing under it.
  const next = placements
    .filter((entry) => entry.state === "open")
    .sort((a, b) => a.node.depth - b.node.depth || b.node.lessons - a.node.lessons)[0];
  const marked = placements.map((entry) => {
    const state: WorldIslandVisualState = entry === next ? "live" : entry.state;
    return {
      ...entry,
      state,
      radius: worldIslandRadiusForState(entry.node.lessons, state),
    };
  });
  return { placements: marked, extent };
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

function Island({
  entry,
  dimmed = false,
  onClick,
  onOver,
}: {
  entry: WorldPlacement;
  /** Authoring focus track: this island is one the learner is ignoring. */
  dimmed?: boolean;
  onClick: () => void;
  onOver: (over: boolean) => void;
}) {
  const locked = entry.state === "idle";
  return (
    <group
      position={entry.position}
      onClick={(event) => {
        // Stop at the island boundary so a click on a child mesh cannot also
        // reach another island or the stage's pointer-miss handler.
        event.stopPropagation();
        playSound("map.select");
        onClick();
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        playSound("map.hover");
        onOver(true);
      }}
      onPointerOut={() => onOver(false)}
    >
      <IslandRender
        blueprint={entry.blueprint}
        detail="world"
        targetRadius={entry.radius}
        dimmed={locked || dimmed}
      />
      <Suspense fallback={null}>
        <IslandDressing blueprint={entry.blueprint} detail="world" targetRadius={entry.radius} />
      </Suspense>
      {/*
        Foam used to mark the waterline. The islands now sit above a cloud
        sea, and a ring in the air would be the waterline of a missing ocean.
      */}
    </group>
  );
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
 * `lift` exists because a lesson marker is deliberately sunk into the ground
 * (see MARKER_BIAS), so its group origin is below the surface. A ring drawn at
 * a fixed height off that origin comes out half-buried, which on screen is not
 * a ring at all — it is two gold slivers either side of the marker.
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
}: {
  readonly position: THREE.Vector3;
  readonly recipe: AvatarRecipe | null;
  readonly signedIn: boolean;
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
        <PlayerMarker position={MARKER_ORIGIN} recipe={recipe} signedIn={signedIn} />
      </group>
      {/* The ring is a navigation cue on the ground; only the avatar leaves it. */}
      <LiveRing radius={0.72} />
    </group>
  );
}

/** Sky, sun and sea. Shared by both map levels so they feel like one world. */
function Weather({
  extent,
  fog,
  sky = SKY_STOPS,
  cloudLevel = -5.2,
  groundRadius,
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
  sky?: SkyStops;
  /** Vertical centre of the cloud layer; course islands have deeper roots. */
  cloudLevel?: number;
  /**
   * Radius of the ground the design camera actually sees. Weather `extent`
   * sizes the sky, clouds and sea; the shadow camera must not inherit that
   * larger sphere or every tree collapses into a handful of texels.
   */
  groundRadius?: number;
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
      <fogExp2 attach="fog" args={[sky.horizon, density]} />
      <SkyDome stops={sky} />
      {/*
        Fill is the denominator of scene-linear range. The previous 1.35 + 0.22
        pair sat under a 2.1 key and erased every shadow; a little cool bounce
        is kept so p05 stays above zero.
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
        castShadow
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
      <Suspense fallback={<AerialWorldPlateFallback extent={extent} level={cloudLevel} />}>
        <AerialWorldPlate extent={extent} level={cloudLevel} />
      </Suspense>
      <DeepSea extent={extent} level={cloudLevel} />
      <CuteCloudSea extent={extent} level={cloudLevel} drift={!islandLookFrozen()} />
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
  focus,
  skyStudyId = null,
}: {
  placements: readonly WorldPlacement[];
  /**
   * How far this project's road reaches from the origin. It used to be the
   * radius of a ring holding every project; one project per scene means the
   * weather, the cloud sea and the ground plate can be sized to the thing
   * actually in front of the camera instead of to the whole catalogue.
   */
  extent: number;
  learnerAt: THREE.Vector3 | null;
  avatarRecipe?: AvatarRecipe | null;
  avatarSignedIn?: boolean;
  onPick: (node: CourseNode) => void;
  onHover: (node: CourseNode | null) => void;
  /**
   * Authoring-only. Islands not on this track dim; the delivery shell
   * omits the prop and the world looks as it does today.
   */
  focus?: { readonly studyId: string; readonly courseIds: readonly string[] };
  /** `null` keeps the default dome — the four-seas overview. */
  skyStudyId?: string | null;
}) {
  return (
    <>
      <Weather
        extent={extent * 1.5}
        groundRadius={extent * 0.9}
        sky={skyStopsForStudy(skyStudyId)}
      />
      {/*
        No roads between islands. They used to be drawn from
        `prerequisiteCourseIds`, one causeway per edge — furniture for a graph
        the learner cannot walk anyway, and the thing that made the sea read as
        a diagram. The order is the road now; the islands sit on it.
      */}
      {placements.map((entry) => (
        <Island
          key={`${entry.node.studyId}/${entry.node.courseId}`}
          entry={entry}
          dimmed={isFocusDimmed(entry.node, focus)}
          onClick={() => onPick(entry.node)}
          onOver={(over) => onHover(over ? entry.node : null)}
        />
      ))}
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
  if (flat.length === 0) return [];
  const geometry = islandGeometryBlueprint({
    studyId,
    courseId: course.id,
    lessonCount: flat.length,
    seed: islandLookSeedForCourse(course.id),
    themeSelection: islandThemeSelectionForCourse(studyId, course.id),
  });
  const blueprint = projectIslandBlueprint(geometry, {
    lessonIds: flat.map(({ lesson }) => lesson.id),
    unitIds: flat.map(({ unit }) => unit.id),
  });
  const hueShift = hueShiftForCourse(studyId, course.id);
  const firstOpen = next
    ? flat.findIndex((entry) => entry.unit.id === next.unitId && entry.lesson.id === next.lessonId)
    : -1;
  return flat.map((entry, index) => {
    const lessonShape = shape.units[entry.unitIndex]!.lessons[entry.slot]!;
    const node = blueprint.nodes[index]!;
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
    return {
      studyId,
      courseId: course.id,
      unitId: entry.unit.id,
      unitTitle: entry.unit.title,
      unitIndex: entry.unitIndex,
      lessonId: entry.lesson.id,
      lessonTitle: entry.lesson.title,
      chars: entry.lesson.content.length,
      // The mesh, props and markers all query this one continuous surface.
      position: new THREE.Vector3(node.x, node.y - MARKER_SINK, node.z),
      state: done
        ? "done"
        : index === firstOpen
          ? "live"
          : index > firstOpen + 3
            ? "locked"
            : "idle",
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

/** A shallow seat in the turf; enough to belong to the ground, not disappear in it. */
const MARKER_SINK = 0.025;

/**
 * The colour of a lesson marker.
 *
 * Four states, and only one of them is warm and bright. The accent belongs to
 * exactly one marker on the island — the next lesson — for the same reason the
 * beacon burns on exactly one island in the sea: a map that highlights
 * everything available has answered "what could I do", and the question is
 * "what do I do".
 */
const MARKER_COLOUR = {
  done: 0xcbb277,
  live: PALETTE.accent,
  idle: 0xe8e4d8,
  locked: 0x8f959c,
} as const;

function LessonMarker({
  lesson,
  radius,
  onPick,
  onHover,
}: {
  lesson: LessonPlacement;
  radius: number;
  onPick: (lesson: LessonPlacement) => void;
  onHover: (lesson: LessonPlacement | null) => void;
}) {
  return (
    <group
      position={lesson.position}
      onClick={(event) => {
        event.stopPropagation();
        playSound("map.select");
        onPick(lesson);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        playSound("map.hover");
        onHover(lesson);
      }}
      onPointerOut={() => onHover(null)}
    >
      <mesh position={[0, radius * 0.1, 0]} castShadow receiveShadow>
        {/*
          Slightly wider at the base than the top, so the light finds an edge
          and the marker reads as a disc set into the ground rather than as a
          circle painted on it. Sixteen sides at this size is already a circle;
          more is spent on nothing.
        */}
        <cylinderGeometry args={[radius, radius * 1.06, radius * 0.2, 18]} />
        <meshStandardMaterial
          color={MARKER_COLOUR[lesson.state]}
          roughness={lesson.state === "live" ? 0.5 : 0.85}
          emissive={lesson.state === "live" ? PALETTE.accent : 0x000000}
          emissiveIntensity={lesson.state === "live" ? 0.32 : 0}
          flatShading
        />
      </mesh>
      <UnitSigil
        sigil={lesson.visualToken.sigil}
        unitIndex={lesson.unitIndex}
        radius={radius}
        active={lesson.state === "live"}
      />
      {lesson.state === "live" ? <LiveRing radius={radius * 1.5} lift={radius * 0.22} /> : null}
    </group>
  );
}

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
  skyStudyId = null,
}: {
  lessons: readonly LessonPlacement[];
  avatarRecipe?: AvatarRecipe | null;
  avatarSignedIn?: boolean;
  onPick: (lesson: LessonPlacement) => void;
  onHover: (lesson: LessonPlacement | null) => void;
  skyStudyId?: string | null;
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
  const extent = blueprint.bounds.maxHalf;
  const markers = useMemo(
    () =>
      lessons.map((lesson) => ({
        lesson,
        // The blueprint reserves this radius when spacing the road. A previous
        // renderer ignored that contract and drew ~3× larger stones, so 41
        // legitimate lesson nodes fused into one mechanical tube. Content
        // length keeps only a restrained eight-percent cue.
        radius:
          blueprint.route.nodeRadius *
          (0.96 + Math.min(1, Math.max(0, lesson.chars) / 12_000) * 0.08),
      })),
    [blueprint.route.nodeRadius, lessons],
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
        sky={skyStopsForStudy(skyStudyId)}
        cloudLevel={-10.2}
      />
      <IslandRender blueprint={blueprint} detail="course" />
      <Suspense fallback={null}>
        <IslandDressing blueprint={blueprint} detail="course" />
      </Suspense>
      {markers.map(({ lesson, radius }) => (
        <LessonMarker
          key={lesson.lessonId}
          lesson={lesson}
          radius={radius}
          onPick={onPick}
          onHover={onHover}
        />
      ))}
      {live ? (
        <LearnerMarker position={live.position} recipe={avatarRecipe} signedIn={avatarSignedIn} />
      ) : null}
    </>
  );
}
