import { hash } from "../island/random.js";
import { hexDistance, hexKey, type HexCoord } from "./hex.js";
import {
  gridBiomesForUnits,
  gridNatureAspect,
  gridPropSize,
  GRID_PROP_ROLE_SIZING,
  type GridBiome,
  type GridPropRole,
} from "./grid-theme.js";

/**
 * A cell is now a small authored vignette, not a boolean occupancy slot:
 * one canopy/understory/landmark subject owns the cell and two to four compact
 * ground or small-understory accents orbit it. Offsets are planned in this
 * renderer-free module so
 * the renderer cannot make a second scatter decision for desktop or mobile.
 * The cluster is validated as discs (footprint / 2) plus a merged AABB before
 * it is returned. Landmark singletons retain the earlier chapter-scale
 * exception because that existing band may overhang one logical hex.
 */

/**
 * An id from the grid nature library. It is a plain string rather than a
 * closed union because the library is now generated from the donor at import
 * time; `grid-theme.test.ts` is what proves every id a biome names is really
 * in the manifest, which is a stronger guarantee than a hand-maintained union
 * that only had to compile.
 */
export type GridPropAssetId = string;
export type GridPropProjection = "course" | "world";
export type GridPropClusterMember = "primary" | "attachment";

/** The measured logical diameter used by the course grid's prop planner. */
export const GRID_PROP_CELL_DIAMETER = 2;
/** A small air gap keeps a cluster from reading as one fused mesh. */
export const GRID_PROP_CLUSTER_GAP = 0.035;

export interface GridPropCellInput {
  readonly coord: HexCoord;
  readonly kind: "route" | "land" | "detached";
  readonly lessonIndex: number | null;
  readonly unitId: string | null;
  readonly distanceToRoute: number;
}

export interface GridPropPlacement {
  readonly cellKey: string;
  readonly coord: HexCoord;
  readonly assetId: GridPropAssetId;
  readonly kind: "course" | "territory" | "landmark";
  readonly role: GridPropRole;
  readonly lessonIndex: number | null;
  readonly unitId: string | null;
  readonly rotation: number;
  /** World-unit height the renderer scales the normalised mesh to. */
  readonly height: number;
  /** World-unit horizontal scale. */
  readonly width: number;
  /** World-unit ground footprint. */
  readonly footprint: number;
  /** Horizontal position inside the owning cell, in planner world units. */
  readonly offsetX: number;
  readonly offsetZ: number;
  /** The cell diameter used to validate this cluster. */
  readonly cellDiameter: number;
  /** Whether this placement is the cluster's subject or its punctuation. */
  readonly clusterMember: GridPropClusterMember;
  /** Course-view semantic LOD; omitted means the placement is rendered. */
  readonly visibleInCourse?: boolean;
}

/**
 * How much dressing a cell receives, by how far it is from the road.
 *
 * This profile is the fix for the single worst defect on the branch it
 * replaces. Density used to *rise* with distance from the route — a clean
 * shoulder, in principle — and then the visual LOD kept the highest-scoring
 * placements, where the score was also distance from the route. The two
 * decisions agreed, and their agreement was catastrophic: of 287 planned props
 * exactly 32 were drawn, none of them within two cells of the road, and the
 * learner's camera stands *on* the road. The island rendered as bare ground.
 *
 * So the shoulder is now a ridge rather than a ramp. Index is the ring
 * distance from the route, clamped to the last entry:
 *  - ring 0 is the road itself and never receives dressing;
 *  - ring 1 gets small things only, so a marker is never crowded;
 *  - rings 2-3 are the peak, because that is the band the course camera fills
 *    its frame with;
 *  - beyond that it decays but never to zero, so the far meadow keeps a
 *    horizon without becoming a hedge.
 */
export const GRID_SHOULDER_PROFILE: Readonly<Record<GridPropRole, readonly number[]>> = {
  // A tall silhouette beside the road would sit between the camera and the
  // lesson marker, which is the one thing dressing may never do.
  canopy: [0, 0, 1, 1, 0.82, 0.62, 0.46],
  understory: [0, 0.42, 1, 0.94, 0.76, 0.58, 0.44],
  ground: [0, 0.92, 1, 0.88, 0.68, 0.52, 0.4],
  landmark: [0, 0, 1, 1, 0.5, 0.25, 0.1],
};

