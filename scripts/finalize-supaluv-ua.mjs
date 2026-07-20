import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { loadUniversityLocalConfig } from "../.university-local-build/server/config/load-config.js";
import {
  getStudyPaths,
  getUaAnalysisPaths,
} from "../.university-local-build/server/studies/paths.js";
import { finalizeUaAnalysis } from "../.university-local-build/server/ua/adapter.js";

const projectRoot = resolve(import.meta.dirname, "..");
const config = loadUniversityLocalConfig({ projectRoot });
const studyId = "supaluv";

function readManifest(analysisId) {
  const path = getUaAnalysisPaths(config.studiesRoot, studyId, analysisId).manifest;
  if (!existsSync(path)) throw new Error(`UA analysis does not exist: ${analysisId}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function discoverPreparingAnalysis() {
  const uaRoot = getStudyPaths(config.studiesRoot, studyId).ua;
  const preparing = readdirSync(uaRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((analysisId) => readManifest(analysisId).status === "preparing");
  if (preparing.length !== 1) {
    throw new Error(
      `Expected exactly one preparing SupaLuv UA analysis, found ${preparing.length}; pass its analysis ID explicitly`,
    );
  }
  return preparing[0];
}

const analysisId = process.argv[2] ?? discoverPreparingAnalysis();
const manifest = readManifest(analysisId);
if (manifest.status !== "preparing") {
  throw new Error(`UA analysis ${analysisId} is ${String(manifest.status)}, not preparing`);
}

console.log(JSON.stringify(finalizeUaAnalysis(config.studiesRoot, studyId, analysisId), null, 2));
