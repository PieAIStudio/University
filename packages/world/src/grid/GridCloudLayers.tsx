import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { islandLookFrozen } from "../island/island-surface-style.js";
import { CLOUD_RENDER_ORDER, CLOUD_TONES, createCloudMaterials } from "../sky/cloud-material.js";
import { createCloudVolumeGeometry } from "../sky/cloud-volume.js";
import type { HexMap } from "./course-grid.js";

/**
 * The course island's clouds, lit by the same pair as the world map's.
 *
 * The placement below is course-specific and stays that way: these clouds
 * frame one island in one fixed aerial shot, which the world map's scattered
 * field has no reason to do. What was *not* course-specific, and had no
 * business being answered twice, was how a cloud is shaded. That now comes
 * from `cloud-material.ts`.
 *
 * Three batches became one. The depth bands were three separate meshes only
 * because each carried its own opacity; now that distance is carried by tone
 * instead, they are instances of one body and the whole sky costs one draw.
 */
type CloudDepth = "back" | "side" | "front";

const CLOUD_DEPTHS: readonly CloudDepth[] = ["back", "side", "front"];

/**
 * Which tone each band takes.
 *
 * Distance is carried by colour rather than by the opacity the old layers used:
 * a far cloud goes cool ivory, a near one keeps the warm pearl. Opacity was
 * doing this job before, and doing it by letting the sky through the cloud's
 * own shading, which is what erased its form.
 */
const CLOUD_DEPTH_TONE: Readonly<Record<CloudDepth, number>> = {
  // All three warm, and the far band warmest-but-palest rather than cool.
  //
  // `ivory` (0xe9eef6) was here for the far band, on the reasonable-sounding
  // theory that distance reads cool. It does — against a warm sky. This sky is
  // deliberately cold, the fill lighting it is deliberately cool, and a cloud
  // face turned away from a 24-degree key sees only that fill, so a cool
  // albedo was the third cool multiplier in a row and the band rendered navy.
  // Distance is carried by value here instead, and hue stays on the warm side
  // of the sky so a cloud always separates from it.
  back: CLOUD_TONES.pearl,
  side: CLOUD_TONES.pearl,
  front: CLOUD_TONES.warm,
};

function cloudGeometry(): THREE.BufferGeometry {
  return createCloudVolumeGeometry(8, 5, "bank");
}

function cloudPositions(
  map: HexMap,
  depth: CloudDepth,
): readonly [number, number, number, number][] {
  const width = map.bounds.maxX - map.bounds.minX;
  const depthOffset = map.bounds.maxZ - map.bounds.minZ;
  // Course-design is a fixed 65° aerial shot. Position the cloud frame in
  // that camera's horizontal basis instead of using world X/Z directly: a
  // world-axis spread can project both front clouds into the same lower ray
  // and cover the floating cone on one route archetype.
  const azimuth = (65 * Math.PI) / 180;
  const viewX = Math.sin(azimuth);
  const viewZ = Math.cos(azimuth);
  const rightX = Math.cos(azimuth);
  const rightZ = -Math.sin(azimuth);
  const framePoint = (horizontal: number, forward: number): readonly [number, number] => [
    rightX * horizontal + viewX * forward,
    rightZ * horizontal + viewZ * forward,
  ];
  // Clouds are framing punctuation, not a second patterned ground plane.
  // Fewer larger silhouettes leave the route as the visual protagonist.
  const count = depth === "front" ? 2 : depth === "back" ? 3 : 2;
  return Array.from({ length: count }, (_, index) => {
    const spread = index / Math.max(1, count - 1) - 0.5;
    if (depth === "back") {
      // Leave the central lower ray open for the island's pointed underside.
      // The middle cloud still frames the island, but sits on the right side
      // like the target's distant cloud bank instead of covering the cone.
      const frameSpread = index === 1 ? 0.2 : spread < 0 ? -0.78 : 0.88;
      const [x, z] = framePoint(frameSpread * width, -depthOffset * 0.72);
      return [
        x,
        map.bounds.maxHalf * 0.26 + (index % 2) * 0.55,
        z,
        map.hexSize * (1.15 + (index % 3) * 0.2),
      ];
    }
    if (depth === "side") {
      const [x, z] = framePoint(width * 0.55, spread * depthOffset * 0.25);
      return [
        x,
        map.bounds.maxHalf * 0.16 + (index % 2) * 0.42,
        z,
        map.hexSize * (1.05 + (index % 2) * 0.22),
      ];
    }
    const [x, z] = framePoint(spread * width * 0.44, depthOffset * 0.45);
    return [
      x,
      // Above the island, not below it.
      //
      // This band sat at negative height, which frames the fixed 65-degree
      // aerial shot nicely and is wrong for the camera that ships. The learner
      // stands on the road and looks down: a cloud below the island shows only
      // the faces the 24-degree key never reaches, so it rendered as a navy
      // wedge no shading change could rescue — warming the baked ramp moved it
      // almost not at all, because the fill was doing the work, not the ramp.
      // Lifted, the same body presents its lit crown and reads as a cloud.
      map.bounds.maxHalf * 0.34 + (index % 2) * 0.34,
      z,
      map.hexSize * (0.94 + (index % 2) * 0.16),
    ];
  });
}

