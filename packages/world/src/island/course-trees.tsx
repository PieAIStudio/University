/** The same complete tree forms used by the miniature kit, at course scale.
 * Each replaces one reserved tree, never an additional parallel forest.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { FoliagePlacement } from "./foliage-geometry.js";
import { createMiniatureAsset } from "./miniature-assets.js";

export function CourseTreeField({
  placements,
  kind,
}: {
  readonly placements: readonly FoliagePlacement[];
  readonly kind: "fir" | "broadleaf";
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => createMiniatureAsset(kind, "course"), [kind]);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0 }),
    [],
  );
  useLayoutEffect(() => {
    if (!ref.current) return;
    const dummy = new THREE.Object3D(),
      tint = new THREE.Color(),
      white = new THREE.Color(0xffffff);
    placements.forEach((p, index) => {
      dummy.position.set(p.position.x, p.position.y, p.position.z);
      dummy.rotation.set(0, p.turn, 0);
      dummy.scale.setScalar(p.height);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(index, dummy.matrix);
      tint.setHex(p.foliageTint ?? 0xffffff).lerp(white, 0.78);
      ref.current!.setColorAt(index, tint);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingBox();
    ref.current.computeBoundingSphere();
  }, [placements]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  if (!placements.length) return null;
  return (
    <instancedMesh
      ref={ref}
      name={`course-${kind}-trees`}
      args={[geometry, material, placements.length]}
      castShadow
      userData={{
        islandLookPlacementCount: placements.length,
        islandLookTreeTotalTriangles: (geometry.index?.count ?? 0) / 3,
      }}
    />
  );
}
