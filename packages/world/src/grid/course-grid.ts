import { hash } from "../island/random.js";
import type { IslandRouteArchetype } from "../island/island-blueprint.js";
import { gridElevationsFor, type GridElevation } from "./grid-elevation.js";
import { hexKey, hexNeighbors, hexToWorld, worldToHex, type HexCoord } from "./hex.js";
import { gridPaletteFor, type GridPalette } from "./grid-palette.js";
import { distanceToRoute, gridPropsFor, type GridPropPlacement } from "./grid-props.js";
import { CELLS_PER_LESSON, growGridOutline, type GridOutline } from "./grid-outline.js";

export type GridLessonState = "done" | "live" | "idle" | "locked";

export interface CourseGridLesson {
  readonly lessonId: string;
  readonly unitId: string;
  readonly unitIndex?: number;
  readonly state?: GridLessonState;
}

export interface CourseGridInput {
  readonly studyId: string;
  readonly courseId: string;
  readonly seed: string;
  readonly lessons: readonly CourseGridLesson[];
  readonly routeArchetype?: IslandRouteArchetype;
  /** Existing continuous blueprint anchors are the source of route intent. */
  readonly routeAnchors?: readonly { readonly x: number; readonly z: number }[];
  readonly activeLessonIndex?: number;
}

export interface GridCell {
  readonly coord: HexCoord;
  readonly key: string;
  readonly kind: "route" | "land" | "detached";
  readonly lessonIndex: number | null;
  readonly unitId: string | null;
  readonly unitIndex: number | null;
  readonly territoryId: string | null;
  readonly height: GridElevation["height"];
  readonly topY: number;
}

export interface GridSeamStrength {
  /** Same-height meadow cells should read as one piece of land. */
  readonly land: number;
  /** Road stones need a deliberate, readable edge. */
  readonly route: number;
  /** Detached cells can keep a little more air around their silhouette. */
  readonly detached: number;
}

/**
 * Geometry receives these values instead of inheriting one gap for every
 * cell. The three levels are the visual contract from LOOK-V2 §13: land is
 * nearly seamless, route is explicit, and cliffs remain visible through
 * height changes rather than an artificial outline.
 */
export const GRID_SEAM_STRENGTH: GridSeamStrength = {
  land: 0.018,
  route: 0.105,
  detached: 0.055,
};

export interface GridLessonCell extends GridCell {
  readonly lessonIndex: number;
  readonly lessonId: string;
  readonly state: GridLessonState;
}

export interface HexMap {
  readonly version: 1;
  readonly studyId: string;
  readonly courseId: string;
  readonly seed: string;
  readonly hexSize: number;
  readonly route: readonly HexCoord[];
  readonly mainCells: readonly HexCoord[];
  readonly detachedCells: readonly HexCoord[];
  readonly detachedGroups: GridOutline["detachedGroups"];
  readonly cells: readonly GridCell[];
  readonly lessons: readonly GridLessonCell[];
  readonly props: readonly GridPropPlacement[];
  readonly palette: GridPalette;
  readonly seamStrength: GridSeamStrength;
  readonly bounds: {
    readonly minX: number;
    readonly maxX: number;
    readonly minZ: number;
    readonly maxZ: number;
    readonly halfX: number;
    readonly halfZ: number;
    readonly maxHalf: number;
  };
}

const SQRT_THREE = Math.sqrt(3);

