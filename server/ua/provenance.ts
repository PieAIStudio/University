import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readlinkSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";

import { UaEngineProvenanceSchema, type UaEngineProvenance } from "../../src/domain/schemas.js";

export type { UaEngineProvenance } from "../../src/domain/schemas.js";

interface InspectUaEngineProvenanceInput {
  readonly skillPath?: string;
  readonly source?: UaEngineProvenance["source"];
}

function git(cwd: string, args: readonly string[]): Buffer {
  return execFileSync("git", ["-C", cwd, ...args], {
    env: {
      ...process.env,
      GIT_LITERAL_PATHSPECS: "1",
      GIT_OPTIONAL_LOCKS: "0",
      GIT_TERMINAL_PROMPT: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function gitText(cwd: string, args: readonly string[]): string {
  return git(cwd, args).toString("utf8").trim();
}

function normalizeRelativePath(value: string): string {
  return value.split(sep).join("/");
}

function pluginBoundary(repository: string, skill: string): string {
  const skillRelative = relative(repository, skill);
  if (
    skillRelative === "" ||
    skillRelative === ".." ||
    skillRelative.startsWith(`..${sep}`) ||
    resolve(repository, skillRelative) !== skill
  ) {
    throw new Error("UA skill is not contained by its Git repository");
  }
  const [topLevel] = skillRelative.split(sep);
  if (!topLevel || topLevel === ".") throw new Error("UA plugin boundary could not be resolved");
  return topLevel;
}

function hashPluginFiles(repository: string, boundary: string): `sha256:${string}` {
  const listed = git(repository, ["ls-files", "-co", "--exclude-standard", "-z", "--", boundary])
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .sort();
  if (listed.length === 0) throw new Error("UA plugin contains no inspectable source files");

  const hash = createHash("sha256");
  for (const path of listed) {
    const absolute = resolve(repository, path);
    if (!absolute.startsWith(`${resolve(repository)}${sep}`)) {
      throw new Error(`UA provenance path escapes its repository: ${path}`);
    }
    let stat;
    try {
      stat = lstatSync(absolute);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        hash.update(normalizeRelativePath(path));
        hash.update("\0deleted\0");
        continue;
      }
      throw error;
    }
    hash.update(normalizeRelativePath(path));
    hash.update("\0");
    if (stat.isSymbolicLink()) {
      hash.update("symlink\0");
      hash.update(readlinkSync(absolute));
    } else if (stat.isFile()) {
      hash.update(stat.mode & 0o111 ? "executable\0" : "file\0");
      hash.update(readFileSync(absolute));
    } else {
      throw new Error(`UA provenance includes an unsupported file type: ${path}`);
    }
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

/**
 * Records the actual local UA implementation that a bare `/understand` resolves to.
 * Paths remain machine-local; manifests receive only a repository-relative entry path.
 */
export function inspectUaEngineProvenance(
  input: InspectUaEngineProvenanceInput = {},
): UaEngineProvenance {
  const requestedSkill = input.skillPath ?? join(homedir(), ".agents", "skills", "understand");
  const skill = realpathSync(requestedSkill);
  const repository = realpathSync(gitText(dirname(skill), ["rev-parse", "--show-toplevel"]));
  const boundary = pluginBoundary(repository, skill);
  const revision = gitText(repository, ["rev-parse", "HEAD"]);
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error("UA engine revision is not a full commit");
  const status = gitText(repository, [
    "status",
    "--porcelain=v1",
    "--untracked-files=normal",
    "--",
    boundary,
  ]);
  const entryPath = normalizeRelativePath(relative(repository, skill));

  return UaEngineProvenanceSchema.parse({
    source: input.source ?? "user-skill-local-git",
    revision,
    contentHash: hashPluginFiles(repository, boundary),
    dirty: status.length > 0,
    entryPath,
  });
}
