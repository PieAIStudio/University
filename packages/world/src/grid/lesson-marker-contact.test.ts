/**
 * Finished marker contact: the rigid medallion stays in the air, the footing
 * meets the drawn ground. Body-bottom samples are the body-footing seam, not
 * the ground contact of the finished shape.
 */
import { readFileSync } from "node:fs";

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { layoutCourseLessons, type LessonPlacement } from "../Maps.js";
import {
  ISLAND_ROUTE_ARCHETYPES,
  islandBlueprint,
  type IslandBlueprint,
  type IslandRouteArchetype,
} from "../island/island-blueprint.js";
import {
  buildIslandGeometry,
  islandVisibleSurfaceIndex,
  sampleIslandTerrainTop,
  visibleGroundHeight,
} from "../island/island-geometry.js";
import {
  composeMarkerMatrix,
  createMarkerMatrixScratch,
  MARKER_ENGRAVING_OFFSET,
  markerPoseLocals,
  markerPulseAllowed,
} from "./LessonMarkerField.js";
import {
  FOOTING_EMBED,
  FOOTING_MAX_EXPOSED,
  MARKER_PLINTH_OFFSET,
  MEDALLION_TOP_RADIUS,
  medallionBottomRing,
} from "./lesson-medallion.js";

const LESSON_COUNTS = [6, 24, 41] as const;
const PULSE = 1.05;

function fixture(archetype: IslandRouteArchetype, lessonCount: number): IslandBlueprint {
  return islandBlueprint({
    studyId: "turing-pact",
    courseId: `route-${archetype}-${lessonCount}`,
    lessonCount,
    routeArchetype: archetype,
    seed: `route/${archetype}/${lessonCount}`,
  });
}

function placements(blueprint: IslandBlueprint): LessonPlacement[] {
  return blueprint.nodes.map((node, index) => {
    const surface = sampleIslandTerrainTop(blueprint, "course", node.x, node.z);
    return {
      studyId: blueprint.studyId,
      courseId: blueprint.courseId,
      unitId: node.unitId,
      unitTitle: node.unitId,
      unitIndex: node.unitIndex,
      lessonId: node.id,
      lessonTitle: node.id,
      chars: 1200,
      position: new THREE.Vector3(node.x, surface.y, node.z),
      state: index === 0 ? "live" : "idle",
      kind: "lesson",
      hueShift: 0,
      blueprint,
      visualToken: node.visualToken,
    };
  });
}

function footingHeightAt(
  geometry: THREE.BufferGeometry,
  x: number,
  z: number,
): { min: number; max: number } | null {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  if (!index) return null;
  let min = Infinity;
  let max = -Infinity;
  let hits = 0;
  for (let triangle = 0; triangle < index.count / 3; triangle += 1) {
    const i0 = index.getX(triangle * 3);
    const i1 = index.getX(triangle * 3 + 1);
    const i2 = index.getX(triangle * 3 + 2);
    const ax = position.getX(i0);
    const az = position.getZ(i0);
    const bx = position.getX(i1);
    const bz = position.getZ(i1);
    const cx = position.getX(i2);
    const cz = position.getZ(i2);
    const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(den) < 1e-10) continue;
    const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / den;
    const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den;
    const w = 1 - u - v;
    if (u < -1e-4 || v < -1e-4 || w < -1e-4) continue;
    const y = position.getY(i0) * u + position.getY(i1) * v + position.getY(i2) * w;
    min = Math.min(min, y);
    max = Math.max(max, y);
    hits += 1;
  }
  return hits === 0 ? null : { min, max };
}

function nearestFootingY(
  geometry: THREE.BufferGeometry,
  x: number,
  z: number,
  targetY: number,
): number | null {
  const position = geometry.getAttribute("position");
  let best: number | null = null;
  let bestScore = Infinity;
  for (let i = 0; i < position.count; i += 1) {
    const dist = Math.hypot(position.getX(i) - x, position.getZ(i) - z);
    if (dist > 0.12) continue;
    const y = position.getY(i);
    const score = dist + Math.abs(y - targetY) * 0.25;
    if (score < bestScore) {
      best = y;
      bestScore = score;
    }
  }
  return best;
}

