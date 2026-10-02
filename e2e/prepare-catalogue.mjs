#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { testProcessEnvironment } from "./process-environment.mjs";
import { reservePorts } from "../scripts/link-studies-into-worktree.mjs";
import { ONLINE_PORT, LOCAL_WEB_PORT, LOCAL_API_PORT, GRADING_PORT } from "./ports.ts";
import {
  E2E_STUDIES_ROOT,
  E2E_RECOVERY_ROOT,
  E2E_CONTENT_ROOT,
  E2E_IMPORTED_MANIFEST,
} from "./catalogue-paths.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const reservation = await reservePorts([ONLINE_PORT, LOCAL_WEB_PORT, LOCAL_API_PORT, GRADING_PORT]);
await reservation.release();
function must(command, args, cwd = ROOT, env = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: testProcessEnvironment(env),
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("e2e: restoring frozen test inputs through the production recovery importer");
must("pnpm", ["--filter", "@pieai/university-core", "build"]);
must("pnpm", ["exec", "tsc", "-p", "tsconfig.server.build.json"], join(ROOT, "apps/local"));
must("node", ["e2e/seed-catalogue.mjs"]);
console.log("e2e: baking the test-owned catalogue, not the delivery shelf");
must("node", ["apps/university/scripts/import-courses.mjs"], ROOT, {
  UNIVERSITY_UPSTREAM_RECOVERY: E2E_RECOVERY_ROOT,
  UNIVERSITY_STUDIES_ROOT: E2E_STUDIES_ROOT,
  UNIVERSITY_CONTENT_ROOT: E2E_CONTENT_ROOT,
  UNIVERSITY_IMPORTED_MANIFEST_PATH: E2E_IMPORTED_MANIFEST,
  UNIVERSITY_EVIDENCE_MODE: "auto",
  UNIVERSITY_REQUIRE_BAKED_EVIDENCE: "1",
  UNIVERSITY_IMPORT_DATE: "2026-10-02",
});
