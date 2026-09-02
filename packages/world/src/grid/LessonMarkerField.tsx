import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { playSound } from "@pieai/university-ui/sound/index.js";
import { islandLookFrozen } from "../island/island-surface-style.js";
import type { LessonPlacement } from "../Maps.js";
import { GRID_SHARED_SOIL } from "./grid-palette.js";

export interface GridLessonMarker {
  readonly lesson: LessonPlacement;
  readonly radius: number;
  readonly colour: number;
}

interface LessonMarkerFieldProps {
  readonly markers: readonly GridLessonMarker[];
  readonly onPick: (lesson: LessonPlacement) => void;
  readonly onHover: (lesson: LessonPlacement | null) => void;
}

export function LessonMarkerField({ markers, onPick, onHover }: LessonMarkerFieldProps) {
  const plinth = useRef<THREE.InstancedMesh>(null);
  const rings = useRef<THREE.InstancedMesh>(null);
  // The road is the continuous ivory layer. Each lesson gets one smaller
  // coral stone set into it, which keeps the route readable without adding a
  // separate mesh per lesson.
  const plinthGeometry = useMemo(() => {
    const geometry = new THREE.CylinderGeometry(0.92, 1, 0.22, 6);
    const normal = geometry.getAttribute("normal");
    const colours = new Float32Array(normal.count * 3);
    for (let index = 0; index < normal.count; index += 1) {
      // The inset top receives less reflected fill than its bevel. This is a
      // face relationship, not a global marker grade, and preserves the
      // bright side rim that keeps the paver legible on the road.
      const value = normal.getY(index) > 0.9 ? 0.5 : 1;
      colours[index * 3] = value;
      colours[index * 3 + 1] = value;
      colours[index * 3 + 2] = value;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    return geometry;
  }, []);
  // The ring is the learner-facing click cue. It gets a little more visible
  // area in the fixed phone frame while keeping the same six-sided geometry
  // and one instanced draw.
  const ringGeometry = useMemo(() => new THREE.CylinderGeometry(0.72, 0.82, 0.12, 6), []);
  const plinthMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.72,
        metalness: 0.04,
        flatShading: true,
      }),
    [],
  );
  const ringMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        toneMapped: false,
      }),
    [],
  );
  const matrix = useMemo(() => new THREE.Matrix4(), []);

  useLayoutEffect(() => {
    const plinthTarget = plinth.current;
    const ringTarget = rings.current;
    if (!plinthTarget || !ringTarget) return;
    markers.forEach(({ lesson, radius, colour }, index) => {
      matrix.compose(
        new THREE.Vector3(lesson.position.x, lesson.position.y + radius * 0.11, lesson.position.z),
        new THREE.Quaternion(),
        new THREE.Vector3(radius, radius, radius),
      );
      plinthTarget.setMatrixAt(index, matrix);
      // `instanceColor` is a separate Three feature from geometry vertex
      // colours. Leaving vertexColors enabled on CylinderGeometry (which has
      // no color attribute) binds the missing attribute as black and turns
      // every paver into a dark token.
      plinthTarget.setColorAt(index, new THREE.Color(GRID_SHARED_SOIL.road));
      matrix.compose(
        new THREE.Vector3(lesson.position.x, lesson.position.y + radius * 0.25, lesson.position.z),
        new THREE.Quaternion(),
        new THREE.Vector3(radius, radius, radius),
      );
      ringTarget.setMatrixAt(index, matrix);
      ringTarget.setColorAt(index, new THREE.Color(colour));
    });
    plinthTarget.instanceMatrix.needsUpdate = true;
    ringTarget.instanceMatrix.needsUpdate = true;
    if (plinthTarget.instanceColor) plinthTarget.instanceColor.needsUpdate = true;
    if (ringTarget.instanceColor) ringTarget.instanceColor.needsUpdate = true;
  }, [markers, matrix]);

  useFrame(({ clock }) => {
    const ringTarget = rings.current;
    if (!ringTarget || islandLookFrozen()) return;
    const liveIndex = markers.findIndex((entry) => entry.lesson.state === "live");
    if (liveIndex < 0) return;
    const live = markers[liveIndex]!;
    const pulse = 1 + Math.sin(clock.elapsedTime * 2.2) * 0.08;
    matrix.compose(
      new THREE.Vector3(
        live.lesson.position.x,
        live.lesson.position.y + live.radius * 0.25,
        live.lesson.position.z,
      ),
      new THREE.Quaternion(),
      new THREE.Vector3(live.radius * pulse, live.radius * pulse, live.radius * pulse),
    );
    ringTarget.setMatrixAt(liveIndex, matrix);
    ringTarget.instanceMatrix.needsUpdate = true;
  });

  useEffect(() => {
    return () => {
      plinthGeometry.dispose();
      ringGeometry.dispose();
      plinthMaterial.dispose();
      ringMaterial.dispose();
    };
  }, [plinthGeometry, plinthMaterial, ringGeometry, ringMaterial]);

  if (markers.length === 0) return null;
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
        ref={plinth}
        args={[plinthGeometry, plinthMaterial, markers.length]}
        name="hex-grid-lesson-plinths"
        /*
          The 41 things a learner actually clicks were the only objects on the
          island that neither cast a shadow, received one, nor had a contact
          blob under them, so they read as stickers printed on the grass. The
          decorative props already had `ContactShadowField`; the plinths were
          simply missed. They are one instanced mesh, so this is one shadow draw
          for all of them.
        */
        castShadow
        receiveShadow
        onClick={pickMarker}
        onPointerOver={hoverMarker}
        onPointerOut={() => onHover(null)}
        frustumCulled={false}
      />
      <instancedMesh
        ref={rings}
        args={[ringGeometry, ringMaterial, markers.length]}
        name="hex-grid-lesson-rings"
        renderOrder={2}
        frustumCulled={false}
      />
    </group>
  );
}
