import { useLayoutEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useWorldStyle } from "@pieai/university-ui/world-style.js";
import { SceneMaterialAppearance, type AppearanceRole } from "./scene-materials.js";
import { SceneGeometryAppearance } from "./scene-geometry.js";

/** A subscriber to the existing canvas owner, not a new render loop. */
export function WorldAppearance({ role = "scenery" }: { readonly role?: AppearanceRole }) {
  const { scene, camera, gl, invalidate } = useThree();
  const style = useWorldStyle();
  const appearance = useMemo(() => new SceneMaterialAppearance(scene, role), [scene, role]);
  const geometry = useMemo(() => new SceneGeometryAppearance(scene), [scene]);
  useLayoutEffect(
    () => () => {
      geometry.dispose();
      appearance.dispose();
    },
    [appearance, geometry],
  );
  useLayoutEffect(() => {
    geometry.reconcile(style);
    appearance.reconcile(style);
    invalidate();
  }, [appearance, geometry, style, invalidate]);
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
          sourceGeometry: geometry.sourceOf(mesh).uuid,
          triangles:
            (mesh.geometry.index?.count ?? mesh.geometry.getAttribute("position")?.count ?? 0) / 3,
          sourceTriangles:
            (geometry.sourceOf(mesh).index?.count ??
              geometry.sourceOf(mesh).getAttribute("position")?.count ??
              0) / 3,
          geometryKind: mesh.geometry.userData.clayGeometryKind ?? null,
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
        ...geometry.inspect(),
        meshes,
        programs: gl.info.programs?.length ?? 0,
        textures: gl.info.memory.textures,
      };
    };
    canvas.__worldAppearanceInspect = inspect;
    return () => {
      if (canvas.__worldAppearanceInspect === inspect) delete canvas.__worldAppearanceInspect;
    };
  }, [scene, camera, gl, geometry]);
  useFrame(() => {
    geometry.reconcile(style);
    appearance.reconcile(style);
  }, -0.5);
  return null;
}
