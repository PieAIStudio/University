import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { playSound } from "@pieai/university-ui/sound/index.js";
import type { IslandUnitSigil } from "../island/island-blueprint.js";
import { usePrefersReducedMotion } from "../reduced-motion.js";
import { islandLookFrozen } from "../island/island-surface-style.js";
import { unitRingGeometry, unitSigilArcCount } from "../island/unit-sigil.js";
import { createBoulderGeometry, type BoulderSetting } from "../island/course-rock-profile.js";
import type { LessonPlacement } from "../Maps.js";
import { GRID_LESSON_PLINTH_ALBEDO } from "./grid-palette.js";
import type { MedallionInlays } from "./medallion-grounding.js";
import {
  createMedallionGeometry,
  MARKER_ENGRAVING_OFFSET,
  MARKER_PLINTH_OFFSET,
  MEDALLION_ENGRAVING_COLOURS,
  MEDALLION_TOP_RADIUS,
} from "./lesson-medallion.js";

export {
  MARKER_ENGRAVING_OFFSET,
  MARKER_PLINTH_OFFSET,
  medallionPoseLocals as markerPoseLocals,
} from "./lesson-medallion.js";

/**
 * How one stone sits on the ground under it.
 *
 * Optional on purpose: a caller that has no height field — the studio preview
 * and any flat-ground surface — passes nothing and gets exactly the upright
 * placement this field has always drawn. `packages/world/src/island` computes
 * it once per blueprint for the course map.
 */
export interface GridLessonMarkerSurface {
  /** Unit normal of the ground plane under the footprint. */
  readonly normal: THREE.Vector3;
  /** Offset along that normal; negative sinks the stone in to close a gap. */
  readonly lift: number;
}

export interface GridLessonMarker {
  readonly lesson: LessonPlacement;
  readonly radius: number;
  readonly colour: number;
  readonly surface?: GridLessonMarkerSurface;
  readonly sigil?: IslandUnitSigil;
  readonly unitIndex?: number;
  /** A rare, diagnosed grounding fallback; the lesson and its footprint stay. */
  readonly grounding?: "inlay";
}

const MARKER_UP = new THREE.Vector3(0, 1, 0);

/** Reusable temporaries so neither the layout pass nor the pulse allocates. */
export interface MarkerMatrixScratch {
  readonly position: THREE.Vector3;
  readonly rotation: THREE.Quaternion;
  readonly scale: THREE.Vector3;
}

export function createMarkerMatrixScratch(): MarkerMatrixScratch {
  return {
    position: new THREE.Vector3(),
    rotation: new THREE.Quaternion(),
    scale: new THREE.Vector3(),
  };
}

/**
 * Compose one instance transform.
 *
 * Split out of the effect so the placement rule is testable without a WebGL
 * context: this is the only place that decides how a pose becomes a matrix, and
 * both the layout pass and the live pulse call it. With no `surface` the normal
 * is +Y, the rotation is identity, and the result is the upright placement this
 * field drew before poses existed.
 */
export function composeMarkerMatrix(
  marker: GridLessonMarker,
  offsetFactor: number,
  scale: number,
  target: THREE.Matrix4,
  scratch: MarkerMatrixScratch,
): THREE.Matrix4 {
  const normal = marker.surface?.normal ?? MARKER_UP;
  const lift = marker.surface?.lift ?? 0;
  scratch.position
    .copy(normal)
    .multiplyScalar(marker.radius * offsetFactor + lift)
    .add(marker.lesson.position);
  scratch.rotation.setFromUnitVectors(MARKER_UP, normal);
  scratch.scale.set(scale, scale, scale);
  return target.compose(scratch.position, scratch.rotation, scratch.scale);
}

/**
 * The stone that sits on a locked lesson (V5 §12 decision C′): the island's own
 * boulder, a small grass-capped one with a pebble, authored for a pad of radius
 * 1 so the marker's radius scales it. When the lesson unlocks it sinks and
 * shrinks away over LOCK_STONE_CRUMBLE_SECONDS; under reduced motion it is gone.
 */
