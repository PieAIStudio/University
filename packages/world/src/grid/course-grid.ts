import { hash } from "../island/random.js";
import type { IslandRouteArchetype } from "../island/island-blueprint.js";
import { gridElevationsFor, type GridElevation } from "./grid-elevation.js";
import { hexDistance, hexKey, hexNeighbors, hexToWorld, type HexCoord } from "./hex.js";
import { gridPaletteFor, type GridPalette } from "./grid-palette.js";
import { distanceToRoute, gridPropsFor, type GridPropPlacement } from "./grid-props.js";
import { assertGridSurfaceContract, gridSurfacesForCells } from "./grid-surface.js";
import { gridBiomesForUnits, type GridBiome, type GridSurface } from "./grid-theme.js";
import {
  CELLS_PER_LESSON,
  GRID_CELL_BUDGET,
  growGridOutline,
  type GridOutline,
} from "./grid-outline.js";

export type GridLessonState = "done" | "live" | "idle" | "locked";
export type CourseGridProjection = "course" | "world";

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
  /** The same grid planner, projected at course or remote world scale. */
  readonly projection?: CourseGridProjection;
  /**
   * How big the remote silhouette should be. World maps size the cluster from
   * the real lesson count, then walk a short route through it — the course
   * shot is the place that still spends one cell per lesson.
   */
  readonly footprintLessons?: number;
  /**
   * Optional floor for a higher-level remote projection. The study picker has
   * one landmass per study, so a one-course study still needs a clickable
   * silhouette even when its lesson count is tiny. This changes only the
   * requested outline size; the shared outline, field and palette stay the
   * same.
   */
  readonly worldCellFloor?: number;
}

export interface GridCell {
  readonly coord: HexCoord;
  readonly key: string;
  readonly kind: "route" | "land" | "detached";
  readonly lessonIndex: number | null;
  readonly unitId: string | null;
  readonly unitIndex: number | null;
  readonly territoryId: string | null;
  readonly surface: GridSurface;
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
  // Same-height meadow cells must overlap slightly. A zero or positive seam
  // leaves a hairline the 65° camera reads as a dotted cliff outline — either
  // a true gap or z-fighting sparkle on a shared edge. Negative seam is the
  // overlap that turns those cells into one terrace. Route and detached cells
  // keep a deliberate air line so those two semantic layers still separate.
  land: -0.02,
  route: 0.072,
  detached: 0.04,
};

export interface GridLessonCell extends GridCell {
  readonly lessonIndex: number;
  readonly lessonId: string;
  readonly state: GridLessonState;
}

