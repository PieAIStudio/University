import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

/** Trusted host configuration only. No HTTP or lesson text selects a file path. */
export function resolvePrimmPreviewSource(repoRoot, selectedRoot) {
  const repo = realpathSync(repoRoot);
  if (!selectedRoot)
    return {
      unpublished: false,
      contentRoot: join(repo, "apps/university/content"),
      recoveryRoot: join(repo, "apps/local/course-proposals/recovery/ai-literacy"),
      appEnvironment: {},
    };
  const root = realpathSync(resolve(selectedRoot));
  const receipt = JSON.parse(readFileSync(join(root, "receipt.json"), "utf8"));
  if (receipt.schemaVersion !== 1 || receipt.purpose !== "unpublished-owner-reading")
    throw Error("An explicit preview requires an unpublished native projection receipt");
  if (
    !/^[a-z0-9][a-z0-9-]+$/.test(receipt.studyId ?? "") ||
    !/^[a-z0-9][a-z0-9-]+$/.test(receipt.courseId ?? "")
  )
    throw Error("Invalid preview study/course identity");
  const inside = (field, suffix) => {
    const expected = join(root, suffix);
    if (typeof receipt[field] !== "string" || resolve(receipt[field]) !== expected)
      throw Error(`Preview ${field} does not name its own projection`);
    const actual = realpathSync(expected);
    const rel = relative(root, actual);
    if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel))
      throw Error(`Preview ${field} escapes its projection`);
    return actual;
  };
  const contentRoot = inside("contentRoot", "content");
  const recoveryRoot = inside("recoveryRoot", join("recovery", receipt.studyId));
  const manifestPath = inside("manifestPath", "imported.json");
  const bytes = readFileSync(manifestPath);
  if (createHash("sha256").update(bytes).digest("hex") !== receipt.manifestSha256)
    throw Error("Preview catalogue changed since the native projection receipt");
  const manifest = JSON.parse(bytes.toString("utf8"));
  if (
    !manifest.studies?.some(
      (study) =>
        study.studyId === receipt.studyId &&
        study.courses?.some((course) => course.courseId === receipt.courseId),
    )
  )
    throw Error("The preview receipt's course is absent from its generated catalogue");
  return {
    unpublished: true,
    contentRoot,
    recoveryRoot,
    manifestPath,
    studyId: receipt.studyId,
    courseId: receipt.courseId,
    appEnvironment: {
      UNIVERSITY_CONTENT_ROOT: contentRoot,
      UNIVERSITY_IMPORTED_MANIFEST_PATH: manifestPath,
    },
  };
}