function fallbackAnchors(
  lessonCount: number,
  seed: string,
  archetype: IslandRouteArchetype = "arc",
): readonly { readonly x: number; readonly z: number }[] {
  const phase = hash(`${seed}/fallback-route-phase`) * Math.PI * 2;
  return Array.from({ length: lessonCount }, (_, index) => {
    const t = lessonCount <= 1 ? 0 : index / (lessonCount - 1);
    const u = t * 2 - 1;
    let x = u * 2.2;
    let z = 0;
    if (archetype === "horseshoe") {
      const angle = Math.PI * (0.18 + t * 1.64);
      x = Math.cos(angle) * 2.4;
      z = Math.sin(angle) * 2.4;
    } else if (archetype === "loop-around-hill") {
      const angle = phase + t * Math.PI * 1.55;
      x = Math.cos(angle) * 2.5;
      z = Math.sin(angle) * 2.5;
    } else if (archetype === "switchback") {
      x = u * 2.2;
      z = Math.sin(t * Math.PI * 3) * 1.8;
    } else if (archetype === "serpentine") {
      x = u * 2.2;
      z = Math.sin(t * Math.PI * 2.5 + phase) * 1.65;
    } else {
      z = Math.sin(t * Math.PI * 0.9 + phase) * 1.35;
    }
    return { x, z };
  });
}

function estimateHexSize(anchors: readonly { readonly x: number; readonly z: number }[]): number {
  const distances = anchors
    .slice(1)
    .map((anchor, index) => Math.hypot(anchor.x - anchors[index]!.x, anchor.z - anchors[index]!.z))
    .filter((distance) => distance > 0.01)
    .sort((first, second) => first - second);
  const typical = distances[Math.floor(distances.length / 2)] ?? 2.3;
  // The blueprint reserves a generous course envelope for the old continuous
  // island. The first hex pass stopped at 2.1, leaving this discrete island
  // visually adrift inside that envelope. The reviewed cap is intentionally
  // a map-scale decision: it lets the island own more of the fixed design shot
  // without changing the camera, labels, or lesson positions relative to a
  // cell. Smaller courses still use their anchor-derived scale.
  // Interpolate the multiplier by course size so a three-lesson island does
  // not become a close-up of three oversized stones while a forty-one-lesson
  // island still sheds sea.
  const courseScale = Math.min(1, Math.max(0, (anchors.length - 3) / 38));

  // Cell size follows from how much of the fixed shot the island should own,
  // not from a cap. Cell *count* is now driven by lesson count
  // (CELLS_PER_LESSON), so a cap made a long course inflate off the edge of the
  // frame: 41 lessons grew to 330 cells and a 126-unit island viewed from 23
  // units away, which is a close-up of six tiles. Solving for the footprint
  // instead keeps every course the same size on screen and lets the cell count
  // change freely.
  //
  // For a roughly circular hex field, halfWidth ~= 0.866 * cellSize * sqrt(n),
  // measured against the real generator rather than derived.
  const cells = Math.max(anchors.length + 7, Math.round(anchors.length * CELLS_PER_LESSON));
  const targetHalfWidth = 9 + courseScale * 9;
  const fromFootprint = targetHalfWidth / (0.866 * Math.sqrt(cells));

  // The anchor spacing still sets a floor, so lesson stones never overlap.
  const fromAnchors = (typical / SQRT_THREE) * 0.55;
  return Math.max(0.6, Math.min(fromFootprint, Math.max(fromAnchors, fromFootprint)));
}

/**
 * The continuous blueprint owns the route's shape, but its physical envelope
 * was sized for the old continuous island. The grid now reserves eight cells
 * per lesson, so keeping that envelope would leave a long road marooned in the
 * middle of a much larger field. Expand the authored intent around its centre
 * as the course grows; the outline still grows from the resulting route, and
 * every step remains snapped by the same adjacency-preserving walk below.
 */
function stretchRouteAnchors(
  anchors: readonly { readonly x: number; readonly z: number }[],
): readonly { readonly x: number; readonly z: number }[] {
  if (anchors.length <= 1) return anchors;
  const courseScale = Math.min(1, Math.max(0, (anchors.length - 3) / 38));
  const stretch = 1 + courseScale * 0.5;
  const centre = anchors.reduce(
    (sum, anchor) => ({
      x: sum.x + anchor.x / anchors.length,
      z: sum.z + anchor.z / anchors.length,
    }),
    { x: 0, z: 0 },
  );
  return anchors.map((anchor) => ({
    x: centre.x + (anchor.x - centre.x) * stretch,
    z: centre.z + (anchor.z - centre.z) * stretch,
  }));
}

