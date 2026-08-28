import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

import type { InspectorLayerId } from "./types.js";
import type { PreviewSceneMetrics, PreviewTuningValues } from "./preview-runtime.js";

interface GrassState {
  baseCount: number;
}

interface SceneState {
  readonly grass: WeakMap<THREE.InstancedMesh, GrassState>;
}

const sceneStates = new WeakMap<THREE.Scene, SceneState>();

function stateFor(scene: THREE.Scene): SceneState {
  const existing = sceneStates.get(scene);
  if (existing) return existing;
  const state: SceneState = { grass: new WeakMap() };
  sceneStates.set(scene, state);
  return state;
}

function materialsOf(object: THREE.Object3D): THREE.Material[] {
  const material = (object as THREE.Mesh).material;
  if (Array.isArray(material)) return material;
  return material ? [material] : [];
}

function setLightIntensity(lights: THREE.Light[], target: number): void {
  const light = lights[0];
  if (!light) return;
  light.intensity = target;
}

function applyPreviewTuning(
  scene: THREE.Scene,
  layer: InspectorLayerId,
  tuning: PreviewTuningValues,
): number {
  const state = stateFor(scene);
  const directional: THREE.DirectionalLight[] = [];
  const ambient: THREE.AmbientLight[] = [];
  let grassInstances = 0;

  scene.traverse((object) => {
    if (object.type === "DirectionalLight") directional.push(object as THREE.DirectionalLight);
    if (object.type === "AmbientLight") ambient.push(object as THREE.AmbientLight);

    if (
      object instanceof THREE.InstancedMesh &&
      object.geometry.name === "IslandGrassBladeGeometry"
    ) {
      const previous = state.grass.get(object);
      const baseCount = previous?.baseCount ?? object.instanceMatrix.count;
      const nextCount = Math.max(
        0,
        Math.min(
          object.instanceMatrix.count,
          Math.round(baseCount * tuning.grassDensityMultiplier),
        ),
      );
      state.grass.set(object, { baseCount });
      object.count = nextCount;
      grassInstances += nextCount;
    }

    for (const material of materialsOf(object)) {
      const uniforms = material.userData.grassUniforms as
        | { readonly uGrassHeightScale?: { value: number } }
        | undefined;
      if (uniforms?.uGrassHeightScale) {
        const baseHeight =
          (material.userData.inspectorBaseGrassHeight as number | undefined) ??
          uniforms.uGrassHeightScale.value;
        material.userData.inspectorBaseGrassHeight = baseHeight;
        uniforms.uGrassHeightScale.value = baseHeight * tuning.grassHeightMultiplier;
      }
      if (object.name === "island-terrain" && material instanceof THREE.MeshStandardMaterial) {
        const base = material.userData.inspectorBaseColor as THREE.Color | undefined;
        if (!base) material.userData.inspectorBaseColor = material.color.clone();
        const original =
          (material.userData.inspectorBaseColor as THREE.Color | undefined) ?? material.color;
        material.color.copy(original).multiplyScalar(Math.max(0, 1 + tuning.terrainBrightness));
      }
    }
  });

  setLightIntensity(directional, tuning.keyLightIntensity);
  setLightIntensity(ambient, tuning.ambientLightIntensity);
  // The planet uses the same first-key convention as Weather; its extra fills
  // remain untouched so a key-light edit never silently changes the whole grade.
  void layer;
  return grassInstances;
}

export function PreviewOverrideBridge({
  layer,
  tuning,
  onMetrics,
}: {
  readonly layer: InspectorLayerId;
  readonly tuning: PreviewTuningValues;
  readonly onMetrics?: (metrics: PreviewSceneMetrics) => void;
}) {
  const scene = useThree(({ scene: current }) => current);
  const lastGrassCount = useRef<number | null>(null);
  useFrame(() => {
    const grassInstances = applyPreviewTuning(scene, layer, tuning);
    if (onMetrics && lastGrassCount.current !== grassInstances) {
      lastGrassCount.current = grassInstances;
      onMetrics({ grassInstances });
    }
  });
  return null;
}
