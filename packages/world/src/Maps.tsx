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

import { courseShapeOf, isFocusDimmed, type Course, type CourseNode } from "./course";
import { buildIsland, hash, seeded, surfaceHeight } from "./island";
import { PropField, type Placement, type Role } from "./kit";
import { courseIslandExtent, layoutCourse, layoutStudyRoad, radiusForLessons } from "./layout";
import { stoneRadius } from "./path-overlay";
import { hueShiftForCourse, pathNodeKind, type PathNodeKind } from "./path-language";
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
 * One study, one climate. Hue-only so the three luminance steps stay a sky.
 * `null` is the overview — all four seas under the default dome.
 */
export function skyStopsForStudy(studyId: string | null): SkyStops {
  if (!studyId) {
    return { zenith: SKY_STOPS.zenith, mid: SKY_STOPS.mid, horizon: SKY_STOPS.horizon };
  }
  const turn = (hash(studyId) - 0.5) * 0.28;
  const shift = (hex: number) => {
    const color = new THREE.Color(hex);
    color.offsetHSL(turn, 0, 0);
    return color.getHex();
  };
  return {
    zenith: shift(SKY_STOPS.zenith),
    mid: shift(SKY_STOPS.mid),
    horizon: shift(SKY_STOPS.horizon),
  };
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

/** Positions for every course, plus each study's centre, computed once. */
export function placeWorld(nodes: readonly CourseNode[], progressOf: (node: CourseNode) => number) {
  const byStudy = new Map<string, CourseNode[]>();
  for (const node of nodes) {
    const list = byStudy.get(node.studyId) ?? [];
    list.push(node);
    byStudy.set(node.studyId, list);
  }

  // Lay each world out first, measure what it took, then place the worlds so
  // the big one is not sitting on its neighbours. Sizing the ring by guess is
  // what made the first attempt unreadable.
  const laid = [...byStudy.entries()].map(([studyId, own]) => {
    // `LayoutInput` speaks in `id`; a course node calls the same thing
    // `courseId`. Translating here keeps the layout maths independent of the
    // content schema, which is what lets it be tested without a library.
    // Teaching order, not graph order. The spine is authored and validated as
    // a legal linear extension of the prerequisites, so walking it is walking
    // the graph. A course missing from the spine (a draft, an import that has
    // not been slotted yet) falls in behind the spine by depth, so it is on the
    // road rather than at the origin.
    const spine = spineOf(studyId).map((entry) => entry.courseId);
    const rank = new Map(spine.map((courseId, index) => [courseId, index]));
    const ordered = [...own]
      .sort(
        (a, b) =>
          (rank.get(a.courseId) ?? spine.length + a.depth) -
            (rank.get(b.courseId) ?? spine.length + b.depth) ||
          a.courseId.localeCompare(b.courseId),
      )
      .map((node) => node.courseId);
    const placed = layoutStudyRoad(ordered);
    const extent =
      Math.max(...[...placed.values()].map((point) => Math.hypot(point.x, point.z)), 1) + 8;
    return { studyId, own, placed, extent };
  });
  const total = laid.reduce((sum, entry) => sum + entry.extent, 0) || 1;
  const ring = Math.max((total * 1.35) / Math.PI, ...laid.map((entry) => entry.extent * 1.5));

  const placements: WorldPlacement[] = [];
  const centres = new Map<string, THREE.Vector3>();
  let bearingCursor = 0;
  for (const entry of laid) {
    const share = entry.extent / total;
    const bearing = bearingCursor + share * Math.PI;
    bearingCursor += share * Math.PI * 2;
    const centre = new THREE.Vector3(Math.cos(bearing) * ring, 0, Math.sin(bearing) * ring);
    centres.set(entry.studyId, centre);
    for (const node of entry.own) {
      const local = entry.placed.get(node.courseId);
      if (!local) continue;
      const progress = progressOf(node);
      const unlocked = node.prerequisiteCourseIds.every((id) =>
        entry.own.some((peer) => peer.courseId === id && progressOf(peer) >= 1),
      );
      placements.push({
        node,
        position: new THREE.Vector3(local.x, 0, local.z).add(centre),
        radius: radiusForLessons(node.lessons),
        progress,
        // Unlocked is not the same as next. The accent marks exactly one place
        // — where to go now — and a map that accents everything reachable has
        // answered "what could I do" instead of "what do I do", which is the
        // question the eight-second test actually asks.
        state: progress >= 1 ? "done" : unlocked ? "open" : "idle",
      });
    }
  }
  // The shallowest unfinished course a learner can actually start is "next".
  // Ties break on lesson count so a one-lesson preface does not outrank the
  // spine it introduces.
  const next = placements
    .filter((entry) => entry.state === "open")
    .sort((a, b) => a.node.depth - b.node.depth || b.node.lessons - a.node.lessons)[0];
  const marked = placements.map((entry) =>
    entry === next ? { ...entry, state: "live" as const } : entry,
  );
  return { placements: marked, centres, ring };
}

/**
 * Decide what stands on one island.
 *
 * Slots come back from `buildIsland` scattered; sorting them by distance from
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
    push("beacon", {
      position: world(new THREE.Vector3(0, entry.radius * 0.24, 0)),
      height: entry.radius * 0.34,
      turn: 0,
    });
  }
  return out;
}

/** Island geometry is expensive enough to be worth keeping between renders. */
const shapes = new Map<string, ReturnType<typeof buildIsland>>();

/** Slots nearest the middle first: the order the settlement fills in. */
function settlementSlots(studyId: string, courseId: string, radius: number) {
  const { slots } = shapeOf(studyId, courseId, radius);
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
  const ordered = settlementSlots(studyId, courseId, radiusForLessons(lessons));
  const claim = Math.max(1, Math.round(ordered.length * 0.45));
  return { ordered, claim, built: Math.round(progress * claim) };
}

function shapeOf(studyId: string, courseId: string, radius: number) {
  const key = `${studyId}/${courseId}/${radius.toFixed(2)}`;
  const found = shapes.get(key);
  if (found) return found;
  // A gentle hue shift per study, so four studies are four places without the
  // world turning into four unrelated colour schemes.
  const tint = (hash(studyId) - 0.5) * 0.14;
  const made = buildIsland(`${studyId}/${courseId}`, radius, tint);
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
  const shape = shapeOf(entry.node.studyId, entry.node.courseId, entry.radius);
  const locked = entry.state === "idle";
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
 * Clouds that speak the same language as the islands.
 *
 * v3 asked to evaluate drei `<Clouds/><Cloud/>` first. A local puff texture,
 * one colour, Lambert, camera-glued so they could not hide at the origin:
 * they never appeared in the blit. Icosahedron clusters next to the thing
 * the camera is actually looking at do appear, and they match the board.
 * Soft billboards against this land would have been the "two styles" trap
 * OwnMySpace already named.
 */
function CloudField({ around }: { around: THREE.Vector3 }) {
  const puffs = useMemo(() => {
    const random = seeded(`clouds/${around.x.toFixed(1)}/${around.z.toFixed(1)}`);
    const centres: readonly (readonly [number, number, number])[] = [
      [14, 8, -11],
      [-16, 7, 8],
      [6, 9, 16],
    ];
    const out: { position: readonly [number, number, number]; scale: number }[] = [];
    for (const centre of centres) {
      for (let i = 0; i < 3; i += 1) {
        out.push({
          position: [
            centre[0] + (random() - 0.5) * 5,
            centre[1] + (random() - 0.5) * 1.4,
            centre[2] + (random() - 0.5) * 5,
          ],
          scale: 2.2 + random() * 1.8,
        });
      }
    }
    return out;
  }, [around.x, around.z]);
  if (renderTier() === "mobile") return null;
  return (
    <group position={around}>
      {puffs.map((puff, index) => (
        <mesh
          key={index}
          position={puff.position}
          scale={[puff.scale, puff.scale * 0.38, puff.scale]}
        >
          <sphereGeometry args={[1, 7, 5]} />
          <meshBasicMaterial color={0xf4ece0} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * A layer of flattened puffs under the islands. This is the depth the flat
 * sea could not give: looking down, you see through clouds to a further
 * ocean, so the islands can hang.
 */
function CloudSea({ extent }: { extent: number }) {
  const mobile = renderTier() === "mobile";
  const puffs = useMemo(() => {
    const random = seeded("cloud-sea");
    const count = mobile ? 18 : 56;
    const radius = extent * 2.4;
    return Array.from({ length: count }, () => {
      const angle = random() * Math.PI * 2;
      const dist = Math.sqrt(random()) * radius;
      return {
        position: [Math.cos(angle) * dist, -2.4 - random() * 1.8, Math.sin(angle) * dist] as const,
        scale: 4.5 + random() * 6,
      };
    });
  }, [extent, mobile]);
  return (
    <group>
      {puffs.map((puff, index) => (
        <mesh
          key={index}
          position={puff.position}
          scale={[puff.scale, puff.scale * 0.32, puff.scale]}
        >
          <sphereGeometry args={[1, 6, 4]} />
          <meshBasicMaterial color={0xf2ebe0} transparent opacity={0.55} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Further islands, the same shape as the ones you can click. A fogged blob
 * at the horizon is a flying saucer; a smaller island in the same language
 * is "more of this world, further away".
 */
function DistantIsles({ extent }: { extent: number }) {
  const mobile = renderTier() === "mobile";
  const isles = useMemo(() => {
    const random = seeded("distant-isles");
    const count = mobile ? 5 : 11;
    return Array.from({ length: count }, (_, index) => {
      const angle = (index / count) * Math.PI * 2 + (random() - 0.5) * 0.25;
      const dist = extent * (1.55 + random() * 0.7);
      const radius = 1.6 + random() * 2.4;
      return {
        position: new THREE.Vector3(
          Math.cos(angle) * dist,
          -1.4 - random() * 0.8,
          Math.sin(angle) * dist,
        ),
        geometry: buildIsland(`distant/${index}`, radius, (random() - 0.5) * 0.1).geometry,
      };
    });
  }, [extent, mobile]);
  return (
    <group>
      {isles.map((isle, index) => (
        <mesh key={index} geometry={isle.geometry} position={isle.position} scale={0.85}>
          <meshStandardMaterial vertexColors flatShading roughness={0.96} color={0xb8c2c8} />
        </mesh>
      ))}
    </group>
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
      <hemisphereLight args={[sky.mid, 0x4a5a3a, 1.15]} />
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -6.5, 0]} receiveShadow>
        <circleGeometry args={[extent * 3.2, 64]} />
        <meshStandardMaterial color={PALETTE.sea} roughness={0.72} metalness={0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -8.2, 0]}>
        <circleGeometry args={[extent * 3.4, 48]} />
        <meshBasicMaterial color={PALETTE.seaDeep} />
      </mesh>
      <CloudSea extent={extent} />
      <DistantIsles extent={extent} />
    </>
  );
}

export function WorldScene({
  placements,
  learnerAt,
  ring,
  onPick,
  onHover,
  focus,
  skyStudyId = null,
}: {
  placements: readonly WorldPlacement[];
  centres: Map<string, THREE.Vector3>;
  ring: number;
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
      if (entry.state === "idle") continue; // a locked island stays bare rock
      for (const [role, list] of dress(entry)) {
        merged.set(role, (merged.get(role) ?? []).concat(list));
      }
    }
    return [...merged.entries()];
  }, [placements]);

  return (
    <>
      <Weather extent={ring * 1.5} sky={skyStopsForStudy(skyStudyId)} />
      {learnerAt ? <CloudField around={learnerAt} /> : null}
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
  const { next } = readCourseProgress(courseShapeOf(course, studyId), source);
  const flat = course.units.flatMap((unit, unitIndex) =>
    unit.lessons.map((lesson, slot) => ({ unit, unitIndex, lesson, slot })),
  );
  const points = layoutCourse(course.units.map((unit) => unit.lessons.length));
  const hueShift = hueShiftForCourse(studyId, course.id);
  const firstOpen = next
    ? flat.findIndex((entry) => entry.unit.id === next.unitId && entry.lesson.id === next.lessonId)
    : -1;
  return flat.map((entry, index) => {
    const done = isLessonComplete(
      source.completionOf({
        studyId,
        courseId: course.id,
        unitId: entry.unit.id,
        lessonId: entry.lesson.id,
      }),
    );
    return {
      unitId: entry.unit.id,
      unitTitle: entry.unit.title,
      unitIndex: entry.unitIndex,
      lessonId: entry.lesson.id,
      lessonTitle: entry.lesson.title,
      chars: entry.lesson.content.length,
      // On the island's surface, sunk by a fraction of the marker so the
      // profile-vs-mesh disagreement (see courseSurfaceY) can only ever bury a
      // marker slightly, never float it.
      position: new THREE.Vector3(
        points[index]!.x,
        courseSurfaceY(points[index]!.x, points[index]!.z, flat.length) - MARKER_BIAS * 0.72,
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
export function courseIslandScale(lessons: number) {
  const extent = courseIslandExtent(lessons);
  // Height follows the narrow axis, halved. Scaling it with the long axis would
  // turn a 41-lesson course into a mountain range for no reason a learner could
  // read; scaling it 1:1 with the narrow one gave a block — the lathe profile
  // spends most of its length on a root that hangs below the waterline, so a
  // full-height island seen from above is a tall dark cone with a lid. This is
  // a plate with a shore, which is what the markers need to sit on.
  return { x: extent.x, y: Math.min(extent.x, extent.z) * 0.38, z: extent.z };
}

/**
 * Where the ground is under a point on the course island.
 *
 * `buildIsland` also jitters each radial column by up to ±17%, so this is the
 * profile's height, not the mesh's, and a marker can end up slightly proud or
 * slightly sunk. Markers are sunk by a fixed bias below so the error only ever
 * buries them a little — a stone half in the ground reads as a stone, and a
 * stone hovering above it reads as a bug.
 */
export function courseSurfaceY(x: number, z: number, lessons: number): number {
  const scale = courseIslandScale(lessons);
  const fraction = Math.hypot(x / scale.x, z / scale.z);
  return surfaceHeight(fraction) * scale.y;
}

/** How far a marker sinks into the ground, in marker radii. */
const MARKER_BIAS = 0.55;

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
        <LiveRing radius={radius * 1.5} lift={MARKER_BIAS * 0.72 + 0.07} />
      ) : null}
    </group>
  );
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
  const scale = useMemo(() => courseIslandScale(lessons.length), [lessons.length]);
  const extent = Math.max(scale.x, scale.z);

  // One island, built once at unit radius and scaled. The seed is the course's
  // first lesson id rather than the course id, because this component is only
  // ever handed placements — and a stable seed matters more than a tidy one:
  // the island a learner remembers has to still be there next month.
  const island = useMemo(
    () => buildIsland(lessons[0]?.lessonId ?? "course", 1, lessons[0]?.hueShift ?? 0, 15),
    [lessons],
  );

  const markers = useMemo(
    () =>
      lessons.map((lesson) => ({
        lesson,
        // Still varies with the length of the lesson, but across a fifth of the
        // old range: these are markers in a row now, and a row of discs at
        // wildly different sizes reads as noise rather than as information.
        radius: 1.5 + Math.min(stoneRadius(lesson.chars) - 1.5, 1.4) * 0.42,
      })),
    [lessons],
  );

  // Growth marks progress, same rule as the sea: a finished lesson has
  // something growing beside it, an unfinished one has bare ground.
  const fields = useMemo(() => {
    const merged = new Map<Role, Placement[]>();
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
          position: new THREE.Vector3(x, courseSurfaceY(x, z, lessons.length) - 0.1, z),
          height: grown ? 1.5 + random() * 0.9 : 0.5,
          turn: random() * Math.PI * 2,
        });
        merged.set(role, list);
      }
    }
    return [...merged.entries()];
  }, [markers, lessons.length]);

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
      <Weather extent={extent * 1.6} fog={[88, 210]} sky={skyStopsForStudy(skyStudyId)} />
      <mesh geometry={island.geometry} scale={[scale.x, scale.y, scale.z]} castShadow receiveShadow>
        <meshStandardMaterial vertexColors flatShading roughness={0.94} color={0xffffff} />
      </mesh>
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
