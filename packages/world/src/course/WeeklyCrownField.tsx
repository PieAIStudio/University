import { useEffect, useLayoutEffect, useState } from "react";
import { InstancedMesh, Matrix4, MeshStandardMaterial } from "three";
import { cosmeticOrnamentGeometry } from "./cosmetic-ornament.js";
import type { WeeklyCrownSpot } from "./weekly-crowns.js";

/** Same small crown-on-plinth geometry as the existing island ornament, but
 * its presence comes only from won weeks. One draw, no texture, no new canvas. */
export function WeeklyCrownField({ spots }: { readonly spots: readonly WeeklyCrownSpot[] }) {
  const [owned, setOwned] = useState<{ capacity: number; mesh: InstancedMesh } | null>(null);
  useEffect(() => {
    if (spots.length === 0) return;
    const geometry = cosmeticOrnamentGeometry("island-crown");
    const material = new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.48,
      metalness: 0.12,
      flatShading: true,
    });
    const mesh = new InstancedMesh(geometry, material, spots.length);
    mesh.name = "weekly-crowns";
    mesh.raycast = () => {};
    setOwned({ capacity: spots.length, mesh });
    return () => {
      mesh.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, [spots.length]);
  const mesh = owned?.capacity === spots.length ? owned.mesh : null;
  useLayoutEffect(() => {
    if (!mesh) return;
    const matrix = new Matrix4();
    spots.forEach((spot, index) =>
      mesh.setMatrixAt(index, matrix.makeTranslation(spot.at.x, spot.at.y, spot.at.z)),
    );
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    mesh.userData.weeklyCrownWeeks = spots.map((spot) => spot.week);
  }, [mesh, spots]);
  return mesh ? <primitive object={mesh} dispose={null} /> : null;
}
