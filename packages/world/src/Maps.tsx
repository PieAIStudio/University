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
import { isLessonComplete, readCourseProgress, type ProgressSource } from "@pieai/university-core";
import { playSound } from "@pieai/university-ui/sound/index.js";
import { useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

import { courseShapeOf, type Course, type CourseNode } from "./course";
import { buildIsland, hash, lockIslandGeometry, seeded } from "./island";
import { PropField, type Placement, type Role } from "./kit";
import { layoutCourse, layoutStudy, radiusForLessons } from "./layout";
import { stoneRadius } from "./path-overlay";
import { hueShiftForCourse, pathNodeKind, type PathNodeKind } from "./path-language";

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

const PALETTE = {
  // The sea is most of the frame, so the sea is what sets the exposure of the
  // whole product. Measured: with a near-navy sea the scene's median linear
  // luminance came out at 0.059 and its middle 90% spanned 0.052 to 0.071 —
  // an image with no midtones, which no grade can rescue, because there is
  // nothing there to expand. A shallow, lit sea puts the median where a grade
  // can work and where the land has something to be brighter than.
  sea: 0x2f89a0,
  seaDeep: 0x1c5c72,
  foam: 0xc9f0ea,
  // Three luminance stops, zenith → horizon. v3: a dead-white sky is the
  // cheapest 3D-demo signal; a cool cyan wash was better than white and still
  // not a sky. Saturation lives at the top, warmth at the rim. The sea number
  // above is not in this list on purpose — it was measured for exposure, and
  // rewriting it to "look more like sky" is how the midtones fall out.
  skyZenith: SKY_STOPS.zenith,
  skyMid: SKY_STOPS.mid,
  skyHorizon: SKY_STOPS.horizon,
  causeway: 0xc0a373,
  steps: 0x9aa0a8,
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
    const placed = layoutStudy(
      own.map((node) => ({
        id: node.courseId,
        depth: node.depth,
        prerequisiteCourseIds: node.prerequisiteCourseIds,
      })),
    );
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
  onClick,
  onOver,
}: {
  entry: WorldPlacement;
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
          color={locked ? PALETTE.locked : 0xffffff}
        />
      </mesh>
      {/* Where the land meets the water. One ring, no texture. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[entry.radius * 0.94, entry.radius * 1.14, 24]} />
        <meshBasicMaterial color={PALETTE.foam} transparent opacity={locked ? 0.1 : 0.24} />
      </mesh>
    </group>
  );
}

/** A prerequisite, drawn as a causeway you could actually walk. */
function Causeway({
  from,
  to,
  color = PALETTE.causeway,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  color?: number;
}) {
  const { position, quaternion, length } = useMemo(() => {
    const direction = new THREE.Vector3().subVectors(to, from).setY(0);
    const mid = from.clone().add(to).multiplyScalar(0.5).setY(0.08);
    const rotation = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      direction.clone().normalize(),
    );
    return { position: mid, quaternion: rotation, length: direction.length() };
  }, [from, to]);
  return (
    <mesh position={position} quaternion={quaternion} rotation-x={0} receiveShadow>
      <boxGeometry args={[0.7, 0.12, length]} />
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
  );
}

/**
 * The other path surface. A unit that isn't a causeway is a flight of slabs,
 * so the change of pavement is the unit boundary you feel with your eye
 * before you read the name.
 */
function StoneSteps({ from, to }: { from: THREE.Vector3; to: THREE.Vector3 }) {
  const pieces = useMemo(() => {
    const direction = new THREE.Vector3().subVectors(to, from);
    const length = direction.length();
    if (length < 0.05) return [];
    const rotation = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      direction.clone().setY(0).normalize(),
    );
    const count = Math.max(3, Math.round(length / 0.72));
    const depth = (length / count) * 0.68;
    return Array.from({ length: count }, (_, index) => {
      const t = (index + 0.5) / count;
      return {
        position: from
          .clone()
          .lerp(to, t)
          .setY(THREE.MathUtils.lerp(from.y, to.y, t) + 0.1 + (index % 2) * 0.08),
        quaternion: rotation,
        depth,
      };
    });
  }, [from, to]);
  return (
    <>
      {pieces.map((piece, index) => (
        <mesh
          key={index}
          position={piece.position}
          quaternion={piece.quaternion}
          receiveShadow
          castShadow
        >
          <boxGeometry args={[1.2, 0.18, piece.depth]} />
          <meshStandardMaterial color={PALETTE.steps} roughness={1} />
        </mesh>
      ))}
    </>
  );
}

/** Gold ring on the live stone. Opacity and scale breathe; the learner stands in it. */
function LiveRing({ radius }: { radius: number }) {
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
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
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
function SkyDome() {
  const mesh = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(
    () => ({
      uZenith: { value: new THREE.Color(PALETTE.skyZenith) },
      uMid: { value: new THREE.Color(PALETTE.skyMid) },
      uHorizon: { value: new THREE.Color(PALETTE.skyHorizon) },
    }),
    [],
  );
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
}) {
  const [fogFrom, fogTo] = fog ?? [extent * 0.9, extent * 3.1];
  return (
    <>
      <color attach="background" args={[PALETTE.skyZenith]} />
      <fog attach="fog" args={[PALETTE.skyHorizon, fogFrom, fogTo]} />
      <SkyDome />
      {/*
        Hemisphere sky is a stop lighter than the painted zenith on purpose:
        the dome can sit at a saturated blue without pulling the islands'
        midtones down with it. Ground stays the moss the land already is.
      */}
      <hemisphereLight args={[PALETTE.skyMid, 0x4a5a3a, 1.15]} />
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
        Rough water, not a mirror. A low-roughness sea puts one enormous
        specular blob under the sun, which on a map is a hole you cannot read
        anything on top of. Stylised water sells depth through colour and the
        shoreline, not through gloss.
      */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[extent * 3.2, 64]} />
        <meshStandardMaterial color={PALETTE.sea} roughness={0.72} metalness={0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}>
        <circleGeometry args={[extent * 3.4, 48]} />
        <meshBasicMaterial color={PALETTE.seaDeep} />
      </mesh>
    </>
  );
}

