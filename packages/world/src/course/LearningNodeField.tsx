import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { MapLearningKind } from "@pieai/university-core";

import { createMedallionGeometry } from "../grid/lesson-medallion.js";
import { GRID_LEARNING_NODE_ALBEDO } from "../grid/grid-palette.js";
import { islandLookFrozen } from "../island/island-surface-style.js";
import { usePrefersReducedMotion } from "../reduced-motion.js";
import {
  buildLearningStoneGeometry,
  flutterPennant,
  LEARNING_PAD_RADIUS,
  learningNodeKindGeometry,
  learningPennantGeometry,
} from "./learning-node-geometry.js";
import type { LearningSite } from "./learning-sites.js";

const KINDS: readonly MapLearningKind[] = ["checkpoint", "personal", "challenge"];
/** The pad's centre sits this far above the ground, so its rim never floats. */
const PAD_LIFT = 0.03;

/**
 * The course's learning nodes as objects on the island, each one somewhere the
 * avatar can stand: under the gate, or on the pad in front of the pennant or
 * the board. Clicking the object or its pad does what clicking its DOM chip
 * does. The chip stays the accessible name: readable text is DOM, never
 * geometry.
 */
export function LearningNodeField({
  sites,
  onPick,
}: {
  readonly sites: readonly LearningSite[];
  readonly onPick?: (site: LearningSite) => void;
}) {
  const drawn = useMemo(() => sites.filter((site) => site.resolved), [sites]);
  const turning = useMemo(() => drawn.filter((site) => site.yaw === null), [drawn]);
  const fixed = useMemo(() => drawn.filter((site) => site.yaw !== null), [drawn]);
  const kinds = useMemo(
    () =>
      Object.fromEntries(KINDS.map((kind) => [kind, learningNodeKindGeometry(kind)])) as Record<
        MapLearningKind,
        THREE.BufferGeometry
      >,
    [],
  );
  const pennant = useMemo(() => learningPennantGeometry(), []);
  const rest = useMemo(
    () => Float32Array.from((pennant.getAttribute("position") as THREE.BufferAttribute).array),
    [pennant],
  );
  const pad = useMemo(() => createMedallionGeometry(), []);
  const stones = useMemo(() => buildLearningStoneGeometry(drawn), [drawn]);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.82,
        metalness: 0,
      }),
    [],
  );
  const cloth = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.9,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    [],
  );
  const padMaterials = useMemo(
    () => ({
      challenge: new THREE.MeshStandardMaterial({
        color: GRID_LEARNING_NODE_ALBEDO.challengePad,
        flatShading: true,
        roughness: 0.78,
      }),
      personal: new THREE.MeshStandardMaterial({
        color: GRID_LEARNING_NODE_ALBEDO.personalPad,
        flatShading: true,
        roughness: 0.78,
      }),
    }),
    [],
  );
  useEffect(() => () => Object.values(kinds).forEach((geometry) => geometry.dispose()), [kinds]);
  useEffect(() => () => pennant.dispose(), [pennant]);
  useEffect(() => () => pad.dispose(), [pad]);
  useEffect(() => () => stones?.dispose(), [stones]);
  useEffect(
    () => () => {
      material.dispose();
      cloth.dispose();
      padMaterials.challenge.dispose();
      padMaterials.personal.dispose();
    },
    [material, cloth, padMaterials],
  );

  // The subscribed preference, never a fresh media query per frame: reading
  // one in useFrame broke every other subscriber's live switch (the coastal
  // spring stopped at 0 when reduced motion was turned off).
  const reducedMotion = usePrefersReducedMotion();
  useEffect(() => {
    if (!reducedMotion) return;
    const position = pennant.getAttribute("position") as THREE.BufferAttribute;
    (position.array as Float32Array).set(rest);
    position.needsUpdate = true;
  }, [reducedMotion, pennant, rest]);

  // Face the camera's heading, not its position: panning does not turn them.
  const turned = useRef<THREE.Group>(null);
  const heading = useRef(Number.NaN);
  const forward = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, clock }) => {
    if (!reducedMotion && !islandLookFrozen() && turning.some((site) => site.kind === "challenge"))
      flutterPennant(pennant, rest, clock.elapsedTime);
    camera.getWorldDirection(forward);
    const yaw = Math.atan2(-forward.x, -forward.z);
    if (Math.abs(yaw - heading.current) < 1e-3 || !turned.current) return;
    heading.current = yaw;
    for (const child of turned.current.children) child.rotation.y = yaw;
  });

  const pick = (site: LearningSite) =>
    onPick
      ? (event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation();
          onPick(site);
        }
      : undefined;

  if (!drawn.length) return null;
  return (
    <group name="course-learning-nodes">
      <group ref={turned}>
        {turning.map((site) => (
          <group
            key={site.id}
            name={`learning-node-${site.kind}`}
            position={site.object}
            onClick={pick(site)}
          >
            <mesh geometry={kinds[site.kind]} material={material} castShadow receiveShadow />
            {site.kind === "challenge" ? (
              <mesh geometry={pennant} material={cloth} castShadow />
            ) : null}
          </group>
        ))}
      </group>
      {turning.map((site) =>
        site.kind === "challenge" || site.kind === "personal" ? (
          <mesh
            key={`${site.id}-pad`}
            name={`learning-node-pad-${site.kind}`}
            position={[site.ground.x, site.ground.y + PAD_LIFT, site.ground.z]}
            scale={[LEARNING_PAD_RADIUS, 1, LEARNING_PAD_RADIUS]}
            geometry={pad}
            material={padMaterials[site.kind]}
            receiveShadow
            onClick={pick(site)}
          />
        ) : null,
      )}
      {fixed.map((site) => (
        <mesh
          key={site.id}
          name={`learning-node-${site.kind}`}
          position={site.object}
          rotation-y={site.yaw!}
          geometry={kinds[site.kind]}
          material={material}
          castShadow
          receiveShadow
          onClick={pick(site)}
        />
      ))}
      {stones ? (
        <mesh name="learning-node-stones" geometry={stones} material={material} receiveShadow />
      ) : null}
    </group>
  );
}
