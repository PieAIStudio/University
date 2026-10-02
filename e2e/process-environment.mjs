/** Git hooks export repository-local paths. A child preparing test repositories
 * must not inherit the University's index, object store, worktree or refs.
 * Explicit overrides are runner-owned settings, not inherited shell state. */
export function testProcessEnvironment(overrides = {}) {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
  );
  return { ...environment, ...overrides };
}
