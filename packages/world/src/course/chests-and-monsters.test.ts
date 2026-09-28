import { describe, expect, it } from "vitest";

import { sampleIslandSurface } from "../island/island-blueprint.js";
import { distanceToIslandRoute } from "../island/island-route-geometry.js";
import type { LessonPlacement } from "../Maps.js";
import {
  BOSS_FOOTPRINT_RADIUS,
  CHEST_EDGE_SCALE,
  CHEST_FOOTPRINT_RADIUS,
  MONSTER_ROSTER,
  courseChests,
  courseMonsters,
  courseWeeklyBoss,
  lessonChestTier,
  monsterOrder,
  openingGuard,
} from "./chests-and-monsters.js";
import { COURSES, placements } from "./course-placements.fixture.js";
import {
  courseLearningSites,
  courseStandingFootprints,
  learningSiteExclusions,
  segmentsFromPlacements,
} from "./learning-sites.js";

/** Three lessons done, the fourth open now, everything after it locked. */
function withProgress(lessons: readonly LessonPlacement[], done = 3): LessonPlacement[] {
  return lessons.map((lesson, index) => ({
    ...lesson,
    state: index < done ? "done" : index === done ? "live" : "locked",
  }));
}

describe("chests and monsters", () => {
  for (const [studyId, courseId, units] of COURSES) {
    describe(`${studyId}/${courseId}`, () => {
      const lessons = withProgress(placements(studyId, courseId, units));
      const sites = courseLearningSites(lessons);
      const chests = courseChests(lessons, sites);
      const monsters = courseMonsters(lessons, sites);
      const blueprint = lessons[0]!.blueprint;

      it("puts one chest beside every lesson stone, tiered by where it stands", () => {
        const segments = segmentsFromPlacements(lessons);
        lessons.forEach((lesson, index) => {
          const own = chests.filter(
            (chest) => chest.owner.kind === "lesson" && chest.owner.lessonId === lesson.lessonId,
          );
          expect(own).toHaveLength(1);
          const endsSegment = segments.some(
            (segment) =>
              segment.unitId === lesson.unitId && segment.lessonIds.at(-1) === lesson.lessonId,
          );
          const expected =
            index === lessons.length - 1 ? "legendary" : endsSegment ? "rare" : "wood";
          expect(own[0]!.tier).toBe(expected);
          expect(lessonChestTier(lessons, index)).toBe(expected);
        });
      });

      it("gives the checkpoint and the challenge purple chests, and the board none", () => {
        for (const chest of chests.filter((entry) => entry.owner.kind !== "lesson"))
          expect(chest.tier).toBe("epic");
        const owners = new Set(
          chests.flatMap((chest) => (chest.owner.kind === "lesson" ? [] : [chest.owner.siteId])),
        );
        for (const site of sites.filter((entry) => entry.kind === "personal"))
          expect(owners.has(site.id)).toBe(false);
        const guarded = sites.filter((site) => site.resolved && site.kind !== "personal");
        // Measured on 2026-09-27: every resolved gate and pennant found ground for its chest.
        expect(guarded.every((site) => owners.has(site.id))).toBe(true);
      });

      it("derives each lesson chest's state from the learner's record", () => {
        for (const chest of chests) {
          if (chest.owner.kind !== "lesson") continue;
          const { lessonId } = chest.owner;
          const state = lessons.find((lesson) => lesson.lessonId === lessonId)!.state;
          expect(chest.state).toBe(
            state === "done" ? "open" : state === "live" ? "ready" : "closed",
          );
        }
        expect(chests.filter((chest) => chest.state === "ready")).toHaveLength(1);
      });

      it("stands every full-size chest on free verge: off the road, clear of everything", () => {
        // Off the road surface; the shoulder's grass edge is verge (see the planner).
        const clearance = blueprint.route.roadWidth / 2;
        const standing = courseStandingFootprints(blueprint);
        const nodes = learningSiteExclusions(sites);
        const full = chests.filter((chest) => chest.scale === 1);
        for (const chest of full) {
          const { x, z } = chest.position;
          expect(distanceToIslandRoute(blueprint, { x, z })).toBeGreaterThanOrEqual(
            clearance + CHEST_FOOTPRINT_RADIUS - 1e-6,
          );
          for (const o of standing)
            expect(Math.hypot(x - o.x, z - o.z)).toBeGreaterThan(o.r + CHEST_FOOTPRINT_RADIUS);
          for (const o of nodes)
            expect(Math.hypot(x - o.x, z - o.z)).toBeGreaterThan(o.radius + CHEST_FOOTPRINT_RADIUS);
          for (const lesson of lessons)
            expect(Math.hypot(x - lesson.position.x, z - lesson.position.z)).toBeGreaterThan(
              blueprint.route.nodeRadius + CHEST_FOOTPRINT_RADIUS,
            );
        }
        for (let a = 0; a < full.length; a += 1)
          for (let b = a + 1; b < full.length; b += 1)
            expect(
              full[a]!.position.distanceTo(full[b]!.position.clone().setY(full[a]!.position.y)),
            ).toBeGreaterThan(CHEST_FOOTPRINT_RADIUS * 2);
        // Hanging at the stone's edge is the exception, where dressing fills the
        // verge. Measured 2026-09-27: 5 of 36, 2 of 8 and 2 of 9 lessons.
        const edge = chests.filter((chest) => chest.scale === CHEST_EDGE_SCALE);
        expect(edge.length).toBeLessThanOrEqual(Math.ceil(lessons.length * 0.25));
      });

      it("jitters chests to both sides of the road", () => {
        const sides = new Set(
          chests
            .filter((chest) => chest.owner.kind === "lesson" && chest.scale === 1)
            .map((chest, index) => {
              const lesson = lessons[index]!;
              const next = lessons[index + 1] ?? lesson;
              const tx = next.position.x - lesson.position.x;
              const tz = next.position.z - lesson.position.z;
              const cross =
                tx * (chest.position.z - lesson.position.z) -
                tz * (chest.position.x - lesson.position.x);
              return Math.sign(cross);
            }),
        );
        expect(sides.size).toBe(2);
      });

      it("stands a monster on every locked stone and none where the learner can go", () => {
        for (const lesson of lessons) {
          const on = monsters.filter(
            (monster) =>
              monster.stop.kind === "lesson" && monster.stop.lessonId === lesson.lessonId,
          );
          expect(on).toHaveLength(lesson.state === "locked" ? 1 : 0);
        }
        const onLessons = monsters.filter((monster) => monster.stop.kind === "lesson");
        for (let index = 1; index < onLessons.length; index += 1)
          expect(onLessons[index]!.role).not.toBe(onLessons[index - 1]!.role);
        expect(new Set(onLessons.map((monster) => monster.role)).size).toBe(
          Math.min(MONSTER_ROSTER.length, onLessons.length),
        );
      });

      it("turns every monster toward the stop before it, so the learner meets it face to face", () => {
        lessons.forEach((lesson, index) => {
          const monster = monsters.find(
            (entry) => entry.stop.kind === "lesson" && entry.stop.lessonId === lesson.lessonId,
          );
          if (!monster) return;
          expect(monster.faces.equals(lessons[index - 1]!.position)).toBe(true);
        });
        for (const boss of monsters.filter((entry) => entry.boss)) {
          const site = sites.find(
            (entry) => boss.stop.kind === "gate" && entry.id === boss.stop.siteId,
          )!;
          const last = lessons.find(
            (lesson) =>
              lesson.unitId === site.segment.unitId &&
              lesson.lessonId === site.segment.lessonIds.at(-1),
          )!;
          expect(boss.faces.equals(last.position)).toBe(true);
        }
      });

      it("guards each uncleared segment's gate with one boss on free ground", () => {
        const bosses = monsters.filter((monster) => monster.boss);
        expect(bosses.every((boss) => boss.role === "boss" && boss.stop.kind === "gate")).toBe(
          true,
        );
        const clearance = blueprint.route.roadWidth / 2;
        for (const boss of bosses) {
          const { x, z } = boss.position;
          expect(distanceToIslandRoute(blueprint, { x, z })).toBeGreaterThanOrEqual(
            clearance + BOSS_FOOTPRINT_RADIUS - 1e-6,
          );
        }
        const gates = sites.filter((site) => site.kind === "checkpoint" && site.resolved);
        // The first segment is cleared only if all its lessons are done; with
        // three done, at most one gate can have lost its boss.
        expect(bosses.length).toBeGreaterThanOrEqual(gates.length - 1);
        expect(new Set(bosses.map((boss) => boss.id)).size).toBe(bosses.length);
      });

      it("opens a gate's chest and sends its boss away once the segment is cleared", () => {
        const all = withProgress(lessons, lessons.length);
        const cleared = courseChests(all, sites).filter(
          (chest) => chest.owner.kind === "checkpoint",
        );
        expect(cleared.every((chest) => chest.state === "open")).toBe(true);
        expect(courseMonsters(all, sites)).toHaveLength(0);
      });

      it("stands the weekly boss at the shore nearest the learner, off the road, clear of the rest", () => {
        const weekly = courseWeeklyBoss(lessons, sites, "2026-09-28");
        expect(weekly).not.toBeNull();
        const { x, z } = weekly!.position;
        expect(weekly!.stop).toEqual({ kind: "weekly", week: "2026-09-28" });
        expect(sampleIslandSurface(blueprint, x, z).radial).toBeGreaterThan(0.5);
        expect(distanceToIslandRoute(blueprint, { x, z })).toBeGreaterThanOrEqual(
          blueprint.route.roadWidth / 2 + BOSS_FOOTPRINT_RADIUS - 1e-6,
        );
        for (const chest of chests)
          expect(Math.hypot(chest.position.x - x, chest.position.z - z)).toBeGreaterThan(
            CHEST_FOOTPRINT_RADIUS * chest.scale + BOSS_FOOTPRINT_RADIUS,
          );
        for (const boss of monsters.filter((entry) => entry.boss))
          expect(Math.hypot(boss.position.x - x, boss.position.z - z)).toBeGreaterThan(
            BOSS_FOOTPRINT_RADIUS * 2,
          );
        // Nearer the stone the learner is on than any other shore spot would be.
        const here = lessons.find((lesson) => lesson.state !== "done")!.position;
        const elsewhere = courseWeeklyBoss(withProgress(lessons, lessons.length - 1), sites, "w")!;
        expect(Math.hypot(here.x - x, here.z - z)).toBeLessThanOrEqual(
          Math.hypot(here.x - elsewhere.position.x, here.z - elsewhere.position.z) + 1e-6,
        );
        // It faces inland.
        const inland = weekly!.faces.clone().sub(weekly!.position);
        expect(inland.x * -x + inland.z * -z).toBeGreaterThan(0);
        // Planned last: adding it moved no chest.
        expect(courseChests(lessons, sites).map((chest) => chest.position.toArray())).toEqual(
          chests.map((chest) => chest.position.toArray()),
        );
      });
    });
  }

  it("sends a finished lesson's star at the next stone's monster, or at the gate's boss", () => {
    for (const [studyId, courseId, units] of COURSES) {
      const lessons = withProgress(placements(studyId, courseId, units), 1);
      const sites = courseLearningSites(lessons);
      const before = withProgress(lessons, 0);
      // Lesson 1 just finished: the monster that stood on lesson 2 is the one chased.
      const standing = courseMonsters(before, sites).find(
        (monster) =>
          monster.stop.kind === "lesson" && monster.stop.lessonId === lessons[1]!.lessonId,
      );
      const gateAfterFirst = sites.find(
        (site) =>
          site.kind === "checkpoint" &&
          site.resolved &&
          site.segment.lessonIds.at(-1) === lessons[0]!.lessonId,
      );
      const guard = openingGuard(lessons, 0);
      if (gateAfterFirst)
        expect(guard).toEqual({ stop: { siteId: gateAfterFirst.id }, role: "boss" });
      else
        expect(guard).toEqual({ stop: { lessonId: lessons[1]!.lessonId }, role: standing!.role });
      // A next stone already done has nobody on it.
      const redone = withProgress(lessons, lessons.length);
      const last = redone.length - 1;
      const lastGate = sites.some(
        (site) =>
          site.kind === "checkpoint" &&
          site.resolved &&
          site.segment.lessonIds.at(-1) === redone[0]!.lessonId,
      );
      if (!lastGate) expect(openingGuard(redone, 0)).toBeNull();
      expect(openingGuard(redone, last + 1)).toBeNull();
    }
  });

  it("keeps each course's fear order stable and complete", () => {
    const order = monsterOrder("understanding-ai");
    expect(order).toEqual(monsterOrder("understanding-ai"));
    expect([...order].sort()).toEqual([...MONSTER_ROSTER].sort());
  });
});
