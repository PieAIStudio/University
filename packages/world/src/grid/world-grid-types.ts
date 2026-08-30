import * as THREE from "three";

import type { HexMap } from "./course-grid.js";

/** One course grid projected into the shared world-level field. */
export interface WorldGridIsland {
  readonly id: string;
  readonly map: HexMap;
  readonly position: THREE.Vector3;
  /** State scale is kept as a transform, so the grid remains one geometry. */
  readonly scale: number;
  readonly dimmed: boolean;
}