export function gridShoulderWeight(role: GridPropRole, distanceToRoute: number): number {
  const profile = GRID_SHOULDER_PROFILE[role];
  const index = Math.min(Math.max(0, Math.round(distanceToRoute)), profile.length - 1);
  return profile[index]!;
}

/**
 * How many dressed props the course view actually draws.
 *
 * The old cap was 34 for any course longer than a sample, which is roughly one
 * prop per ten cells: an island that is empty everywhere the learner looks.
 * This scales with the route because a longer course is a bigger island, and
 * it is still a cap rather than a target — the shoulder profile above decides
 * where they go, and a short course simply has fewer.
 */
export function gridVisiblePropTarget(routeLength: number): number {
  return Math.min(210, Math.max(24, Math.round(routeLength * 3.6)));
}

/** Cells this close to a landmark stay clear so it reads as one large thing. */
export const GRID_LANDMARK_CLEARANCE = 1;
/** Two tall silhouettes closer than this read as a hedge, not as landmarks. */
export const GRID_CANOPY_SPACING = 2;

interface RoleChoice {
  readonly role: GridPropRole;
  readonly assets: readonly string[];
}

function roleChoicesFor(biome: GridBiome): readonly RoleChoice[] {
  return [
    { role: "canopy", assets: biome.canopy },
    { role: "understory", assets: biome.understory },
    { role: "ground", assets: biome.ground },
  ];
}

function primaryRoleChoicesFor(biome: GridBiome): readonly RoleChoice[] {
  return roleChoicesFor(biome).filter((choice) => choice.role !== "ground");
}

function biomeRoleDensity(biome: GridBiome, role: GridPropRole): number {
  if (role === "canopy") return biome.canopyDensity;
  if (role === "understory") return biome.understoryDensity;
  if (role === "ground") return biome.groundDensity;
  return 0;
}

function placementFor(
  cell: GridPropCellInput,
  role: GridPropRole,
  assetId: string,
  seed: string,
  kind: GridPropPlacement["kind"],
  keySuffix: string,
  projection: GridPropProjection,
  clusterMember: GridPropClusterMember,
  offset: readonly [number, number],
  cellDiameter: number,
  roll = hash(`${seed}/prop-size/${keySuffix}`),
): GridPropPlacement {
  const size = gridPropSize(role, gridNatureAspect(assetId), roll);
  // The world projection draws the same plan at archipelago scale, where a
  // course island is a few dozen pixels. One shared shrink keeps it the same
  // placement rather than a second layout with its own rules.
  const worldScale = projection === "world" ? 0.42 : 1;
  return {
    cellKey: hexKey(cell.coord),
    coord: cell.coord,
    assetId,
    kind,
    role,
    lessonIndex: null,
    unitId: cell.unitId,
    rotation: hash(`${seed}/prop-rotation/${keySuffix}`) * Math.PI * 2,
    height: size.height * worldScale,
    width: size.width * worldScale,
    footprint: size.footprint * worldScale,
    offsetX: offset[0] * worldScale,
    offsetZ: offset[1] * worldScale,
    cellDiameter: cellDiameter * worldScale,
    clusterMember,
  };
}

function pick<T>(items: readonly T[], roll: number): T {
  return items[Math.min(items.length - 1, Math.floor(roll * items.length))]!;
}

interface ClusterSizeSpec {
  readonly role: GridPropRole;
  readonly assetId: string;
  readonly roll: number;
  readonly footprint: number;
}

interface ClusterOffsetSpec {
  readonly offsetX: number;
  readonly offsetZ: number;
  readonly footprint: number;
  readonly cellDiameter: number;
}

