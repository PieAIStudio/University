/** One shared miniature kit, three batched layers; ground shade is in the atlas. */
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeBufferGeometries } from "three-stdlib";
import { planRemotePropsCatalogue } from "./remote-props.js";
import type { RemoteIslandPlacement } from "./remote-island-field.js";
import { buildMiniatureSurfaces, mergeMiniatureProps } from "./miniature-batch.js";
import { usePrefersReducedMotion } from "../reduced-motion.js";
import { islandLookFrozen } from "./island-surface-style.js";

export interface RemotePropsFieldProps {
  readonly islands: readonly RemoteIslandPlacement[];
  readonly onPick?: (index: number) => void;
  readonly onHover?: (index: number | null) => void;
}
const triangles = (g: THREE.BufferGeometry) => (g.index?.count ?? 0) / 3;

export function RemotePropsField({ islands, onPick, onHover }: RemotePropsFieldProps) {
  const reduced = usePrefersReducedMotion();
  const plan = useMemo(() => planRemotePropsCatalogue(islands), [islands]);
  const batch = useMemo(() => {
    const trees = mergeMiniatureProps(plan.trees);
    const props = mergeMiniatureProps([...plan.landmarks, ...plan.accents]);
    const surfaces = buildMiniatureSurfaces(plan);
    const scenery =
      surfaces.bank.index?.count && props.index?.count
        ? mergeBufferGeometries([props, surfaces.bank])!
        : props;
    scenery.userData.miniatureRanges = props.userData.miniatureRanges;
    scenery.userData.miniatureSceneryBounds = props.userData.miniatureSceneryBounds;
    if (scenery !== props) props.dispose();
    surfaces.bank.dispose();
    return { trees, scenery, water: surfaces.water };
  }, [plan, islands]);
  const materials = useMemo(() => {
    const time = { value: 0 };
    const solid = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0,
    });
    const water = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    water.onBeforeCompile = (shader) => {
      shader.uniforms.uMiniatureTime = time;
      shader.vertexShader = `varying vec3 vMiniaturePosition;\n${shader.vertexShader}`.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvMiniaturePosition = position;",
      );
      shader.fragmentShader =
        `uniform float uMiniatureTime;\nvarying vec3 vMiniaturePosition;\n${shader.fragmentShader}`.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float ripple = sin(vMiniaturePosition.y * 24.0 + vMiniaturePosition.z * 9.0 + uMiniatureTime * 2.0);
          diffuseColor.rgb *= 1.0 + ripple * 0.055;`,
        );
    };
    water.customProgramCacheKey = () => "miniature-water-v1";
    return { solid, water, time };
  }, []);
  useFrame((_, delta) => {
    if (!reduced && !islandLookFrozen()) materials.time.value += Math.min(0.05, Math.max(0, delta));
  });
  useEffect(() => () => Object.values(batch).forEach((g) => g.dispose()), [batch]);
  useEffect(
    () => () => {
      materials.solid.dispose();
      materials.water.dispose();
    },
    [materials],
  );
  const totalTriangles = Object.values(batch).reduce((sum, g) => sum + triangles(g), 0);
  const pickIndex = (event: ThreeEvent<MouseEvent | PointerEvent>) => {
    const mesh = event.object as THREE.Mesh;
    const ranges = mesh.geometry.userData.miniatureRanges as
      | readonly { start: number; end: number; islandId: string }[]
      | undefined;
    const range =
      typeof event.faceIndex === "number"
        ? ranges?.find((r) => event.faceIndex! >= r.start && event.faceIndex! < r.end)
        : undefined;
    return range ? islands.findIndex((island) => island.id === range.islandId) : -1;
  };
  const events = {
    onClick: (event: ThreeEvent<MouseEvent>) => {
      const index = pickIndex(event);
      if (index >= 0) {
        event.stopPropagation();
        onPick?.(index);
      }
    },
    onPointerMove: (event: ThreeEvent<PointerEvent>) => {
      const index = pickIndex(event);
      if (index >= 0) {
        event.stopPropagation();
        onHover?.(index);
      }
    },
    onPointerOut: () => onHover?.(null),
  };
  return (
    <group
      name="remote-props"
      userData={{
        remoteProps: true,
        remotePropCount: plan.totalProps,
        remoteTreeCount: plan.trees.length,
        remoteLandmarkCount: plan.landmarks.length,
        remoteAccentCount: plan.accents.length,
        remoteTriangleCount: totalTriangles,
        miniatureStyles: islands.map((island) => island.blueprint.themeSelection.recipeId),
      }}
    >
      {triangles(batch.trees) > 0 ? (
        <mesh
          name="remote-props-trees"
          geometry={batch.trees}
          material={materials.solid}
          {...events}
          frustumCulled={false}
          userData={{
            remoteProps: true,
            remotePropsKind: "tree",
            remotePlacementCount: plan.trees.length,
          }}
        />
      ) : null}
      {triangles(batch.scenery) > 0 ? (
        <mesh
          name="remote-props-landmarks"
          geometry={batch.scenery}
          material={materials.solid}
          {...events}
          frustumCulled={false}
          userData={{
            remoteProps: true,
            remotePropsKind: "landmark",
            remotePlacementCount: plan.landmarks.length + plan.accents.length,
          }}
        />
      ) : null}
      {triangles(batch.water) > 0 ? (
        <mesh
          name="remote-props-water"
          geometry={batch.water}
          material={materials.water}
          frustumCulled={false}
        />
      ) : null}
    </group>
  );
}
