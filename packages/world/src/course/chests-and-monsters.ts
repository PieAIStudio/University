import { Vector3 } from "three";

import { hash } from "../island/random.js";
import { sampleIslandSurface, type IslandBlueprint } from "../island/island-blueprint.js";
import { createIslandHeightSampler } from "../island/island-geometry.js";
import { distanceToIslandRoute } from "../island/island-route-geometry.js";
import type { LessonPlacement } from "../Maps.js";
import {
  courseLearningSites,
  courseStandingFootprints,
  learningSiteExclusions,
  learningSiteLocked,
  MAX_SLOPE_RISE,
  segmentsFromPlacements,
  type LearningSite,
} from "./learning-sites.js";

/**
 * What stands beside and on the lesson stones in V7 (station 3): a chest
 * beside every stone, and a monster on every stone the learner cannot enter
 * yet, each one named after a beginner's fear. The segment's end is guarded by
 * a crowned boss beside its gate.
 *
 * Placement follows the learning nodes' rule (learning-sites.ts): search
 * outward for ground that is actually free, never move a tree, rock, landmark
 * or path. A chest that finds no free ground hangs at its stone's edge, drawn
 * smaller (V7: 「找不到空地的那一关，箱子就挂在垫石边上缩小一点」); a boss that
 * finds none is not drawn, the meadow-bed rule.
 *
 * Nothing here is stored. Tier comes from where a chest stands, state from the
 * learner's record, and the all-correct upgrade (task 02) is applied when a
 * chest opens, never written back.
 */

export type ChestTier = "wood" | "rare" | "epic" | "legendary";
/** Least to most rare. */
export const CHEST_TIERS: readonly ChestTier[] = ["wood", "rare", "epic", "legendary"];
/** closed: nothing to take yet. ready: the lesson you can take now. open: taken. */
export type ChestState = "closed" | "ready" | "open";

export type MonsterRole = "frog" | "crab" | "yeti" | "boar" | "mushroom" | "chicken" | "boss";
/** The six ordinary fears; the boss is placed separately. */
export const MONSTER_ROSTER: readonly Exclude<MonsterRole, "boss">[] = [
  "frog",
  "crab",
  "yeti",
  "boar",
  "mushroom",
  "chicken",
];

/** An ordinary monster is about three fifths of the learner's 1.8 (world units). */
export const MONSTER_HEIGHT = 1.05;
/** The boss stands taller than the learner. */
export const BOSS_HEIGHT = 1.95;
/** Per-kind height, so a wide crab and a tall yeti read as the same size of thing. */
export const MONSTER_ROLE_HEIGHT: Readonly<Record<MonsterRole, number>> = {
  frog: 1,
  crab: 0.72,
  yeti: 1.05,
  boar: 0.82,
  mushroom: 1.05,
  chicken: 0.95,
  boss: 1,
};
/** The tallest ordinary monster, in world units: what a label over a locked stone clears. */
export const MONSTER_TALLEST =
  MONSTER_HEIGHT * Math.max(...MONSTER_ROSTER.map((role) => MONSTER_ROLE_HEIGHT[role]));

export type ChestOwner =
  | { readonly kind: "lesson"; readonly lessonId: string }
  | { readonly kind: "checkpoint" | "challenge"; readonly siteId: string }
  /** The chest the weekly boss drops where it stood when it runs. */
  | { readonly kind: "weekly"; readonly week: string };

export interface CourseChest {
  readonly id: string;
  readonly owner: ChestOwner;
  readonly tier: ChestTier;
  readonly state: ChestState;
  /** Ground point in blueprint space; y is the drawn terrain height. */
  readonly position: Vector3;
  /** Heading of the chest's front (+z), turned toward what it belongs to. */
  readonly yaw: number;
  /** 1 on free verge; CHEST_EDGE_SCALE when it hangs at its stone's edge. */
  readonly scale: number;
}

export type MonsterStop =
  | { readonly kind: "lesson"; readonly lessonId: string }
  | { readonly kind: "pad"; readonly siteId: string }
  | { readonly kind: "gate"; readonly siteId: string }
  /** The weekly boss (V7 mechanic 8), at the shore rather than at a stop; `week` is its Monday. */
  | { readonly kind: "weekly"; readonly week: string };

