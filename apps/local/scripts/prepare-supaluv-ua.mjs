import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { loadUniversityLocalConfig } from "../.university-local-build/server/config/load-config.js";
import { getUaAnalysisPaths } from "../.university-local-build/server/studies/paths.js";
import { createCleanSnapshot } from "../.university-local-build/server/studies/snapshots.js";
import {
  createUaAnalysisIdentity,
  prepareUaAnalysis,
} from "../.university-local-build/server/ua/adapter.js";

const projectRoot = resolve(import.meta.dirname, "..");
const config = loadUniversityLocalConfig({ projectRoot });
const studyId = "supaluv";
const snapshot = createCleanSnapshot(config.studiesRoot, studyId, "HEAD");
const engineVersion = "2.9.4";
const outputLanguage = "zh";
const analysisId =
  process.argv[2] ??
  createUaAnalysisIdentity({
    snapshotId: snapshot.id,
    sourceCommit: snapshot.sourceCommit,
    engineVersion,
    outputLanguage,
  }).analysisId;
const paths = getUaAnalysisPaths(config.studiesRoot, studyId, analysisId);

if (existsSync(paths.manifest)) {
  const existing = JSON.parse(readFileSync(paths.manifest, "utf8"));
  if (existing.status !== "preparing") {
    throw new Error(
      `UA analysis ${analysisId} is already ${String(existing.status)}; pass a new analysis ID to start another full run`,
    );
  }
}

console.log(
  JSON.stringify(
    prepareUaAnalysis({
      studiesRoot: config.studiesRoot,
      studyId,
      snapshotId: snapshot.id,
      analysisId,
      engineVersion,
      outputLanguage,
    }),
    null,
    2,
  ),
);
