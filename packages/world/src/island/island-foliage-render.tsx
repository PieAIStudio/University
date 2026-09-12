/** One course foliage projection. Trees reuse the approved complete miniature
 * silhouettes; shrubs retain their three terrain-fitted lobes. Replaces the
 * old donor-trunk/large-sphere tree draw, not an extra overlay or forest.
 * It never loads donor trunks; their attribution and original source remain
 * in the asset registry. Placement continues to belong to IslandDressing.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Placement } from "../kit.js";
import type { IslandDressingPlacement, IslandDressingPlan } from "./island-dressing.js";
import { CourseTreeField } from "./course-trees.js";
import { courseTreeIsFir } from "./course-landscape-plan.js";
import {
  COURSE_BUSH_CROWN_DETAIL,
  COURSE_BUSH_CROWN_TRIANGLES_PER_LOBE,
  COURSE_CROWN_LOBES_PER_BUSH,
  bushCrownLobes,
  createSmoothIcosahedron,
} from "./foliage-geometry.js";

type FoliageRenderPlacement = Placement & {
  readonly treeForm: "fir" | "broadleaf";
  readonly foliageTint?: number;
  readonly shapeSeed?: string;
  readonly groundOffsets?: readonly number[];
};

function CourseBushFoliage({
  placements,
}: {
  readonly placements: readonly FoliageRenderPlacement[];
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const lobes = useMemo(() => placements.flatMap((p) => bushCrownLobes(p)), [placements]);
  const geometry = useMemo(() => createSmoothIcosahedron(COURSE_BUSH_CROWN_DETAIL, 1.2), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.92,
        metalness: 0,
        flatShading: false,
      }),
    [],
  );
  useLayoutEffect(() => {
    const target = ref.current;
    if (!target) return;
    const dummy = new THREE.Object3D();
    lobes.forEach((lobe, i) => {
      dummy.position.copy(lobe.position);
      dummy.quaternion.copy(lobe.quaternion);
      dummy.scale.copy(lobe.scale);
      dummy.updateMatrix();
      target.setMatrixAt(i, dummy.matrix);
      target.setColorAt(i, lobe.color);
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
    target.computeBoundingBox();
    target.computeBoundingSphere();
  }, [lobes]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  if (!lobes.length) return null;
  return (
    <instancedMesh
      ref={ref}
      name="course-bush-crowns"
      args={[geometry, material, lobes.length]}
      castShadow
      frustumCulled={false}
      userData={{
        islandLookFoliageInstanceCount: lobes.length,
        islandLookCrownTrianglesPerLobe: COURSE_BUSH_CROWN_TRIANGLES_PER_LOBE,
        islandLookCrownLobesPerPlacement: COURSE_CROWN_LOBES_PER_BUSH,
        islandLookPlacementCount: placements.length,
      }}
    />
  );
}

export function isIslandFoliagePlacement(p: IslandDressingPlacement): boolean {
  return (
    p.packId === "elemental-serenity" && (p.assetId === "treeTrunks" || p.assetId === "bushEmitter")
  );
}

export function toFoliageRenderPlacement(
  p: IslandDressingPlacement,
  scale: number,
): FoliageRenderPlacement {
  return {
    treeForm: courseTreeIsFir(p.foliageShapeSeed ?? p.id, p.x, p.z) ? "fir" : "broadleaf",
    position: new THREE.Vector3(
      p.x * scale,
      (p.y + (p.foliageRootOffset ?? 0)) * scale,
      p.z * scale,
    ),
    height: p.height * scale,
    turn: p.turn,
    foliageTint: p.foliageTint,
    shapeSeed: p.foliageShapeSeed,
    groundOffsets: p.foliageGroundOffsets?.map((n) => n * scale),
  };
}

export function IslandFoliage({
  plan,
  scale,
}: {
  readonly plan: IslandDressingPlan;
  readonly scale: number;
}) {
  const trees = useMemo(
    () =>
      plan.placements
        .filter((p) => p.assetId === "treeTrunks")
        .map((p) => toFoliageRenderPlacement(p, scale)),
    [plan, scale],
  );
  const firs = useMemo(() => trees.filter((p) => p.treeForm === "fir"), [trees]);
  const broadleaves = useMemo(() => trees.filter((p) => p.treeForm === "broadleaf"), [trees]);
  const bushes = useMemo(
    () =>
      plan.placements
        .filter((p) => p.assetId === "bushEmitter")
        .map((p) => toFoliageRenderPlacement(p, scale)),
    [plan, scale],
  );
  return (
    <>
      <CourseTreeField kind="fir" placements={firs} />
      <CourseTreeField kind="broadleaf" placements={broadleaves} />
      {bushes.length ? <CourseBushFoliage placements={bushes} /> : null}
    </>
  );
}
