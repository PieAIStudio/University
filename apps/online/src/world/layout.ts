/**
 * Where things stand on the map, decided by the courses rather than by hand.
 *
 * There is no level editor and no table of coordinates in this repository, on
 * purpose. A hand-placed map is a second copy of the course structure living
 * here, which is exactly the drift the parity contract exists to prevent — and
 * it is the copy nobody reviews, because it looks like art.
 *
 * Seeds are stable ids, never package hashes. A layout keyed to content would
 * be deterministic and still wrong: an author fixing one typo would rearrange a
 * learner's whole world overnight. Determinism and stability are different
 * properties and a map needs both.
 */

/** FNV-1a. Small, stable across machines, adequate for scattering nodes. */
export function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return (value >>> 0) / 0xffffffff;
}

export const jitter = (id: string, salt: string) => hash(`${id}:${salt}`) * 2 - 1;

/**
 * A lesson count turned into a radius.
 *
 * Courses run from 1 lesson to 41. Linear scaling makes the largest island
 * forty times the smallest and unusable; scaling by area keeps a 41 visibly
 * bigger than a 12 while both stay clickable. The map tolerates content this
 * uneven because the content is not going to be regularised first.
 */
export const radiusForLessons = (lessons: number) => 0.55 + Math.sqrt(lessons) * 0.42;

export interface Placed {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly depth: number;
}

export interface LayoutInput {
  readonly id: string;
  readonly depth: number;
  readonly prerequisiteCourseIds: readonly string[];
}

/**
 * One study, laid out as a radial tree.
 *
 * The tree is the honest shape of this library: turing-pact is a trunk nine
 * links long — the foundations spine — then nine branches open at once and
 * taper away. Drawn as depth rings that reads as noise and, worse, overlaps:
 * islands two units wide on rings under two units apart. Drawn as a tree it
 * reads as what it is, a long climb to a plateau and then a choice.
 *
 * Sibling spread is clamped rather than filling the inherited wedge. Without
 * the clamp, nine branches at radius 56 fan across two hundred units and stop
 * being one place the learner has arrived at.
 */
export function layoutStudy(
  courses: readonly LayoutInput[],
  options: { step?: number; rise?: number; siblingGap?: number } = {},
): Map<string, Placed> {
  const step = options.step ?? 6.4;
  const rise = options.rise ?? 0.9;
  const siblingGap = options.siblingGap ?? 7.4;

  const byId = new Map(courses.map((course) => [course.id, course]));
  const children = new Map<string, LayoutInput[]>(courses.map((course) => [course.id, []]));
  const roots: LayoutInput[] = [];
  for (const course of [...courses].sort((a, b) => a.id.localeCompare(b.id))) {
    // The first prerequisite that exists here is the parent. A course with two
    // still sits on one branch; the other stays visible as a road, which is
    // honest about the graph without turning the map into one.
    const parentId = course.prerequisiteCourseIds.find((id) => byId.has(id));
    if (parentId === undefined) roots.push(course);
    else children.get(parentId)?.push(course);
  }

  const leaves = new Map<string, number>();
  const countLeaves = (course: LayoutInput): number => {
    const known = leaves.get(course.id);
    if (known !== undefined) return known;
    const own = children.get(course.id) ?? [];
    const total = own.length === 0 ? 1 : own.reduce((sum, kid) => sum + countLeaves(kid), 0);
    leaves.set(course.id, total);
    return total;
  };
  for (const root of roots) countLeaves(root);

  const placed = new Map<string, Placed>();
  const place = (course: LayoutInput, angle: number, depth: number) => {
    const radius = depth * step;
    placed.set(course.id, {
      x: Math.cos(angle) * radius,
      y: depth * rise,
      z: Math.sin(angle) * radius,
      depth,
    });
    const own = children.get(course.id) ?? [];
    if (own.length === 0) return;
    const childRadius = (depth + 1) * step;
    const spread =
      own.length === 1
        ? 0
        : Math.min((own.length - 1) * siblingGap, childRadius * 1.5) / childRadius;
    own.forEach((kid, slot) => {
      const offset = own.length === 1 ? 0 : (slot / (own.length - 1) - 0.5) * spread;
      place(kid, angle + offset + jitter(kid.id, "angle") * 0.02, depth + 1);
    });
  };

  // Roots share the circle by how much grows behind each, so a lone preface
  // does not get the same quarter of the world as a nine-course spine.
  const totalLeaves = roots.reduce((sum, root) => sum + countLeaves(root), 0) || 1;
  let cursor = 0;
  for (const root of roots) {
    const share = countLeaves(root) / totalLeaves;
    place(root, cursor + share * Math.PI, roots.length === 1 ? 0 : 1);
    cursor += share * Math.PI * 2;
  }
  // A study with no prerequisites at all comes out of this same code as a ring
  // with no roads, which is the truth about it. Inventing an order to make the
  // picture tidier would tell the learner something the author never said.
  return placed;
}

/**
 * One course, folded four lessons to a row.
 *
 * Straight, a 41-lesson course is a corridor with no visible end — and that is
 * the first course a beginner meets here. Folded, 41 and 12 are the same shape
 * and both fit one frame. The fold is at four because the content already folds
 * there: 93 of 146 units hold exactly four lessons.
 */
export function layoutCourse(unitSizes: readonly number[]): Placed[] {
  const STRIDE = 5.2;
  const ROW = 6.4;
  const STEP_UP = 1.15;
  const out: Placed[] = [];
  let rowIndex = 0;
  unitSizes.forEach((count, unitIndex) => {
    const rowsBefore = rowIndex;
    for (let slot = 0; slot < count; slot += 1) {
      const row = rowsBefore + Math.floor(slot / 4);
      const column = slot % 4;
      const forward = row % 2 === 0 ? 1 : -1;
      out.push({
        x: (column - 1.5) * STRIDE * forward,
        y: unitIndex * STEP_UP,
        z: -row * ROW,
        depth: unitIndex,
      });
    }
    rowIndex = rowsBefore + Math.ceil(count / 4);
  });
  return out;
}