function clusterGeometryHolds(placements: readonly ClusterOffsetSpec[], epsilon = 1e-6): boolean {
  if (placements.length === 0) return true;
  const diameter = placements[0]!.cellDiameter;
  if (diameter <= 0 || placements.some((placement) => placement.cellDiameter !== diameter)) {
    return false;
  }

  for (let first = 0; first < placements.length; first += 1) {
    const left = placements[first]!;
    if (left.footprint <= 0 || !Number.isFinite(left.footprint)) return false;
    for (let second = first + 1; second < placements.length; second += 1) {
      const right = placements[second]!;
      const dx = left.offsetX - right.offsetX;
      const dz = left.offsetZ - right.offsetZ;
      const horizontalDistance = Math.hypot(dx, dz);
      const radiusSum = (left.footprint + right.footprint) / 2;
      if (horizontalDistance + epsilon < radiusSum) return false;
    }
  }

  const minX = Math.min(
    ...placements.map((placement) => placement.offsetX - placement.footprint / 2),
  );
  const maxX = Math.max(
    ...placements.map((placement) => placement.offsetX + placement.footprint / 2),
  );
  const minZ = Math.min(
    ...placements.map((placement) => placement.offsetZ - placement.footprint / 2),
  );
  const maxZ = Math.max(
    ...placements.map((placement) => placement.offsetZ + placement.footprint / 2),
  );
  return (
    maxX - minX <= diameter + epsilon &&
    maxZ - minZ <= diameter + epsilon &&
    minX >= -diameter / 2 - epsilon &&
    maxX <= diameter / 2 + epsilon &&
    minZ >= -diameter / 2 - epsilon &&
    maxZ <= diameter / 2 + epsilon
  );
}

function clusterOffsetSpecs(
  primaryFootprint: number,
  attachments: readonly ClusterSizeSpec[],
  cellDiameter: number,
  seed: string,
): readonly [readonly [number, number], readonly (readonly [number, number])[]] | null {
  const baseAngle = hash(`${seed}/cluster-angle`) * (Math.PI / 6);
  const anglePatterns: readonly number[][] =
    attachments.length === 2
      ? [
          [Math.PI / 4, -Math.PI / 4],
          [0, Math.PI],
          [Math.PI / 2, -Math.PI / 2],
        ]
      : attachments.length === 3
        ? [
            [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3],
            [Math.PI / 2, (Math.PI * 7) / 6, (Math.PI * 11) / 6],
          ]
        : [
            [Math.PI / 4, (Math.PI * 3) / 4, (Math.PI * 5) / 4, (Math.PI * 7) / 4],
            [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2],
          ];

  for (const pattern of anglePatterns) {
    const offsets = pattern.map((angle, index) => {
      const attachmentRadius = attachments[index]!.footprint / 2;
      const distance = primaryFootprint / 2 + attachmentRadius + GRID_PROP_CLUSTER_GAP;
      const rotated = angle + baseAngle;
      return [Math.cos(rotated) * distance, Math.sin(rotated) * distance] as const;
    });
    const geometry = [
      { offsetX: 0, offsetZ: 0, footprint: primaryFootprint, cellDiameter },
      ...offsets.map(([offsetX, offsetZ], index) => ({
        offsetX,
        offsetZ,
        footprint: attachments[index]!.footprint,
        cellDiameter,
      })),
    ];
    const minX = Math.min(
      ...geometry.map((placement) => placement.offsetX - placement.footprint / 2),
    );
    const maxX = Math.max(
      ...geometry.map((placement) => placement.offsetX + placement.footprint / 2),
    );
    const minZ = Math.min(
      ...geometry.map((placement) => placement.offsetZ - placement.footprint / 2),
    );
    const maxZ = Math.max(
      ...geometry.map((placement) => placement.offsetZ + placement.footprint / 2),
    );
    const shiftX = (minX + maxX) / 2;
    const shiftZ = (minZ + maxZ) / 2;
    const centredGeometry = geometry.map((placement) => ({
      ...placement,
      offsetX: placement.offsetX - shiftX,
      offsetZ: placement.offsetZ - shiftZ,
    }));
    if (clusterGeometryHolds(centredGeometry)) {
      return [
        [-shiftX, -shiftZ],
        offsets.map(([offsetX, offsetZ]) => [offsetX - shiftX, offsetZ - shiftZ] as const),
      ];
    }
  }
  return null;
}

