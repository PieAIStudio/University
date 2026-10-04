import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { ONLINE_PORT } from "./ports.ts";

// One input identity shared by the launcher, role selector and disk readers.
// Port-scoped disposable roots never resolve a personal authoring preference.
export const E2E_FIXTURE_ROOT = fileURLToPath(new URL("fixtures/catalogue/", import.meta.url));
export const E2E_RUN_ROOT = fileURLToPath(
  new URL(`../.scratch/e2e-catalogue/${ONLINE_PORT}/`, import.meta.url),
);
export const E2E_PROJECT_ROOT = join(E2E_RUN_ROOT, "project");
export const E2E_STUDIES_ROOT = join(E2E_PROJECT_ROOT, "studies");
export const E2E_COURSE_ROOT = join(E2E_RUN_ROOT, "course-root");
export const E2E_RECOVERY_ROOT = join(E2E_COURSE_ROOT, "course-proposals/recovery");
export const E2E_SOURCE_ROOT = join(E2E_RUN_ROOT, "source");
export const E2E_CONTENT_ROOT = join(E2E_RUN_ROOT, "content");
export const E2E_IMPORTED_MANIFEST = join(E2E_RUN_ROOT, "imported.json");
