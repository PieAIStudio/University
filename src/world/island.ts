/**
 * Islands are grown, not modelled.
 *
 * A course has between 1 and 41 lessons, so its island has to be between 1 and
 * 41 lessons big. No authored mesh can do that — you would either ship 41
 * models or scale one model and watch the rocks stretch. So the island is
 * generated from the same two numbers the map already derives: how big the
 * course is, and its id.
 *
 * The id is the seed, and that matters more than it looks. A layout keyed to
 * content would rearrange a learner's whole world because an author fixed a
 * typo upstream. Keyed to `courseId`, the island a learner remembers is the
 * island that is still there next month. Determinism and stability are
 * different properties and the world needs both — same rule as the map layout
 * in `layout.ts`, applied to shape instead of position.
 *
 * The look is flat-shaded low poly: few radial segments, hard colour bands, no
 * smooth normals. That is a real style with real reasons behind it here —
 * it reads at a distance, it costs almost nothing on a phone, and it matches
 * the CC0 packs in `kit.json`, which are all built the same way. A realistic
 * island next to a Quaternius tree looks like a bug.
 */
import * as THREE from "three";

/** FNV-1a. The same hash the layout uses, for the same reason: no Math.random. */
export function hash(text: string) {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0) / 4294967295;
}

/** A stream of stable numbers in [0,1) from one seed. */
export function seeded(seed: string) {
  let step = 0;
  return () => hash(`${seed}#${(step += 1)}`);
}

const GRASS = new THREE.Color(0x6f9e52);
const GRASS_DRY = new THREE.Color(0x86a459);
const ROCK = new THREE.Color(0x6b6152);
const ROCK_DEEP = new THREE.Color(0x4a4438);

/**
 * The silhouette, as a lathe profile: a slightly domed top, an undercut rim
 * that catches the light, then a root tapering away under the water.
 *
 * The undercut is the one part that is not decoration. Without it the island is
 * a cylinder and reads as a coin lying in a puddle; with it there is a shadow
 * line at the waterline and the thing reads as land.
 *
 * Ordered bottom to top, and that is not cosmetic: LatheGeometry derives its
 * winding from the order of the profile, so a top-down list turns every island
 * inside out. The symptom is not an error — it is a black island, because you
 * are looking at back faces the light never reaches.
 */
const PROFILE: readonly (readonly [number, number])[] = [
  [0.0, -2.8],
  [0.4, -2.1],
  [0.72, -1.1],
  [0.93, -0.35],
  [1.0, 0.1],
  [0.86, 0.44],
  [0.5, 0.58],
  [0.0, 0.62],
];

export interface IslandShape {
  readonly geometry: THREE.BufferGeometry;
  /** Where props may stand, in island-local space, already on the surface. */
  readonly slots: readonly THREE.Vector3[];
  /** Radius of the flat-ish top, for placing anything else. */
  readonly top: number;
}

/**
 * Build one island.
 *
 * `tint` shifts the grass so the four studies do not look like one continent
 * cut into pieces — it is a hue nudge, not a repaint, so the world still reads
 * as one place.
 */
export function buildIsland(seed: string, radius: number, tint = 0): IslandShape {
  const random = seeded(seed);
  // Few segments on purpose. Nine reads as hand-made; thirty-two reads as a
  // primitive nobody styled.
  const segments = 9;
  const points = PROFILE.map(([x, y]) => new THREE.Vector2(x * radius, y * radius * 0.42));
  const geometry = new THREE.LatheGeometry(points, segments);

  // Push each column of vertices in or out by a fixed amount, so the island is
  // irregular but its silhouette stays vertical — a per-vertex jitter would
  // make the cliff face ripple and destroy the flat-shaded facets.
  const offsets = Array.from({ length: segments + 1 }, () => 0.82 + random() * 0.34);
  offsets[segments] = offsets[0]!; // seam column shares the first column's offset
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const colours = new Float32Array(position.count * 3);
  const colour = new THREE.Color();
  const grassTop = GRASS.clone().offsetHSL(tint, 0, 0);
  const grassDry = GRASS_DRY.clone().offsetHSL(tint, 0, 0);

  for (let index = 0; index < position.count; index += 1) {
    const column = index % (segments + 1);
    const scale = offsets[column]!;
    const x = position.getX(index) * scale;
    const y = position.getY(index);
    const z = position.getZ(index) * scale;
    position.setXYZ(index, x, y, z);

    // Hard bands, not a gradient. The waterline should be a line.
    const band =
      y > radius * 0.03 ? (column % 2 ? grassTop : grassDry) : y > -radius * 0.3 ? ROCK : ROCK_DEEP;
    colour.copy(band);
    colours[index * 3] = colour.r;
    colours[index * 3 + 1] = colour.g;
    colours[index * 3 + 2] = colour.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  geometry.computeVertexNormals();

  // Dart-throwing rather than a grid: a grid of trees is instantly a grid, and
  // the eye finds it before it finds the island.
  // Slots stay inside the flat crown, not out on the slope — the profile has
  // already narrowed to about 0.5r by the time it reaches the top, so a tree
  // placed at 0.78r stands on a hillside with its base in the air.
  const top = radius * 0.6;
  const slots: THREE.Vector3[] = [];
  // Density is a feel decision, not a performance one: everything here is
  // instanced, so the cost of a fuller island is a larger matrix array. An
  // island with four things on it reads as unfinished terrain rather than as a
  // place, and "unfinished" is the one thing this map must not say by accident.
  const wanted = Math.max(4, Math.round(radius * radius * 1.1));
  const spacing = radius * 0.2;
  for (let attempt = 0; attempt < wanted * 24 && slots.length < wanted; attempt += 1) {
    const angle = random() * Math.PI * 2;
    // sqrt keeps the distribution even instead of crowding the middle.
    const distance = Math.sqrt(random()) * top;
    const point = new THREE.Vector3(
      Math.cos(angle) * distance,
      radius * 0.24,
      Math.sin(angle) * distance,
    );
    if (slots.every((taken) => taken.distanceTo(point) > spacing)) slots.push(point);
  }

  return { geometry, slots, top };
}
