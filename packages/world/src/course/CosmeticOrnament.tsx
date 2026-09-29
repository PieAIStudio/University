import { useEffect, useMemo } from "react";
import { MeshStandardMaterial, type Vector3 } from "three";
import { cosmeticOrnamentGeometry, type CosmeticOrnamentId } from "./cosmetic-ornament.js";

export function CosmeticOrnament({
  id,
  position,
}: {
  readonly id: CosmeticOrnamentId;
  readonly position: Vector3;
}) {
  const geometry = useMemo(() => cosmeticOrnamentGeometry(id), [id]);
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.48,
        metalness: 0.12,
        flatShading: true,
      }),
    [],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh
      geometry={geometry}
      material={material}
      position={position}
      dispose={null}
      name={`cosmetic:${id}`}
      userData={{ cosmeticOrnament: id }}
    />
  );
}
