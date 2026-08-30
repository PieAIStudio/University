import { useMemo } from "react";

import { BatchedAssetField, type Placement } from "../kit.js";
import { GRID_KENNEY_NATURE_ASSETS } from "./grid-prop-assets.js";
import { ContactShadowField, placementFor } from "./PropField.js";
import type { GridPropAssetId } from "./grid-props.js";
import type { WorldGridIsland } from "./world-grid-types.js";

interface WorldPropFieldProps {
  readonly islands: readonly WorldGridIsland[];
}

interface WorldPropBatch {
  readonly assetId: GridPropAssetId;
  readonly at: readonly Placement[];
}

function worldPlacementFor(
  island: WorldGridIsland,
  prop: WorldGridIsland["map"]["props"][number],
): Placement {
  const local = placementFor(island.map, prop);
  return {
    position: local.position.multiplyScalar(island.scale).add(island.position),
    height: local.height * island.scale,
    turn: local.turn,
  };
}

function propsByAsset(islands: readonly WorldGridIsland[]): readonly WorldPropBatch[] {
  const grouped = new Map<GridPropAssetId, Placement[]>();
  for (const island of islands) {
    for (const prop of island.map.props) {
      const field = grouped.get(prop.assetId) ?? [];
      field.push(worldPlacementFor(island, prop));
      grouped.set(prop.assetId, field);
    }
  }
  return [...grouped.entries()].map(([assetId, at]) => ({ assetId, at }));
}

function allProps(islands: readonly WorldGridIsland[]): readonly Placement[] {
  return islands.flatMap((island) =>
    island.map.props.map((prop) => worldPlacementFor(island, prop)),
  );
}

/** One batch per surviving large nature asset across the whole catalogue. */
export function WorldPropField({ islands }: WorldPropFieldProps) {
  const fields = useMemo(() => propsByAsset(islands), [islands]);
  const shadows = useMemo(() => allProps(islands), [islands]);
  const propCount = useMemo(
    () => islands.reduce((total, island) => total + island.map.props.length, 0),
    [islands],
  );

  return (
    <group
      name="world-grid-prop-fields"
      userData={{ worldGridPropCount: propCount, worldGridPropBatches: fields.length }}
    >
      <ContactShadowField at={shadows} />
      {fields.map((field) => (
        <BatchedAssetField
          key={field.assetId}
          src={GRID_KENNEY_NATURE_ASSETS[field.assetId]}
          at={field.at}
          castShadow={false}
        />
      ))}
    </group>
  );
}