export interface HexMap {
  readonly version: 1;
  readonly projection: CourseGridProjection;
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
  /**
   * One biome per authored unit. The renderer, the dressing planner and the
   * inspector all read this same assignment, so the ground a learner walks on
   * and the things standing in it can never disagree about which chapter they
   * are in.
   */
  readonly unitBiomes: ReadonlyMap<string, GridBiome>;
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

/**
 * The planet's unit is a study, not a course. Keep its sizing rule beside the
 * shared world-grid generator so the renderer cannot quietly grow a second
 * notion of "large".
 */
export const WORLD_STUDY_GRID_CONTRACT = {
  /** A short or empty study still owns a visible, pickable landmass. */
  minCells: 24,
  /** The existing 400-cell field budget also bounds one study projection. */
  maxCells: GRID_CELL_BUDGET,
  /** Course count contributes when lesson totals are sparse or incomplete. */
  courseWeight: 4,
  /** Avoid letting a malformed zero-total study collapse to a pebble. */
  minFootprintLessons: 12,
} as const;

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

function estimateHexSize(lessonCount: number, cellCount: number, expansion = 0): number {
  // The blueprint reserves a generous course envelope for the old continuous
  // island. The first hex pass stopped at 2.1, leaving this discrete island
  // visually adrift inside that envelope. The reviewed cap is intentionally
  // a map-scale decision: it lets the island own more of the fixed design shot
  // without changing the camera, labels, or lesson positions relative to a
  // cell. Smaller courses still use their anchor-derived scale.
  // Interpolate the multiplier by course size so a three-lesson island does
  // not become a close-up of three oversized stones while a forty-one-lesson
  // island still sheds sea.
  const courseScale = Math.min(1, Math.max(0, (lessonCount - 3) / 38));

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
  // The course camera still frames the shared continuous blueprint envelope;
  // keep the new compact cell region at that established screen scale without
  // changing the camera or any lesson position relative to its cell.
  const targetHalfWidth = 14 + courseScale * 14 + expansion * 4;
  return Math.max(0.6, targetHalfWidth / (0.866 * Math.sqrt(cellCount)));
}

/**
 * The remote map only needs enough surrounding land for a readable silhouette.
 * Keeping this ratio near twenty cells for the catalogue's common twelve-lesson
 * courses is what makes one shared instanced field cheap: route cells carry
 * the course's progress, while the surrounding cells carry its shape.
 */
export function worldGridTargetForLessons(lessons: number): number {
  const safeLessons = Math.max(1, Math.floor(lessons));
  return Math.min(GRID_CELL_BUDGET - 4, Math.max(safeLessons + 6, Math.round(safeLessons * 1.55)));
}

/** The lesson-equivalent volume used by one study's higher-level landmass. */
export function worldGridFootprintLessonsForStudy(
  courseCount: number,
  lessonCount: number,
): number {
  const safeCourses = Math.max(1, Math.floor(Number.isFinite(courseCount) ? courseCount : 1));
  const safeLessons = Math.max(0, Math.floor(Number.isFinite(lessonCount) ? lessonCount : 0));
  return Math.max(
    WORLD_STUDY_GRID_CONTRACT.minFootprintLessons,
    safeLessons,
    safeCourses * WORLD_STUDY_GRID_CONTRACT.courseWeight,
  );
}

/**
 * Return the requested main-outline target before detached underside cells are
 * added. The renderer uses the same result through `worldCellFloor`, while
 * tests and inspector surfaces can reason about the threshold without Three.
 */
export function worldGridTargetForStudy(courseCount: number, lessonCount: number): number {
  return Math.min(
    GRID_CELL_BUDGET - 4,
    Math.max(
      WORLD_STUDY_GRID_CONTRACT.minCells,
      worldGridTargetForLessons(worldGridFootprintLessonsForStudy(courseCount, lessonCount)),
    ),
  );
}

/**
 * Target half-width for the remote silhouette, in world units before the
 * state emphasis scale is applied. The square-root curve makes area grow with
 * lesson count while its floor keeps the shortest real courses clickable.
 */
export function worldGridFootprintForLessons(lessons: number): number {
  return 1.1 + Math.sqrt(Math.max(1, Math.floor(lessons))) * 0.98;
}

function unitHalfExtent(cells: readonly HexCoord[]): number {
  const points = cells.map((cell) => hexToWorld(cell, 1));
  return Math.max(...points.map((point) => Math.max(Math.abs(point.x), Math.abs(point.z)) + 1), 1);
}

/**
 * A world island grows with lesson count instead of inheriting the course
 * shot's large working footprint. The cell size stays in the same visual band
 * and the outline owns the difference between a small plateau and a highland.
 */
function estimateWorldHexSize(
  lessonCount: number,
  cells: readonly HexCoord[],
  expansion = 0,
): number {
  const targetHalfWidth = worldGridFootprintForLessons(lessonCount) + expansion * 0.16;
  return Math.max(0.42, targetHalfWidth / unitHalfExtent(cells));
}

function routeFromAnchors(
  anchors: readonly { readonly x: number; readonly z: number }[],
  hexSize: number,
  seed: string,
  allowedCells: readonly HexCoord[],
): HexCoord[] | null {
  if (anchors.length === 0 || allowedCells.length === 0) return null;
  const allowedKeys = new Set(allowedCells.map(hexKey));
  const nearestAllowed = (target: { readonly x: number; readonly z: number }): HexCoord | null =>
    [...allowedCells]
      .map((cell) => {
        const point = hexToWorld(cell, hexSize);
        return {
          cell,
          score:
            Math.hypot(point.x - target.x, point.z - target.z) * 1.1 +
            hash(`${seed}/route-start/${hexKey(cell)}`) * 0.02,
        };
      })
      .sort((first, second) => first.score - second.score)[0]?.cell ?? null;
  const end = nearestAllowed(anchors.at(-1)!);
  const start = nearestAllowed(anchors[0]!);
  if (!start || !end) return null;

  type RouteState = { readonly path: readonly HexCoord[]; readonly score: number };
  let beam: RouteState[] = [{ path: [start], score: 0 }];
  // Keep enough alternatives for a long switchback to preserve an endpoint
  // path after its early choices. Small islands still cap the work by their
  // own region size; the long-course region intentionally reaches 512.
  const beamWidth = Math.min(512, Math.max(24, allowedCells.length * 2));
  for (let index = 1; index < anchors.length; index += 1) {
    const target = anchors[index]!;
    const lookAhead = anchors[Math.min(index + 1, anchors.length - 1)]!;
    const remaining = anchors.length - 1 - index;
    const nextStates: RouteState[] = [];
    for (const state of beam) {
      const current = state.path.at(-1)!;
      const used = new Set(state.path.map(hexKey));
      const candidates = hexNeighbors(current).filter(
        (candidate) => allowedKeys.has(hexKey(candidate)) && !used.has(hexKey(candidate)),
      );
      for (const candidate of candidates) {
        const point = hexToWorld(candidate, hexSize);
        const distanceToEnd = hexDistance(candidate, end);
        // A state that cannot physically reach the far endpoint in the
        // remaining lesson steps cannot become a valid route. The small
        // detour allowance absorbs a jagged island edge; the final step still
        // has to land within a few cells of the far endpoint.
        if (distanceToEnd > remaining + 8) continue;
        nextStates.push({
          path: [...state.path, candidate],
          score:
            state.score +
            Math.hypot(point.x - target.x, point.z - target.z) * 1.25 +
            Math.hypot(point.x - lookAhead.x, point.z - lookAhead.z) * 0.16 +
            distanceToEnd * 0.045 +
            // Keep equal walks deterministic without making noise stronger
            // than the authored S-shaped guide.
            hash(`${seed}/route-tie/${index}/${hexKey(candidate)}`) * 0.01,
        });
      }
    }
    if (nextStates.length === 0) return null;
    nextStates.sort((first, second) => first.score - second.score);
    beam = nextStates.slice(0, beamWidth);
  }
  return beam[0]?.path.length === anchors.length ? [...beam[0].path] : null;
}

function fitRouteAnchorsToRegion(
  anchors: readonly { readonly x: number; readonly z: number }[],
  mainCells: readonly HexCoord[],
  hexSize: number,
): readonly { readonly x: number; readonly z: number }[] {
  if (anchors.length <= 1) return [{ x: 0, z: 0 }];
  const sourceBounds = anchors.reduce(
    (bounds, anchor) => ({
      minX: Math.min(bounds.minX, anchor.x),
      maxX: Math.max(bounds.maxX, anchor.x),
      minZ: Math.min(bounds.minZ, anchor.z),
      maxZ: Math.max(bounds.maxZ, anchor.z),
    }),
    { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
  );
  const regionBounds = mainCells.reduce(
    (bounds, cell) => {
      const point = hexToWorld(cell, hexSize);
      return {
        minX: Math.min(bounds.minX, point.x),
        maxX: Math.max(bounds.maxX, point.x),
        minZ: Math.min(bounds.minZ, point.z),
        maxZ: Math.max(bounds.maxZ, point.z),
      };
    },
    { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
  );
  const sourceCentre = {
    x: (sourceBounds.minX + sourceBounds.maxX) / 2,
    z: (sourceBounds.minZ + sourceBounds.maxZ) / 2,
  };
  const regionCentre = {
    x: (regionBounds.minX + regionBounds.maxX) / 2,
    z: (regionBounds.minZ + regionBounds.maxZ) / 2,
  };
  const sourceSpanX = Math.max(sourceBounds.maxX - sourceBounds.minX, 1e-6);
  const sourceSpanZ = Math.max(sourceBounds.maxZ - sourceBounds.minZ, 1e-6);
  const regionSpanX = Math.max(regionBounds.maxX - regionBounds.minX, hexSize);
  const regionSpanZ = Math.max(regionBounds.maxZ - regionBounds.minZ, hexSize);
  // Leave a real shoulder on both sides of the route. The long axis still
  // spans most of the island, while the independent land remains visible as
  // a place around the S-shaped walk.
  const scaleX = (regionSpanX * 0.72) / sourceSpanX;
  const scaleZ = (regionSpanZ * 0.78) / sourceSpanZ;
  const nearestCell = (point: { readonly x: number; readonly z: number }): HexCoord =>
    mainCells
      .map((cell) => {
        const cellPoint = hexToWorld(cell, hexSize);
        return {
          cell,
          distance: Math.hypot(cellPoint.x - point.x, cellPoint.z - point.z),
        };
      })
      .sort((first, second) => first.distance - second.distance)[0]!.cell;
  const base = anchors.map((anchor) => ({
    x: regionCentre.x + (anchor.x - sourceCentre.x) * scaleX,
    z: regionCentre.z + (anchor.z - sourceCentre.z) * scaleZ,
  }));
  const start = base[0]!;
  const end = base.at(-1)!;
  const endpointLength = Math.hypot(end.x - start.x, end.z - start.z);
  const lateral =
    endpointLength > 1e-6
      ? { x: -(end.z - start.z) / endpointLength, z: (end.x - start.x) / endpointLength }
      : { x: 1, z: 0 };
  const swayAmplitude = Math.min(regionSpanX, regionSpanZ) * 0.11;
  const sGuide = base.map((anchor, index) => {
    const t = index / (base.length - 1);
    // One broad positive-to-negative lateral sweep makes the route read as a
    // path through the place even when a small archetype happens to be nearly
    // straight after hex snapping. Endpoints stay fixed at opposite ends.
    const sway = Math.sin(Math.PI * 2 * t) * swayAmplitude;
    return { x: anchor.x + lateral.x * sway, z: anchor.z + lateral.z * sway };
  });
  // A three-lesson route cannot span the same visual fraction as a
  // forty-one-lesson route: two graph steps have a hard geometric ceiling.
  // Shrink the guide toward the region centre until its endpoint pair can be
  // joined in the available number of adjacent cells. This is a fit check,
  // not a route-shaped island growth rule.
  const maxSteps = anchors.length - 1;
  let scale = 1;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = sGuide.map((anchor) => ({
      x: regionCentre.x + (anchor.x - regionCentre.x) * scale,
      z: regionCentre.z + (anchor.z - regionCentre.z) * scale,
    }));
    if (hexDistance(nearestCell(candidate[0]!), nearestCell(candidate.at(-1)!)) <= maxSteps)
      return candidate;
    scale *= 0.82;
  }
  return sGuide.map((anchor) => ({
    x: regionCentre.x + (anchor.x - regionCentre.x) * scale,
    z: regionCentre.z + (anchor.z - regionCentre.z) * scale,
  }));
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
  unitBiomes: ReadonlyMap<string, GridBiome>,
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
  const plannedCells = elevationInputs.map(({ coord, kind }) => {
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
  const surfaceByKey = gridSurfacesForCells(plannedCells, unitBiomes, seed);
  const cells: GridCell[] = plannedCells.map((cell) => ({
    ...cell,
    surface: surfaceByKey.get(cell.key)!,
  }));
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
  const projection: CourseGridProjection = input.projection ?? "course";
  const footprintLessons = Math.max(1, Math.floor(input.footprintLessons ?? input.lessons.length));
  const anchors =
    input.routeAnchors?.length === input.lessons.length
      ? input.routeAnchors
      : fallbackAnchors(input.lessons.length, input.seed, input.routeArchetype);
  const outlineSeed = `${input.studyId}/${input.courseId}/${input.seed}`;
  const requestedTarget =
    projection === "world"
      ? worldGridTargetForLessons(footprintLessons)
      : Math.min(
          GRID_CELL_BUDGET - 4,
          Math.max(input.lessons.length + 7, Math.round(input.lessons.length * CELLS_PER_LESSON)),
        );
  const worldCellFloor =
    projection === "world" && input.worldCellFloor !== undefined
      ? Math.max(1, Math.floor(input.worldCellFloor))
      : 0;
  let outline: GridOutline | null = null;
  let route: HexCoord[] | null = null;
  let hexSize = 0;
  // The first pass grows a place without seeing the route. If a future route
  // shape cannot fit, the retry expands that place; it never compresses the
  // route to make a too-small island look valid.
  for (let expansion = 0; expansion < 4 && route === null; expansion += 1) {
    const target = Math.min(
      GRID_CELL_BUDGET - 4,
      Math.max(worldCellFloor, requestedTarget) +
        expansion * Math.max(4, Math.ceil(input.lessons.length * 0.12)),
    );
    outline = growGridOutline(outlineSeed, target);
    hexSize =
      projection === "world"
        ? estimateWorldHexSize(footprintLessons, [...outline.main, ...outline.detached], expansion)
        : estimateHexSize(input.lessons.length, outline.main.length, expansion);
    const fittedAnchors = fitRouteAnchorsToRegion(anchors, outline.main, hexSize);
    route = routeFromAnchors(fittedAnchors, hexSize, input.seed, outline.main);
  }
  if (outline === null || route === null) {
    throw new RangeError("Hex route could not fit inside the generated island");
  }
  const activeLessonIndex =
    input.activeLessonIndex ?? input.lessons.findIndex((lesson) => lesson.state === "live");
  const unitIds = [...new Set(input.lessons.map((lesson) => lesson.unitId))];
  const unitBiomes = gridBiomesForUnits(unitIds, input.seed);
  const projected = withElevation(
    outline,
    route,
    input.lessons,
    input.seed,
    activeLessonIndex,
    unitBiomes,
  );
  assertGridSurfaceContract(projected.cells);
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
    projection,
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
    projection,
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
    unitBiomes,
    palette,
    seamStrength: GRID_SEAM_STRENGTH,
    bounds: { minX, maxX, minZ, maxZ, halfX, halfZ, maxHalf: Math.max(halfX, halfZ) },
  };
}
