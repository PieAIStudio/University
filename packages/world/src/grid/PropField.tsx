import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { BatchedAssetLibraryField, type Placement } from "../kit.js";
import { hexToWorld } from "./hex.js";
import { gridNatureAssetSrc } from "./grid-theme.js";
import type { HexMap } from "./course-grid.js";

interface PropFieldProps {
  readonly map: HexMap;
  readonly dimmed?: boolean;
}

/**
 * Put one planned prop on the ground.
 *
 * The height comes from the cell the prop was planned for and from nowhere
 * else. That sounds obvious and is the second-most expensive bug this field
 * has had: a prop placed at the island's average height, or at its neighbour's,
 * sinks into a terrace and shows only the corners that poke out of the seam.
 * `topY` is per-cell, so a prop on a step stands on that step.
 *
 * Size is entirely the pure planner's decision — `grid-theme.ts` derives it
 * from the mesh's measured proportions and asserts both ends of the band. This
 * file used to hold a hand-tuned `fatten` and `heightFactor` table keyed by
 * asset id, which could not survive going from nine models to seventy-eight
 * and could not be tested without a browser.
 */
export function placementFor(map: HexMap, prop: HexMap["props"][number]): Placement {
  const cell = map.cells.find((entry) => entry.key === prop.cellKey)!;
  const point = hexToWorld(prop.coord, map.hexSize);
  return {
    position: new THREE.Vector3(point.x, cell.topY + 0.03, point.z),
    height: prop.height,
    turn: prop.rotation,
    width: prop.width,
  };
}

function visibleProps(map: HexMap): readonly HexMap["props"][number][] {
  return map.props.filter((prop) => prop.visibleInCourse !== false);
}

/**
 * One instanced blob under every prop.
 *
 * LOOK-V2 §11 rule 1: this is the largest single difference between "the thing
 * is standing there" and "the thing is floating", and it costs one draw for
 * the whole field. The footprint is the planner's own number, so a landmark
 * gets a landmark-sized anchor without a second table saying how big things
 * are.
 */
export function ContactShadowField({
  at,
  dimmed = false,
}: {
  readonly at: readonly { readonly placement: Placement; readonly footprint: number }[];
  readonly dimmed?: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  // Twelve segments keep the edge smooth at course scale while one instanced
  // geometry stays well inside the look budget however many props there are.
  const geometry = useMemo(() => new THREE.CircleGeometry(0.72, 12), []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          shadowColour: { value: new THREE.Color(dimmed ? 0x19242a : 0x3b2b24) },
          shadowOpacity: { value: dimmed ? 0.1 : 0.28 },
        },
        vertexShader: `
          varying vec2 vShadowUv;
          void main() {
            vShadowUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 shadowColour;
          uniform float shadowOpacity;
          varying vec2 vShadowUv;
          void main() {
            float distanceFromCentre = distance(vShadowUv, vec2(0.5));
            float softness = 1.0 - smoothstep(0.18, 0.5, distanceFromCentre);
            gl_FragColor = vec4(shadowColour, shadowOpacity * softness * softness);
          }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [dimmed],
  );
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const matrix = new THREE.Matrix4();
    at.forEach((entry, index) => {
      // A blob a little wider than the prop's own footprint reads as contact;
      // one exactly the same size reads as a decal cut to shape.
      const radiusScale = Math.min(1.7, Math.max(0.34, entry.footprint * 0.76));
      matrix.compose(
        new THREE.Vector3(
          entry.placement.position.x,
          entry.placement.position.y + 0.018,
          entry.placement.position.z,
        ),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
        new THREE.Vector3(radiusScale, radiusScale, 1),
      );
      target.setMatrixAt(index, matrix);
    });
    target.instanceMatrix.needsUpdate = true;
  }, [at]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  if (at.length === 0) return null;
  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, at.length]}
      name="hex-grid-contact-shadows"
      renderOrder={1}
      frustumCulled={false}
    />
  );
}

export function PropField({ map, dimmed = false }: PropFieldProps) {
  const drawn = useMemo(() => visibleProps(map), [map]);
  const fields = useMemo(() => {
    const grouped = new Map<string, Placement[]>();
    for (const prop of drawn) {
      const src = gridNatureAssetSrc(prop.assetId);
      const field = grouped.get(src) ?? [];
      field.push(placementFor(map, prop));
      grouped.set(src, field);
    }
    return [...grouped.entries()].map(([src, at]) => ({ src, at }));
  }, [drawn, map]);
  const shadows = useMemo(
    () => drawn.map((prop) => ({ placement: placementFor(map, prop), footprint: prop.footprint })),
    [drawn, map],
  );

  return (
    <group
      name="hex-grid-prop-fields"
      userData={{
        gridPropCount: map.props.length,
        gridDecorPropCount: drawn.length,
        gridLogicalPropCount: map.props.length,
        gridPropAssetCount: fields.length,
        gridLandmarkCount: drawn.filter((prop) => prop.kind === "landmark").length,
      }}
    >
      <ContactShadowField at={shadows} dimmed={dimmed} />
      <BatchedAssetLibraryField
        fields={fields}
        name="hex-grid-prop-library"
        /*
          2026-09-02: the whole prop field is one batch and therefore one shadow
          submission, so a field of seventy-eight models casts as cheaply as a
          field of nine. A blob is directionless; only a real cast shadow gives
          a stand of trees a shared light direction, which is the clearest
          single signal that a scene is lit rather than shaded.
        */
        castShadow
      />
    </group>
  );
}
