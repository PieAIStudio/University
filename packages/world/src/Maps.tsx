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
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import aerialWorldPlate2k from "./assets/generated/aerial-world-plate-2k.webp?url";
import aerialWorldPlate4k from "./assets/generated/aerial-world-plate-4k.webp?url";
import { cloudPuffs } from "./cloud-layout.js";
import { courseShapeOf, isFocusDimmed, type Course, type CourseNode } from "./course";
import { GeneratedCourseLandmark } from "./island/generated-landmark.js";
import { islandBlueprint, islandSurfaceY, type IslandBlueprint } from "./island/island-blueprint.js";
import { buildBlueprintIsland } from "./island/island-geometry.js";
import { PropField, type Placement, type Role } from "./kit";
import { layoutCourse, layoutStudyRoad, radiusForLessons } from "./layout";
import { stoneRadius } from "./path-overlay";
import { hueShiftForCourse, pathNodeKind, type PathNodeKind } from "./path-language";
import { hash, seeded } from "./island/random.js";
import { renderTier } from "./tier";

/**
 * The world's palette. Two greens for land, one warm accent for the only thing
 * that is lit, and a sea that is dark enough for a white label to sit on.
 */
/**
 * Painted sky, as three hex stops. Exported so a test can refuse a sky that
 * has collapsed back into one colour, which is how the last one went cheap.
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

const TREES: Role[] = ["tree-broad-a", "tree-broad-b", "tree-tall-a", "tree-tall-b"];
const SCRUB: Role[] = ["bush", "bush-flowering", "fern", "mushroom"];
const STONES: Role[] = ["rock-a", "rock-b", "rock-c"];
/** A settlement fills in this order, so growth has a shape a learner can feel. */
const BUILDINGS: Role[] = ["well", "house-small", "house-mid", "house-small", "house-large"];

