import { useMemo } from "react";
import * as THREE from "three";

import { BatchedAssetLibraryField, type Placement } from "../kit.js";
import { VIGNETTE_MODELS, type Vignette } from "../island/course-vignettes.js";

/**
 * The island's small Kenney scenes (`planCourseVignettes`) in one batched draw.
 * Planned in CourseScene with the wildflowers, where the learning nodes are
 * known; the flowers keep off every group.
 */
export function CourseVignettes({ vignettes }: { readonly vignettes: readonly Vignette[] }) {
  const fields = useMemo(() => {
    const bySource = new Map<string, Placement[]>();
    for (const vignette of vignettes)
      for (const prop of vignette.props) {
        const model = VIGNETTE_MODELS[prop.model];
        const at = bySource.get(model.src) ?? [];
        at.push({
          position: new THREE.Vector3(prop.x, prop.y, prop.z),
          height: model.height * prop.scale,
          turn: prop.turn,
        });
        bySource.set(model.src, at);
      }
    return [...bySource.entries()].map(([src, at]) => ({ src, at }));
  }, [vignettes]);
  if (!fields.length) return null;
  return <BatchedAssetLibraryField fields={fields} name="course-vignettes" castShadow />;
}