function routeFromAnchors(
  anchors: readonly { readonly x: number; readonly z: number }[],
  hexSize: number,
  seed: string,
): HexCoord[] {
  const first = worldToHex(anchors[0] ?? { x: 0, z: 0 }, hexSize);
  const route = [first];
  const used = new Set([hexKey(first)]);
  for (let index = 1; index < anchors.length; index += 1) {
    const target = anchors[index]!;
    const lookAhead = anchors[Math.min(index + 1, anchors.length - 1)]!;
    const candidates = hexNeighbors(route.at(-1)!).filter(
      (candidate) => !used.has(hexKey(candidate)),
    );
    if (candidates.length === 0) throw new RangeError("Hex route ran out of adjacent cells");
    candidates.sort((firstCandidate, secondCandidate) => {
      const firstWorld = hexToWorld(firstCandidate, hexSize);
      const secondWorld = hexToWorld(secondCandidate, hexSize);
      const firstScore =
        Math.hypot(firstWorld.x - target.x, firstWorld.z - target.z) * 1.1 +
        Math.hypot(firstWorld.x - lookAhead.x, firstWorld.z - lookAhead.z) * 0.18 +
        hash(`${seed}/route-tie/${index}/${hexKey(firstCandidate)}`) * 0.04;
      const secondScore =
        Math.hypot(secondWorld.x - target.x, secondWorld.z - target.z) * 1.1 +
        Math.hypot(secondWorld.x - lookAhead.x, secondWorld.z - lookAhead.z) * 0.18 +
        hash(`${seed}/route-tie/${index}/${hexKey(secondCandidate)}`) * 0.04;
      return firstScore - secondScore;
    });
    const next = candidates[0]!;
    route.push(next);
    used.add(hexKey(next));
  }
  return route;
}

function unitTerritories(
  mainCells: readonly HexCoord[],
  route: readonly HexCoord[],
  lessons: readonly CourseGridLesson[],
): Map<string, string | null> {
  const mainKeys = new Set(mainCells.map(hexKey));
  const routeIndexes = new Map(route.map((cell, index) => [hexKey(cell), index]));
  const territory = new Map<string, string | null>();
  const queue: HexCoord[] = [];
  for (const [key, index] of routeIndexes) {
    const unitId = lessons[index]?.unitId ?? null;
    territory.set(key, unitId);
    queue.push(route[index]!);
  }
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentKey = hexKey(current);
    const currentUnit = territory.get(currentKey) ?? null;
    for (const neighbor of hexNeighbors(current)) {
      const neighborKey = hexKey(neighbor);
      if (!mainKeys.has(neighborKey) || territory.has(neighborKey)) continue;
      territory.set(neighborKey, currentUnit);
      queue.push(neighbor);
    }
  }
  return territory;
}

function unitIndexFor(lessons: readonly CourseGridLesson[], unitId: string | null): number | null {
  if (unitId === null) return null;
  const index = lessons.findIndex((lesson) => lesson.unitId === unitId);
  return index < 0 ? null : (lessons[index]!.unitIndex ?? index);
}

