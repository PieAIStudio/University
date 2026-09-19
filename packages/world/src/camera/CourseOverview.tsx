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
  surface = "course",
  onFrame,
  onError,
  eyeDirection,
}: {
  readonly onFrame: (frame: CourseOverviewFrame) => void;
  readonly surface?: "course" | "world";
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
  }, [gl, size.width, size.height, surface]);
  useFrame(() => {
    if (!dirty.current || !(camera instanceof THREE.PerspectiveCamera)) return;
    const terrain = scene.getObjectByName(
      surface === "course" ? "island-terrain" : "remote-island-terrain",
    );
    const dressing = scene.getObjectByName(
      surface === "course" ? "island-dressing-course" : "remote-props",
    );
    if (!terrain || !dressing) return;
    dirty.current = false;
    try {
      const stage = gl.domElement.closest<HTMLElement>(".stagewrap");
      const shell = gl.domElement.closest<HTMLElement>(".app-shell");
      const obstacles = stage && shell ? mapOverlayObstacles(stage, shell).labels : [];
      // The tapered root is not a cuboid. Its empty lower corners used to
      // consume most of the overview's space. Fit every rendered terrain
      // vertex plus the conservative dressing envelope, without changing the
      // normal course lens, the terrain, or any interaction target.
      const mesh = terrain as THREE.Mesh;
      const attribute = mesh.geometry.getAttribute("position");
      terrain.updateWorldMatrix(true, false);
      const supports = Array.from({ length: attribute.count }, (_, index) =>
        new THREE.Vector3().fromBufferAttribute(attribute, index).applyMatrix4(terrain.matrixWorld),
      );
      const dressingBounds = new THREE.Box3().setFromObject(dressing);
      if (!dressingBounds.isEmpty()) {
        for (const x of [dressingBounds.min.x, dressingBounds.max.x])
          for (const y of [dressingBounds.min.y, dressingBounds.max.y])
            for (const z of [dressingBounds.min.z, dressingBounds.max.z])
              supports.push(new THREE.Vector3(x, y, z));
      }
      const bounds = new THREE.Box3().setFromPoints(supports);
      const eye = new THREE.Vector3(...eyeDirection).normalize();
      const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), eye).normalize();
      const up = new THREE.Vector3().crossVectors(eye, right).normalize();
      const projectedSize = (axis: THREE.Vector3) => {
        let low = Infinity,
          high = -Infinity;
        for (const point of supports) {
          const value = point.dot(axis);
          low = Math.min(low, value);
          high = Math.max(high, value);
        }
        return high - low;
      };
      const subjectAspect = projectedSize(right) / Math.max(1e-6, projectedSize(up));
      onFrame(
        frameCourseOverview(
          bounds,
          eye,
          {
            width: size.width,
            height: size.height,
            fov: camera.fov,
            usable: overviewViewport(size.width, size.height, obstacles, subjectAspect),
          },
          supports,
        ),
      );
    } catch {
      onError();
    }
  });
  return null;
}
