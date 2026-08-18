/**
 * The two map levels, both drawn inside the one Canvas the app owns.
 *
 * Text is never geometry. Every name on these maps is a DOM node positioned by
 * projecting a world point — baseline rule 7, and the reason it is a rule: a
 * Chinese IME, selectable code, a screen reader and a phone keyboard all
 * degrade to nothing inside WebGL. The canvas moves the eye; the DOM carries
 * the words.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import type { CourseNode } from "../content/library";
import { layoutCourse, layoutStudy, radiusForLessons } from "./layout";

/** Three greys and one accent. Completion is lightness, not colour. */
export const GREY = {
  // Measured against the grade, not picked in a swatch: the contrast pivot in
  // `grade.ts` pulls anything under roughly 0.08 to black, so a floor darker
  // than this stops being a floor and becomes a hole.
  base: 0x2a3140,
  /** Reachable, but not the one to start now. */
  open: 0x55617a,
  idle: 0x3d4757,
  done: 0x6d788a,
  live: 0x5ec8c0,
  locked: 0x232a36,
  edge: 0x5a6675,
} as const;

export interface Marker {
  readonly id: string;
  readonly position: THREE.Vector3;
  readonly text: string;
  readonly sub?: string;
  readonly kind: "study" | "course" | "lesson" | "unit";
}

function Disc({
  position,
  radius,
  height,
  colour,
  onClick,
  onOver,
}: {
  position: THREE.Vector3;
  radius: number;
  height: number;
  colour: number;
  onClick?: () => void;
  onOver?: (over: boolean) => void;
}) {
  return (
    <mesh
      position={position}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        onOver?.(true);
      }}
      onPointerOut={() => onOver?.(false)}
    >
      <cylinderGeometry args={[radius, radius * 0.94, height, 28]} />
      <meshStandardMaterial color={colour} roughness={0.82} metalness={0.05} />
    </mesh>
  );
}

function Road({ from, to }: { from: THREE.Vector3; to: THREE.Vector3 }) {
  const { position, quaternion, length } = useMemo(() => {
    const direction = new THREE.Vector3().subVectors(to, from);
    const mid = from.clone().add(to).multiplyScalar(0.5);
    const rotation = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      direction.clone().normalize(),
    );
    return { position: mid, quaternion: rotation, length: direction.length() };
  }, [from, to]);
  return (
    <mesh position={position} quaternion={quaternion}>
      <boxGeometry args={[0.16, 0.06, length]} />
      <meshStandardMaterial color={GREY.edge} roughness={0.9} />
    </mesh>
  );
}

/** The learner. A small capsule, as asked for, and deliberately kept that way. */
function Learner({ position }: { position: THREE.Vector3 }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ring.current) ring.current.rotation.z += delta * 0.7;
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.62, 0]}>
        <capsuleGeometry args={[0.32, 0.5, 4, 12]} />
        <meshStandardMaterial color={0xf2f6ff} roughness={0.5} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[0.55, 0.78, 32]} />
        <meshBasicMaterial color={GREY.live} transparent opacity={0.75} />
      </mesh>
    </group>
  );
}

export interface WorldPlacement {
  readonly node: CourseNode;
  readonly position: THREE.Vector3;
  readonly radius: number;
  readonly state: "done" | "live" | "open" | "idle";
}