function withElevation(
  outline: GridOutline,
  route: readonly HexCoord[],
  lessons: readonly CourseGridLesson[],
  seed: string,
  activeLessonIndex: number,
): { readonly cells: readonly GridCell[]; readonly lessons: readonly GridLessonCell[] } {
  const routeIndexes = new Map(route.map((cell, index) => [hexKey(cell), index]));
  const detachedKeys = new Set(outline.detached.map(hexKey));
  const territory = unitTerritories(outline.main, route, lessons);
  const elevationInputs = [
    ...outline.main.map((coord) => ({
      coord,
      kind: routeIndexes.has(hexKey(coord)) ? ("route" as const) : ("land" as const),
    })),
    ...outline.detached.map((coord) => ({ coord, kind: "detached" as const })),
  ];
  const activeKey = activeLessonIndex >= 0 ? hexKey(route[activeLessonIndex]!) : undefined;
  const elevations = new Map(
    gridElevationsFor(elevationInputs, route, seed, activeKey).map((entry) => [entry.key, entry]),
  );
  const cells: GridCell[] = elevationInputs.map(({ coord, kind }) => {
    const key = hexKey(coord);
    const lessonIndex = routeIndexes.get(key) ?? null;
    const unitId =
      lessonIndex === null ? (territory.get(key) ?? null) : (lessons[lessonIndex]?.unitId ?? null);
    const elevation = elevations.get(key)!;
    return {
      coord,
      key,
      kind,
      lessonIndex,
      unitId,
      unitIndex: unitIndexFor(lessons, unitId),
      territoryId: detachedKeys.has(key) ? null : unitId,
      height: elevation.height,
      topY: elevation.topY,
    };
  });
  const lessonCells = route.map((coord, lessonIndex) => {
    const cell = cells.find((entry) => entry.key === hexKey(coord))!;
    const lesson = lessons[lessonIndex]!;
    return {
      ...cell,
      lessonIndex,
      lessonId: lesson.lessonId,
      state: lesson.state ?? "idle",
    };
  });
  return { cells, lessons: lessonCells };
}

export function buildCourseGrid(input: CourseGridInput): HexMap {
  if (input.lessons.length === 0) throw new RangeError("A course grid needs at least one lesson");
  const authoredAnchors =
    input.routeAnchors?.length === input.lessons.length
      ? input.routeAnchors
      : fallbackAnchors(input.lessons.length, input.seed, input.routeArchetype);
  const anchors = stretchRouteAnchors(authoredAnchors);
  const hexSize = estimateHexSize(anchors);
  const route = routeFromAnchors(anchors, hexSize, input.seed);
  const outline = growGridOutline(route, `${input.studyId}/${input.courseId}/${input.seed}`);
  const activeLessonIndex =
    input.activeLessonIndex ?? input.lessons.findIndex((lesson) => lesson.state === "live");
  const projected = withElevation(outline, route, input.lessons, input.seed, activeLessonIndex);
  const props = gridPropsFor(
    projected.cells.map((cell) => ({
      coord: cell.coord,
      kind: cell.kind,
      lessonIndex: cell.lessonIndex,
      unitId: cell.unitId,
      distanceToRoute: distanceToRoute(cell.coord, route),
    })),
    route,
    input.seed,
  );
  const palette = gridPaletteFor(input.studyId, input.courseId, input.seed);
  const points = projected.cells.map((cell) => hexToWorld(cell.coord, hexSize));
  const minX = Math.min(...points.map((point) => point.x - hexSize));
  const maxX = Math.max(...points.map((point) => point.x + hexSize));
  const minZ = Math.min(...points.map((point) => point.z - hexSize));
  const maxZ = Math.max(...points.map((point) => point.z + hexSize));
  const halfX = Math.max(Math.abs(minX), Math.abs(maxX));
  const halfZ = Math.max(Math.abs(minZ), Math.abs(maxZ));
  return {
    version: 1,
    studyId: input.studyId,
    courseId: input.courseId,
    seed: input.seed,
    hexSize,
    route,
    mainCells: outline.main,
    detachedCells: outline.detached,
    detachedGroups: outline.detachedGroups,
    cells: projected.cells,
    lessons: projected.lessons,
    props,
    palette,
    seamStrength: GRID_SEAM_STRENGTH,
    bounds: { minX, maxX, minZ, maxZ, halfX, halfZ, maxHalf: Math.max(halfX, halfZ) },
  };
}