interface WorldPlacement {
  readonly node: CourseNode;
  readonly position: THREE.Vector3;
  readonly radius: number;
  /** 0 to 1 — how much of the course is finished. */
  readonly progress: number;
  readonly state: "done" | "live" | "open" | "idle";
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
    placements.push({
      node,
      position: new THREE.Vector3(local.x, 0, local.z),
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
  const marked = placements.map((entry) =>
    entry === next ? { ...entry, state: "live" as const } : entry,
  );
  return { placements: marked, extent };
}

/**
 * Decide what stands on one island.
 *
 * Slots come back from the shared blueprint scattered; sorting them by distance from
 * the middle is what turns a scatter into a settlement — buildings take the
 * centre, nature keeps the shore, and the boundary between them moves outward
 * as the course is finished.
 */
function dress(entry: WorldPlacement) {
  const random = seeded(`${entry.node.studyId}/${entry.node.courseId}/dress`);
  const { ordered, claim, built } = settlementSize(
    entry.node.studyId,
    entry.node.courseId,
    entry.node.lessons,
    entry.progress,
  );

  const out = new Map<Role, Placement[]>();
  const push = (role: Role, at: Placement) => {
    const list = out.get(role) ?? [];
    list.push(at);
    out.set(role, list);
  };
  const world = (local: THREE.Vector3) => local.clone().add(entry.position);

  ordered.forEach((slot, index) => {
    const turn = random() * Math.PI * 2;
    if (index < claim) {
      // The settlement band. Empty until the course is worked through.
      if (index >= built) return;
      const role =
        entry.state === "done" && index === 0 ? "hall" : BUILDINGS[index % BUILDINGS.length]!;
      push(role, {
        position: world(slot),
        height: entry.radius * (role === "hall" ? 0.5 : 0.34),
        turn,
      });
      return;
    }
    // The wild band. Always there.
    const roll = random();
    const role =
      roll < 0.5
        ? TREES[Math.floor(random() * TREES.length)]!
        : roll < 0.78
          ? SCRUB[Math.floor(random() * SCRUB.length)]!
          : STONES[Math.floor(random() * STONES.length)]!;
    const height =
      entry.radius * (TREES.includes(role) ? 0.42 + random() * 0.22 : 0.14 + random() * 0.1);
    push(role, { position: world(slot), height, turn });
  });

  // One lit thing in the whole world. Its height has to match the slot height
  // the island's own surface sits at, or it is buried inside the hill — void
  // is not a rendering error anyone gets to see, so this is the kind of thing
  // that just looks like "the beacon never worked".
  if (entry.state === "live") {
    const blueprint = islandBlueprint(entry.node.studyId, entry.node.courseId, entry.node.lessons);
    const shape = shapeOf(
      entry.node.studyId,
      entry.node.courseId,
      entry.node.lessons,
      entry.radius,
    );
    const [x, z] = blueprint.anchors.entrance;
    push("beacon", {
      position: world(
        new THREE.Vector3(
          x * shape.horizontalScale,
          islandSurfaceY(blueprint, x, z) * shape.heightScale,
          z * shape.horizontalScale,
        ),
      ),
      height: entry.radius * 0.34,
      turn: 0,
    });
  }
  return out;
}

/** Geometry is cached by blueprint version and semantic detail. */
const shapes = new Map<string, ReturnType<typeof buildBlueprintIsland>>();

/** Slots nearest the middle first: the order the settlement fills in. */
function settlementSlots(studyId: string, courseId: string, lessons: number, radius: number) {
  const { slots } = shapeOf(studyId, courseId, lessons, radius);
  return [...slots].sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
}

/**
 * How much of one island is built, at a given progress.
 *
 * Exported because the settlement screen tells the learner what just grew, and
 * it was answering that from its own arithmetic — `lessons * 0.45` against the
 * lesson count, while the map used `0.45` against the *slot* count, which comes
 * from the island's radius. The two agreed only by coincidence. A reward screen
 * that claims a house appeared where none did is worse than one that says
 * nothing, so both now ask the same function.
 *
 * `progress` is `done / total` from `readCourseProgress`. This function does
 * not count lessons itself — it only turns that fraction into buildings — so
 * the map and the reward screen stay on one number even as the shells agree
 * on what "done" means.
 */
export function settlementSize(
  studyId: string,
  courseId: string,
  lessons: number,
  progress: number,
) {
  const ordered = settlementSlots(studyId, courseId, lessons, radiusForLessons(lessons));
  const claim = Math.max(1, Math.round(ordered.length * 0.45));
  return { ordered, claim, built: Math.round(progress * claim) };
}

function shapeOf(studyId: string, courseId: string, lessons: number, radius: number) {
  const blueprint = islandBlueprint(studyId, courseId, lessons);
  const key = `${blueprint.version}/${blueprint.seed}/${blueprint.lessons}/world/${radius.toFixed(2)}`;
  const found = shapes.get(key);
  if (found) return found;
  const made = buildBlueprintIsland(blueprint, "world", radius);
  shapes.set(key, made);
  return made;
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
  const blueprint = islandBlueprint(entry.node.studyId, entry.node.courseId, entry.node.lessons);
  const shape = shapeOf(entry.node.studyId, entry.node.courseId, entry.node.lessons, entry.radius);
  const locked = entry.state === "idle";
  const [landmarkX, landmarkZ] = blueprint.anchors.landmark;
  const landmarkAt = [
    landmarkX * shape.horizontalScale,
    islandSurfaceY(blueprint, landmarkX, landmarkZ) * shape.heightScale,
    landmarkZ * shape.horizontalScale,
  ] as const;
  return (
    <group position={entry.position}>
      <mesh
        geometry={shape.geometry}
        castShadow
        receiveShadow
        onClick={(event) => {
          // Islands register a pointer handler; sea and sky do not.
          // R3F only raycasts `internal.interaction` (objects with
          // handlers), so this stop is what makes a sea click a miss —
          // Stage's onPointerMissed is that miss. Without it, a pick
          // would also look like empty space and close the card it
          // just opened.
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
        <meshStandardMaterial
          vertexColors
          flatShading
          roughness={0.94}
          metalness={0}
          // A locked island is the same island seen through colder air. Hiding
          // it would hide the shape of the course tree, which is information.
          // Focus-dimmed islands use the same colder air: they are still
          // places, just not the ones this session is walking.
          color={locked || dimmed ? PALETTE.locked : 0xffffff}
        />
      </mesh>
      <Suspense fallback={null}>
        <GeneratedCourseLandmark
          studyId={entry.node.studyId}
          courseId={entry.node.courseId}
          position={landmarkAt}
          height={entry.radius * 0.58}
          detail="world"
        />
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

/** The learner. Small, bobbing, and always on the island the map is telling you about. */
function Learner({ position, scale = 1 }: { position: THREE.Vector3; scale?: number }) {
  const body = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  useFrame((state, delta) => {
    if (ring.current) ring.current.rotation.z += delta * 0.6;
    if (body.current) body.current.position.y = Math.sin(state.clock.elapsedTime * 1.6) * 0.08;
  });
  return (
    <group position={position} scale={scale}>
      <group ref={body}>
        <mesh position={[0, 0.62, 0]} castShadow>
          <capsuleGeometry args={[0.3, 0.5, 4, 12]} />
          <meshStandardMaterial color={0xf6f2e8} roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.12, 0]} castShadow>
          <sphereGeometry args={[0.24, 12, 10]} />
          <meshStandardMaterial color={0xe9c9a3} roughness={0.7} />
        </mesh>
      </group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <ringGeometry args={[0.6, 0.86, 28]} />
        <meshBasicMaterial color={PALETTE.accent} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

/**
 * Three-stop sky, glued to the camera so it never leaves the far clip.
 *
 * drei's `<Sky>` is a Preetham atmosphere. That is a real sky for a real
 * landscape, and the wrong language for a low-poly board whose colour script
 * names hex stops. A dome we can pin to those stops is the cheaper, more
 * honest fit — and it does not pull a second lighting model into a scene
 * that already has a hemisphere and a sun.
 */
function SkyDome({ stops }: { stops: SkyStops }) {
  const mesh = useRef<THREE.Mesh>(null);
  const uniforms = useRef({
    uZenith: { value: new THREE.Color(stops.zenith) },
    uMid: { value: new THREE.Color(stops.mid) },
    uHorizon: { value: new THREE.Color(stops.horizon) },
  }).current;
  uniforms.uZenith.value.setHex(stops.zenith);
  uniforms.uMid.value.setHex(stops.mid);
  uniforms.uHorizon.value.setHex(stops.horizon);
  useFrame(({ camera }) => {
    mesh.current?.position.copy(camera.position);
  });
  return (
    <mesh ref={mesh} frustumCulled={false} renderOrder={-1000}>
      <sphereGeometry args={[420, 24, 16]} />
      <shaderMaterial
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
        uniforms={uniforms}
        vertexShader={SKY_VERTEX}
        fragmentShader={SKY_FRAGMENT}
      />
    </mesh>
  );
}

/**
 * A layer of flattened puffs under the islands. This is the depth the flat
 * sea could not give: looking down, you see through clouds to a further
 * ocean, so the islands can hang.
 */
function CloudSea({ extent, level }: { extent: number; level: number }) {
  const mobile = renderTier() === "mobile";
  const puffs = useMemo(() => cloudPuffs(extent, mobile, level), [extent, level, mobile]);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const lobes = useMemo(
    () =>
      puffs.flatMap((puff) => [
        { x: -0.3, y: -0.02, z: 0.08, scale: 0.62, puff },
        { x: 0.28, y: 0, z: 0.03, scale: 0.58, puff },
        { x: 0.02, y: 0.08, z: -0.22, scale: 0.72, puff },
        { x: 0.05, y: -0.03, z: 0.27, scale: 0.5, puff },
      ]),
    [puffs],
  );
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const dummy = new THREE.Object3D();
    lobes.forEach((lobe, index) => {
      const scale = lobe.puff.scale * lobe.scale;
      dummy.position.set(
        lobe.puff.position[0] + lobe.x * lobe.puff.scale,
        lobe.puff.position[1] + lobe.y * lobe.puff.scale,
        lobe.puff.position[2] + lobe.z * lobe.puff.scale,
      );
      dummy.scale.set(scale, scale * 0.28, scale * 0.82);
      dummy.updateMatrix();
      target.setMatrixAt(index, dummy.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, [lobes]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, Math.max(lobes.length, 1)]}>
      <sphereGeometry args={[1, 16, 10]} />
      <meshStandardMaterial
        color={0xf2eee8}
        roughness={1}
        metalness={0}
        transparent
        opacity={0.72}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

/**
 * A deliberately low-frequency aerial plate below the cloud deck.
 *
 * This is background scenery, not another source of world truth: the playable
 * islands, their landmarks and their path all remain 3D and come from the
 * versioned blueprint. The plate only gives the eye the same cue it gets from
 * an aeroplane window — distant coast, sea depth and cloud shadow. Keeping it
 * on a horizontal disc also avoids pretending a top-down painting is an HDRI.
 */
/**
 * Big enough that the sea reaches past the frame at the widest world camera.
 * `WORLD_DISTANCE_MIN * sin(WORLD_POLAR)` is roughly half the ground the
 * camera covers; twice that with room to spare.
 */
const WORLD_PLATE_MIN_RADIUS = 130;

function AerialWorldPlate({ extent, level }: { extent: number; level: number }) {
  const mobile = renderTier() === "mobile";
  const gl = useThree((state) => state.gl);
  const sourceTexture = useLoader(
    THREE.TextureLoader,
    mobile ? aerialWorldPlate2k : aerialWorldPlate4k,
  );
  // useLoader caches by URL. World and course views need different UV offsets,
  // so mutating the cached texture would let the last route poison the next.
  const texture = useMemo(() => sourceTexture.clone(), [sourceTexture]);

  useLayoutEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.MirroredRepeatWrapping;
    texture.wrapT = THREE.MirroredRepeatWrapping;
    texture.repeat.set(1.32, 1.32);
    // The overview looks at a much larger central patch than a course camera.
    // Shift that patch toward a coastline; otherwise it samples only the
    // quiet middle of the sea and the authored 2D depth reads as a flat fill.
    texture.offset.set(level > -8 ? 0.06 : -0.16, -0.16);
    texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    texture.needsUpdate = true;
    return () => texture.dispose();
  }, [gl, level, texture]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, level - 4, 0]}>
      {/*
        A floor under the radius, not just a multiple of the world.

        `extent` is how far the furthest course sits from the origin, so a
        series with one course gives about 9 and a plate about 13 across —
        while the camera sits 62 back and sees a ground footprint several times
        that. The result was a visible disc of sea with sky beyond it: the edge
        of the world, in a product whose first screen is a world. The floor is
        set past what this camera can see at `WORLD_DISTANCE_MIN`.
      */}
      <circleGeometry args={[Math.max(extent * 1.45, WORLD_PLATE_MIN_RADIUS), 96]} />
      <meshBasicMaterial map={texture} color={0xe8f5ef} transparent opacity={0.7} fog={false} />
    </mesh>
  );
}

function AerialWorldPlateFallback({ extent, level }: { extent: number; level: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, level - 4, 0]} receiveShadow>
      <circleGeometry args={[Math.max(extent * 3.2, WORLD_PLATE_MIN_RADIUS), 64]} />
      <meshStandardMaterial color={PALETTE.sea} roughness={0.72} metalness={0} />
    </mesh>
  );
}

const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uMid;
uniform vec3 uHorizon;
varying vec3 vDir;
void main() {
  float h = normalize(vDir).y;
  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.22, h));
  col = mix(col, uZenith, smoothstep(0.22, 0.88, h));
  vec3 nadir = uHorizon * 0.78;
  col = mix(nadir, col, smoothstep(-0.2, 0.0, h));
  gl_FragColor = vec4(col, 1.0);
}
`;

/** Sky, sun and sea. Shared by both map levels so they feel like one world. */
function Weather({
  extent,
  fog,
  sky = SKY_STOPS,
  cloudLevel = -5.2,
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
}) {
  const [, fogTo] = fog ?? [extent * 0.9, extent * 3.1];
  // FogExp2 has no near plane. Density is derived from the old far so the
  // sight-line contract stays: a course still fades where you stop reading,
  // not where the world ends. Linear-with-near ate less of the mid-ground;
  // if locked stones collapse into the horizon, this number is the lever.
  const density = 1.15 / fogTo;
  return (
    <>
      <color attach="background" args={[sky.zenith]} />
      <fogExp2 attach="fog" args={[sky.horizon, density]} />
      <SkyDome stops={sky} />
      {/*
        Hemisphere sky is a stop lighter than the painted zenith on purpose:
        the dome can sit at a saturated blue without pulling the islands'
        midtones down with it. Ground stays the moss the land already is.
      */}
      <hemisphereLight args={[sky.mid, 0x786e5f, 1.35]} />
      <ambientLight color={sky.horizon} intensity={0.22} />
      {/*
        The shadow camera is deliberately far smaller than the world.
        Stretched across the whole archipelago, one 2048 map gives each texel a
        quarter of a world unit — and a tree is one and a half units tall, so
        every prop lands inside six texels and shadows itself into a black
        silhouette. That is shadow acne, and it looks exactly like "the model
        failed to load", which is what cost the time here. `normalBias` is the
        fix that matters: it pushes the shadow lookup along the surface normal,
        which is what small curved geometry needs. `bias` alone just trades
        acne for peter-panning.
      */}
      <directionalLight
        position={[extent * 0.5, extent * 0.9, extent * 0.35]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-extent * 0.3}
        shadow-camera-right={extent * 0.3}
        shadow-camera-top={extent * 0.3}
        shadow-camera-bottom={-extent * 0.3}
        shadow-camera-far={extent * 4}
        shadow-bias={-0.0002}
        shadow-normalBias={0.06}
      />
      {/*
        The ocean planet is still there — it is just further down. The sea
        hex is the exposure measurement; lowering the disc does not rewrite
        it. Clouds sit between the islands and that disc so looking down is
        looking through a layer, not at a painted floor.
      */}
      <Suspense fallback={<AerialWorldPlateFallback extent={extent} level={cloudLevel} />}>
        <AerialWorldPlate extent={extent} level={cloudLevel} />
      </Suspense>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, cloudLevel - 5.8, 0]}>
        <circleGeometry args={[extent * 3.4, 48]} />
        <meshBasicMaterial color={PALETTE.seaDeep} />
      </mesh>
      <CloudSea extent={extent} level={cloudLevel} />
    </>
  );
}

export function WorldScene({
  placements,
  learnerAt,
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
  // Every prop in the world, gathered per model so each becomes one instanced
  // draw rather than one draw per tree.
  const fields = useMemo(() => {
    const merged = new Map<Role, Placement[]>();
    for (const entry of placements) {
      for (const [role, list] of dress(entry)) {
        merged.set(role, (merged.get(role) ?? []).concat(list));
      }
    }
    return [...merged.entries()];
  }, [placements]);

  return (
    <>
      <Weather extent={extent * 1.5} sky={skyStopsForStudy(skyStudyId)} />
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
      {/*
        Only the kit models suspend, so only they sit behind a boundary. Sky,
        sea, islands and roads are computed here and owe nothing to the network
        — gating them on a tree finishing its download is what turns a slow
        connection into a blank screen instead of a world that fills in.
      */}
      <Suspense fallback={null}>
        {fields.map(([role, at]) => (
          <PropField key={role} role={role} at={at} />
        ))}
      </Suspense>
      {learnerAt ? <Learner position={learnerAt} /> : null}
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
  const blueprint = islandBlueprint(studyId, course.id, flat.length);
  const points = layoutCourse(course.units.map((unit) => unit.lessons.length));
  const hueShift = hueShiftForCourse(studyId, course.id);
  const firstOpen = next
    ? flat.findIndex((entry) => entry.unit.id === next.unitId && entry.lesson.id === next.lessonId)
    : -1;
  return flat.map((entry, index) => {
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
      position: new THREE.Vector3(
        points[index]!.x,
        islandSurfaceY(blueprint, points[index]!.x, points[index]!.z) - MARKER_SINK,
        points[index]!.z,
      ),
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
  const blueprint = islandBlueprint(studyId, courseId, lessons);
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
  return islandSurfaceY(islandBlueprint(studyId, courseId, lessons), x, z);
}

/** A shallow seat in the turf; enough to belong to the ground, not disappear in it. */
const MARKER_SINK = 0.08;

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
    <group position={lesson.position}>
      <mesh
        castShadow
        receiveShadow
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
        {/*
          Slightly wider at the base than the top, so the light finds an edge
          and the marker reads as a disc set into the ground rather than as a
          circle painted on it. Sixteen sides at this size is already a circle;
          more is spent on nothing.
        */}
        <cylinderGeometry args={[radius, radius * 1.1, radius * 0.55, 18]} />
        <meshStandardMaterial
          color={MARKER_COLOUR[lesson.state]}
          roughness={lesson.state === "live" ? 0.5 : 0.85}
          emissive={lesson.state === "live" ? PALETTE.accent : 0x000000}
          emissiveIntensity={lesson.state === "live" ? 0.32 : 0}
          flatShading
        />
      </mesh>
      {lesson.state === "live" ? (
        <LiveRing radius={radius * 1.5} lift={MARKER_SINK + 0.07} />
      ) : null}
    </group>
  );
}

const UNIT_TRAIL_COLOURS = [0xd7c28d, 0xc0c990, 0xaec6b1, 0xb7b4ce, 0xd0ae92, 0xa9c2c7] as const;

/** A narrow ground ribbon makes lesson order readable without another text layer. */
function CourseTrail({
  blueprint,
  lessons,
}: {
  blueprint: IslandBlueprint;
  lessons: readonly LessonPlacement[];
}) {
  const geometry = useMemo(() => {
    const made = new THREE.BufferGeometry();
    if (lessons.length < 2) return made;
    const positions: number[] = [];
    const colours: number[] = [];
    const indices: number[] = [];
    lessons.forEach((lesson, index) => {
      const before = lessons[Math.max(0, index - 1)]!.position;
      const after = lessons[Math.min(lessons.length - 1, index + 1)]!.position;
      const dx = after.x - before.x;
      const dz = after.z - before.z;
      const length = Math.hypot(dx, dz) || 1;
      const normalX = -dz / length;
      const normalZ = dx / length;
      const colour = new THREE.Color(
        UNIT_TRAIL_COLOURS[lesson.unitIndex % UNIT_TRAIL_COLOURS.length]!,
      );
      for (const side of [-1, 1]) {
        const x = lesson.position.x + normalX * side * 0.24;
        const z = lesson.position.z + normalZ * side * 0.24;
        positions.push(x, islandSurfaceY(blueprint, x, z) + 0.045, z);
        colours.push(colour.r, colour.g, colour.b);
      }
      if (index === lessons.length - 1) return;
      const at = index * 2;
      indices.push(at, at + 1, at + 2, at + 1, at + 3, at + 2);
    });
    made.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    made.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
    made.setIndex(indices);
    made.computeVertexNormals();
    return made;
  }, [blueprint, lessons]);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        vertexColors
        roughness={0.96}
        metalness={0}
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={-1}
      />
    </mesh>
  );
}

const COURSE_BIOMES: readonly (readonly Role[])[] = [
  ["tree-broad-a", "bush", "fern"],
  ["rock-a", "rock-b", "fern"],
  ["tree-tall-a", "tree-tall-b", "mushroom"],
  ["tree-broad-b", "bush-flowering", "rock-c"],
  ["tree-broad-a", "tree-tall-a", "bush"],
  ["rock-c", "fern", "bush-flowering"],
];

/** Six unit climates, scattered from the blueprint rather than hand-authored coordinates. */
function courseLandscape(
  blueprint: IslandBlueprint,
  lessons: readonly LessonPlacement[],
): Map<Role, Placement[]> {
  const out = new Map<Role, Placement[]>();
  blueprint.surfaceSlots.forEach((slot, index) => {
    let nearest: LessonPlacement | undefined;
    let distance = Number.POSITIVE_INFINITY;
    for (const lesson of lessons) {
      const next = Math.hypot(slot.x - lesson.position.x, slot.z - lesson.position.z);
      if (next >= distance) continue;
      distance = next;
      nearest = lesson;
    }
    if (!nearest || distance < 3.15 || hash(`${blueprint.seed}/landscape/${index}`) > 0.58) return;
    const roles = COURSE_BIOMES[nearest.unitIndex % COURSE_BIOMES.length]!;
    const role = roles[Math.floor(hash(`${blueprint.seed}/role/${index}`) * roles.length)]!;
    const height = TREES.includes(role)
      ? 1.7 + hash(`${blueprint.seed}/height/${index}`) * 1.15
      : SCRUB.includes(role)
        ? 0.48 + hash(`${blueprint.seed}/height/${index}`) * 0.46
        : 0.42 + hash(`${blueprint.seed}/height/${index}`) * 0.45;
    const at = out.get(role) ?? [];
    at.push({
      position: new THREE.Vector3(slot.x, slot.y - 0.05, slot.z),
      height,
      turn: slot.turn,
    });
    out.set(role, at);
  });
  return out;
}

/**
 * Inside a course: one island, and the lessons lying on it in order.
 */
export function CourseScene({
  lessons,
  onPick,
  onHover,
  skyStudyId = null,
}: {
  lessons: readonly LessonPlacement[];
  onPick: (lesson: LessonPlacement) => void;
  onHover: (lesson: LessonPlacement | null) => void;
  skyStudyId?: string | null;
}) {
  const live = lessons.find((lesson) => lesson.state === "live");
  const studyId = lessons[0]?.studyId ?? "course";
  const courseId = lessons[0]?.courseId ?? "course";
  const blueprint = useMemo(
    () => islandBlueprint(studyId, courseId, lessons.length),
    [courseId, lessons.length, studyId],
  );
  const extent = blueprint.bounds.maxHalf;

  // This is the high-detail projection of the same versioned blueprint used
  // by the small world-map island. Lesson prose can change without changing
  // the seed or inventing a second representation.
  const island = useMemo(() => buildBlueprintIsland(blueprint, "course"), [blueprint]);
  const [landmarkX, landmarkZ] = blueprint.anchors.landmark;
  const landmarkHeight = Math.max(
    2.8,
    Math.min(4.8, Math.min(blueprint.bounds.halfX, blueprint.bounds.halfZ) * 0.32),
  );
  const landmarkAt = [
    landmarkX,
    islandSurfaceY(blueprint, landmarkX, landmarkZ),
    landmarkZ,
  ] as const;

  const markers = useMemo(
    () =>
      lessons.map((lesson) => ({
        lesson,
        // Still varies with the length of the lesson, but across a fifth of the
        // old range: these are markers in a row now, and a row of discs at
        // wildly different sizes reads as noise rather than as information.
        radius: 1.12 + Math.min(stoneRadius(lesson.chars) - 1.5, 1.4) * 0.3,
      })),
    [lessons],
  );

  // Growth marks progress, same rule as the sea: a finished lesson has
  // something growing beside it, an unfinished one has bare ground.
  const fields = useMemo(() => {
    const merged = courseLandscape(blueprint, lessons);
    for (const { lesson, radius } of markers) {
      if (lesson.state === "locked" || lesson.state === "idle") continue;
      const random = seeded(`${lesson.lessonId}/dress`);
      const grown = lesson.state === "done";
      for (let slot = 0; slot < (grown ? 2 : 1); slot += 1) {
        const angle = random() * Math.PI * 2;
        const away = radius * (2.1 + random() * 1.4);
        const x = lesson.position.x + Math.cos(angle) * away;
        const z = lesson.position.z + Math.sin(angle) * away;
        const role = grown
          ? TREES[Math.floor(random() * TREES.length)]!
          : STONES[Math.floor(random() * STONES.length)]!;
        const list = merged.get(role) ?? [];
        list.push({
          position: new THREE.Vector3(x, islandSurfaceY(blueprint, x, z) - 0.1, z),
          height: grown ? 1.5 + random() * 0.9 : 0.5,
          turn: random() * Math.PI * 2,
        });
        merged.set(role, list);
      }
    }
    return [...merged.entries()];
  }, [blueprint, markers]);

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
        fog={[88, 210]}
        sky={skyStopsForStudy(skyStudyId)}
        cloudLevel={-10.2}
      />
      <mesh geometry={island.geometry} castShadow receiveShadow>
        <meshStandardMaterial vertexColors flatShading roughness={0.94} color={0xffffff} />
      </mesh>
      <Suspense fallback={null}>
        <GeneratedCourseLandmark
          studyId={studyId}
          courseId={courseId}
          position={landmarkAt}
          height={landmarkHeight}
          detail="course"
        />
      </Suspense>
      <CourseTrail blueprint={blueprint} lessons={lessons} />
      {markers.map(({ lesson, radius }) => (
        <LessonMarker
          key={lesson.lessonId}
          lesson={lesson}
          radius={radius}
          onPick={onPick}
          onHover={onHover}
        />
      ))}
      {/*
        Only the kit models suspend, so only they sit behind a boundary. Sky,
        sea and island are computed here and owe nothing to the network —
        gating them on a tree finishing its download is what turns a slow
        connection into a blank screen instead of a world that fills in.
      */}
      <Suspense fallback={null}>
        {fields.map(([role, at]) => (
          <PropField key={role} role={role} at={at} />
        ))}
      </Suspense>
      {live ? <Learner position={live.position} /> : null}
    </>
  );
}
