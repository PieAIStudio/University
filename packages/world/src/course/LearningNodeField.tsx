import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import type { MapLearningKind } from "@pieai/university-core";

import { createMedallionGeometry, MEDALLION_TOP_RADIUS } from "../grid/lesson-medallion.js";
import {
  composeStopMatrix,
  createLockStoneGeometry,
  createMarkerMatrixScratch,
  MARKER_ENGRAVING_OFFSET,
  MARKER_PLINTH_OFFSET,
  type GridLessonMarkerSurface,
} from "../grid/LessonMarkerField.js";
import { GRID_LESSON_PLINTH_ALBEDO, GRID_STOP_RING } from "../grid/grid-palette.js";
import { islandLookFrozen } from "../island/island-surface-style.js";
import { unitRingGeometry, unitSigilArcCount } from "../island/unit-sigil.js";
import { usePrefersReducedMotion } from "../reduced-motion.js";
import type { LessonPlacement } from "../Maps.js";
import {
  buildLearningStoneGeometry,
  flutterGateStreamers,
  flutterPennant,
  LEARNING_PAD_RADIUS,
  learningGateStreamerGeometry,
  learningNodeKindGeometry,
  learningPennantGeometry,
} from "./learning-node-geometry.js";
import { learningSiteLocked, type LearningSite } from "./learning-sites.js";

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);
/** A pad's unit ring when its lesson carries no sigil. */
const DEFAULT_ARCS = 4;

interface Stop {
  readonly site: LearningSite;
  readonly locked: boolean;
  readonly arcs: number;
  readonly surface: GridLessonMarkerSurface | undefined;
}

/**
 * The course's learning nodes as places on the island (V5 R59). Every node
 * stands on the lesson stone itself — the same medallion, the same unit ring,
 * the same lock stone — and only the object beside it says what it is: a gate
 * across the road, a pennant, a notice board. The ring is green where the
 * avatar can go and red where it cannot. Clicking the object or its stone does
 * what clicking its DOM chip does; the chip stays the accessible name, because
 * readable text is DOM, never geometry.
 *
 * Everything is instanced: a course draws a gate every few lessons, so this is
 * a fixed handful of draws however long the road is.
 */
