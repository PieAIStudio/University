import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, parse, relative, resolve } from "node:path";

import {
  UniversityLocalConfigSchema,
  type UniversityLocalConfig,
} from "../../src/domain/schemas.js";
import { writeJsonAtomically } from "../storage/atomic-json.js";

const BASE_CONFIG = "university-local.config.json";
const LOCAL_CONFIG = "university-local.config.local.json";
export const STUDIES_ROOT_MARKER = ".university-local-root";
const PartialUniversityLocalConfigSchema = UniversityLocalConfigSchema.partial().strict();

export interface LoadConfigOptions {
  readonly projectRoot: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

export interface ResolvedUniversityLocalConfig extends UniversityLocalConfig {
  readonly projectRoot: string;
  readonly studiesRoot: string;
}

function readConfig(path: string): Partial<UniversityLocalConfig> {
  if (!existsSync(path)) return {};
  return PartialUniversityLocalConfigSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}

function hasValidStudiesRootMarker(studiesRoot: string): boolean {
  const marker = join(studiesRoot, STUDIES_ROOT_MARKER);
  if (!existsSync(marker)) return false;
  try {
    const value = JSON.parse(readFileSync(marker, "utf8")) as Record<string, unknown>;
    return value["schemaVersion"] === 1 && value["product"] === "UniversityLocal";
  } catch {
    return false;
  }
}

function resolveFromProject(projectRoot: string, candidate: string): string {
  return resolve(projectRoot, candidate);
}

export function canonicalizePotentialPath(candidate: string): string {
  let existingAncestor = resolve(candidate);
  const missingSegments: string[] = [];
  while (!existsSync(existingAncestor)) {
    const parent = dirname(existingAncestor);
    if (parent === existingAncestor) break;
    missingSegments.unshift(basename(existingAncestor));
    existingAncestor = parent;
  }
  return resolve(realpathSync.native(existingAncestor), ...missingSegments);
}

export function isPathInside(parent: string, candidate: string): boolean {
  const relation = relative(parent, candidate);
  return relation === "" || (!relation.startsWith("..") && !isAbsolute(relation));
}

function assertSafeStudiesRootLocation(projectRoot: string, studiesRoot: string): void {
  const root = parse(studiesRoot).root;
  if (studiesRoot === root) {
    throw new Error("studiesRoot must be a dedicated directory, not a filesystem root");
  }
  if (studiesRoot === projectRoot || isPathInside(studiesRoot, projectRoot)) {
    throw new Error("studiesRoot must not be the project root or contain the project checkout");
  }
  const defaultRoot = canonicalizePotentialPath(join(projectRoot, "studies"));
  if (isPathInside(projectRoot, studiesRoot) && studiesRoot !== defaultRoot) {
    throw new Error("A project-local studiesRoot must be the default studies directory");
  }
}

export function assertSafeStudiesRoot(projectRoot: string, studiesRoot: string): void {
  assertSafeStudiesRootLocation(projectRoot, studiesRoot);
  if (!isPathInside(projectRoot, studiesRoot) && !hasValidStudiesRootMarker(studiesRoot)) {
    throw new Error(
      `External studiesRoot is missing ${STUDIES_ROOT_MARKER}; initialize it explicitly first`,
    );
  }
}

export function initializeExternalStudiesRoot(
  projectRootCandidate: string,
  rootCandidate: string,
): string {
  const projectRoot = realpathSync.native(projectRootCandidate);
  const studiesRoot = canonicalizePotentialPath(rootCandidate);
  assertSafeStudiesRootLocation(projectRoot, studiesRoot);
  if (isPathInside(projectRoot, studiesRoot)) {
    throw new Error("The default project studies root does not require external initialization");
  }
  if (existsSync(studiesRoot)) {
    if (hasValidStudiesRootMarker(studiesRoot)) return studiesRoot;
    if (readdirSync(studiesRoot).length > 0) {
      throw new Error("Refusing to initialize a non-empty external studiesRoot");
    }
  } else {
    mkdirSync(studiesRoot, { recursive: true, mode: 0o700 });
  }
  writeJsonAtomically(join(studiesRoot, STUDIES_ROOT_MARKER), {
    schemaVersion: 1,
    product: "UniversityLocal",
  });
  return studiesRoot;
}

export function assertSeparatedRoots(studiesRoot: string, sourceRoot: string): void {
  const canonicalStudiesRoot = realpathSync.native(studiesRoot);
  const canonicalSourceRoot = realpathSync.native(sourceRoot);
  if (
    isPathInside(canonicalStudiesRoot, canonicalSourceRoot) ||
    isPathInside(canonicalSourceRoot, canonicalStudiesRoot)
  ) {
    throw new Error("studiesRoot and sourceRoot must be separate and must not contain each other");
  }
}

export function loadUniversityLocalConfig(
  options: LoadConfigOptions,
): ResolvedUniversityLocalConfig {
  const env = options.env ?? process.env;
  const projectRoot = realpathSync.native(options.projectRoot);
  const base = readConfig(resolve(projectRoot, BASE_CONFIG));
  const local = readConfig(resolve(projectRoot, LOCAL_CONFIG));
  const merged = UniversityLocalConfigSchema.parse({
    schemaVersion: local.schemaVersion ?? base.schemaVersion ?? 1,
    studiesRoot:
      env["UNIVERSITY_LOCAL_STUDIES_ROOT"] ?? local.studiesRoot ?? base.studiesRoot ?? "./studies",
  });
  const studiesRoot = canonicalizePotentialPath(
    resolveFromProject(projectRoot, merged.studiesRoot),
  );
  assertSafeStudiesRoot(projectRoot, studiesRoot);
  return { ...merged, projectRoot, studiesRoot };
}