function compactAttachmentChoices(biome: GridBiome): readonly RoleChoice[] {
  const understory = biome.understory.filter((assetId) => gridNatureAspect(assetId) <= 1.2);
  const ground = biome.ground.filter((assetId) => gridNatureAspect(assetId) <= 2.4);
  return [
    { role: "understory" as const, assets: understory },
    { role: "ground" as const, assets: ground },
  ].filter((choice) => choice.assets.length > 0);
}

function attachmentSpecsFor(
  biome: GridBiome,
  count: number,
  seed: string,
  cellKey: string,
  sizeTier: number,
  allowSmallUnderstory: boolean,
): readonly ClusterSizeSpec[] {
  const choices = compactAttachmentChoices(biome);
  if (choices.length === 0) return [];
  return Array.from({ length: count }, (_, index) => {
    const ground = choices.find((candidate) => candidate.role === "ground");
    const understory = choices.find((candidate) => candidate.role === "understory");
    const useSmallUnderstory =
      allowSmallUnderstory &&
      understory &&
      hash(`${seed}/cluster-attachment-role/${cellKey}/${index}`) < 0.45;
    const choice = (useSmallUnderstory ? understory : ground) ?? choices[0]!;
    const assetId = pick(
      choice.assets,
      hash(`${seed}/cluster-attachment-asset/${cellKey}/${index}`),
    );
    const roll = Math.min(
      1,
      Math.max(0, sizeTier + hash(`${seed}/cluster-attachment-size/${cellKey}/${index}`) * 0.08),
    );
    return {
      role: choice.role,
      assetId,
      roll,
      footprint: gridPropSize(choice.role, gridNatureAspect(assetId), roll).footprint,
    };
  });
}

function clusterPlacementsFor(
  cell: GridPropCellInput,
  biome: GridBiome,
  primaryRole: GridPropRole,
  primaryAssetId: string,
  seed: string,
  kind: GridPropPlacement["kind"],
  keySuffix: string,
  projection: GridPropProjection,
  cellDiameter: number,
): readonly GridPropPlacement[] {
  const primary = placementFor(
    cell,
    primaryRole,
    primaryAssetId,
    seed,
    kind,
    keySuffix,
    projection,
    "primary",
    [0, 0],
    cellDiameter,
  );
  // Layout is authored in course/world units before the archipelago projection
  // applies its shared 0.42 scale. Otherwise a world projection would mix a
  // scaled subject with unscaled attachment footprints while choosing offsets.
  const planningPrimary = placementFor(
    cell,
    primaryRole,
    primaryAssetId,
    seed,
    kind,
    keySuffix,
    "course",
    "primary",
    [0, 0],
    cellDiameter,
  );

  // A chapter landmark may already be wider than the regular dressing cell.
  // Keep the existing landmark silhouette intact; only add punctuation when
  // the complete subject-plus-attachments cluster fits the same cell rule.
  const maxAttachments = primaryRole === "landmark" ? 3 : 4;
  const preferredCount =
    primaryRole === "landmark"
      ? 2
      : planningPrimary.footprint / cellDiameter > 0.7
        ? 2
        : 2 + Math.floor(hash(`${seed}/cluster-count/${keySuffix}`) * 3);
  const tierSteps = [0.32, 0.22, 0.12, 0.04] as const;
  for (const sizeTier of tierSteps) {
    for (let count = Math.min(maxAttachments, preferredCount); count >= 2; count -= 1) {
      // Try mixed clusters first for visual height. If a particular biome's
      // understory mesh is too broad, retry the same geometry with ground
      // accents before reducing the cluster or abandoning it.
      for (const allowSmallUnderstory of [true, false]) {
        const specs = attachmentSpecsFor(
          biome,
          count,
          seed,
          hexKey(cell.coord),
          sizeTier,
          allowSmallUnderstory,
        );
        if (specs.length !== count) continue;
        const offsets = clusterOffsetSpecs(
          planningPrimary.footprint,
          specs,
          cellDiameter,
          `${seed}/${keySuffix}/${sizeTier}/${count}/${allowSmallUnderstory}`,
        );
        if (!offsets) continue;
        const [primaryOffset, attachmentOffsets] = offsets;
        const positionedPrimary = placementFor(
          cell,
          primaryRole,
          primaryAssetId,
          seed,
          kind,
          keySuffix,
          projection,
          "primary",
          primaryOffset,
          cellDiameter,
        );
        return [
          positionedPrimary,
          ...specs.map((spec, index) =>
            placementFor(
              cell,
              spec.role,
              spec.assetId,
              seed,
              kind,
              `${keySuffix}/attachment/${index}`,
              projection,
              "attachment",
              attachmentOffsets[index]!,
              cellDiameter,
              spec.roll,
            ),
          ),
        ];
      }
    }
  }
  // A regular territory subject must have punctuation. The shape test below
  // is the guard that keeps a future asset or band change from silently
  // returning to one naked dot per cell.
  return [primary];
}

