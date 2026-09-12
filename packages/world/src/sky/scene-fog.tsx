import { useLayoutEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

type Fog = THREE.Scene["fog"];
interface Owner {
  readonly fog: Fog;
}
interface FogBinding {
  readonly original: Fog;
  readonly owners: Owner[];
}
const bindings = new WeakMap<THREE.Scene, FogBinding>();

/** Scene-level property handoff, not a new atmosphere renderer. During a
 * course→world commit the new fog may attach before the old fog detaches.
 * Blindly restoring the old attachment's null erased the newly mounted fog.
 * Remove exactly this lease; restore only a still-live owner or the baseline.
 */
export function bindSceneFog(scene: THREE.Scene, fog: Fog): () => void {
  let binding = bindings.get(scene);
  if (!binding) {
    binding = { original: scene.fog, owners: [] };
    bindings.set(scene, binding);
  }
  const owner = { fog };
  binding.owners.push(owner);
  scene.fog = fog;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const index = binding.owners.indexOf(owner);
    if (index >= 0) binding.owners.splice(index, 1);
    if (scene.fog === fog) scene.fog = binding.owners.at(-1)?.fog ?? binding.original;
    if (!binding.owners.length) bindings.delete(scene);
  };
}

export function SceneFog({
  colour,
  density,
}: {
  readonly colour: number;
  readonly density: number;
}) {
  const scene = useThree((state) => state.scene);
  const fog = useMemo(() => new THREE.FogExp2(colour, density), [colour, density]);
  useLayoutEffect(() => bindSceneFog(scene, fog), [scene, fog]);
  return null;
}