/** Positions for every course, plus each study's centre, computed once. */
export function placeWorld(nodes: readonly CourseNode[], completed: (node: CourseNode) => boolean) {
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
      const unlocked = node.prerequisiteCourseIds.every((id) =>
        entry.own.some((peer) => peer.courseId === id && completed(peer)),
      );
      placements.push({
        node,
        position: new THREE.Vector3(local.x, local.y, local.z).add(centre),
        radius: radiusForLessons(node.lessons),
        // Unlocked is not the same as next. The accent marks exactly one place
        // — where to go now — and a map that accents everything reachable has
        // answered "what could I do" instead of "what do I do", which is the
        // question the eight-second test actually asks.
        state: completed(node) ? "done" : unlocked ? "open" : "idle",
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

export function WorldScene({
  placements,
  centres,
  ring,
  learnerAt,
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
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
        <circleGeometry args={[ring * 2.4, 96]} />
        <meshStandardMaterial color={GREY.base} roughness={1} />
      </mesh>
      {[...centres.entries()].map(([studyId, centre]) => {
        const own = placements.filter((entry) => entry.node.studyId === studyId);
        const reach = Math.max(...own.map((entry) => entry.position.distanceTo(centre)), 4) + 6;
        return (
          <mesh key={studyId} position={[centre.x, -0.2, centre.z]}>
            <cylinderGeometry args={[reach, reach * 0.99, 0.3, 48]} />
            <meshStandardMaterial color={0x353d4e} roughness={1} />
          </mesh>
        );
      })}
      {placements.map((entry) =>
        entry.node.prerequisiteCourseIds.map((id) => {
          const from = byKey.get(`${entry.node.studyId}/${id}`);
          return from ? (
            <Road key={`${entry.node.courseId}-${id}`} from={from.position} to={entry.position} />
          ) : null;
        }),
      )}
      {placements.map((entry) => (
        <Disc
          key={`${entry.node.studyId}/${entry.node.courseId}`}
          position={entry.position}
          radius={entry.radius}
          height={0.55 + entry.node.depth * 0.05}
          colour={GREY[entry.state]}
          onClick={() => onPick(entry.node)}
          onOver={(over) => onHover(over ? entry.node : null)}
        />
      ))}
      {learnerAt ? <Learner position={learnerAt} /> : null}
    </>
  );
}

export interface LessonPlacement {
  readonly unitId: string;
  readonly unitTitle: string;
  readonly lessonId: string;
  readonly lessonTitle: string;
  readonly chars: number;
  readonly position: THREE.Vector3;
  readonly state: "done" | "live" | "idle" | "locked";
}

export function placeCourse(
  units: readonly {
    id: string;
    title: string;
    lessons: readonly { id: string; title: string; content: string }[];
  }[],
  isDone: (unitId: string, lessonId: string) => boolean,
): LessonPlacement[] {
  const flat = units.flatMap((unit) => unit.lessons.map((lesson) => ({ unit, lesson })));
  const points = layoutCourse(units.map((unit) => unit.lessons.length));
  let firstOpen = -1;
  const states = flat.map((entry, index) => {
    const done = isDone(entry.unit.id, entry.lesson.id);
    if (!done && firstOpen === -1) firstOpen = index;
    return done;
  });
  return flat.map((entry, index) => ({
    unitId: entry.unit.id,
    unitTitle: entry.unit.title,
    lessonId: entry.lesson.id,
    lessonTitle: entry.lesson.title,
    chars: entry.lesson.content.length,
    position: new THREE.Vector3(points[index]!.x, points[index]!.y, points[index]!.z),
    state: states[index]
      ? "done"
      : index === firstOpen
        ? "live"
        : index > firstOpen + 3
          ? "locked"
          : "idle",
  }));
}

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
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color={GREY.base} roughness={1} />
      </mesh>
      {lessons.map((lesson, index) =>
        index > 0 ? (
          <Road
            key={`road-${lesson.lessonId}`}
            from={lessons[index - 1]!.position}
            to={lesson.position}
          />
        ) : null,
      )}
      {lessons.map((lesson) => (
        <Disc
          key={lesson.lessonId}
          position={lesson.position}
          // A wall of 4,900 characters should be visible as a bigger step
          // before it is entered rather than after.
          radius={1.3 + Math.min(lesson.chars, 5000) / 4200}
          height={0.4}
          colour={GREY[lesson.state === "locked" ? "locked" : lesson.state]}
          onClick={() => onPick(lesson)}
          onOver={(over) => onHover(over ? lesson : null)}
        />
      ))}
      {live ? <Learner position={live.position} /> : null}
    </>
  );
}
