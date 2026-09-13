/**
 * Dedicated to this suite so the main checkout can keep 9998 / 9999 / 4317.
 *
 * The base is overridable because two worktrees can run this suite at once —
 * that is how a look change gets raced by two agents and compared on the same
 * judge. `start-servers.mjs` already read these variables; the origins the
 * specs navigate to did not, so a second run silently pointed at the first
 * run's server and both reports described one scene.
 */
import { fileURLToPath } from "node:url";
import { E2E_PORT_NAMES, readWorktreeSettings } from "../scripts/link-studies-into-worktree.mjs";

const settings = readWorktreeSettings(fileURLToPath(new URL("..", import.meta.url)));
const ports = E2E_PORT_NAMES.map((name: string, index: number) =>
  Number(process.env[name] ?? settings.ports?.[name] ?? 18093 + index),
);
if (
  ports.some((port: number) => !Number.isInteger(port) || port < 1 || port > 65535) ||
  new Set(ports).size !== 4
) {
  throw new Error("All four E2E ports must be distinct integers from 1 to 65535");
}
export const [ONLINE_PORT, LOCAL_WEB_PORT, LOCAL_API_PORT, GRADING_PORT] = ports;
export const E2E_STUDIES_ROOT = process.env.E2E_STUDIES_ROOT ?? settings.studiesRoot;

export const ONLINE_ORIGIN = `http://127.0.0.1:${ONLINE_PORT}`;
export const LOCAL_ORIGIN = `http://127.0.0.1:${LOCAL_WEB_PORT}`;
export const LOCAL_API_ORIGIN = `http://127.0.0.1:${LOCAL_API_PORT}`;
export const GRADING_ORIGIN = `http://127.0.0.1:${GRADING_PORT}`;