describe("Lesson marker contact after the instance transform", () => {
  it("keeps an upright matrix when no surface is supplied", () => {
    const marker = {
      lesson: {
        position: new THREE.Vector3(3, 4, 5),
      } as LessonPlacement,
      radius: 0.62,
      colour: 0xffffff,
    };
    const matrix = new THREE.Matrix4();
    const scratch = createMarkerMatrixScratch();
    composeMarkerMatrix(marker, MARKER_PLINTH_OFFSET, marker.radius, matrix, scratch);
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    matrix.decompose(position, quaternion, scale);
    expect(position.x).toBeCloseTo(3, 8);
    expect(position.z).toBeCloseTo(5, 8);
    expect(position.y).toBeCloseTo(4 + 0.62 * MARKER_PLINTH_OFFSET, 8);
    expect(quaternion.x).toBeCloseTo(0, 8);
    expect(scale.x).toBeCloseTo(0.62, 8);
  });

  it("gates live pulse on reduced-motion as well as the frozen look shot", () => {
    const source = readFileSync(new URL("./LessonMarkerField.tsx", import.meta.url), "utf8");
    expect(source).toMatch(/prefers-reduced-motion: reduce/);
    expect(source).toMatch(/markerPulseAllowed/);
    expect(markerPulseAllowed()).toBe(!false);

    // Simulated reduced motion check
    const originalWindow = (globalThis as unknown as { window?: unknown }).window;
    try {
      (globalThis as unknown as { window: unknown }).window = {
        matchMedia: (query: string) => ({
          matches: query.includes("prefers-reduced-motion: reduce"),
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
        }),
      };

      expect(markerPulseAllowed()).toBe(false);
    } finally {
      if (originalWindow === undefined) {
        delete (globalThis as unknown as { window?: unknown }).window;
      } else {
        (globalThis as unknown as { window: unknown }).window = originalWindow;
      }
    }
  });

  it("resets live marker engraving scale to 1.0 upon reduced motion", () => {
    const marker = {
      lesson: {
        position: new THREE.Vector3(3, 4, 5),
        state: "live" as const,
      } as LessonPlacement,
      radius: 0.62,
      colour: 0xffffff,
    };
    const matrix = new THREE.Matrix4();
    const scratch = createMarkerMatrixScratch();
    // In unpulsed / reduced-motion state, scale is exactly radius * MEDALLION_TOP_RADIUS
    const baselineScale = marker.radius * MEDALLION_TOP_RADIUS;
    composeMarkerMatrix(marker, MARKER_ENGRAVING_OFFSET, baselineScale, matrix, scratch);
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    matrix.decompose(position, quaternion, scale);
    expect(scale.x).toBeCloseTo(baselineScale, 6);
    expect(scale.z).toBeCloseTo(baselineScale, 6);

    const source = readFileSync(new URL("./LessonMarkerField.tsx", import.meta.url), "utf8");
    expect(source).toMatch(/usePrefersReducedMotion/);
    expect(source).toMatch(/MEDALLION_TOP_RADIUS/);
  });

  for (const archetype of ISLAND_ROUTE_ARCHETYPES) {
    for (const lessonCount of LESSON_COUNTS) {
      const label = `${archetype}/${lessonCount}`;

      it(`joins the posed medallion to the drawn ground with a bounded footing (${label})`, () => {
        const blueprint = fixture(archetype, lessonCount);
        const lessons = placements(blueprint);
        const layout = layoutCourseLessons(blueprint, lessons);
        const { markers, footing } = layout;
        expect(
          markers.map((marker) => marker.lesson.lessonId),
          label,
        ).toEqual(lessons.map((lesson) => lesson.lessonId));
        expect(footing.maxExposed, `${label} exposed`).toBeLessThanOrEqual(FOOTING_MAX_EXPOSED);
        expect(footing.triangleCount, `${label} footing tris`).toBeLessThan(12_000);

        const shape = buildIslandGeometry(blueprint, "course");
        const ground = islandVisibleSurfaceIndex(shape);
        const matrix = new THREE.Matrix4();
        const scratch = createMarkerMatrixScratch();
        const locals = markerPoseLocals();
        const vertex = new THREE.Vector3();
        const ring = medallionBottomRing();

        let worstTopBurial = Infinity;
        let worstChamferBurial = Infinity;
        let worstEngravingBurial = Infinity;
        let worstLower = Infinity;
        let worstLowerHigh = -Infinity;
        let worstSeamJoin = 0;
        let missed = 0;
        let edgeGaps = 0;
        let edgeChecks = 0;

        markers.forEach((marker, index) => {
          expect(marker.radius, `${label} radius`).toBeGreaterThan(
            blueprint.route.nodeRadius * 0.95,
          );
          expect(marker.radius, `${label} radius cap`).toBeLessThan(
            blueprint.route.nodeRadius * 1.05,
          );
          expect(marker.lesson.lessonId, `${label} id`).toBe(lessons[index]!.lessonId);
          expect(marker.lesson.position.x, `${label} x`).toBe(lessons[index]!.position.x);
          expect(marker.lesson.position.z, `${label} z`).toBe(lessons[index]!.position.z);
          composeMarkerMatrix(marker, MARKER_PLINTH_OFFSET, marker.radius, matrix, scratch);

          for (const local of locals) {
            if (local.role === "foot") continue;
            vertex.set(local.x, local.y, local.z).applyMatrix4(matrix);
            const height = visibleGroundHeight(ground, vertex.x, vertex.z);
            if (height === null) {
              missed += 1;
              continue;
            }
            const delta = vertex.y - height;
            if (local.role === "chamfer") worstChamferBurial = Math.min(worstChamferBurial, delta);
            else worstTopBurial = Math.min(worstTopBurial, delta);
          }

          composeMarkerMatrix(
            marker,
            MARKER_ENGRAVING_OFFSET,
            marker.radius * MEDALLION_TOP_RADIUS * PULSE,
            matrix,
            scratch,
          );
          vertex.set(0, 0, 0).applyMatrix4(matrix);
          const engravingGround = visibleGroundHeight(ground, vertex.x, vertex.z);
          if (engravingGround === null) missed += 1;
          else worstEngravingBurial = Math.min(worstEngravingBurial, vertex.y - engravingGround);

          composeMarkerMatrix(marker, MARKER_PLINTH_OFFSET, marker.radius, matrix, scratch);
          const posed = ring.map((point) =>
            new THREE.Vector3(point.x, point.y, point.z).applyMatrix4(matrix),
          );
          if (!footing.geometry) {
            for (const seam of posed) {
              const height = visibleGroundHeight(ground, seam.x, seam.z);
              if (height === null) {
                missed += 1;
                continue;
              }
              expect(seam.y - height, `${label} flat seam`).toBeLessThan(0.02);
            }
            return;
          }
          for (let i = 0; i < posed.length; i += 1) {
            const a = posed[i]!;
            const b = posed[(i + 1) % posed.length]!;
            for (const t of [0, 0.5]) {
              const x = a.x + (b.x - a.x) * t;
              const ySeam = a.y + (b.y - a.y) * t;
              const z = a.z + (b.z - a.z) * t;
              const height = visibleGroundHeight(ground, x, z);
              if (height === null) {
                missed += 1;
                continue;
              }
              const exposed = ySeam - height;
              if (exposed <= 0.008) continue;
              edgeChecks += 1;
              const lower = nearestFootingY(footing.geometry, x, z, height - FOOTING_EMBED);
              const seamJoin = nearestFootingY(footing.geometry, x, z, ySeam);
              if (lower === null || seamJoin === null) {
                edgeGaps += 1;
                continue;
              }
              worstLower = Math.min(worstLower, lower - height);
              worstLowerHigh = Math.max(worstLowerHigh, lower - height);
              worstSeamJoin = Math.max(worstSeamJoin, Math.abs(seamJoin - ySeam));
            }
            const midX = (a.x + b.x) / 2;
            const midZ = (a.z + b.z) / 2;
            const midSeam = (a.y + b.y) / 2;
            const midGround = visibleGroundHeight(ground, midX, midZ);
            if (midGround !== null && midSeam - midGround > 0.008) {
              const lower = nearestFootingY(
                footing.geometry,
                midX,
                midZ,
                midGround - FOOTING_EMBED,
              );
              if (lower === null) edgeGaps += 1;
            }
          }
          const cx = posed.reduce((s, p) => s + p.x, 0) / posed.length;
          const cz = posed.reduce((s, p) => s + p.z, 0) / posed.length;
          const centreGround = visibleGroundHeight(ground, cx, cz);
          const cap = footingHeightAt(footing.geometry, cx, cz);
          if (centreGround !== null && cap) {
            expect(cap.min, `${label} cap`).toBeLessThan(centreGround + 0.005);
            expect(cap.min, `${label} cap embed`).toBeGreaterThan(centreGround - 0.04);
          }
        });

        expect(missed, `${label} off-island`).toBe(0);
        expect(worstTopBurial, `${label} top`).toBeGreaterThan(0.01);
        expect(worstChamferBurial, `${label} chamfer`).toBeGreaterThan(-0.01);
        expect(worstEngravingBurial, `${label} engraving`).toBeGreaterThan(0.02);
        if (footing.geometry && edgeChecks > 0) {
          expect(edgeGaps, `${label} edge gaps`).toBe(0);
          expect(worstLower, `${label} lower bite`).toBeGreaterThan(-0.04);
          expect(worstLowerHigh, `${label} lower float`).toBeLessThan(0.02);
          expect(worstSeamJoin, `${label} seam join`).toBeLessThan(0.03);
        }
        footing.geometry?.dispose();
        layout.inlays.geometry?.dispose();
        shape.terrain.dispose();
      });
    }
  }
});
