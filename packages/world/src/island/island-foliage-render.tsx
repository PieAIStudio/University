/**
 * Elemental-Serenity foliage projection.
 *
 * Course trees keep the six registered donor trunks and replace the retired
 * alpha cards with three overlapping icosahedron lobes (V5 K / ADR-0008).
 * Bushes are three flattened lobes in a second instanced field. Distant
 * vegetation belongs exclusively to remote-props; it never loads donor trunks.
 *
 * Placement is not authored here. IslandDressing passes IslandField points;
 * this module only projects those points.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { useIslandGLTF, type Placement } from "../kit.js";
import { resolveIslandRuntimeAsset, type IslandAssetPackId } from "./island-asset-registry.js";
import type { IslandDressingPlacement, IslandDressingPlan } from "./island-dressing.js";
import { seeded } from "./random.js";
import {
  COURSE_BUSH_CROWN_DETAIL,
  COURSE_BUSH_CROWN_TRIANGLES_PER_LOBE,
  COURSE_CROWN_LOBES_PER_BUSH,
  COURSE_CROWN_LOBES_PER_TREE,
  COURSE_TREE_CROWN_DETAIL,
  COURSE_TREE_CROWN_TRIANGLES_PER_LOBE,
  COURSE_TREE_TRUNK_HEIGHT_RATIO,
  bushCrownLobes,
  createSmoothIcosahedron,
  treeCrownLobes,
  type CrownLobeTransform,
} from "./foliage-geometry.js";

const ELEMENTAL_SERENITY_PACK: IslandAssetPackId = "elemental-serenity";
const TREE_ASSET_ID = "treeTrunks";
const BUSH_ASSET_ID = "bushEmitter";

function donorSource(assetId: string): string {
  const asset = resolveIslandRuntimeAsset(ELEMENTAL_SERENITY_PACK, assetId);
  if (!asset) {
    throw new Error(`Missing registered elemental-serenity asset: ${assetId}`);
  }
  return asset.src;
}

const TREE_SRC = donorSource(TREE_ASSET_ID);
const UP = new THREE.Vector3(0, 1, 0);
const DUMMY = new THREE.Object3D();

interface TrunkVariant {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
  readonly triangles: number;
}

function disposeTrunkVariants(variants: readonly TrunkVariant[]) {
  for (const variant of variants) {
    variant.geometry.dispose();
    variant.material.dispose();
  }
}

function writeCrownInstances(
  target: THREE.InstancedMesh,
  lobes: readonly CrownLobeTransform[],
): void {
  lobes.forEach((lobe, index) => {
    DUMMY.position.copy(lobe.position);
    DUMMY.quaternion.copy(lobe.quaternion);
    DUMMY.scale.copy(lobe.scale);
    DUMMY.updateMatrix();
    target.setMatrixAt(index, DUMMY.matrix);
    target.setColorAt(index, lobe.color);
  });
  target.instanceMatrix.needsUpdate = true;
  if (target.instanceColor) target.instanceColor.needsUpdate = true;
  target.computeBoundingBox();
  target.computeBoundingSphere();
}

function SolidCrownField({
  lobes,
  detail,
  trianglesPerLobe,
  lobesPerPlacement,
  name,
  placementCount,
}: {
  readonly lobes: readonly CrownLobeTransform[];
  readonly detail: number;
  readonly trianglesPerLobe: number;
  readonly lobesPerPlacement: number;
  readonly name: string;
  readonly placementCount?: number;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  // A crown represents many sun-facing leaves, not an opaque polished ball.
  // Bend its shared normals upward to soften the hard Lambert terminator;
  // positions, contact, shadows and geometry budgets remain unchanged.
  const geometry = useMemo(() => createSmoothIcosahedron(detail, 1.2), [detail]);
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
    const target = mesh.current;
    if (!target) return;
    writeCrownInstances(target, lobes);
  }, [lobes]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  if (lobes.length === 0) return null;
  return (
    <instancedMesh
      ref={mesh}
      name={name}
      args={[geometry, material, lobes.length]}
      castShadow
      frustumCulled={false}
      userData={{
        islandLookFoliageInstanceCount: lobes.length,
        islandLookCrownTrianglesPerLobe: trianglesPerLobe,
        islandLookCrownLobesPerPlacement: lobesPerPlacement,
        ...(placementCount === undefined ? {} : { islandLookPlacementCount: placementCount }),
      }}
    />
  );
}

function normalizedTrunkVariants(scene: THREE.Object3D): readonly TrunkVariant[] {
  scene.updateMatrixWorld(true);
  const variants: TrunkVariant[] = [];
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const sourceMaterial = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!sourceMaterial) return;
    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box) return;
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const height = Math.max(size.y, 1e-5);
    const normalise = new THREE.Matrix4()
      .makeScale(1 / height, 1 / height, 1 / height)
      .multiply(new THREE.Matrix4().makeTranslation(-centre.x, -box.min.y, -centre.z));
    geometry.applyMatrix4(normalise);
    const material = sourceMaterial.clone();
    if (material instanceof THREE.MeshStandardMaterial) {
      material.flatShading = true;
      material.roughness = Math.max(0.78, material.roughness);
      material.side = THREE.DoubleSide;
      material.needsUpdate = true;
    }
    variants.push({
      geometry,
      material,
      triangles: geometry.index
        ? geometry.index.count / 3
        : (geometry.getAttribute("position")?.count ?? 0) / 3,
    });
  });
  if (variants.length === 0) throw new Error("elemental-serenity treeTrunks.glb has no meshes");
  return variants;
}

function TrunkVariantField({
  variant,
  at,
  castShadow = true,
}: {
  readonly variant: TrunkVariant;
  readonly at: readonly Placement[];
  readonly castShadow?: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const resources = useMemo(
    () => ({ geometry: variant.geometry.clone(), material: variant.material.clone() }),
    [variant],
  );

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const quaternion = new THREE.Quaternion();
    at.forEach((placement, index) => {
      DUMMY.position.copy(placement.position);
      quaternion.setFromAxisAngle(UP, placement.turn);
      DUMMY.quaternion.copy(quaternion);
      DUMMY.scale.setScalar(placement.height);
      DUMMY.updateMatrix();
      target.setMatrixAt(index, DUMMY.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingBox();
    target.computeBoundingSphere();
  }, [at, resources]);

  useEffect(
    () => () => {
      resources.geometry.dispose();
      resources.material.dispose();
    },
    [resources],
  );

  if (at.length === 0) return null;
  return (
    <instancedMesh
      ref={mesh}
      args={[resources.geometry, resources.material, at.length]}
      castShadow={castShadow}
      frustumCulled={false}
      userData={{
        islandLookTreeTrunkTriangles: variant.triangles,
        islandLookPlacementCount: at.length,
      }}
    />
  );
}

function TreeTrunks({
  variants,
  placements,
  castShadow = true,
}: {
  readonly variants: readonly TrunkVariant[];
  readonly placements: readonly Placement[];
  readonly castShadow?: boolean;
}) {
  const assignments = useMemo(() => {
    const grouped = variants.map(() => [] as Placement[]);
    placements.forEach((placement, index) => {
      const variantIndex = Math.floor(
        seeded(`tree-trunk/${index}/${placement.turn}`)() * variants.length,
      );
      grouped[variantIndex]!.push(placement);
    });
    return grouped;
  }, [placements, variants]);
  return (
    <>
      {variants.map((variant, index) => (
        <TrunkVariantField
          key={`tree-trunk-${index}`}
          variant={variant}
          at={assignments[index]!}
          castShadow={castShadow}
        />
      ))}
    </>
  );
}

function CourseTreeFoliage({ placements }: { readonly placements: readonly Placement[] }) {
  const tree = useIslandGLTF(TREE_SRC);
  const variants = useMemo(() => normalizedTrunkVariants(tree.scene), [tree]);
  const lobes = useMemo(
    () => placements.flatMap((placement) => treeCrownLobes(placement)),
    [placements],
  );
  // In the widest donor variant, branches span 1.079 times the bare trunk
  // height. Scaling that skeleton to the *whole tree* height poked orange
  // forks through the crown. Its top now meets the upper crown's centre.
  const trunks = useMemo(
    () =>
      placements.map((placement) => ({
        ...placement,
        height: placement.height * COURSE_TREE_TRUNK_HEIGHT_RATIO,
      })),
    [placements],
  );
  useEffect(() => () => disposeTrunkVariants(variants), [variants]);
  return (
    <>
      <TreeTrunks variants={variants} placements={trunks} castShadow={false} />
      <SolidCrownField
        lobes={lobes}
        detail={COURSE_TREE_CROWN_DETAIL}
        trianglesPerLobe={COURSE_TREE_CROWN_TRIANGLES_PER_LOBE}
        lobesPerPlacement={COURSE_CROWN_LOBES_PER_TREE}
        name="course-tree-crowns"
      />
    </>
  );
}

function CourseBushFoliage({ placements }: { readonly placements: readonly Placement[] }) {
  const lobes = useMemo(
    () => placements.flatMap((placement) => bushCrownLobes(placement)),
    [placements],
  );
  return (
    <SolidCrownField
      lobes={lobes}
      detail={COURSE_BUSH_CROWN_DETAIL}
      trianglesPerLobe={COURSE_BUSH_CROWN_TRIANGLES_PER_LOBE}
      lobesPerPlacement={COURSE_CROWN_LOBES_PER_BUSH}
      name="course-bush-crowns"
      placementCount={placements.length}
    />
  );
}

export function isIslandFoliagePlacement(placement: IslandDressingPlacement): boolean {
  return (
    placement.packId === ELEMENTAL_SERENITY_PACK &&
    (placement.assetId === TREE_ASSET_ID || placement.assetId === BUSH_ASSET_ID)
  );
}

function toPlacement(placement: IslandDressingPlacement, scale: number): Placement {
  return {
    position: new THREE.Vector3(placement.x * scale, placement.y * scale, placement.z * scale),
    height: placement.height * scale,
    turn: placement.turn,
  };
}

export function IslandFoliage({
  plan,
  scale,
}: {
  readonly plan: IslandDressingPlan;
  readonly scale: number;
}) {
  const treePlacements = useMemo(
    () =>
      plan.placements
        .filter((placement) => placement.assetId === TREE_ASSET_ID)
        .map((placement) => toPlacement(placement, scale)),
    [plan, scale],
  );
  const bushPlacements = useMemo(
    () =>
      plan.placements
        .filter((placement) => placement.assetId === BUSH_ASSET_ID)
        .map((placement) => toPlacement(placement, scale)),
    [plan, scale],
  );
  return (
    <>
      {treePlacements.length > 0 ? <CourseTreeFoliage placements={treePlacements} /> : null}
      {bushPlacements.length > 0 ? <CourseBushFoliage placements={bushPlacements} /> : null}
    </>
  );
}
