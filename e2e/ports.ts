/**
 * Dedicated to this suite so the main checkout can keep 9998 / 9999 / 4317.
 *
 * The base is overridable because two worktrees can run this suite at once —
 * that is how a look change gets raced by two agents and compared on the same
 * judge. `start-servers.mjs` already read these variables; the origins the
 * specs navigate to did not, so a second run silently pointed at the first
 * run's server and both reports described one scene.
 */
const ONLINE_PORT = Number(process.env.E2E_ONLINE_PORT ?? 18093);
const LOCAL_WEB_PORT = Number(process.env.E2E_LOCAL_WEB_PORT ?? 18094);
const LOCAL_API_PORT = Number(process.env.E2E_LOCAL_API_PORT ?? 18095);
const GRADING_PORT = Number(process.env.E2E_GRADING_PORT ?? 18096);

export const ONLINE_ORIGIN = `http://127.0.0.1:${ONLINE_PORT}`;
export const LOCAL_ORIGIN = `http://127.0.0.1:${LOCAL_WEB_PORT}`;
export const LOCAL_API_ORIGIN = `http://127.0.0.1:${LOCAL_API_PORT}`;
export const GRADING_ORIGIN = `http://127.0.0.1:${GRADING_PORT}`;
