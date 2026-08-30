import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { AssetField, type Placement } from "../kit.js";
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

function placementFor(map: HexMap, prop: HexMap["props"][number]): Placement {
  const cell = map.cells.find((entry) => entry.key === prop.cellKey)!;
  const point = hexToWorld(prop.coord, map.hexSize);
  return {
    position: new THREE.Vector3(point.x, cell.topY + 0.03, point.z),
    height: prop.kind === "course" ? prop.scale * 2.25 : prop.scale * 1.45,
    turn: prop.rotation,
  };
}

function propsByAsset(map: HexMap): readonly RuntimePropField[] {
  const grouped = new Map<GridPropAssetId, Placement[]>();
  for (const prop of map.props) {
    const field = grouped.get(prop.assetId) ?? [];
    field.push(placementFor(map, prop));
    grouped.set(prop.assetId, field);
  }
  return [...grouped.entries()].map(([assetId, at]) => ({ assetId, at }));
}

function ContactShadowField({ map, dimmed = false }: PropFieldProps) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.CircleGeometry(0.34, 8), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: dimmed ? 0x071014 : 0x18251d,
        transparent: true,
        opacity: dimmed ? 0.1 : 0.2,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [dimmed],
  );
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const matrix = new THREE.Matrix4();
    map.props.forEach((prop, index) => {
      const cell = map.cells.find((entry) => entry.key === prop.cellKey)!;
      const point = hexToWorld(prop.coord, map.hexSize);
      matrix.compose(
        new THREE.Vector3(point.x, cell.topY + 0.018, point.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)),
        new THREE.Vector3(
          prop.kind === "course" ? 0.9 : 0.58,
          prop.kind === "course" ? 0.9 : 0.58,
          1,
        ),
      );
      target.setMatrixAt(index, matrix);
    });
    target.instanceMatrix.needsUpdate = true;
  }, [map]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  if (map.props.length === 0) return null;
  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, map.props.length]}
      name="hex-grid-contact-shadows"
      renderOrder={1}
      frustumCulled={false}
    />
  );
}

export function PropField({ map, dimmed = false }: PropFieldProps) {
  const fields = useMemo(() => propsByAsset(map), [map]);
  return (
    <group name="hex-grid-prop-fields" userData={{ gridPropCount: map.props.length }}>
      <ContactShadowField map={map} dimmed={dimmed} />
      {fields.map((field) => (
        <AssetField
          key={field.assetId}
          src={GRID_KENNEY_NATURE_ASSETS[field.assetId]}
          at={field.at}
          preserveMap
          castShadow={false}
        />
      ))}
    </group>
  );
}