export function LearningNodeField({
  sites,
  lessons,
  surfaces,
  onPick,
}: {
  readonly sites: readonly LearningSite[];
  readonly lessons: readonly LessonPlacement[];
  /** How each pad leans into the ground, by site id (the lesson stones' own rule). */
  readonly surfaces?: ReadonlyMap<string, GridLessonMarkerSurface>;
  readonly onPick?: (site: LearningSite) => void;
}) {
  const stops = useMemo<readonly Stop[]>(
    () =>
      sites
        .filter((site) => site.resolved)
        .map((site) => {
          const sigil = lessons.find((lesson) => lesson.lessonId === site.opensWith)?.visualToken
            .sigil;
          return {
            site,
            locked: learningSiteLocked(site, lessons),
            arcs: sigil ? unitSigilArcCount(sigil) : DEFAULT_ARCS,
            surface: surfaces?.get(site.id),
          };
        }),
    [sites, lessons, surfaces],
  );
  const byKind = useMemo(() => {
    const of = (kind: MapLearningKind) => stops.filter((stop) => stop.site.kind === kind);
    return { checkpoint: of("checkpoint"), challenge: of("challenge"), personal: of("personal") };
  }, [stops]);
  const ringBatches = useMemo(() => {
    const grouped = new Map<number, Stop[]>();
    for (const stop of stops) grouped.set(stop.arcs, [...(grouped.get(stop.arcs) ?? []), stop]);
    return [...grouped.entries()].map(([arcs, members]) => ({ arcs, members }));
  }, [stops]);

  const geometries = useMemo(
    () => ({
      checkpoint: learningNodeKindGeometry("checkpoint"),
      challenge: learningNodeKindGeometry("challenge"),
      personal: learningNodeKindGeometry("personal"),
      pad: createMedallionGeometry(),
      lock: createLockStoneGeometry(),
    }),
    [],
  );
  const rings = useMemo(
    () => new Map(ringBatches.map(({ arcs }) => [arcs, unitRingGeometry(arcs)])),
    [ringBatches],
  );
  const pennant = useMemo(() => learningPennantGeometry(), []);
  const pennantRest = useMemo(
    () => Float32Array.from((pennant.getAttribute("position") as THREE.BufferAttribute).array),
    [pennant],
  );
  const streamers = useMemo(() => learningGateStreamerGeometry(), []);
  const stones = useMemo(() => buildLearningStoneGeometry(sites), [sites]);
  const materials = useMemo(
    () => ({
      object: new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.82,
        metalness: 0,
      }),
      cloth: new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.9,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
      // Paper and ribbons hang in the lintel's shadow and are seen from both
      // sides; a little of their own light keeps them paper-white, not grey.
      streamer: new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.95,
        metalness: 0,
        side: THREE.DoubleSide,
        emissive: 0x6a6258,
      }),
      // The lesson stone's own body and ring materials (LessonMarkerField).
      pad: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.7,
        metalness: 0.04,
      }),
      ring: new THREE.MeshBasicMaterial({
        color: 0xffffff,
        toneMapped: false,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
      lock: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
    }),
    [],
  );
  useEffect(
    () => () => {
      for (const geometry of Object.values(geometries)) geometry.dispose();
      pennant.dispose();
      streamers.geometry.dispose();
      for (const material of Object.values(materials)) material.dispose();
    },
    [geometries, pennant, streamers, materials],
  );
  useEffect(() => () => rings.forEach((geometry) => geometry.dispose()), [rings]);
  useEffect(() => () => stones?.dispose(), [stones]);

  const refs = {
    checkpoint: useRef<THREE.InstancedMesh>(null),
    challenge: useRef<THREE.InstancedMesh>(null),
    personal: useRef<THREE.InstancedMesh>(null),
    pennant: useRef<THREE.InstancedMesh>(null),
    streamers: useRef<THREE.InstancedMesh>(null),
    pad: useRef<THREE.InstancedMesh>(null),
    lock: useRef<THREE.InstancedMesh>(null),
  };
  const ringRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const scratch = useMemo(() => createMarkerMatrixScratch(), []);
  const heading = useRef(Number.NaN);

  /** An object standing at `site.object`, turned to `yaw`. */
  const place = (
    mesh: THREE.InstancedMesh | null,
    list: readonly Stop[],
    yawOf: (s: Stop) => number,
  ) => {
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const turn = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    list.forEach((stop, index) => {
      turn.setFromAxisAngle(UP, yawOf(stop));
      mesh.setMatrixAt(index, matrix.compose(stop.site.object, turn, one));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  };

  useLayoutEffect(() => {
    // The gate spans the road, so the road decides its heading.
    place(refs.checkpoint.current, byKind.checkpoint, (stop) => stop.site.yaw ?? 0);
    place(refs.streamers.current, byKind.checkpoint, (stop) => stop.site.yaw ?? 0);
    heading.current = Number.NaN;
    const matrix = new THREE.Matrix4();
    const tint = new THREE.Color();
    const pad = refs.pad.current;
    const lock = refs.lock.current;
    stops.forEach((stop, index) => {
      const at = stop.site.ground;
      if (pad) {
        pad.setMatrixAt(
          index,
          composeStopMatrix(
            at,
            LEARNING_PAD_RADIUS,
            stop.surface,
            MARKER_PLINTH_OFFSET,
            LEARNING_PAD_RADIUS,
            matrix,
            scratch,
          ),
        );
        pad.setColorAt(
          index,
          tint.set(GRID_LESSON_PLINTH_ALBEDO).multiplyScalar(stop.locked ? 0.78 : 1),
        );
      }
      lock?.setMatrixAt(
        index,
        stop.locked
          ? composeStopMatrix(
              at,
              LEARNING_PAD_RADIUS,
              stop.surface,
              MARKER_ENGRAVING_OFFSET,
              LEARNING_PAD_RADIUS,
              matrix,
              scratch,
            )
          : HIDDEN,
      );
    });
    for (const mesh of [pad, lock]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    ringBatches.forEach((batch, batchIndex) => {
      const mesh = ringRefs.current[batchIndex];
      if (!mesh) return;
      batch.members.forEach((stop, slot) => {
        composeStopMatrix(
          stop.site.ground,
          LEARNING_PAD_RADIUS,
          stop.surface,
          MARKER_ENGRAVING_OFFSET,
          LEARNING_PAD_RADIUS * MEDALLION_TOP_RADIUS,
          matrix,
          scratch,
        );
        mesh.setMatrixAt(slot, matrix);
        mesh.setColorAt(slot, tint.set(stop.locked ? GRID_STOP_RING.locked : GRID_STOP_RING.idle));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
    // `place` and the refs are stable per render of this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, byKind, ringBatches, scratch]);

  // The subscribed preference, never a fresh media query per frame: reading
  // one in useFrame broke every other subscriber's live switch (the coastal
  // spring stopped at 0 when reduced motion was turned off).
  const reducedMotion = usePrefersReducedMotion();
  useEffect(() => {
    if (!reducedMotion) return;
    const position = pennant.getAttribute("position") as THREE.BufferAttribute;
    (position.array as Float32Array).set(pennantRest);
    position.needsUpdate = true;
    const hanging = streamers.geometry.getAttribute("position") as THREE.BufferAttribute;
    (hanging.array as Float32Array).set(streamers.rest);
    hanging.needsUpdate = true;
  }, [reducedMotion, pennant, pennantRest, streamers]);

  // Pennants and boards face the camera's heading, not its position: panning
  // does not turn them, so this is a rare matrix update, not a spin.
  const forward = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, clock }) => {
    if (!reducedMotion && !islandLookFrozen()) {
      if (byKind.challenge.length) flutterPennant(pennant, pennantRest, clock.elapsedTime);
      if (byKind.checkpoint.length) flutterGateStreamers(streamers, clock.elapsedTime);
    }
    camera.getWorldDirection(forward);
    const yaw = Math.atan2(-forward.x, -forward.z);
    if (Math.abs(yaw - heading.current) < 1e-3) return;
    heading.current = yaw;
    place(refs.challenge.current, byKind.challenge, () => yaw);
    place(refs.pennant.current, byKind.challenge, () => yaw);
    place(refs.personal.current, byKind.personal, () => yaw);
  });

  const pick =
    (list: readonly Stop[]) =>
    (event: ThreeEvent<MouseEvent>): void => {
      const stop = event.instanceId === undefined ? undefined : list[event.instanceId];
      if (!stop || !onPick) return;
      event.stopPropagation();
      onPick(stop.site);
    };

  if (!stops.length) return null;
  const objects = (
    kind: MapLearningKind,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    ref: RefObject<THREE.InstancedMesh | null>,
    name: string,
  ) =>
    byKind[kind].length ? (
      <instancedMesh
        key={name}
        ref={ref}
        name={name}
        args={[geometry, material, byKind[kind].length]}
        castShadow
        receiveShadow
        frustumCulled={false}
        onClick={pick(byKind[kind])}
      />
    ) : null;
  return (
    <group name="course-learning-nodes">
      {objects(
        "checkpoint",
        geometries.checkpoint,
        materials.object,
        refs.checkpoint,
        "learning-node-checkpoint",
      )}
      {objects(
        "checkpoint",
        streamers.geometry,
        materials.streamer,
        refs.streamers,
        "learning-node-streamers",
      )}
      {objects(
        "challenge",
        geometries.challenge,
        materials.object,
        refs.challenge,
        "learning-node-challenge",
      )}
      {objects("challenge", pennant, materials.cloth, refs.pennant, "learning-node-pennant")}
      {objects(
        "personal",
        geometries.personal,
        materials.object,
        refs.personal,
        "learning-node-personal",
      )}
      <instancedMesh
        ref={refs.pad}
        name="learning-node-pads"
        args={[geometries.pad, materials.pad, stops.length]}
        castShadow
        receiveShadow
        frustumCulled={false}
        onClick={pick(stops)}
      />
      <instancedMesh
        ref={refs.lock}
        name="learning-node-lock-stones"
        args={[geometries.lock, materials.lock, stops.length]}
        castShadow
        receiveShadow
        frustumCulled={false}
        onClick={pick(stops)}
      />
      {ringBatches.map((batch, batchIndex) => (
        <instancedMesh
          key={batch.arcs}
          ref={(node) => {
            ringRefs.current[batchIndex] = node;
          }}
          name={`learning-node-ring-${batch.arcs}`}
          args={[rings.get(batch.arcs)!, materials.ring, batch.members.length]}
          renderOrder={2}
          frustumCulled={false}
          raycast={() => {}}
        />
      ))}
      {stones ? (
        <mesh
          name="learning-node-stones"
          geometry={stones}
          material={materials.object}
          receiveShadow
        />
      ) : null}
    </group>
  );
}
