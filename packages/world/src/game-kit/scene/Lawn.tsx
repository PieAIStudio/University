import { Block } from "../../toy-play/parts.js";
import { TOY } from "../../toy-play/style.js";
import { COURTYARD } from "./Courtyard.js";
import type { ArenaBox } from "./stage-fit.js";

/**
 * A checkered garden bed where the courtyard's pond usually is (ADR-0011,
 * scene layer): the playfield for a game that moves on a grid. Cell (0, 0) is
 * the far left corner; rows run toward the terrace.
 */
export const LAWN_CELL = 0.66;
export const LAWN_TOP = 0.16;

export function lawnCell(
  c: number,
  r: number,
  grid: { readonly cols: number; readonly rows: number },
): { x: number; z: number } {
  const { minZ, maxZ } = COURTYARD.pond;
  const centreZ = (minZ + maxZ) / 2 + 0.1;
  return {
    x: (c - (grid.cols - 1) / 2) * LAWN_CELL,
    z: centreZ + (r - (grid.rows - 1) / 2) * LAWN_CELL,
  };
}

/**
 * What the camera keeps in view for a lawn game: the bed and its hedge, with
 * only a strip of terrace. The whole courtyard left the lawn a third of a
 * phone's width and pushed crate labels far from their crates.
 */
export function lawnBox(grid: { readonly cols: number; readonly rows: number }): ArenaBox {
  const far = lawnCell(0, 0, grid);
  const near = lawnCell(grid.cols - 1, grid.rows - 1, grid);
  const pad = LAWN_CELL / 2 + 0.45;
  return {
    min: [far.x - pad, 0, far.z - pad],
    max: [near.x + pad, 1.2, near.z + pad + 0.3],
  };
}

const LIGHT = 0xa5cf62;
const DARK = 0x93c254;

export function Lawn({ cols, rows }: { cols: number; rows: number }) {
  const { x: x0, z: z0 } = lawnCell(0, 0, { cols, rows });
  const width = cols * LAWN_CELL;
  const depth = rows * LAWN_CELL;
  const cx = x0 + ((cols - 1) * LAWN_CELL) / 2;
  const cz = z0 + ((rows - 1) * LAWN_CELL) / 2;
  const tiles = [];
  for (let c = 0; c < cols; c += 1)
    for (let r = 0; r < rows; r += 1) {
      const { x, z } = lawnCell(c, r, { cols, rows });
      tiles.push(
        <Block
          key={`${c}/${r}`}
          position={[x, LAWN_TOP - 0.03, z]}
          size={[LAWN_CELL - 0.02, 0.06, LAWN_CELL - 0.02]}
          color={(c + r) % 2 ? DARK : LIGHT}
        />,
      );
    }
  return (
    <group name="lawn">
      {/* The bed: soil under the tiles, a low hedge around them. */}
      <Block position={[cx, 0.06, cz]} size={[width + 0.3, 0.12, depth + 0.3]} color={TOY.soil} />
      {tiles}
      {[-1, 1].map((side) => (
        <Block
          key={`x${side}`}
          position={[cx + side * (width / 2 + 0.28), 0.2, cz]}
          size={[0.26, 0.34, depth + 0.82]}
          color={TOY.leaf}
        />
      ))}
      {[-1, 1].map((side) => (
        <Block
          key={`z${side}`}
          position={[cx, 0.2, cz + side * (depth / 2 + 0.28)]}
          size={[width + 0.3, 0.34, 0.26]}
          color={TOY.leaf}
        />
      ))}
    </group>
  );
}
