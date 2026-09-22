import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { MapLearningKind } from "@pieai/university-core";

import { buildLearningStoneGeometry, learningNodeKindGeometry } from "./learning-node-geometry.js";
import type { LearningSite } from "./learning-sites.js";

const KINDS: readonly MapLearningKind[] = ["checkpoint", "personal", "challenge"];

/**
 * The course's learning nodes as objects on the island. Decoration for the
 * DOM chip above each one, which stays the pick target and the accessible
 * name: readable text is DOM, never geometry.
 */
export function LearningNodeField({ sites }: { readonly sites: readonly LearningSite[] }) {
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
  useEffect(() => () => Object.values(kinds).forEach((geometry) => geometry.dispose()), [kinds]);
  useEffect(() => () => stones?.dispose(), [stones]);
  useEffect(() => () => material.dispose(), [material]);

  // Face the camera's heading, not its position: panning does not turn them.
  const turned = useRef<THREE.Group>(null);
  const heading = useRef(Number.NaN);
  const forward = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    camera.getWorldDirection(forward);
    const yaw = Math.atan2(-forward.x, -forward.z);
    if (Math.abs(yaw - heading.current) < 1e-3 || !turned.current) return;
    heading.current = yaw;
    for (const child of turned.current.children) child.rotation.y = yaw;
  });

  if (!drawn.length) return null;
  return (
    <group name="course-learning-nodes">
      <group ref={turned}>
        {turning.map((site) => (
          <mesh
            key={site.id}
            name={`learning-node-${site.kind}`}
            position={site.ground}
            geometry={kinds[site.kind]}
            material={material}
            castShadow
            receiveShadow
          />
        ))}
      </group>
      {fixed.map((site) => (
        <mesh
          key={site.id}
          name={`learning-node-${site.kind}`}
          position={site.ground}
          rotation-y={site.yaw!}
          geometry={kinds[site.kind]}
          material={material}
          castShadow
          receiveShadow
        />
      ))}
      {stones ? (
        <mesh name="learning-node-stones" geometry={stones} material={material} receiveShadow />
      ) : null}
    </group>
  );
}
