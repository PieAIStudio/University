import { resolve } from "node:path";

/**
 * The course repository has one shape everywhere:
 *   studies/                 authoring sources and learner state
 *   course-proposals/        recovery, locked and retired packages
 *   vocabulary/              delivery lexicons
 *
 * Callers may still supply a project root while the repository is being
 * prepared. Once `UNIVERSITY_COURSE_ROOT` is set, every content path must be
 * derived from this object; no caller should invent a second root or combine
 * paths from University with paths from UniversityCourses.
 */
export function contentRoot({ projectRoot = process.cwd(), env = process.env } = {}) {
  const configured = env.UNIVERSITY_COURSE_ROOT;
  if (configured) return resolve(projectRoot, configured);
  return resolve(projectRoot, "apps/local/content");
}

export function contentPaths(options = {}) {
  const root = contentRoot(options);
  return {
    root,
    studies: resolve(root, "studies"),
    recovery: resolve(root, "course-proposals/recovery"),
    locked: resolve(root, "course-proposals/locked"),
    retired: resolve(root, "course-proposals/retired"),
    proposals: resolve(root, "course-proposals"),
    vocabulary: resolve(root, "vocabulary"),
    lexicon: resolve(root, "vocabulary/en.json"),
  };
}
