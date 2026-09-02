import { useMemo } from "react";

import { BatchedAssetLibraryField, type Placement } from "../kit.js";
import { gridNatureAssetSrc } from "./grid-theme.js";
import { ContactShadowField, placementFor } from "./PropField.js";
import type { WorldGridIsland } from "./world-grid-types.js";

interface WorldPropFieldProps {
  readonly islands: readonly WorldGridIsland[];
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
    ...(local.width === undefined ? {} : { width: local.width * island.scale }),
  };
}

/**
 * The archipelago keeps only what survives the projection: each island's unit
 * landmark and a thin scatter of canopy, chosen by the shared planner rather
 * than by a second rule here. `visibleInCourse` is the planner's own LOD flag
 * and it is honoured in both projections — drawing everything here was the
 * quiet reason fifty-three islands each paid for a full dressing field.
 */
function visibleWorldProps(islands: readonly WorldGridIsland[]): readonly {
  readonly island: WorldGridIsland;
  readonly prop: WorldGridIsland["map"]["props"][number];
}[] {
  return islands.flatMap((island) =>
    island.map.props
      .filter((prop) => prop.visibleInCourse !== false)
      .map((prop) => ({ island, prop })),
  );
}

/** One batch for every surviving nature asset across the whole catalogue. */
export function WorldPropField({ islands }: WorldPropFieldProps) {
  const drawn = useMemo(() => visibleWorldProps(islands), [islands]);
  const fields = useMemo(() => {
    const grouped = new Map<string, Placement[]>();
    for (const { island, prop } of drawn) {
      const src = gridNatureAssetSrc(prop.assetId);
      const field = grouped.get(src) ?? [];
      field.push(worldPlacementFor(island, prop));
      grouped.set(src, field);
    }
    return [...grouped.entries()].map(([src, at]) => ({ src, at }));
  }, [drawn]);
  const shadows = useMemo(
    () =>
      drawn.map(({ island, prop }) => ({
        placement: worldPlacementFor(island, prop),
        footprint: prop.footprint * island.scale,
      })),
    [drawn],
  );

  return (
    <group
      name="world-grid-prop-fields"
      userData={{ worldGridPropCount: drawn.length, worldGridPropBatches: fields.length }}
    >
      <ContactShadowField at={shadows} />
      <BatchedAssetLibraryField fields={fields} name="world-grid-prop-library" castShadow={false} />
    </group>
  );
}
