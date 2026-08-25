/**
 * How deep a course sits in its study's prerequisite chain.
 *
 * A pure fold over ids, living in core for the same reason `courseShapeOf`
 * does: the 2D catalogue needs it and must not import the scene to get it.
 * `packages/world` was the first home, `apps/university/src/content/library.ts`
 * grew a byte-identical second copy, and the two then had to be kept in step
 * by nobody in particular. One of them is this file.
 *
 * A cycle resolves to depth 0 rather than throwing. Prerequisites come from
 * authored content, and a course that quietly sorts to the front of the list
 * is a far better failure than a map that will not draw.
 */
export function depthsFromPrerequisites(
  courses: readonly {
    readonly id: string;
    readonly prerequisiteCourseIds: readonly string[];
  }[],
): Map<string, number> {
  const byId = new Map(courses.map((course) => [course.id, course]));
  const depths = new Map<string, number>();
  const visiting = new Set<string>();
  const walk = (id: string): number => {
    const known = depths.get(id);
    if (known !== undefined) return known;
    const course = byId.get(id);
    if (!course || visiting.has(id)) return 0;
    visiting.add(id);
    const depth = course.prerequisiteCourseIds.length
      ? Math.max(...course.prerequisiteCourseIds.map(walk)) + 1
      : 0;
    visiting.delete(id);
    depths.set(id, depth);
    return depth;
  };
  for (const course of courses) walk(course.id);
  return depths;
}