export interface CourseMonster {
  readonly id: string;
  readonly role: MonsterRole;
  readonly boss: boolean;
  readonly stop: MonsterStop;
  /**
   * Where it stands. For a lesson or a pad this is the stop's own point (the
   * renderer lifts it onto the stone); for the boss, free ground beside the gate.
   */
  readonly position: Vector3;
  /**
   * The point it faces while the learner is away: the stop before it on the
   * road, so a learner arriving there meets it face to face (Owner,
   * 2026-09-27). A pad's monster faces the lesson its stones lead back to; the
   * boss faces the segment's last lesson.
   */
  readonly faces: Vector3;
  /** Drawn this many times its role's height; only the weekly boss is not 1. */
  readonly size?: number;
}

/**
 * The weekly boss is the gate boss 20% larger and gilded, and it roams (Owner,
 * 2026-09-28: 「都要大 20%……凸显它不一样」): one size, so every week's boss,
 * whatever model it is drawn from later, reads as the same kind of thing. It
 * flies, so the ground it needs is a landing spot of a gate boss's size; it was
 * once searched at its drawn size, and a crowded shore then held no boss at all.
 */
export const WEEKLY_BOSS_SIZE = 1.2;

/** Ground a chest needs around its centre, in blueprint units (a lesson stone is 0.62). */
export const CHEST_FOOTPRINT_RADIUS = 0.48;
/**
 * Rarer chests are bigger, each tier 20% larger than the one below (Owner,
 * 2026-09-28: 「好牛逼的宝箱就得大一点……按 20% 递增」). A ratio, not a step:
 * size reads by proportion, so a ratio is what makes every step look alike.
 * A chest's ground grows with it.
 */
export const CHEST_TIER_SCALE: Readonly<Record<ChestTier, number>> = {
  wood: 1,
  rare: 1.2,
  epic: 1.44,
  legendary: 1.728,
};
/** A chest that found no free verge is drawn this much smaller at its stone's edge. */
export const CHEST_EDGE_SCALE = 0.62;
/** Ground the boss needs beside its gate. */
export const BOSS_FOOTPRINT_RADIUS = 0.62;

const STONE_GAP = 0.25;
const OBSTACLE_GAP = 0.12;
const ALONG_JITTER = 0.28;
/** Search stays close: past this a chest no longer reads as belonging to its stone. */
const SEARCH_RINGS = [0, 0.18, 0.36, 0.54, 0.72, 0.9, 1.1, 1.3];
/** A gate's verge is crowded by its posts and both neighbouring stones; look a little wider. */
const GATE_RINGS = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.8];
const SEARCH_ANGLES = 12;
/** Directions round the shore a weekly boss may stand in, and how far out "the shore" starts. */
const SHORE_DIRECTIONS = 12;
const SHORE_RADIAL = 0.86;

interface Circle {
  readonly x: number;
  readonly z: number;
  readonly r: number;
}

interface Spot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Unit vector from the spot back toward what it belongs to. */
  readonly facing: { readonly x: number; readonly z: number };
  readonly scale: number;
  /** The ground it was planned to keep; a chest's grows with its tier. */
  readonly radius?: number;
}

interface Placement {
  readonly chests: ReadonlyMap<string, Spot>;
  readonly bosses: ReadonlyMap<string, Spot>;
  /**
   * Free ground near the shore, one per direction round the island: where a
   * weekly boss may stand. Planned whether or not one comes, so nothing else
   * moves when it does.
   */
  readonly shore: readonly Spot[];
}

/** The chest's id for a lesson or a learning site. */
export function chestIdOf(owner: ChestOwner): string {
  if (owner.kind === "lesson") return `chest:lesson:${owner.lessonId}`;
  if (owner.kind === "weekly") return `chest:weekly:${owner.week}`;
  return `chest:${owner.siteId}`;
}

/**
 * The tier a chest shows on the map. The island's last lesson is gold, each
 * segment's last lesson blue, and everything else wood; the checkpoint and the
 * challenge pennant carry purple (V7 station 3).
 */
/** Every lesson's chest tier, deriving the segments once. */
function lessonChestTiers(
  lessons: readonly Pick<LessonPlacement, "lessonId" | "unitId" | "unitTitle">[],
): readonly ChestTier[] {
  const ends = new Set(
    segmentsFromPlacements(lessons).map(
      (segment) => `${segment.unitId}/${segment.lessonIds.at(-1)}`,
    ),
  );
  return lessons.map((lesson, index) =>
    index === lessons.length - 1
      ? "legendary"
      : ends.has(`${lesson.unitId}/${lesson.lessonId}`)
        ? "rare"
        : "wood",
  );
}