const LOCK_STONE: readonly BoulderSetting[] = [
  { x: -0.06, z: 0.04, rx: 0.5, rz: 0.44, height: 0.72, turn: 0.35, turf: true },
  { x: 0.46, z: -0.26, rx: 0.2, rz: 0.18, height: 0.3, turn: -0.6, turf: false },
];
export const LOCK_STONE_CRUMBLE_SECONDS = 0.7;
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

interface LessonMarkerFieldProps {
  readonly markers: readonly GridLessonMarker[];
  readonly footing?: THREE.BufferGeometry | null;
  readonly inlays?: MedallionInlays;
  readonly onPick: (lesson: LessonPlacement) => void;
  readonly onHover: (lesson: LessonPlacement | null) => void;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Live engraving may pulse only when the shot is not frozen and motion is allowed. */
export function markerPulseAllowed(): boolean {
  return !islandLookFrozen() && !prefersReducedMotion();
}

interface SigilBatch {
  readonly arcs: number;
  readonly indices: readonly number[];
}

function sigilBatches(markers: readonly GridLessonMarker[]): readonly SigilBatch[] {
  const grouped = new Map<number, number[]>();
  markers.forEach((marker, index) => {
    if (!marker.sigil) return;
    const arcs = unitSigilArcCount(marker.sigil);
    const list = grouped.get(arcs);
    if (list) list.push(index);
    else grouped.set(arcs, [index]);
  });
  return [...grouped.entries()].map(([arcs, indices]) => ({ arcs, indices }));
}

export function LessonMarkerField({
  markers: allMarkers,
  footing = null,
  inlays,
  onPick,
  onHover,
}: LessonMarkerFieldProps) {
  const markers = useMemo(
    () => allMarkers.filter((marker) => marker.grounding !== "inlay"),
    [allMarkers],
  );
  const plinth = useRef<THREE.InstancedMesh>(null);
  const engravingRefs = useRef<Array<THREE.InstancedMesh | null>>([]);
  const batches = useMemo(() => sigilBatches(markers), [markers]);
  const bodyGeometry = useMemo(() => createMedallionGeometry(), []);
  const engravingGeometries = useMemo(
    () => batches.map((batch) => unitRingGeometry(batch.arcs)),
    [batches],
  );
  const bodyMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.7,
        metalness: 0.04,
      }),
    [],
  );
  const engravingMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        toneMapped: false,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    [],
  );
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const scratch = useMemo(() => createMarkerMatrixScratch(), []);
  const bodyTint = useMemo(() => new THREE.Color(GRID_LESSON_PLINTH_ALBEDO), []);
  const engravingTint = useMemo(() => new THREE.Color(), []);

  useLayoutEffect(() => {
    const body = plinth.current;
    if (!body) return;
    markers.forEach((marker, index) => {
      body.setMatrixAt(
        index,
        composeMarkerMatrix(marker, MARKER_PLINTH_OFFSET, marker.radius, matrix, scratch),
      );
      const tint = bodyTint.clone();
      if (marker.lesson.state === "locked") tint.multiplyScalar(0.78);
      else if (marker.lesson.state === "done") tint.multiplyScalar(0.9);
      body.setColorAt(index, tint);
    });
    body.instanceMatrix.needsUpdate = true;
    if (body.instanceColor) body.instanceColor.needsUpdate = true;

    batches.forEach((batch, batchIndex) => {
      const mesh = engravingRefs.current[batchIndex];
      if (!mesh) return;
      batch.indices.forEach((markerIndex, slot) => {
        const marker = markers[markerIndex]!;
        const scale = marker.radius * MEDALLION_TOP_RADIUS;
        composeMarkerMatrix(marker, MARKER_ENGRAVING_OFFSET, scale, matrix, scratch);
        mesh.setMatrixAt(slot, matrix);
        engravingTint.set(MEDALLION_ENGRAVING_COLOURS[marker.lesson.state]);
        mesh.setColorAt(slot, engravingTint);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  }, [batches, bodyTint, engravingTint, markers, matrix, scratch]);

  const reducedMotion = usePrefersReducedMotion();

  // Reset before paint, not in a later passive effect after a stopped frame.
  useLayoutEffect(() => {
    if (!reducedMotion) return;
    const liveIndex = markers.findIndex((entry) => entry.lesson.state === "live");
    if (liveIndex < 0) return;
    const live = markers[liveIndex]!;
    batches.forEach((batch, batchIndex) => {
      const slot = batch.indices.indexOf(liveIndex);
      if (slot < 0) return;
      const mesh = engravingRefs.current[batchIndex];
      if (!mesh) return;
      composeMarkerMatrix(
        live,
        MARKER_ENGRAVING_OFFSET,
        live.radius * MEDALLION_TOP_RADIUS,
        matrix,
        scratch,
      );
      mesh.setMatrixAt(slot, matrix);
      mesh.instanceMatrix.needsUpdate = true;
    });
  }, [reducedMotion, batches, markers, matrix, scratch]);

  useFrame(({ clock }) => {
    // Use the same subscribed preference as the reset effect. Creating a new
    // MediaQueryList in every frame bypassed that owner during live switches.
    if (reducedMotion || islandLookFrozen()) return;
    const liveIndex = markers.findIndex((entry) => entry.lesson.state === "live");
    if (liveIndex < 0) return;
    const live = markers[liveIndex]!;
    const pulse = 1 + Math.sin(clock.elapsedTime * 2.2) * 0.05;
    batches.forEach((batch, batchIndex) => {
      const slot = batch.indices.indexOf(liveIndex);
      if (slot < 0) return;
      const mesh = engravingRefs.current[batchIndex];
      if (!mesh) return;
      composeMarkerMatrix(
        live,
        MARKER_ENGRAVING_OFFSET,
        live.radius * MEDALLION_TOP_RADIUS * pulse,
        matrix,
        scratch,
      );
      mesh.setMatrixAt(slot, matrix);
      mesh.instanceMatrix.needsUpdate = true;
    });
  });

  useEffect(() => {
    return () => {
      bodyGeometry.dispose();
      bodyMaterial.dispose();
      engravingMaterial.dispose();
    };
  }, [bodyGeometry, bodyMaterial, engravingMaterial]);

  // Lock stones: one instance per marker, hidden unless the lesson is locked.
  const lockGeometry = useMemo(() => createBoulderGeometry(LOCK_STONE, "lesson-lock"), []);
  const lockMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
    [],
  );
  useEffect(
    () => () => {
      lockGeometry.dispose();
      lockMaterial.dispose();
    },
    [lockGeometry, lockMaterial],
  );
  const lockStones = useRef<THREE.InstancedMesh>(null);
  const lockedBefore = useRef(new Set<string>());
  const crumbling = useRef(new Map<number, number>());
  useLayoutEffect(() => {
    const stones = lockStones.current;
    if (!stones) return;
    const now = performance.now();
    const locked = new Set<string>();
    markers.forEach((marker, index) => {
      const id = marker.lesson.lessonId;
      if (marker.lesson.state === "locked") {
        locked.add(id);
        crumbling.current.delete(index);
        stones.setMatrixAt(
          index,
          composeMarkerMatrix(marker, MARKER_ENGRAVING_OFFSET, marker.radius, matrix, scratch),
        );
      } else if (lockedBefore.current.has(id) && !reducedMotion) {
        // Just unlocked: keep the stone in place and let the frame loop crumble it.
        crumbling.current.set(index, now);
      } else {
        stones.setMatrixAt(index, HIDDEN);
      }
    });
    lockedBefore.current = locked;
    stones.instanceMatrix.needsUpdate = true;
  }, [markers, matrix, scratch, reducedMotion]);
  useFrame(() => {
    const stones = lockStones.current;
    if (!stones || crumbling.current.size === 0) return;
    const now = performance.now();
    for (const [index, start] of crumbling.current) {
      const marker = markers[index];
      const t = (now - start) / 1000 / LOCK_STONE_CRUMBLE_SECONDS;
      if (!marker || t >= 1) {
        stones.setMatrixAt(index, HIDDEN);
        crumbling.current.delete(index);
        continue;
      }
      // Sink into the pad while shrinking, with a small shake as it goes.
      const shake = Math.sin(t * 40) * 0.04 * (1 - t);
      composeMarkerMatrix(
        marker,
        MARKER_ENGRAVING_OFFSET - t * 0.5 + shake,
        marker.radius * (1 - t * t),
        matrix,
        scratch,
      );
      stones.setMatrixAt(index, matrix);
    }
    stones.instanceMatrix.needsUpdate = true;
  });

  if (allMarkers.length === 0) return null;
  const pickMarker = (event: { readonly instanceId?: number; stopPropagation: () => void }) => {
    const marker = event.instanceId === undefined ? undefined : markers[event.instanceId];
    if (!marker) return;
    event.stopPropagation();
    playSound("map.select");
    onPick(marker.lesson);
  };
  const hoverMarker = (event: { readonly instanceId?: number; stopPropagation: () => void }) => {
    const marker = event.instanceId === undefined ? undefined : markers[event.instanceId];
    if (!marker) return;
    event.stopPropagation();
    playSound("map.hover");
    onHover(marker.lesson);
  };
  return (
    <group name="hex-grid-lesson-markers">
      <instancedMesh
        ref={lockStones}
        args={[lockGeometry, lockMaterial, markers.length]}
        name="lesson-lock-stones"
        castShadow
        receiveShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={plinth}
        args={[bodyGeometry, bodyMaterial, markers.length]}
        name="hex-grid-lesson-plinths"
        castShadow
        receiveShadow
        onClick={pickMarker}
        onPointerOver={hoverMarker}
        onPointerOut={() => onHover(null)}
        frustumCulled={false}
      />
      {footing ? (
        <mesh
          geometry={footing}
          material={bodyMaterial}
          name="lesson-medallion-footing"
          castShadow
          receiveShadow
        />
      ) : null}
      {inlays?.geometry ? (
        <mesh
          name="lesson-medallion-ground-inlays"
          geometry={inlays.geometry}
          material={bodyMaterial}
          receiveShadow
          onClick={(event) => {
            const range = inlays.ranges.find(
              (entry) =>
                event.faceIndex != null &&
                event.faceIndex >= entry.start &&
                event.faceIndex < entry.end,
            );
            const marker = range ? allMarkers[range.markerIndex] : undefined;
            if (!marker) return;
            event.stopPropagation();
            playSound("map.select");
            onPick(marker.lesson);
          }}
          onPointerOver={(event) => {
            const range = inlays.ranges.find(
              (entry) =>
                event.faceIndex != null &&
                event.faceIndex >= entry.start &&
                event.faceIndex < entry.end,
            );
            const marker = range ? allMarkers[range.markerIndex] : undefined;
            if (!marker) return;
            event.stopPropagation();
            onHover(marker.lesson);
          }}
          onPointerOut={() => onHover(null)}
        />
      ) : null}
      {batches.map((batch, batchIndex) => (
        <instancedMesh
          key={batch.arcs}
          ref={(node) => {
            engravingRefs.current[batchIndex] = node;
          }}
          args={[engravingGeometries[batchIndex], engravingMaterial, batch.indices.length]}
          name={`lesson-medallion-engraving-${batch.arcs}`}
          renderOrder={2}
          frustumCulled={false}
          raycast={() => {}}
        />
      ))}
    </group>
  );
}
