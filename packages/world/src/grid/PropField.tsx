import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { BatchedAssetField, type Placement } from "../kit.js";
import { hexToWorld } from "./hex.js";
import { GRID_KENNEY_NATURE_ASSETS } from "./grid-prop-assets.js";
import type { GridPropAssetId } from "./grid-props.js";
import type { HexMap } from "./course-grid.js";

interface PropFieldProps {
  readonly map: HexMap;
  readonly dimmed?: boolean;
}

interface RuntimePropField {
  readonly assetId: GridPropAssetId;
  readonly at: readonly Placement[];
}

export function placementFor(map: HexMap, prop: HexMap["props"][number]): Placement {
  const cell = map.cells.find((entry) => entry.key === prop.cellKey)!;
  const point = hexToWorld(prop.coord, map.hexSize);
  const worldScale = map.projection === "world" ? 0.58 : 1;
  const fatten =
    prop.assetId === "tree_pineRoundA"
      ? 1.72
      : prop.assetId === "tree_oak"
        ? 1.28
        : prop.assetId === "tree_simple"
          ? 1.38
          : prop.assetId === "plant_bushLarge"
            ? 1.42
            : 1;
  const heightFactor =
    (prop.assetId === "tree_pineRoundA"
      ? 6.4
      : prop.assetId.startsWith("tree_")
        ? 5.8
        : prop.assetId === "plant_bushLarge"
          ? 2.35
          : prop.assetId === "mushroom_redGroup"
            ? 1.85
            : 1.38) * worldScale;
  const height = prop.scale * heightFactor;
  return {
    position: new THREE.Vector3(point.x, cell.topY + 0.03, point.z),
    height,
    turn: prop.rotation,
    ...(fatten === 1 ? {} : { width: height * fatten }),
  };
}

function propsByAsset(map: HexMap): readonly RuntimePropField[] {
  const grouped = new Map<GridPropAssetId, Placement[]>();
  // Course props are represented by the coral lesson stones. Keeping their
  // logical placement in the map preserves the pure planner contract, while
  // the 3D layer uses only the territory dressing so the road stays clean.
  for (const prop of map.props.filter(
    (entry) => entry.kind === "territory" && entry.visibleInCourse !== false,
  )) {
    const field = grouped.get(prop.assetId) ?? [];
    field.push(placementFor(map, prop));
    grouped.set(prop.assetId, field);
  }
  return [...grouped.entries()].map(([assetId, at]) => ({ assetId, at }));
}

export function ContactShadowField({
  at,
  dimmed = false,
}: {
  readonly at: readonly Placement[];
  readonly dimmed?: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  // The shadow is a soft anchor, not a visible disc. Twelve segments keep its
  // edge smooth at course scale while leaving the long-course triangle peak
  // under the 25k look budget when this one instanced geometry is replicated.
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
    at.forEach((placement, index) => {
      matrix.compose(
        new THREE.Vector3(placement.position.x, placement.position.y + 0.018, placement.position.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
        // Shadow footprint follows the asset's semantic height: a tree needs
        // a broad soft anchor, while a mushroom remains a small punctuation
        // mark. It is still one instanced shadow draw for the whole field.
        new THREE.Vector3(
          Math.min(1.45, Math.max(0.62, (placement.width ?? placement.height) * 0.18)),
          Math.min(1.45, Math.max(0.62, (placement.width ?? placement.height) * 0.18)),
          1,
        ),
      );
      target.setMatrixAt(index, matrix);
    });
    target.instanceMatrix.needsUpdate = true;
  }, [at]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  const decorativeCount = at.length;
  if (decorativeCount === 0) return null;
  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, decorativeCount]}
      name="hex-grid-contact-shadows"
      renderOrder={1}
      frustumCulled={false}
    />
  );
}

export function PropField({ map, dimmed = false }: PropFieldProps) {
  const fields = useMemo(() => propsByAsset(map), [map]);
  const decorative = useMemo(
    () =>
      map.props
        .filter((prop) => prop.kind === "territory" && prop.visibleInCourse !== false)
        .map((prop) => placementFor(map, prop)),
    [map],
  );
  return (
    <group
      name="hex-grid-prop-fields"
      userData={{
        gridPropCount: map.props.length,
        gridDecorPropCount: decorative.length,
        gridLogicalPropCount: map.props.length,
      }}
    >
      <ContactShadowField at={decorative} dimmed={dimmed} />
      {fields.map((field) => (
        <BatchedAssetField
          key={field.assetId}
          src={GRID_KENNEY_NATURE_ASSETS[field.assetId]}
          at={field.at}
          /*
            2026-09-02: was hard-coded false with no comment saying why. The
            blob under each prop anchors it to the ground, but a blob is
            directionless, so a field of trees under a 24° sun had no shared
            light direction — the single clearest signal that a scene is lit
            rather than shaded. These are batched per asset, so this is one
            shadow draw per asset kind, not one per tree.
          */
          castShadow
        />
      ))}
    </group>
  );
}