export function lessonChestTier(
  lessons: readonly Pick<LessonPlacement, "lessonId" | "unitId" | "unitTitle">[],
  index: number,
): ChestTier {
  if (index === lessons.length - 1) return "legendary";
  const lesson = lessons[index];
  if (!lesson) return "wood";
  const segments = segmentsFromPlacements(lessons);
  const endsSegment = segments.some(
    (segment) => segment.unitId === lesson.unitId && segment.lessonIds.at(-1) === lesson.lessonId,
  );
  return endsSegment ? "rare" : "wood";
}

function lessonChestState(state: LessonPlacement["state"]): ChestState {
  return state === "done" ? "open" : state === "live" ? "ready" : "closed";
}

/** A segment is cleared when every one of its lessons is done. */
function segmentCleared(
  site: Pick<LearningSite, "segment">,
  lessons: readonly Pick<LessonPlacement, "lessonId" | "unitId" | "state">[],
): boolean {
  return site.segment.lessonIds.every(
    (id) =>
      lessons.find((lesson) => lesson.lessonId === id && lesson.unitId === site.segment.unitId)
        ?.state === "done",
  );
}

/**
 * The fears in a stable order per course, so the same stone always shows the
 * same monster and neighbours differ.
 */
export function monsterOrder(courseId: string): readonly Exclude<MonsterRole, "boss">[] {
  return [...MONSTER_ROSTER]
    .map((role) => ({ role, key: hash(`${courseId}:monster:${role}`) }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.role);
}

const cache = new WeakMap<IslandBlueprint, Map<string, Placement>>();

function placementKey(lessons: readonly LessonPlacement[], sites: readonly LearningSite[]) {
  return `${lessons.map((lesson) => lesson.lessonId).join(",")}|${sites
    .map((site) => `${site.id}:${site.resolved ? 1 : 0}`)
    .join(",")}`;
}

/**
 * Where every chest and boss stands. Depends only on the island, the lessons'
 * order and the learning sites, never on progress, so it is computed once per
 * island and progress only changes what is drawn there.
 */
function placeChestsAndBosses(
  lessons: readonly LessonPlacement[],
  sites: readonly LearningSite[],
): Placement {
  const blueprint = lessons[0]?.blueprint;
  if (!blueprint) return { chests: new Map(), bosses: new Map(), shore: [] };
  const key = placementKey(lessons, sites);
  const hit = cache.get(blueprint)?.get(key);
  if (hit) return hit;

  // Off the road surface; a chest may lean over the shoulder's grass edge, which
  // is where a verge chest sits on a narrow island.
  const routeClearance = blueprint.route.roadWidth / 2;
  const obstacles: Circle[] = [
    ...courseStandingFootprints(blueprint),
    ...learningSiteExclusions(sites).map((item) => ({ x: item.x, z: item.z, r: item.radius })),
  ];
  const taken: Circle[] = [];
  const ground = createIslandHeightSampler(blueprint);
  const chests = new Map<string, Spot>();
  const bosses = new Map<string, Spot>();
  const shore: Spot[] = [];
  try {
    const free = (x: number, z: number, radius: number): number | null => {
      const centre = ground.heightAt(x, z);
      if (!centre.inside) return null;
      if (distanceToIslandRoute(blueprint, { x, z }) < routeClearance + radius) return null;
      for (const lesson of lessons)
        if (
          Math.hypot(x - lesson.position.x, z - lesson.position.z) <
          blueprint.route.nodeRadius + STONE_GAP + radius
        )
          return null;
      for (const circle of obstacles)
        if (Math.hypot(x - circle.x, z - circle.z) < circle.r + radius + OBSTACLE_GAP) return null;
      for (const circle of taken)
        if (Math.hypot(x - circle.x, z - circle.z) < circle.r + radius + OBSTACLE_GAP) return null;
      for (let step = 0; step < 6; step += 1) {
        const a = (step / 6) * Math.PI * 2;
        const rim = ground.heightAt(x + Math.cos(a) * radius, z + Math.sin(a) * radius);
        if (!rim.inside || Math.abs(rim.y - centre.y) > MAX_SLOPE_RISE) return null;
      }
      return centre.y;
    };
    const search = (
      anchor: { readonly x: number; readonly z: number },
      desired: { readonly x: number; readonly z: number },
      radius: number,
      rings: readonly number[],
    ): Spot | null => {
      for (const ring of rings) {
        const count = ring === 0 ? 1 : SEARCH_ANGLES;
        for (let step = 0; step < count; step += 1) {
          const a = (step / count) * Math.PI * 2;
          const x = desired.x + Math.cos(a) * ring;
          const z = desired.z + Math.sin(a) * ring;
          const y = free(x, z, radius);
          if (y === null) continue;
          const length = Math.hypot(anchor.x - x, anchor.z - z) || 1;
          return {
            x,
            y,
            z,
            facing: { x: (anchor.x - x) / length, z: (anchor.z - z) / length },
            scale: 1,
            radius,
          };
        }
      }
      return null;
    };
    /** The road's direction at a stone, from its neighbours. */
    const tangentAt = (index: number) => {
      const here = lessons[index]!.position;
      const next = lessons[index + 1]?.position;
      const previous = lessons[index - 1]?.position;
      const t = next
        ? new Vector3(next.x - here.x, 0, next.z - here.z)
        : previous
          ? new Vector3(here.x - previous.x, 0, here.z - previous.z)
          : new Vector3(0, 0, -1);
      if (t.lengthSq() < 1e-6) t.set(0, 0, -1);
      return t.normalize();
    };
    /** Beside a point, on a side chosen by `seed`, then the other side. */
    const beside = (
      anchor: { readonly x: number; readonly z: number },
      tangent: Vector3,
      reach: number,
      radius: number,
      seed: string,
      rings: readonly number[] = SEARCH_RINGS,
    ): Spot | null => {
      const side = hash(`${seed}:side`) < 0.5 ? 1 : -1;
      const along = (hash(`${seed}:along`) - 0.5) * 2 * ALONG_JITTER;
      for (const sign of [side, -side]) {
        const normal = { x: -tangent.z * sign, z: tangent.x * sign };
        const found = search(
          anchor,
          {
            x: anchor.x + normal.x * reach + tangent.x * along,
            z: anchor.z + normal.z * reach + tangent.z * along,
          },
          radius,
          rings,
        );
        if (found) return found;
      }
      return null;
    };
    const reach = Math.max(
      blueprint.route.nodeRadius + STONE_GAP + CHEST_FOOTPRINT_RADIUS,
      routeClearance + CHEST_FOOTPRINT_RADIUS + 0.05,
    );
    const EPIC_RADIUS = CHEST_FOOTPRINT_RADIUS * CHEST_TIER_SCALE.epic;
    /**
     * A purple chest at its full size where the verge has room; otherwise at a
     * wood chest's ground, drawn that small, rather than missing or overlapping.
     */
    const besideEpic = (
      anchor: { readonly x: number; readonly z: number },
      tangent: Vector3,
      at: number,
      seed: string,
    ): Spot | null => {
      const full = beside(anchor, tangent, at, EPIC_RADIUS, seed, GATE_RINGS);
      if (full) return full;
      const small = beside(anchor, tangent, at, CHEST_FOOTPRINT_RADIUS, seed, GATE_RINGS);
      return small ? { ...small, scale: 1 / CHEST_TIER_SCALE.epic } : null;
    };

    // Gates and pennants first: their verge is the scarcest, a lesson's chest can go either side.
    for (const site of sites) {
      if (!site.resolved || site.kind === "personal") continue;
      if (site.kind === "challenge") {
        const away = new Vector3(site.object.x - site.ground.x, 0, site.object.z - site.ground.z);
        const tangent =
          away.lengthSq() > 1e-6
            ? new Vector3(-away.z, 0, away.x).normalize()
            : new Vector3(0, 0, -1);
        const found = besideEpic(site.ground, tangent, reach, site.id);
        if (found) {
          taken.push({ x: found.x, z: found.z, r: found.radius ?? EPIC_RADIUS });
          chests.set(chestIdOf({ kind: "challenge", siteId: site.id }), found);
        }
        continue;
      }
      // The gate spans the road, so the road runs along the gate's normal.
      const yaw = site.yaw ?? 0;
      const tangent = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const gateReach = reach + 0.5;
      // Beside the gate first; where its verge is taken, at the segment's end
      // on either side of the gate: its last lesson, then the next one.
      const last = lessons.findIndex(
        (lesson) =>
          lesson.unitId === site.segment.unitId &&
          lesson.lessonId === site.segment.lessonIds.at(-1),
      );
      const neighbours = [last, last + 1].filter((index) => index >= 0 && index < lessons.length);
      let boss = beside(
        site.object,
        tangent,
        gateReach,
        BOSS_FOOTPRINT_RADIUS,
        `${site.id}:boss`,
        GATE_RINGS,
      );
      for (const index of neighbours) {
        if (boss) break;
        boss = beside(
          lessons[index]!.position,
          tangentAt(index),
          reach + BOSS_FOOTPRINT_RADIUS - CHEST_FOOTPRINT_RADIUS,
          BOSS_FOOTPRINT_RADIUS,
          `${site.id}:boss:${index}`,
          GATE_RINGS,
        );
      }
      if (boss) {
        taken.push({ x: boss.x, z: boss.z, r: BOSS_FOOTPRINT_RADIUS });
        bosses.set(site.id, boss);
      }
      const chest = besideEpic(site.object, tangent, gateReach, site.id);
      if (chest) {
        taken.push({ x: chest.x, z: chest.z, r: chest.radius ?? EPIC_RADIUS });
        chests.set(chestIdOf({ kind: "checkpoint", siteId: site.id }), chest);
      }
    }
    const tiers = lessonChestTiers(lessons);
    lessons.forEach((lesson, index) => {
      const tangent = tangentAt(index);
      const at = lesson.position;
      const radius = CHEST_FOOTPRINT_RADIUS * CHEST_TIER_SCALE[tiers[index] ?? "wood"];
      const found = beside(
        at,
        tangent,
        reach + radius - CHEST_FOOTPRINT_RADIUS,
        radius,
        lesson.lessonId,
      );
      const id = chestIdOf({ kind: "lesson", lessonId: lesson.lessonId });
      if (found) {
        taken.push({ x: found.x, z: found.z, r: radius });
        chests.set(id, found);
        return;
      }
      // Hang at the stone's edge, smaller, on its preferred side.
      const sign = hash(`${lesson.lessonId}:side`) < 0.5 ? 1 : -1;
      const edge = blueprint.route.nodeRadius * 0.92;
      const x = at.x - tangent.z * sign * edge;
      const z = at.z + tangent.x * sign * edge;
      chests.set(id, {
        x,
        y: ground.heightAt(x, z).y,
        z,
        facing: { x: tangent.z * sign, z: -tangent.x * sign },
        scale: CHEST_EDGE_SCALE,
      });
    });

    // The weekly boss comes to the shore: free ground near the island's edge,
    // off every path, facing inland. Planned last, so it moves nothing else.
    // Largest first: a small island's shore may only hold it at a guard's size.
    const radius = BOSS_FOOTPRINT_RADIUS;
    for (let step = 0; step < SHORE_DIRECTIONS; step += 1) {
      const a = (step / SHORE_DIRECTIONS) * Math.PI * 2;
      for (let reach = 0.95; reach >= 0.3; reach -= 0.05) {
        const x = Math.cos(a) * blueprint.bounds.halfX * reach;
        const z = Math.sin(a) * blueprint.bounds.halfZ * reach;
        if (sampleIslandSurface(blueprint, x, z).radial > SHORE_RADIAL) continue;
        const y = free(x, z, radius);
        if (y === null) continue;
        const length = Math.hypot(x, z) || 1;
        shore.push({ x, y, z, facing: { x: -x / length, z: -z / length }, scale: 1 });
        taken.push({ x, z, r: radius });
        break;
      }
    }
  } finally {
    ground.dispose();
  }
  const placement: Placement = { chests, bosses, shore };
  let perBlueprint = cache.get(blueprint);
  if (!perBlueprint) {
    perBlueprint = new Map();
    cache.set(blueprint, perBlueprint);
  }
  perBlueprint.set(key, placement);
  return placement;
}

const yawOf = (spot: Spot) => Math.atan2(spot.facing.x, spot.facing.z);

/** Every chest on the course island, with the tier and state it shows now. */
export function courseChests(
  lessons: readonly LessonPlacement[],
  sites: readonly LearningSite[],
): readonly CourseChest[] {
  const placement = placeChestsAndBosses(lessons, sites);
  const chests: CourseChest[] = [];
  const tiers = lessonChestTiers(lessons);
  lessons.forEach((lesson, index) => {
    const owner: ChestOwner = { kind: "lesson", lessonId: lesson.lessonId };
    const spot = placement.chests.get(chestIdOf(owner));
    if (!spot) return;
    chests.push({
      id: chestIdOf(owner),
      owner,
      tier: tiers[index]!,
      state: lessonChestState(lesson.state),
      position: new Vector3(spot.x, spot.y, spot.z),
      yaw: yawOf(spot),
      scale: spot.scale * CHEST_TIER_SCALE[tiers[index]!],
    });
  });
  for (const site of sites) {
    if (site.kind === "personal") continue;
    const owner: ChestOwner = { kind: site.kind, siteId: site.id };
    const spot = placement.chests.get(chestIdOf(owner));
    if (!spot) continue;
    chests.push({
      id: chestIdOf(owner),
      owner,
      tier: "epic",
      // A challenge's win is not known to the map yet; its chest opens with
      // the opening sequence (task 02). The gate's opens with its segment.
      state: site.kind === "checkpoint" && segmentCleared(site, lessons) ? "open" : "closed",
      position: new Vector3(spot.x, spot.y, spot.z),
      yaw: yawOf(spot),
      scale: spot.scale * CHEST_TIER_SCALE.epic,
    });
  }
  return chests;
}

/**
 * Every monster standing now: one on each lesson stone and learning-node pad
 * the learner cannot enter yet, and a boss beside each gate whose segment is
 * not cleared.
 */
export function courseMonsters(
  lessons: readonly LessonPlacement[],
  sites: readonly LearningSite[],
): readonly CourseMonster[] {
  const courseId = lessons[0]?.courseId ?? "course";
  const order = monsterOrder(courseId);
  const monsters: CourseMonster[] = [];
  const lessonAt = (id: string, unitId?: string) =>
    lessons.find((lesson) => lesson.lessonId === id && (!unitId || lesson.unitId === unitId));
  lessons.forEach((lesson, index) => {
    if (lesson.state !== "locked") return;
    const before = lessons[index - 1] ?? lessons[index + 1] ?? lesson;
    monsters.push({
      id: `monster:lesson:${lesson.lessonId}`,
      role: order[index % order.length]!,
      boss: false,
      stop: { kind: "lesson", lessonId: lesson.lessonId },
      position: lesson.position.clone(),
      faces: before.position.clone(),
    });
  });
  const placement = placeChestsAndBosses(lessons, sites);
  sites.forEach((site, index) => {
    if (!site.resolved) return;
    if (site.kind === "checkpoint") {
      const spot = placement.bosses.get(site.id);
      if (!spot || segmentCleared(site, lessons)) return;
      monsters.push({
        id: `monster:gate:${site.id}`,
        role: "boss",
        boss: true,
        stop: { kind: "gate", siteId: site.id },
        position: new Vector3(spot.x, spot.y, spot.z),
        faces: (
          lessonAt(site.segment.lessonIds.at(-1) ?? "", site.segment.unitId)?.position ??
          site.ground
        ).clone(),
      });
      return;
    }
    if (!learningSiteLocked(site, lessons)) return;
    monsters.push({
      id: `monster:pad:${site.id}`,
      role: order[(lessons.length + index) % order.length]!,
      boss: false,
      stop: { kind: "pad", siteId: site.id },
      position: site.ground.clone(),
      faces: (lessonAt(site.opensWith)?.position ?? site.object).clone(),
    });
  });
  return monsters;
}

/**
 * Whom the knowledge star from a finished lesson's chest chases away (V7
 * station 4): the gate's boss when the lesson finished its segment, otherwise
 * the monster that stood on the next stone — unless that stone was already
 * done, when there is nobody to chase.
 */
export function openingGuard(
  lessons: readonly LessonPlacement[],
  index: number,
): {
  readonly stop: { readonly lessonId: string } | { readonly siteId: string };
  readonly role: MonsterRole;
} | null {
  const lesson = lessons[index];
  if (!lesson) return null;
  const gate = courseLearningSites(lessons).find(
    (site) =>
      site.resolved &&
      site.kind === "checkpoint" &&
      site.segment.unitId === lesson.unitId &&
      site.segment.lessonIds.at(-1) === lesson.lessonId,
  );
  if (gate) return { stop: { siteId: gate.id }, role: "boss" };
  const next = lessons[index + 1];
  if (!next || next.state === "done") return null;
  const order = monsterOrder(lesson.courseId);
  return { stop: { lessonId: next.lessonId }, role: order[(index + 1) % order.length]! };
}

/**
 * This week's boss on this island: at the shore nearest the stone the learner
 * is on now, so the map opens with it in view. Null when the shore has no room.
 */
export function courseWeeklyBoss(
  lessons: readonly LessonPlacement[],
  sites: readonly LearningSite[],
  week: string,
): CourseMonster | null {
  const { shore: all } = placeChestsAndBosses(lessons, sites);
  const here = (lessons.find((lesson) => lesson.state !== "done") ?? lessons.at(-1))?.position;
  const blueprint = lessons[0]?.blueprint;
  if (!here || !blueprint || all.length === 0) return null;
  // Out toward the edge where there is room; inland only on an island with none.
  const outer = all.filter((spot) => sampleIslandSurface(blueprint, spot.x, spot.z).radial > 0.5);
  const shore = outer.length ? outer : all;
  const spot = shore.reduce((best, next) =>
    Math.hypot(next.x - here.x, next.z - here.z) < Math.hypot(best.x - here.x, best.z - here.z)
      ? next
      : best,
  );
  const position = new Vector3(spot.x, spot.y, spot.z);
  return {
    id: `monster:weekly:${week}`,
    role: "boss",
    boss: true,
    stop: { kind: "weekly", week },
    position,
    size: WEEKLY_BOSS_SIZE,
    faces: position.clone().add(new Vector3(spot.facing.x, 0, spot.facing.z).multiplyScalar(3)),
  };
}

/**
 * The chest the weekly boss drops where it stood when it runs (PLAN-V7-07 §2a):
 * purple, facing inland as the boss did. Nothing stands beside the boss before
 * then; the fight's card names the prize instead, and the drop is the reveal.
 */
export function courseWeeklyChest(boss: CourseMonster): CourseChest | null {
  if (boss.stop.kind !== "weekly") return null;
  const owner: ChestOwner = { kind: "weekly", week: boss.stop.week };
  const facing = boss.faces.clone().sub(boss.position);
  return {
    id: chestIdOf(owner),
    owner,
    tier: "epic",
    state: "ready",
    position: boss.position.clone(),
    yaw: Math.atan2(facing.x, facing.z),
    scale: CHEST_TIER_SCALE.epic,
  };
}

/**
 * The monster standing at a stop now, if any: on a lesson stone, on a
 * learning-node pad, or guarding a gate. The map's card names it in DOM text.
 */
export function monsterAtStop(
  lessons: readonly LessonPlacement[],
  stop: { readonly lessonId: string } | { readonly siteId: string },
): MonsterRole | null {
  const sites = courseLearningSites(lessons);
  const found = courseMonsters(lessons, sites).find((monster) =>
    "lessonId" in stop
      ? monster.stop.kind === "lesson" && monster.stop.lessonId === stop.lessonId
      : "siteId" in monster.stop && monster.stop.siteId === stop.siteId,
  );
  return found?.role ?? null;
}

/** Ground the planned chests and bosses occupy, for what is planned after them. */
export function chestAndMonsterFootprints(
  lessons: readonly LessonPlacement[],
  sites: readonly LearningSite[],
): readonly { readonly x: number; readonly z: number; readonly radius: number }[] {
  const placement = placeChestsAndBosses(lessons, sites);
  return [
    ...[...placement.chests.values()]
      // Edge chests hang on their stone; every verge chest keeps its ground.
      .filter((spot) => spot.scale !== CHEST_EDGE_SCALE)
      .map((spot) => ({
        x: spot.x,
        z: spot.z,
        radius: (spot.radius ?? CHEST_FOOTPRINT_RADIUS) + 0.12,
      })),
    ...placement.shore.map((spot) => ({
      x: spot.x,
      z: spot.z,
      radius: BOSS_FOOTPRINT_RADIUS + 0.12,
    })),
    ...[...placement.bosses.values()].map((spot) => ({
      x: spot.x,
      z: spot.z,
      radius: BOSS_FOOTPRINT_RADIUS + 0.12,
    })),
  ];
}
