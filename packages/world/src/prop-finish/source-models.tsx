import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { AssetField, type Placement } from "../kit.js";
import { CourseTreeField } from "../island/course-trees.js";
import { createMiniatureAsset } from "../island/miniature-assets.js";
import { courseFacilityTreatment } from "../island/course-facility-material.js";
import type { PropSample } from "./catalog.js";
import { copySurface } from "./surface-refinement.js";

export interface SourcePart {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.MeshStandardMaterial;
  readonly name: string;
}
export interface SourceModel {
  readonly sample: PropSample;
  readonly parts: readonly SourcePart[];
}
const at: readonly Placement[] = [{ position: new THREE.Vector3(), height: 1, turn: 0 }];

/** The gray rock assembly actually generated for distant map props, also
 * reused by course landscape stones. Same generator, colors and 0.88 material
 * as RemotePropsField; only the common height normalization changes. */
function MiniatureSource() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => createMiniatureAsset("stone"), []);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 }),
    [],
  );
  useLayoutEffect(() => {
    if (!ref.current) return;
    geometry.computeBoundingBox();
    const b = geometry.boundingBox!;
    const height = b.max.y - b.min.y;
    const matrix = new THREE.Matrix4().makeScale(1 / height, 1 / height, 1 / height);
    matrix.setPosition(
      -(b.min.x + b.max.x) / 2 / height,
      -b.min.y / height,
      -(b.min.z + b.max.z) / 2 / height,
    );
    ref.current.setMatrixAt(0, matrix);
    ref.current.instanceMatrix.needsUpdate = true;
  }, [geometry]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  return <instancedMesh ref={ref} args={[geometry, material, 1]} dispose={null} />;
}

/** Borrow the actual map's adapters. Capture their committed, normalized result
 * once; the hidden source remains mounted and owns its materials/textures.
 * Each displayed model owns only normalized geometry copies until cleanup.
 */
export function MapPropSource({
  sample,
  onReady,
}: {
  sample: PropSample;
  onReady: (model: SourceModel) => void;
}) {
  const root = useRef<THREE.Group>(null),
    captured = useRef<SourceModel | null>(null);
  const last = useRef(0),
    stable = useRef(0);
  const treatment = useMemo(
    () => (sample.materialKey ? courseFacilityTreatment(sample.materialKey) : undefined),
    [sample.materialKey],
  );
  useFrame(() => {
    if (captured.current || !root.current) return;
    const meshes: THREE.InstancedMesh[] = [];
    root.current.traverse((n) => {
      if ((n as THREE.InstancedMesh).isInstancedMesh) meshes.push(n as THREE.InstancedMesh);
    });
    if (!meshes.length) return;
    stable.current = meshes.length === last.current ? stable.current + 1 : 0;
    last.current = meshes.length;
    if (stable.current < 2) return;
    const parts = meshes.map((mesh) => {
      const transform = new THREE.Matrix4();
      mesh.getMatrixAt(0, transform);
      const geometry = mesh.geometry.clone().applyMatrix4(transform);
      geometry.userData = {};
      if (mesh.instanceColor) {
        const tint = new THREE.Color();
        mesh.getColorAt(0, tint);
        const colors = geometry.getAttribute("color");
        if (colors)
          for (let i = 0; i < colors.count; i++)
            colors.setXYZ(
              i,
              colors.getX(i) * tint.r,
              colors.getY(i) * tint.g,
              colors.getZ(i) * tint.b,
            );
      }
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const borrowed = (
        Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
      ) as THREE.MeshStandardMaterial;
      if (!borrowed?.isMeshStandardMaterial)
        throw new Error(`Unsupported source material for ${sample.id}`);
      const material = copySurface(borrowed);
      // Geometry now contains the normalization matrix. Rebind the existing
      // facility treatment to identity rather than applying that matrix twice.
      treatment?.(material, new THREE.Matrix4());
      return { geometry, material, name: material.name || mesh.name };
    });
    const model = { sample, parts };
    captured.current = model;
    onReady(model);
  });
  useEffect(
    () => () => {
      captured.current?.parts.forEach((p) => {
        p.geometry.dispose();
        p.material.dispose();
      });
      captured.current = null;
      stable.current = 0;
    },
    [],
  );
  return (
    <group ref={root} name={`source-${sample.id}`} visible={false}>
      {sample.miniature ? (
        <MiniatureSource />
      ) : sample.tree ? (
        <CourseTreeField placements={at} kind={sample.tree} />
      ) : (
        <AssetField
          src={sample.src!}
          at={at}
          preserveMap={sample.preserveMap}
          materialTreatment={treatment}
        />
      )}
    </group>
  );
}
export interface EncodedGeometry {
  position: number[];
  normal: number[];
  uv?: number[];
  color?: number[];
  index: number[];
  visibilityUv?: number[];
  grainAxis?: number[];
}
export function encodeGeometry(g: THREE.BufferGeometry): EncodedGeometry {
  const read = (name: string, size: number) => {
    const a = g.getAttribute(name);
    if (!a) return undefined;
    const out: number[] = [];
    for (let i = 0; i < a.count; i++) for (let j = 0; j < size; j++) out.push(a.getComponent(i, j));
    return out;
  };
  const position = read("position", 3)!;
  return {
    position,
    normal: read("normal", 3)!,
    uv: read("uv", 2),
    color: read("color", 3),
    index: g.index
      ? Array.from(g.index.array)
      : Array.from({ length: position.length / 3 }, (_, i) => i),
  };
}