/**
 * The one large thing that opens a unit.
 *
 * A landmark is placed beside the unit's *first* lesson rather than at its
 * centre, because its job is to be the thing a learner sees as they arrive.
 * It never lands on the road and never touches a lesson cell, so it cannot
 * occlude the control the learner is meant to click.
 */
function landmarkCellFor(
  unitId: string,
  cells: readonly GridPropCellInput[],
  lessonCoords: readonly HexCoord[],
  seed: string,
): GridPropCellInput | null {
  const unitLessons = cells
    .filter((cell) => cell.unitId === unitId && cell.lessonIndex !== null)
    .sort((first, second) => (first.lessonIndex ?? 0) - (second.lessonIndex ?? 0));
  const anchor = unitLessons[0];
  if (!anchor) return null;
  const candidates = cells
    .filter(
      (cell) =>
        cell.kind === "land" &&
        cell.unitId === unitId &&
        cell.distanceToRoute >= 2 &&
        cell.distanceToRoute <= 3 &&
        hexDistance(cell.coord, anchor.coord) <= 4 &&
        lessonCoords.every((lesson) => hexDistance(cell.coord, lesson) > 1),
    )
    .sort(
      (first, second) =>
        hexDistance(first.coord, anchor.coord) - hexDistance(second.coord, anchor.coord) ||
        hash(`${seed}/landmark/${hexKey(first.coord)}`) -
          hash(`${seed}/landmark/${hexKey(second.coord)}`),
    );
  return candidates[0] ?? null;
}

