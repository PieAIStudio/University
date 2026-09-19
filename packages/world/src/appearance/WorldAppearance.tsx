import { useLayoutEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useWorldStyle } from "@pieai/university-ui/world-style.js";
import { SceneMaterialAppearance, type AppearanceRole } from "./scene-materials.js";

/** A subscriber to the existing canvas owner, not a new render loop. */
export function WorldAppearance({ role = "scenery" }: { readonly role?: AppearanceRole }) {
  const { scene, camera, gl, invalidate } = useThree();
  const style = useWorldStyle();
  const appearance = useMemo(() => new SceneMaterialAppearance(scene, role), [scene, role]);
  useLayoutEffect(() => () => appearance.dispose(), [appearance]);
  useLayoutEffect(() => {
    appearance.reconcile(style);
    invalidate();
  }, [appearance, style, invalidate]);
  useLayoutEffect(() => {
    if (!import.meta.env.DEV) return;
    const canvas = gl.domElement as HTMLCanvasElement & {
      __worldAppearanceInspect?: () => unknown;
    };
    const inspect = () => {
      const meshes: unknown[] = [];
      scene.traverse((node) => {
        const mesh = node as import("three").Mesh;
        if (!mesh.isMesh) return;
        meshes.push({
          id: mesh.uuid,
          name: mesh.name,
          geometry: mesh.geometry.uuid,
          materials: (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => ({
            id: m.uuid,
            type: m.type,
            appearance: m.userData.worldAppearance ?? null,
          })),
        });
      });
      return {
        scene: scene.uuid,
        camera: camera.matrixWorld.toArray(),
        ...scene.userData.worldAppearance,
        meshes,
        programs: gl.info.programs?.length ?? 0,
        textures: gl.info.memory.textures,
      };
    };
    canvas.__worldAppearanceInspect = inspect;
    return () => {
      if (canvas.__worldAppearanceInspect === inspect) delete canvas.__worldAppearanceInspect;
    };
  }, [scene, camera, gl]);
  useFrame(() => appearance.reconcile(style), -0.5);
  return null;
}
