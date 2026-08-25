/**
 * Projects a companion chip onto the same screen the labels use.
 *
 * A second LabelProbe that went through `placeLabels` would spend the name
 * budget on initials, and `labels.ts` is being edited on another desk.
 * This probe only writes a transform. Collision avoidance is not its job:
 * two group-mates on one stone stack horizontally via CSS, which is the
 * whole of a three-seat plan.
 *
 * The projection itself is the same `Vector3.project` LabelProbe uses. The
 * arithmetic is duplicated on purpose rather than reaching into that file.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

import { screenFromProjected, type CompanionAnchor } from "./companion-screen.js";

export type { CompanionAnchor } from "./companion-screen.js";
export { screenFromProjected } from "./companion-screen.js";

export function CompanionProbe({
  anchors,
  nodes,
}: {
  readonly anchors: readonly CompanionAnchor[];
  readonly nodes: Map<string, HTMLElement>;
}) {
  const { camera, size } = useThree();
  const scratch = useRef(new THREE.Vector3());

  useFrame(() => {
    const byId = new Map(anchors.map((anchor) => [anchor.id, anchor]));
    const seen = new Set<string>();
    const stack = new Map<string, number>();
    for (const [userId, element] of nodes) {
      const anchorId = element.dataset.anchor;
      const anchor = anchorId ? byId.get(anchorId) : undefined;
      if (!anchor) {
        element.style.setProperty("--placed", "0");
        continue;
      }
      const projected = scratch.current
        .set(anchor.position.x, anchor.position.y, anchor.position.z)
        .project(camera);
      const screen = screenFromProjected(projected, size.width, size.height);
      if (!screen) {
        element.style.setProperty("--placed", "0");
        continue;
      }
      const index = stack.get(anchor.id) ?? 0;
      stack.set(anchor.id, index + 1);
      seen.add(userId);
      // Two group-mates on one stone. Offset rather than overlap: a
      // three-seat plan never has a crowd, so a 28px step is the whole
      // layout algorithm.
      element.style.transform = `translate(${screen.x + 14}px, ${screen.y - 10 - index * 28}px)`;
      element.style.setProperty("--placed", "1");
    }
    for (const [userId, element] of nodes) {
      if (seen.has(userId)) continue;
      element.style.setProperty("--placed", "0");
    }
  }, 2);

  return null;
}