/** Every band's clouds, flattened into one list of placements. */
function cloudPlacements(
  map: HexMap,
): readonly { position: THREE.Vector3; scale: number; tone: number }[] {
  return CLOUD_DEPTHS.flatMap((depth) =>
    cloudPositions(map, depth).map(([x, y, z, scale]) => ({
      position: new THREE.Vector3(x, y, z),
      scale,
      tone: CLOUD_DEPTH_TONE[depth],
    })),
  );
}

/*
 * No separate underbelly instance here, deliberately, and the reason is worth
 * keeping: one was tried and it looked worse than what it replaced.
 *
 * `cloud-sea` splits each puff into a lit crown and a darker belly, and that
 * works because six overlapping crown lobes bury the belly so only its rim
 * shows. The course form is `bank` — three flattened lobes — so the same drop
 * left the belly hanging in open sky as a separate slab, and its warm albedo,
 * lit by nothing but the cool fill, went navy. Both course clouds turned into
 * dark wedges.
 *
 * The bank body already carries its own dark side: `addCloudVertexValueRamp`
 * bakes 0.5 at the underside against 0.88 at the crown. That ramp was always
 * there — it simply could not be seen through an unlit `MeshBasicMaterial`.
 * Giving the body the shared lit material is the entire fix; a second body was
 * me copying a relationship instead of the reason for it.
 */

export function GridCloudLayers({ map, dimmed = false }: { map: HexMap; dimmed?: boolean }) {
  const group = useRef<THREE.Group>(null);
  const crownMesh = useRef<THREE.InstancedMesh>(null);
  const placements = useMemo(() => cloudPlacements(map), [map]);
  const geometry = useMemo(cloudGeometry, []);
  const { crown } = useMemo(() => createCloudMaterials(dimmed), [dimmed]);
  const rotation = useMemo(
    () => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (65 * Math.PI) / 180, 0)),
    [],
  );

  useLayoutEffect(() => {
    const crownTarget = crownMesh.current;
    if (!crownTarget) return;
    const matrix = new THREE.Matrix4();
    const scratch = new THREE.Vector3();
    placements.forEach(({ position, scale, tone }, index) => {
      matrix.compose(position, rotation, scratch.set(scale * 1.72, scale * 1.14, scale * 1.14));
      crownTarget.setMatrixAt(index, matrix);
      crownTarget.setColorAt(index, new THREE.Color(tone));
    });
    crownTarget.instanceMatrix.needsUpdate = true;
    if (crownTarget.instanceColor) crownTarget.instanceColor.needsUpdate = true;
  }, [placements, rotation]);

  useFrame(({ clock }) => {
    // The same whole-field drift the world map uses: the composition moves as
    // one, because six clouds each wandering on their own is weather, and this
    // is scenery. Frozen for look screenshots so a visual diff stays a diff.
    const target = group.current;
    if (!target || islandLookFrozen()) return;
    const time = clock.elapsedTime;
    const span = map.bounds.maxX - map.bounds.minX;
    target.position.x = Math.sin(time * 0.018) * span * 0.004;
    target.position.z = Math.cos(time * 0.014) * span * 0.003;
  });

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => crown.dispose(), [crown]);

  return (
    <group ref={group} name="hex-grid-cloud-layers">
      <instancedMesh
        ref={crownMesh}
        args={[geometry, crown, placements.length]}
        name="hex-grid-clouds-crown"
        renderOrder={CLOUD_RENDER_ORDER.upper}
        frustumCulled={false}
      />
    </group>
  );
}