export function WorldScene({
  placements,
  learnerAt,
  ring,
  onPick,
  onHover,
}: {
  placements: readonly WorldPlacement[];
  centres: Map<string, THREE.Vector3>;
  ring: number;
  learnerAt: THREE.Vector3 | null;
  onPick: (node: CourseNode) => void;
  onHover: (node: CourseNode | null) => void;
}) {
  const byKey = new Map(
    placements.map((entry) => [`${entry.node.studyId}/${entry.node.courseId}`, entry]),
  );

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
      <Weather extent={ring * 1.5} />
      {placements.map((entry) =>
        entry.node.prerequisiteCourseIds.map((id) => {
          const from = byKey.get(`${entry.node.studyId}/${id}`);
          return from ? (
            <Causeway
              key={`${entry.node.courseId}-${id}`}
              from={from.position}
              to={entry.position}
            />
          ) : null;
        }),
      )}
      {placements.map((entry) => (
        <Island
          key={`${entry.node.studyId}/${entry.node.courseId}`}
          entry={entry}
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
      // The road climbs. Flattening it to y=0 threw away the one thing a
      // course path has that a page cannot: looking back down it.
      position: new THREE.Vector3(points[index]!.x, points[index]!.y, points[index]!.z),
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
 * Inside a course, the same world at walking scale: each lesson is a stepping
 * stone, and the ones already crossed have something growing on them.
 */
export function CourseScene({
  lessons,
  onPick,
  onHover,
}: {
  lessons: readonly LessonPlacement[];
  onPick: (lesson: LessonPlacement) => void;
  onHover: (lesson: LessonPlacement | null) => void;
}) {
  const live = lessons.find((lesson) => lesson.state === "live");
  const extent = useMemo(
    () =>
      Math.max(...lessons.map((lesson) => Math.hypot(lesson.position.x, lesson.position.z)), 20),
    [lessons],
  );

  const stones = useMemo(
    () =>
      lessons.map((lesson) => {
        const radius = stoneRadius(lesson.chars);
        const shape = buildIsland(lesson.lessonId, radius, lesson.hueShift);
        const lockedGeometry =
          lesson.state === "locked" ? lockIslandGeometry(shape.geometry) : shape.geometry;
        return { lesson, radius, shape, lockedGeometry };
      }),
    [lessons],
  );

  const fields = useMemo(() => {
    const merged = new Map<Role, Placement[]>();
    for (const { lesson, radius, shape } of stones) {
      if (lesson.state === "locked") continue;
      const random = seeded(`${lesson.lessonId}/dress`);
      const grown = lesson.state === "done";
      for (const slot of shape.slots.slice(0, grown ? 4 : 2)) {
        const role = grown
          ? TREES[Math.floor(random() * TREES.length)]!
          : STONES[Math.floor(random() * STONES.length)]!;
        const list = merged.get(role) ?? [];
        list.push({
          position: slot.clone().add(lesson.position),
          height: radius * (grown ? 0.44 : 0.16),
          turn: random() * Math.PI * 2,
        });
        merged.set(role, list);
      }
    }
    return [...merged.entries()];
  }, [stones]);

  return (
    <>
      {/*
        Sight line past the five readable stones, not the length of the road.
        Fog used to start at 52, which ate locked nodes into the same grey as
        "far away". Locked is a colour treatment now; fog only takes the ones
        you have already stopped reading.
      */}
      <Weather extent={extent * 1.3} fog={[88, 210]} />
      {lessons.map((lesson, index) =>
        index > 0 ? (
          lesson.unitIndex % 2 === 1 ? (
            <StoneSteps
              key={`road-${lesson.lessonId}`}
              from={lessons[index - 1]!.position}
              to={lesson.position}
            />
          ) : (
            <Causeway
              key={`road-${lesson.lessonId}`}
              from={lessons[index - 1]!.position}
              to={lesson.position}
            />
          )
        ) : null,
      )}
      {stones.map(({ lesson, radius, lockedGeometry }) => (
        <group key={lesson.lessonId} position={lesson.position}>
          <mesh
            geometry={lockedGeometry}
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
            <meshStandardMaterial vertexColors flatShading roughness={0.94} color={0xffffff} />
          </mesh>
          {lesson.state === "live" ? (
            <LiveRing radius={radius} />
          ) : (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
              <ringGeometry args={[radius * 0.94, radius * 1.12, 20]} />
              <meshBasicMaterial
                color={PALETTE.foam}
                transparent
                opacity={lesson.state === "locked" ? 0.12 : 0.2}
              />
            </mesh>
          )}
        </group>
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
      {live ? <Learner position={live.position} /> : null}
    </>
  );
}
