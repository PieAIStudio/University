import { useEffect, useMemo } from "react";
import * as THREE from "three";

import type { IslandBlueprint, IslandPoint } from "../island/island-blueprint.js";
import { buildWildflowerGeometry, planWildflowers } from "../island/course-wildflowers.js";
import { LEARNING_GATE_HALF_SPAN, LEARNING_PAD_RADIUS } from "./learning-node-geometry.js";
import {
  courseStandingFootprints,
  LEARNING_SITE_RADIUS,
  type LearningSite,
} from "./learning-sites.js";

/** Ground the learning nodes stand on: pads, objects, gate posts and stepping stones. */
export function learningSiteExclusions(
  sites: readonly LearningSite[],
): readonly (IslandPoint & { readonly radius: number })[] {
  return sites
    .filter((site) => site.resolved)
    .flatMap((site) => [
      { x: site.ground.x, z: site.ground.z, radius: LEARNING_PAD_RADIUS + 0.2 },
      {
        x: site.object.x,
        z: site.object.z,
        radius:
          (site.kind === "checkpoint" ? LEARNING_GATE_HALF_SPAN : LEARNING_SITE_RADIUS[site.kind]) +
          0.3,
      },
      ...site.branch.map((stone) => ({ x: stone.x, z: stone.z, radius: 0.3 })),
    ]);
}

/**
 * The course island's wildflowers. Planned here, where the learning nodes are
 * known, so no flower grows through a pad, a pennant, a board, a gate post or
 * a stepping stone; everything else standing is kept clear through the same
 * footprints the nodes use.
 */
export function CourseWildflowers({
  blueprint,
  sites,
  around = [],
}: {
  readonly blueprint: IslandBlueprint;
  readonly sites: readonly LearningSite[];
  /** Anything else planned with the flowers that they keep off (the vignettes). */
  readonly around?: readonly (IslandPoint & { readonly radius: number })[];
}) {
  const geometry = useMemo(() => {
    const exclusions = [...learningSiteExclusions(sites), ...around];
    const standing = courseStandingFootprints(blueprint).map((o) => ({
      x: o.x,
      z: o.z,
      radius: o.r,
    }));
    return buildWildflowerGeometry(planWildflowers(blueprint, standing, exclusions));
  }, [blueprint, sites, around]);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.8,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    [],
  );
  useEffect(() => () => geometry?.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  if (!geometry) return null;
  return <mesh name="course-wildflowers" geometry={geometry} material={material} receiveShadow />;
}
