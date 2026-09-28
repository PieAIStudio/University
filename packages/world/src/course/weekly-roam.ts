import * as THREE from "three";

import { sampleIslandSurface, type IslandBlueprint } from "../island/island-blueprint.js";
import { createIslandHeightSampler } from "../island/island-geometry.js";
import { BOSS_FOOTPRINT_RADIUS, BOSS_HEIGHT, type CourseMonster } from "./chests-and-monsters.js";

/**
 * The weekly boss roams (Owner, 2026-09-28): 「平时游荡……在这个林里面漫步来回走，
 * 只要他不掉下去，有一个范围就行」. Movement is what makes it read as the week's
 * event rather than another guard, so it drifts out from where it came ashore
 * and back, resting between legs.
 *
 * The legs are planned once from the island as it stands — the stones, the
 * trees and tents, the chests and the vignettes — and never reserve ground of
 * their own, so nothing else on the island moves because a boss came.
 */

/** How far one leg reaches from home, in blueprint units; shorter legs are dropped. */
const REACH: readonly [number, number] = [1.1, 2.6];
const DIRECTIONS = 10;
/** Spacing of a leg's points: the boss walks between them. */
export const ROAM_STEP = 0.2;
/** Legs stay this far inside the island's edge (0 centre, 1 shore). */
const INLAND = 0.9;
/** Units per second; unhurried, so it reads as wandering. */
export const ROAM_SPEED = 0.55;
/** Seconds it rests at each end of a leg. */
export const ROAM_REST: readonly [number, number] = [2.5, 6];

export interface RoamObstacle {
  readonly x: number;
  readonly z: number;
  readonly r: number;
}

/** Legs out from home, each a polyline on the ground; it walks one out and back, then another. */
export interface WeeklyRoam {
  readonly legs: readonly (readonly THREE.Vector3[])[];
}

export function planWeeklyRoam(
  blueprint: IslandBlueprint,
  boss: CourseMonster,
  obstacles: readonly RoamObstacle[],
): WeeklyRoam {
  const home = boss.position;
  // It flies: it needs room for its body, not a landing pad, but it must not graze a tree.
  const clearance = BOSS_FOOTPRINT_RADIUS;
  const blocked = (x: number, z: number) =>
    sampleIslandSurface(blueprint, x, z).radial > INLAND ||
    obstacles.some((item) => Math.hypot(item.x - x, item.z - z) < item.r + clearance);
  const ground = createIslandHeightSampler(blueprint);
  try {
    const legs: THREE.Vector3[][] = [];
    for (let index = 0; index < DIRECTIONS; index += 1) {
      const angle = (index / DIRECTIONS) * Math.PI * 2;
      const dx = Math.cos(angle);
      const dz = Math.sin(angle);
      const leg: THREE.Vector3[] = [home.clone()];
      for (let along = ROAM_STEP; along <= REACH[1] + 1e-6; along += ROAM_STEP) {
        const x = home.x + dx * along;
        const z = home.z + dz * along;
        if (blocked(x, z)) break;
        leg.push(new THREE.Vector3(x, ground.heightAt(x, z).y, z));
      }
      if ((leg.length - 1) * ROAM_STEP >= REACH[0]) legs.push(leg);
    }
    return { legs };
  } finally {
    ground.dispose();
  }
}

/**
 * Where the weekly boss is now, shared by everything that follows it: the
 * scene moves it, and its crown chip, the stars thrown at it, the camera and
 * the chest it drops all read it. One per week and landing spot; a new spot
 * (the learner moved on) starts it over at home.
 */
export interface WeeklyAnchor {
  readonly at: THREE.Vector3;
  /** Over its head, where the DOM chip hangs. */
  readonly chip: THREE.Vector3;
}

const anchors = new Map<string, { readonly home: string; readonly anchor: WeeklyAnchor }>();
const chipLift = (boss: CourseMonster) => BOSS_HEIGHT * (boss.size ?? 1) + 0.35;

export function weeklyBossAnchor(boss: CourseMonster): WeeklyAnchor {
  const week = boss.stop.kind === "weekly" ? boss.stop.week : boss.id;
  const home = `${boss.position.x.toFixed(3)},${boss.position.z.toFixed(3)}`;
  const known = anchors.get(week);
  if (known && known.home === home) return known.anchor;
  const at = boss.position.clone();
  const anchor = { at, chip: at.clone().setY(at.y + chipLift(boss)) };
  anchors.set(week, { home, anchor });
  return anchor;
}

export function moveWeeklyAnchor(anchor: WeeklyAnchor, to: THREE.Vector3, boss: CourseMonster) {
  anchor.at.copy(to);
  anchor.chip.copy(to).setY(to.y + chipLift(boss));
}
