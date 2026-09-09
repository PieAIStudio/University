/**
 * V5 M: a catalogue is a few ordered shoals, not one uniform field of dots.
 * Only stable teaching order, identity and reserved course radii enter here;
 * progress, titles, geometry and the camera are deliberately not inputs.
 */
import { WORLD_ISLAND_SEPARATION_GAP, type Placed } from "./course/layout.js";
import { hash } from "./island/random.js";

export interface WorldLayoutIsland {
  readonly key: string;
  readonly studyId: string;
  /** Radius of the largest learner state, not the state currently drawn. */
  readonly radius: number;
}

export interface WorldLayoutGroup {
  readonly keys: readonly string[];
  readonly anchorKey: string;
}

interface LocalIsland extends WorldLayoutIsland {
  readonly x: number;
  readonly z: number;
}

// The smaller gap makes neighbours read together; the larger gap is actual
// unoccupied sky between their maximum-state outlines, not centre spacing.
const NEIGHBOUR_GAP = 0.9;
const SKY_CHANNEL = 5.2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function median(values: readonly number[]): number {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.floor(ordered.length / 2)] ?? 1;
}

/** Adjacent teaching entries stay together, with no one-/two-island tail.
 * Scale can move a boundary by one or two entries, but cannot reorder a course
 * or join two studies. A genuinely tiny study remains genuinely tiny.
 */
function partition(islands: readonly WorldLayoutIsland[]): WorldLayoutIsland[][] {
  const groups: WorldLayoutIsland[][] = [];
  let start = 0;
  while (start < islands.length) {
    let end = start + 1;
    while (end < islands.length && islands[end]!.studyId === islands[start]!.studyId) end += 1;
    const own = islands.slice(start, end);
    const targetArea = median(own.map((entry) => entry.radius ** 2)) * 4.5;
    let cursor = 0;
    while (cursor < own.length) {
      const remaining = own.length - cursor;
      let size = remaining;
      if (remaining > 6) {
        let best = Number.POSITIVE_INFINITY;
        for (let candidate = 3; candidate <= 6; candidate += 1) {
          if (remaining - candidate < 3) continue;
          const area = own
            .slice(cursor, cursor + candidate)
            .reduce((sum, entry) => sum + entry.radius ** 2, 0);
          const cost = Math.abs(area / targetArea - 1) + Math.abs(candidate - 4.5) * 0.12;
          if (cost < best) {
            best = cost;
            size = candidate;
          }
        }
      }
      groups.push(own.slice(cursor, cursor + size));
      cursor += size;
    }
    start = end;
  }
  return groups;
}

function clearNeighbour(candidate: LocalIsland, peer: LocalIsland): boolean {
  const dx = candidate.x - peer.x;
  const dz = candidate.z - peer.z;
  const groundGap = (candidate.radius + peer.radius) * WORLD_ISLAND_SEPARATION_GAP;
  // A small course still needs room for a hit target/caption. Reserve space
  // in the foreshortened ground plane as well as between physical outlines.
  // This is conservative placement slack, not a replacement for DOM layout
  // or an assertion that a 44px target fits at every possible zoom level.
  return dx * dx + dz * dz >= groundGap ** 2 && dx * dx + dz * dz * 0.35 >= 3.5 ** 2;
}

/** An open, tapered fan around the largest real course, not a closed orbit.
 * Its opening and depth drift slowly across groups; unequal radii and stable
 * angular sway prevent identical flowers when several groups have five islands.
 */
function localGroup(group: readonly WorldLayoutIsland[], index: number): LocalIsland[] {
  const anchor = group.reduce((largest, entry) =>
    entry.radius > largest.radius ? entry : largest,
  );
  const placed: LocalIsland[] = [{ ...anchor, x: 0, z: 0 }];
  const neighbours = group.filter((entry) => entry !== anchor);
  const direction = 0.38 + Math.sin(index * 0.83) * 0.32 + hash(`${anchor.key}:shoal`) * 0.18;
  const sweep = Math.min(4.6, Math.max(0, neighbours.length - 1) * 1.3);
  neighbours.forEach((entry, order) => {
    const angle =
      direction +
      (order / Math.max(1, neighbours.length - 1) - 0.5) * sweep +
      (hash(`${entry.key}:shore-sway`) - 0.5) * 0.1;
    const distance =
      (Math.max(1.65, anchor.radius) + Math.max(1.65, entry.radius)) * WORLD_ISLAND_SEPARATION_GAP +
      NEIGHBOUR_GAP;
    let candidate: LocalIsland | null = null;
    // At most five neighbours: bounded local recovery never moves an earlier
    // island or breaks up a group in response to a distant collision.
    for (let step = 0; step < 16 && candidate === null; step += 1) {
      for (const turn of [0, -0.1, 0.1, -0.2, 0.2, -0.35, 0.35, -0.5, 0.5]) {
        const radius = distance + step * 0.35;
        const point = {
          ...entry,
          x: Math.cos(angle + turn) * radius,
          z: Math.sin(angle + turn) * radius * 1.12,
        };
        if (
          placed.every((peer) => clearNeighbour(point, peer)) &&
          placed.some(
            (peer) =>
              Math.hypot(point.x - peer.x, point.z - peer.z) - point.radius - peer.radius <= 3.5,
          )
        ) {
          candidate = point;
          break;
        }
      }
    }
    // Finite fallback for extreme radii; no course is silently omitted. This
    // lies beyond every previous physical/interaction envelope along +X.
    candidate ??= {
      ...entry,
      x:
        Math.max(
          ...placed.map((peer) => peer.x + peer.radius * WORLD_ISLAND_SEPARATION_GAP + 3.5),
        ) +
        entry.radius * WORLD_ISLAND_SEPARATION_GAP +
        NEIGHBOUR_GAP,
      z: 0,
    };
    placed.push(candidate);
  });
  return placed;
}

