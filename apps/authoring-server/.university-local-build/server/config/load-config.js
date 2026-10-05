import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, parse, relative, resolve } from "node:path";
import { AuthoringFocusSchema, UniversityLocalConfigSchema, } from "@pieai/university-core/domain/schemas.js";
import { writeJsonAtomically } from "../storage/atomic-json.js";
const BASE_CONFIG = "university-authoring.config.json";
const LOCAL_CONFIG = "university-authoring.config.local.json";
export const STUDIES_ROOT_MARKER = ".university-authoring-root";
const PartialUniversityLocalConfigSchema = UniversityLocalConfigSchema.partial().strict();
function readConfig(path) {
    if (!existsSync(path))
        return {};
    const raw = JSON.parse(readFileSync(path, "utf8"));
    const { focus: focusValue, ...others } = raw;
    const rest = PartialUniversityLocalConfigSchema.omit({ focus: true }).parse(others);
    if (focusValue === undefined)
        return rest;
    const parsed = AuthoringFocusSchema.safeParse(focusValue);
    if (parsed.success)
        return { ...rest, focus: parsed.data };
    // The authoring focus only reorders what "今日学习" reaches for first.
    // Refusing to start over it would make a preference written by an older version brick the tool
    // — including the `focus set` command that would repair it. Say so and carry
    // on unfocused.
    process.stderr.write(`Ignoring the focus in ${path}: this version does not understand it. Reset it with \`pnpm university focus set\`.\n`);
    return rest;
}
function hasValidStudiesRootMarker(studiesRoot) {
    const marker = join(studiesRoot, STUDIES_ROOT_MARKER);
    if (!existsSync(marker))
        return false;
    try {
        const value = JSON.parse(readFileSync(marker, "utf8"));
        return value["schemaVersion"] === 1 && value["product"] === "UniversityLocal";
    }
    catch {
        return false;
    }
}
function resolveFromProject(projectRoot, candidate) {
    return resolve(projectRoot, candidate);
}
export function canonicalizePotentialPath(candidate) {
    let existingAncestor = resolve(candidate);
    const missingSegments = [];
    while (!existsSync(existingAncestor)) {
        const parent = dirname(existingAncestor);
        if (parent === existingAncestor)
            break;
        missingSegments.unshift(basename(existingAncestor));
        existingAncestor = parent;
    }
    return resolve(realpathSync.native(existingAncestor), ...missingSegments);
}
export function isPathInside(parent, candidate) {
    const relation = relative(parent, candidate);
    return relation === "" || (!relation.startsWith("..") && !isAbsolute(relation));
}
function assertSafeStudiesRootLocation(projectRoot, studiesRoot) {
    const root = parse(studiesRoot).root;
    if (studiesRoot === root) {
        throw new Error("studiesRoot must be a dedicated directory, not a filesystem root");
    }
    if (studiesRoot === projectRoot || isPathInside(studiesRoot, projectRoot)) {
        throw new Error("studiesRoot must not be the project root or contain the project checkout");
    }
    const defaultRoots = new Set([
        canonicalizePotentialPath(join(projectRoot, "content/studies")),
        // Test and user-supplied project roots may still use their own local
        // `studies` directory; the University checkout's default is content/studies.
        canonicalizePotentialPath(join(projectRoot, "studies")),
    ]);
    if (isPathInside(projectRoot, studiesRoot) && !defaultRoots.has(studiesRoot)) {
        throw new Error("A project-local studiesRoot must be the default studies directory");
    }
}
function assertSafeStudiesRoot(projectRoot, studiesRoot) {
    assertSafeStudiesRootLocation(projectRoot, studiesRoot);
    if (!isPathInside(projectRoot, studiesRoot) && !hasValidStudiesRootMarker(studiesRoot)) {
        throw new Error(`External studiesRoot is missing ${STUDIES_ROOT_MARKER}; initialize it explicitly first`);
    }
}
export function initializeExternalStudiesRoot(projectRootCandidate, rootCandidate) {
    const projectRoot = realpathSync.native(projectRootCandidate);
    const studiesRoot = canonicalizePotentialPath(rootCandidate);
    assertSafeStudiesRootLocation(projectRoot, studiesRoot);
    if (isPathInside(projectRoot, studiesRoot)) {
        throw new Error("The default project studies root does not require external initialization");
    }
    if (existsSync(studiesRoot)) {
        if (hasValidStudiesRootMarker(studiesRoot))
            return studiesRoot;
        if (readdirSync(studiesRoot).length > 0) {
            throw new Error("Refusing to initialize a non-empty external studiesRoot");
        }
    }
    else {
        mkdirSync(studiesRoot, { recursive: true, mode: 0o700 });
    }
    writeJsonAtomically(join(studiesRoot, STUDIES_ROOT_MARKER), {
        schemaVersion: 1,
        product: "UniversityLocal",
    });
    return studiesRoot;
}
export function assertSeparatedRoots(studiesRoot, sourceRoot) {
    const canonicalStudiesRoot = realpathSync.native(studiesRoot);
    const canonicalSourceRoot = realpathSync.native(sourceRoot);
    if (isPathInside(canonicalStudiesRoot, canonicalSourceRoot) ||
        isPathInside(canonicalSourceRoot, canonicalStudiesRoot)) {
        throw new Error("studiesRoot and sourceRoot must be separate and must not contain each other");
    }
}
export function loadUniversityLocalConfig(options) {
    const env = options.env ?? process.env;
    // A normal checkout may export UNIVERSITY_COURSE_ROOT for the content-aware
    // verification lane. Vitest suites still create their own isolated studies
    // shelves; let those suites keep their fixture roots unless they explicitly
    // pass an environment object containing the course root.
    const useAmbientCourseRoot = options.env ? true : process.env.VITEST !== "true";
    const projectRoot = realpathSync.native(options.projectRoot);
    const base = readConfig(resolve(projectRoot, BASE_CONFIG));
    const local = readConfig(resolve(projectRoot, LOCAL_CONFIG));
    const authoringFocus = local.focus ?? base.focus;
    const configuredContentRoot = useAmbientCourseRoot && env["UNIVERSITY_COURSE_ROOT"]
        ? resolve(projectRoot, env["UNIVERSITY_COURSE_ROOT"])
        : undefined;
    const merged = UniversityLocalConfigSchema.parse({
        schemaVersion: local.schemaVersion ?? base.schemaVersion ?? 1,
        studiesRoot: env["UNIVERSITY_LOCAL_STUDIES_ROOT"] ??
            (configuredContentRoot
                ? join(configuredContentRoot, "studies")
                : (local.studiesRoot ?? base.studiesRoot ?? "./studies")),
        // The authoring focus is a personal preference, so the local file wins
        // outright rather than merging field by field: a local focus naming only a
        // study should clear a course pinned in the base file, not silently inherit it.
        ...(authoringFocus ? { focus: authoringFocus } : {}),
    });
    const studiesRoot = canonicalizePotentialPath(resolveFromProject(projectRoot, merged.studiesRoot));
    assertSafeStudiesRoot(projectRoot, studiesRoot);
    return { ...merged, projectRoot, studiesRoot };
}
//# sourceMappingURL=load-config.js.map