export function gridPropsFor(
  cells: readonly GridPropCellInput[],
  route: readonly HexCoord[],
  seed: string,
  projection: GridPropProjection = "course",
  cellDiameter = GRID_PROP_CELL_DIAMETER,
): readonly GridPropPlacement[] {
  const unitIds: string[] = [];
  for (const cell of cells) {
    if (cell.unitId && !unitIds.includes(cell.unitId)) unitIds.push(cell.unitId);
  }
  const biomes = gridBiomesForUnits(unitIds, seed);
  if (biomes.size === 0) return [];
  const fallbackBiome = biomes.get(unitIds[0]!)!;
  const biomeFor = (cell: GridPropCellInput): GridBiome =>
    (cell.unitId ? biomes.get(cell.unitId) : undefined) ?? fallbackBiome;

  const lessonCoords = cells.filter((cell) => cell.lessonIndex !== null).map((cell) => cell.coord);
  const occupied = new Set<string>();
  const placements: GridPropPlacement[] = [];
  const landmarkCoords: HexCoord[] = [];
  const canopyCoords: HexCoord[] = [];

  // --- landmarks first: they claim their clearing before anything else ----
  for (const unitId of unitIds) {
    const cell = landmarkCellFor(unitId, cells, lessonCoords, seed);
    if (!cell) continue;
    const biome = biomes.get(unitId) ?? fallbackBiome;
    placements.push(
      ...clusterPlacementsFor(
        cell,
        biome,
        "landmark",
        biome.landmark,
        seed,
        "landmark",
        `landmark/${unitId}`,
        projection,
        cellDiameter,
      ),
    );
    occupied.add(hexKey(cell.coord));
    landmarkCoords.push(cell.coord);
  }

  // --- the dressing field -------------------------------------------------
  for (const cell of cells) {
    const cellKey = hexKey(cell.coord);
    if (occupied.has(cellKey)) continue;
    if (cell.kind !== "land") continue;
    /*
     * A landmark needs air around it to read as one large thing — but only
     * against things of its own size. Blanking the ring entirely cost 42 of
     * 287 land cells on the pressure course, and because landmarks sit two to
     * three rings off the road, every one of those cells was in the band the
     * course camera fills. The landmark cluster itself supplies the base
     * punctuation, so the surrounding clearing stays calm.
     */
    const insideClearing = landmarkCoords.some(
      (coord) => hexDistance(cell.coord, coord) <= GRID_LANDMARK_CLEARANCE,
    );
    // Landmark clusters already provide their own base punctuation. Keeping
    // the rest of the clearing empty preserves the chapter opener's silhouette.
    if (insideClearing) continue;

    const biome = biomeFor(cell);
    // One roll picks the cluster's subject, weighted by the biome's own
    // character and by the shoulder profile. Ground density is folded into
    // understory rather than emitted as a naked dot: every territory cell that
    // wins this roll gets one readable subject and its own punctuation.
    const choices = primaryRoleChoicesFor(biome)
      .map((choice) => ({
        ...choice,
        weight:
          (choice.role === "understory"
            ? biomeRoleDensity(biome, "understory") + biome.groundDensity * 0.6
            : biomeRoleDensity(biome, choice.role)) *
          gridShoulderWeight(choice.role, cell.distanceToRoute),
      }))
      .filter((choice) => choice.weight > 0 && choice.assets.length > 0);
    const total = choices.reduce((sum, choice) => sum + choice.weight, 0);
    if (total <= 0) continue;
    if (hash(`${seed}/prop-density/${cellKey}`) >= total) continue;

    let cursor = hash(`${seed}/prop-role/${cellKey}`) * total;
    let chosen = choices[choices.length - 1]!;
    for (const choice of choices) {
      if (cursor < choice.weight) {
        chosen = choice;
        break;
      }
      cursor -= choice.weight;
    }

    /*
     * A tree is a landmark, not a fence post: tall silhouettes keep their
     * distance so an arm of the island cannot turn into a hedge.
     *
     * But a rejected canopy falls *down* the scale rather than leaving the cell
     * bare. Skipping outright was quietly the second-largest source of empty
     * ground: the spacing rule fires most often exactly where trees want to be,
     * which is the band the camera fills, so the rule that was meant to thin a
     * hedge was instead clearing the foreground. A clearing around a tree still
     * has undergrowth in it.
     */
    if (
      chosen.role === "canopy" &&
      canopyCoords.some((coord) => hexDistance(cell.coord, coord) <= GRID_CANOPY_SPACING)
    ) {
      const understory = choices.find((choice) => choice.role === "understory");
      const fallback = understory;
      if (!fallback) continue;
      chosen = fallback;
    }

    const assetId = pick(chosen.assets, hash(`${seed}/prop-asset/${cellKey}`));
    placements.push(
      ...clusterPlacementsFor(
        cell,
        biome,
        chosen.role,
        assetId,
        seed,
        "territory",
        cellKey,
        projection,
        cellDiameter,
      ),
    );
    occupied.add(cellKey);
    if (chosen.role === "canopy") canopyCoords.push(cell.coord);
  }

  return projection === "course"
    ? selectCourseVisiblePlacements(placements, route, seed)
    : selectWorldVisiblePlacements(placements, seed);
}

/**
 * The course-view visual LOD.
 *
 * Sorted by distance to the route *ascending*. That single character is the
 * defect this file was rewritten around: the previous implementation sorted
 * descending, and so kept, with complete precision, the props furthest from
 * the only place the learner ever stands.
 *
 * Landmarks are never dropped. They are the chapter headings.
 */
