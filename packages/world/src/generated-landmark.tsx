/** A small registry for generated landmarks that survive semantic LOD. */
import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

import twinPactGate1024Url from "./assets/generated/twin-pact-gate-1024.glb?url";
import twinPactGate512Url from "./assets/generated/twin-pact-gate-512.glb?url";
import twinPactGateUrl from "./assets/generated/twin-pact-gate.glb?url";
import { renderTier } from "./tier.js";

const TWIN_PACT_STUDY = "turing-pact";
const TWIN_PACT_COURSE = "foundations-before-zero";

export function hasGeneratedLandmark(studyId: string, courseId: string): boolean {
  return studyId === TWIN_PACT_STUDY && courseId === TWIN_PACT_COURSE;
}

interface LandmarkProps {
  readonly studyId: string;
  readonly courseId: string;
  readonly position: readonly [number, number, number];
  /** Desired model height in world units, independent of the source scale. */
  readonly height: number;
  /** Semantic view detail. It selects texture resolution, never a new shape. */
  readonly detail: "world" | "course";
}

/**
 * Keep the conditional outside the component that owns the loading hook. A
 * CourseScene may switch from one course to another without remounting; a hook
 * hidden behind `if (courseId === ...)` would therefore change hook order.
 */
export function GeneratedCourseLandmark(props: LandmarkProps) {
  return hasGeneratedLandmark(props.studyId, props.courseId) ? <TwinPactGate {...props} /> : null;
}

function TwinPactGate({ position, height, detail }: LandmarkProps) {
  // The same geometry and material layout survive every view. Only embedded
  // texture pixels change: a world-map landmark cannot reveal 2K detail, while
  // a desktop close-up can. This is semantic LOD rather than a second model.
  const modelUrl =
    detail === "world"
      ? twinPactGate512Url
      : renderTier() === "mobile"
        ? twinPactGate1024Url
        : twinPactGateUrl;
  // The asset requires Meshopt but not Draco. Keeping Draco disabled avoids
  // initializing an unrelated decoder (and its default remote decoder path).
  const gltf = useGLTF(modelUrl, false, true);
  const prepared = useMemo(() => {
    const scene = gltf.scene.clone(true);
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());

    // Tripo centres this asset around the origin. Re-centre X/Z and move the
    // plinth to y=0 before the caller scales it to the authored world height.
    scene.position.set(-centre.x, -box.min.y, -centre.z);
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const originals = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const materials = originals.map((source) => {
        const material = source.clone();
        if (material instanceof THREE.MeshStandardMaterial) {
          material.roughness = Math.max(0.82, material.roughness);
          material.metalness = 0;
        }
        return material;
      });
      mesh.material = Array.isArray(mesh.material) ? materials : materials[0]!;
    });
    return { scene, sourceHeight: size.y || 1 };
  }, [gltf.scene]);

  return (
    <group
      position={position}
      rotation={[0, -0.16, 0]}
      scale={height / prepared.sourceHeight}
      dispose={null}
    >
      <primitive object={prepared.scene} />
    </group>
  );
}
