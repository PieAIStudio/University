import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { loadUniversityLocalConfig } from "../.university-local-build/server/config/load-config.js";
import { SqliteLearningStore } from "../.university-local-build/server/learning/sqlite-learning-store.js";
import {
  getStudyPaths,
  getUaAnalysisPaths,
} from "../.university-local-build/server/studies/paths.js";
import {
  createStudy,
  readStudy,
  registerLocalGitSource,
} from "../.university-local-build/server/studies/repository.js";
import { createCleanSnapshot } from "../.university-local-build/server/studies/snapshots.js";
import { importLegacyUaAnalysis } from "../.university-local-build/server/ua/import-legacy.js";

const projectRoot = resolve(import.meta.dirname, "..");
const sourceRoot = "/Users/yuanfei/PieAI/SupaLuv";
const legacyUa = `${sourceRoot}/.ua`;
const studyId = "supaluv";
const config = loadUniversityLocalConfig({ projectRoot });
const paths = getStudyPaths(config.studiesRoot, studyId);

function git(args) {
  return execFileSync("git", ["-C", sourceRoot, ...args], { encoding: "utf8" }).trim();
}

const beforeStatus = git(["status", "--porcelain=v1"]);
const legacyMeta = JSON.parse(readFileSync(`${legacyUa}/meta.json`, "utf8"));

const study = existsSync(paths.manifest)
  ? readStudy(config.studiesRoot, studyId)
  : createStudy(config.studiesRoot, {
      id: studyId,
      title: "SupaLuv",
      description: "用创始人和工程维护者视角学习 SupaLuv 的产品与技术系统。",
      goals: [
        "理解产品架构与关键边界",
        "能够判断改动影响并维护产品",
        "把源码证据转化为长期可复习的知识",
      ],
    });

if (!existsSync(paths.source.registration)) {
  registerLocalGitSource(config.studiesRoot, studyId, sourceRoot);
}
const legacySnapshot = createCleanSnapshot(config.studiesRoot, studyId, legacyMeta.gitCommitHash);
const legacyAnalysisId = "ua-legacy-20260719";
const legacyPaths = getUaAnalysisPaths(config.studiesRoot, studyId, legacyAnalysisId);
const legacyAnalysis = existsSync(legacyPaths.manifest)
  ? JSON.parse(readFileSync(legacyPaths.manifest, "utf8"))
  : importLegacyUaAnalysis({
      studiesRoot: config.studiesRoot,
      studyId,
      snapshotId: legacySnapshot.id,
      analysisId: legacyAnalysisId,
      sourceUaDirectory: legacyUa,
      engineVersion: "2.9.4",
    });
const currentSnapshot = createCleanSnapshot(config.studiesRoot, studyId, "HEAD");

// Opening the store is deliberate even when the database already exists: startup migrations and
// scheduler-profile validation must run before the bootstrap is considered complete.
const store = new SqliteLearningStore(paths.learner.database);
store.close();

const afterStatus = git(["status", "--porcelain=v1"]);
if (afterStatus !== beforeStatus) {
  throw new Error("SupaLuv working tree changed during UniversityLocal bootstrap");
}

console.log(
  JSON.stringify(
    {
      study,
      legacySnapshot,
      legacyAnalysis,
      currentSnapshot,
      sourceWorkingTreeUnchanged: true,
    },
    null,
    2,
  ),
);