function selectCourseVisiblePlacements(
  placements: readonly GridPropPlacement[],
  route: readonly HexCoord[],
  seed: string,
): readonly GridPropPlacement[] {
  if (route.length === 0) return placements;
  const target = gridVisiblePropTarget(route.length);
  const distance = (placement: GridPropPlacement): number =>
    Math.min(...route.map((entry) => hexDistance(entry, placement.coord)));

  const clusters = new Map<string, GridPropPlacement[]>();
  for (const placement of placements) {
    const cluster = clusters.get(placement.cellKey) ?? [];
    cluster.push(placement);
    clusters.set(placement.cellKey, cluster);
  }
  const selected = new Set<string>();
  let selectedCount = 0;
  for (const [cellKey, cluster] of clusters) {
    if (cluster[0]!.kind === "landmark") {
      selected.add(cellKey);
      selectedCount += cluster.length;
    }
  }

  const candidates = [...clusters.entries()]
    .filter(([, cluster]) => cluster[0]!.kind === "territory")
    .map(([cellKey, cluster]) => ({
      cellKey,
      cluster,
      // The jitter keeps one ring from being taken in a solid block, which
      // would read as a band of dressing rather than as a meadow.
      score: distance(cluster[0]!) + hash(`${seed}/course-visible/${cellKey}`) * 0.9,
    }))
    .sort((first, second) => first.score - second.score);

  for (const candidate of candidates) {
    if (selectedCount >= target) break;
    selected.add(candidate.cellKey);
    selectedCount += candidate.cluster.length;
  }

  return placements.map((placement) =>
    selected.has(placement.cellKey) ? placement : { ...placement, visibleInCourse: false as const },
  );
}

/**
 * The archipelago view draws fifty-three islands at once, so it keeps only a
 * silhouette: the unit landmarks plus a thin scatter of canopy.
 */
function selectWorldVisiblePlacements(
  placements: readonly GridPropPlacement[],
  seed: string,
): readonly GridPropPlacement[] {
  const clusters = new Map<string, GridPropPlacement[]>();
  for (const placement of placements) {
    const cluster = clusters.get(placement.cellKey) ?? [];
    cluster.push(placement);
    clusters.set(placement.cellKey, cluster);
  }
  const selected = new Set<string>();
  let canopyBudget = 2;
  for (const [cellKey, cluster] of clusters) {
    if (cluster[0]!.kind === "landmark" && selected.size < 1) {
      selected.add(cellKey);
      continue;
    }
    if (
      cluster.some((placement) => placement.role === "canopy") &&
      canopyBudget > 0 &&
      hash(`${seed}/world-visible/${cellKey}`) < 0.5
    ) {
      selected.add(cellKey);
      canopyBudget -= 1;
    }
  }
  return placements.map((placement) =>
    selected.has(placement.cellKey) &&
    (placement.role === "landmark" || placement.role === "canopy")
      ? placement
      : { ...placement, visibleInCourse: false as const },
  );
}

/**
 * The old name is kept for callers that used the one-prop-per-cell guard.
 * Its meaning is now stronger: a cell may contain a cluster, but every member
 * must be a non-overlapping, cell-sized placement in that cluster.
 */
export function propCellsAreUnique(placements: readonly GridPropPlacement[]): boolean {
  return propClustersFitCells(placements);
}

/** Check pairwise disc separation and the merged AABB for every cell cluster. */
export function propClustersFitCells(placements: readonly GridPropPlacement[]): boolean {
  const clusters = new Map<string, GridPropPlacement[]>();
  for (const placement of placements) {
    const cluster = clusters.get(placement.cellKey) ?? [];
    cluster.push(placement);
    clusters.set(placement.cellKey, cluster);
  }
  return [...clusters.values()].every(propClusterFitsCell);
}

/** The same geometry gate for one cell, useful for focused diagnostics/tests. */
export function propClusterFitsCell(placements: readonly GridPropPlacement[]): boolean {
  if (placements.length === 0) return true;
  // The existing landmark band deliberately permits a chapter-scale singleton
  // to overhang its source hex. It is not a multi-prop cluster, so the cluster
  // AABB rule starts when a second member is added.
  if (placements.length === 1 && placements[0]!.kind === "landmark") return true;
  return clusterGeometryHolds(
    placements.map((placement) => ({
      offsetX: placement.offsetX,
      offsetZ: placement.offsetZ,
      footprint: placement.footprint,
      cellDiameter: placement.cellDiameter,
    })),
  );
}

