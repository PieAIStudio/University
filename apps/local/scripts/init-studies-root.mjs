import { resolve } from "node:path";

import { initializeExternalStudiesRoot } from "../.university-local-build/server/config/load-config.js";

const projectRoot = resolve(import.meta.dirname, "..");
const forwarded = process.argv.slice(2);
const candidate = forwarded[0] === "--" ? forwarded[1] : forwarded[0];

if (!candidate) {
  console.error("Usage: pnpm studies:init -- /absolute/path/to/studies");
  process.exit(2);
}

const studiesRoot = initializeExternalStudiesRoot(projectRoot, resolve(candidate));
console.log(`Initialized UniversityLocal studies root: ${studiesRoot}`);