function clearsGroups(
  local: readonly LocalIsland[],
  prior: readonly LocalIsland[],
  x: number,
  z: number,
): boolean {
  for (const entry of local) {
    for (const peer of prior) {
      const dx = x + entry.x - peer.x;
      const dz = z + entry.z - peer.z;
      const distance = (entry.radius + peer.radius) * WORLD_ISLAND_SEPARATION_GAP + SKY_CHANNEL;
      if (dx * dx + dz * dz < distance * distance) return false;
    }
  }
  return true;
}

/** The caller supplies canonical study/spine order (never incoming array order).
 * A bounded best-fit search packs whole shoals along a broad bent diagonal.
 * The spiral is only an aperiodic candidate sampler; unlike the former layout
 * it does not assign each course a turn on a uniformly populated disc. The
 * score gives the overall field a direction, and exact outline gaps leave sky
 * channels. No camera fitting, per-course coordinates or cross-island roads.
 */
export function layoutWorldArchipelago(islands: readonly WorldLayoutIsland[]): {
  readonly positions: ReadonlyMap<string, Placed>;
  readonly groups: readonly WorldLayoutGroup[];
  readonly extent: number;
} {
  const groups = partition(islands);
  const laid: LocalIsland[] = [];
  const summaries: WorldLayoutGroup[] = [];
  const typicalRadius = median(islands.map((entry) => entry.radius));
  const sampleStep = Math.max(1.2, typicalRadius * 0.82);
  for (const [index, group] of groups.entries()) {
    const local = localGroup(group, index);
    const anchor = local[0]!;
    summaries.push({ keys: group.map((entry) => entry.key), anchorKey: anchor.key });
    let offset: { x: number; z: number } | null = null;
    if (index === 0) {
      const first = local.find((entry) => entry.key === islands[0]!.key)!;
      offset = { x: -first.x, z: -first.z };
    } else {
      let best = Number.POSITIVE_INFINITY;
      const phase = hash(`${group[0]!.key}:current`) * 0.3;
      const centreX = local.reduce((sum, entry) => sum + entry.x, 0) / local.length;
      const centreZ = local.reduce((sum, entry) => sum + entry.z, 0) / local.length;
      for (let sample = 1; sample <= 512; sample += 1) {
        const radius = sampleStep * Math.sqrt(sample * (index + 1));
        const angle = sample * GOLDEN_ANGLE + phase;
        const viewX = Math.cos(angle) * radius;
        const viewZ = Math.sin(angle) * radius;
        const x = viewX - centreX;
        const z = viewZ - centreZ;
        const across =
          viewZ - viewX * 0.65 - Math.sin(viewX / (typicalRadius * 7)) * typicalRadius * 2;
        const score = viewX * viewX * 0.6 + across * across * 1.5;
        if (score >= best || !clearsGroups(local, laid, x, z)) continue;
        best = score;
        offset = { x, z };
      }
      offset ??= {
        x:
          Math.max(...laid.map((entry) => entry.x + entry.radius * WORLD_ISLAND_SEPARATION_GAP)) -
          Math.min(...local.map((entry) => entry.x - entry.radius * WORLD_ISLAND_SEPARATION_GAP)) +
          SKY_CHANNEL,
        z: 0,
      };
    }
    laid.push(
      ...local.map((entry) => ({ ...entry, x: entry.x + offset.x, z: entry.z + offset.z })),
    );
  }
  const byKey = new Map(laid.map((entry) => [entry.key, entry]));
  return {
    positions: new Map(
      islands.map((entry, depth) => {
        const point = byKey.get(entry.key)!;
        return [entry.key, { x: point.x, y: 0, z: point.z, depth }];
      }),
    ),
    groups: summaries,
    // Reserve the same sky/controls envelope across all progress states too.
    extent: Math.max(1, ...laid.map((entry) => Math.hypot(entry.x, entry.z) + entry.radius)) + 5,
  };
}
