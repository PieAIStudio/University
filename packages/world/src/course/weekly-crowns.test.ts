import { describe, expect, it } from "vitest";
import type { WeeklyBossWin } from "@pieai/university-core";
import { COURSES, placements } from "./course-placements.fixture.js";
import { weeklyCrownPlacements, WEEKLY_CROWN_LIMIT } from "./weekly-crowns.js";
import { COSMETIC_ORNAMENT_RADIUS, cosmeticOrnamentGeometry } from "./cosmetic-ornament.js";
import { createIslandHeightSampler } from "../island/island-geometry.js";
import { distanceToIslandRoute } from "../island/island-route-geometry.js";
import {
  COURSE_WEEKLY_CROWN_COUNT_CEILING,
  COURSE_WEEKLY_CROWN_TRIANGLE_CEILING,
} from "../island/island-technique-lock.js";

it("uses one low-cost geometry for at most eight crowns", () => {
  const geometry = cosmeticOrnamentGeometry("island-crown");
  expect((geometry.getAttribute("position").count / 3) * WEEKLY_CROWN_LIMIT).toBeLessThanOrEqual(
    COURSE_WEEKLY_CROWN_TRIANGLE_CEILING,
  );
  expect(WEEKLY_CROWN_LIMIT).toBeLessThanOrEqual(COURSE_WEEKLY_CROWN_COUNT_CEILING);
  expect(geometry.groups).toHaveLength(0);
  geometry.dispose();
});

describe("historical crowns use recorded places and safe ground", () => {
  for (const [studyId, courseId, units] of COURSES)
    it(`${studyId}/${courseId}`, () => {
      const lessons = placements(studyId, courseId, units),
        blueprint = lessons[0]!.blueprint;
      const history: WeeklyBossWin[] = Array.from({ length: 12 }, (_, index) => ({
        week: new Date(Date.UTC(2026, 8, 28 - index * 7)).toISOString().slice(0, 10),
        flawless: false,
        location: { studyId, courseId, lessonId: lessons[0]!.lessonId },
      }));
      const before = JSON.stringify(blueprint);
      const spots = weeklyCrownPlacements(lessons, history);
      expect(spots.length).toBeGreaterThan(0);
      expect(spots.length).toBeLessThanOrEqual(WEEKLY_CROWN_LIMIT);
      expect(
        weeklyCrownPlacements(
          lessons.map((lesson) => ({ ...lesson, state: "done" })),
          history,
        ),
      ).toBe(spots);
      expect(JSON.stringify(blueprint)).toBe(before);
      const ground = createIslandHeightSampler(blueprint);
      try {
        for (const [index, spot] of spots.entries()) {
          expect(ground.heightAt(spot.at.x, spot.at.z).inside).toBe(true);
          expect(spot.at.y).toBeCloseTo(ground.heightAt(spot.at.x, spot.at.z).y, 6);
          expect(distanceToIslandRoute(blueprint, spot.at)).toBeGreaterThanOrEqual(
            blueprint.route.roadWidth / 2 + COSMETIC_ORNAMENT_RADIUS + 0.12,
          );
          for (const other of spots.slice(index + 1))
            expect(spot.at.distanceTo(other.at)).toBeGreaterThanOrEqual(
              2 * COSMETIC_ORNAMENT_RADIUS + 0.12,
            );
        }
      } finally {
        ground.dispose();
      }
      expect(weeklyCrownPlacements(lessons, history, [{ x: 0, z: 0, radius: 1000 }])).toEqual([]);
      expect(weeklyCrownPlacements(lessons, [{ ...history[0]!, location: null }])).toEqual([]);
      expect(
        weeklyCrownPlacements(lessons, [
          {
            ...history[0]!,
            location: { studyId: "other", courseId, lessonId: lessons[0]!.lessonId },
          },
        ]),
      ).toEqual([]);
      expect(
        weeklyCrownPlacements(lessons, [
          { ...history[0]!, location: { studyId, courseId, lessonId: "retired" } },
        ]),
      ).toEqual([]);
    });
});
