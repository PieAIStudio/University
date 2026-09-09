import { createContext, useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mapOverlayObstacles } from "../labels/chrome-obstacles.js";
import {
  frameCourseOverview,
  overviewViewport,
  type CourseOverviewFrame,
} from "./course-overview.js";

export const CourseOverviewContext = createContext<CourseOverviewFrame | null>(null);

/** Reads the rendered scene once per request/resize; Flight remains the camera writer. */
export function CourseOverviewProbe({
  onFrame,
  onError,
  eyeDirection,
}: {
  readonly onFrame: (frame: CourseOverviewFrame) => void;
  readonly onError: () => void;
  readonly eyeDirection: readonly [number, number, number];
}) {
  const { camera, gl, scene, size } = useThree();
  const dirty = useRef(true);
  useEffect(() => {
    dirty.current = true;
    const stage = gl.domElement.closest<HTMLElement>(".stagewrap");
    const shell = gl.domElement.closest<HTMLElement>(".app-shell");
    const observer = new ResizeObserver(() => {
      dirty.current = true;
    });
    if (stage) observer.observe(stage);
    if (stage && shell)
      for (const element of mapOverlayObstacles(stage, shell).elements) observer.observe(element);
    return () => observer.disconnect();
  }, [gl, size.width, size.height]);
  useFrame(() => {
    if (!dirty.current || !(camera instanceof THREE.PerspectiveCamera)) return;
    const terrain = scene.getObjectByName("island-terrain");
    const dressing = scene.getObjectByName("island-dressing-course");
    if (!terrain || !dressing) return;
    dirty.current = false;
    try {
      const stage = gl.domElement.closest<HTMLElement>(".stagewrap");
      const shell = gl.domElement.closest<HTMLElement>(".app-shell");
      const obstacles = stage && shell ? mapOverlayObstacles(stage, shell).labels : [];
      const bounds = new THREE.Box3()
        .setFromObject(terrain)
        .union(new THREE.Box3().setFromObject(dressing));
      onFrame(
        frameCourseOverview(bounds, new THREE.Vector3(...eyeDirection), {
          width: size.width,
          height: size.height,
          fov: camera.fov,
          usable: overviewViewport(size.width, size.height, obstacles),
        }),
      );
    } catch {
      onError();
    }
  });
  return null;
}