/** Keep the lower and upper size-band tripwires attached to actual placements. */
export function propPlacementSizeBandsHold(placements: readonly GridPropPlacement[]): boolean {
  return placements.every((placement) => {
    const sizing = GRID_PROP_ROLE_SIZING[placement.role];
    return (
      placement.height >= sizing.height[0] - 1e-6 &&
      placement.height <= sizing.height[1] + 1e-6 &&
      placement.footprint >= sizing.footprint[0] - 1e-6 &&
      placement.footprint <= sizing.footprint[1] + 1e-6
    );
  });
}

/** The complete geometry gate used by the course tests. */
export function propClustersAreValid(placements: readonly GridPropPlacement[]): boolean {
  return (
    propClustersFitCells(placements) &&
    propPlacementSizeBandsHold(placements) &&
    propClusterShapesHold(placements)
  );
}

/** Every regular dressing cluster has one subject and two to four accents. */
export function propClusterShapesHold(placements: readonly GridPropPlacement[]): boolean {
  const clusters = new Map<string, GridPropPlacement[]>();
  for (const placement of placements) {
    const cluster = clusters.get(placement.cellKey) ?? [];
    cluster.push(placement);
    clusters.set(placement.cellKey, cluster);
  }
  return [...clusters.values()].every((cluster) => {
    const primary = cluster.filter((placement) => placement.clusterMember === "primary");
    const attachments = cluster.filter((placement) => placement.clusterMember === "attachment");
    const primaryRoleIsValid = primary.every((placement) => placement.role !== "ground");
    const attachmentRolesAreValid = attachments.every(
      (placement) => placement.role === "ground" || placement.role === "understory",
    );
    // A landmark may be wider than the regular cell and remains a deliberate
    // singleton when no complete subject-plus-punctuation layout fits it.
    if (cluster[0]!.kind === "landmark" && cluster.length === 1) {
      return primary.length === 1 && primary[0]!.role === "landmark";
    }
    return (
      primary.length === 1 &&
      primaryRoleIsValid &&
      attachments.length >= 2 &&
      attachments.length <= 4 &&
      attachmentRolesAreValid
    );
  });
}

export function distanceToRoute(cell: HexCoord, route: readonly HexCoord[]): number {
  return Math.min(...route.map((entry) => hexDistance(cell, entry)));
}

/* ------------------------------------------------------------------ *
 * Assertions
 *
 * These are the reason the planner is a pure module. "Too big", "floating",
 * "the learner can't see any of it" are all arithmetic, and arithmetic is
 * something a test can refuse to merge. Every one of them exists because the
 * failure it describes actually shipped.
 * ------------------------------------------------------------------ */

/**
 * Can the learner see any of this from where they stand?
 *
 * The camera sits on the route. A plan with three hundred props and none of
 * them within two rings of the road is, from the only viewpoint that exists,
 * an empty island — and every other metric in the project scored it as full.
 */
export function visiblePropsNearRoute(
  placements: readonly GridPropPlacement[],
  route: readonly HexCoord[],
  rings = 2,
): readonly GridPropPlacement[] {
  if (route.length === 0) return [];
  return placements.filter(
    (placement) =>
      placement.visibleInCourse !== false &&
      route.some((entry) => hexDistance(entry, placement.coord) <= rings),
  );
}

/** No dressing may stand on the road or on a lesson's own cell. */
export function propsAvoidRoute(
  placements: readonly GridPropPlacement[],
  route: readonly HexCoord[],
): boolean {
  const routeKeys = new Set(route.map(hexKey));
  return placements.every((placement) => !routeKeys.has(placement.cellKey));
}

/** Every tall silhouette keeps its distance from every other one. */
export function canopySpacingHolds(placements: readonly GridPropPlacement[]): boolean {
  const canopies = placements.filter(
    (placement) => placement.role === "canopy" && placement.visibleInCourse !== false,
  );
  for (let first = 0; first < canopies.length; first += 1) {
    for (let second = first + 1; second < canopies.length; second += 1) {
      if (hexDistance(canopies[first]!.coord, canopies[second]!.coord) <= GRID_CANOPY_SPACING - 1) {
        return false;
      }
    }
  }
  return true;
}
