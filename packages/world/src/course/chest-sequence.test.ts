import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { courseMonsters } from "./chests-and-monsters.js";
import { guardedLessons, isGuardedPlacement, starTarget } from "./chest-sequence.js";
import { COURSES, placements } from "./course-placements.fixture.js";
import { courseLearningSites, segmentsFromPlacements } from "./learning-sites.js";
import { STAR_FLIGHT, STAR_GAP, STAR_RISE, throwSchedule } from "./StarThrow.js";

/** The first three lessons done: the learner just finished the third. */
function afterThird() {
  const [studyId, courseId, units] = COURSES[0];
  return placements(studyId, courseId, units).map((lesson, index) => ({
    ...lesson,
    state: index < 3 ? ("done" as const) : index === 3 ? ("live" as const) : ("locked" as const),
  }));
}

describe("the star-throw sequence", () => {
  it("keeps the next lesson's monster standing until the star has chased it", () => {
    const lessons = afterThird();
    const sites = courseLearningSites(lessons);
    const next = lessons[3]!.lessonId;
    const guard = { lessonId: next };
    expect(courseMonsters(lessons, sites).some((m) => m.id === `monster:lesson:${next}`)).toBe(
      false,
    );
    const guarded = courseMonsters(guardedLessons(lessons, lessons[2]!.lessonId, guard), sites);
    const target = guarded.find((m) => m.id === `monster:lesson:${next}`);
    expect(target).toBeDefined();
    expect(isGuardedPlacement({ monster: target!, at: target!.position }, guard)).toBe(true);
    // Nothing else about the island moves.
    expect(guardedLessons(lessons, lessons[2]!.lessonId, null)).toBe(lessons);
  });

  it("brings back the boss the finished segment's last lesson just cleared", () => {
    const lessons = afterThird();
    const sites = courseLearningSites(lessons);
    const first = segmentsFromPlacements(lessons)[0]!;
    const everyDone = lessons.map((lesson) =>
      first.lessonIds.includes(lesson.lessonId) ? { ...lesson, state: "done" as const } : lesson,
    );
    const gate = sites.find((site) => site.kind === "checkpoint" && site.segment.id === first.id)!;
    expect(
      courseMonsters(everyDone, sites).some(
        (m) => m.boss && m.stop.kind === "gate" && m.stop.siteId === gate.id,
      ),
    ).toBe(false);
    const guarded = courseMonsters(
      guardedLessons(everyDone, first.lessonIds.at(-1)!, { siteId: gate.id }),
      sites,
    );
    const boss = guarded.find((m) => m.boss && m.stop.kind === "gate" && m.stop.siteId === gate.id);
    expect(boss).toBeDefined();
    expect(starTarget({ monster: boss!, at: boss!.position }).y).toBeGreaterThan(boss!.position.y);
  });

  it("throws one star at a monster and three at a boss, one after another", () => {
    expect(throwSchedule(1)).toEqual([{ release: STAR_RISE, impact: STAR_RISE + STAR_FLIGHT }]);
    const boss = throwSchedule(3);
    expect(boss).toHaveLength(3);
    expect(boss[2]!.release - boss[0]!.release).toBeCloseTo(STAR_GAP * 2, 6);
    for (const star of boss) expect(star.impact).toBeGreaterThan(star.release);
  });

  it("aims at the middle of the monster", () => {
    const lessons = afterThird();
    const sites = courseLearningSites(lessons);
    const monster = courseMonsters(lessons, sites)[0]!;
    const at = new THREE.Vector3(1, 2, 3);
    expect(starTarget({ monster, at }).y).toBeGreaterThan(2.3);
  });
});
