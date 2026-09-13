#!/usr/bin/env node
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs, parseEnv } from "node:util";

export const E2E_PORT_NAMES = [
  "E2E_ONLINE_PORT",
  "E2E_LOCAL_WEB_PORT",
  "E2E_LOCAL_API_PORT",
  "E2E_GRADING_PORT",
];
const PUBLIC_ENV_KEYS = [
  "VITE_SWIMMER_BACKEND_SUPABASE_URL",
  "VITE_SWIMMER_BACKEND_PUBLISHABLE_KEY",
  "VITE_UNIVERSITY_GRADING_URL",
  "VITE_UNIVERSITY_VAPID_PUBLIC_KEY",
  "VITE_POSTHOG_KEY",
  "VITE_POSTHOG_HOST",
  "VITE_ENABLE_POSTHOG",
];
const stat = (path) => lstatSync(path, { throwIfNoEntry: false });
const inside = (parent, child) => {
  const path = relative(parent, child);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
};

/**
 * Preserve the tracked skeleton and every existing user path. Linking a whole
 * study over its partly tracked directory would stage real lesson deletions.
 */
export function linkMissing(real, mirror) {
  let linked = 0;
  for (const name of readdirSync(real)) {
    const source = join(real, name);
    const target = join(mirror, name);
    const targetStat = stat(target);
    if (!targetStat) {
      symlinkSync(source, target, stat(source).isDirectory() ? "dir" : "file");
      linked += 1;
    } else if (targetStat.isSymbolicLink()) {
      if (!existsSync(target)) throw new Error("Broken existing study link: " + target);
    } else if (stat(source).isDirectory() && targetStat.isDirectory()) {
      linked += linkMissing(source, target);
    }
  }
  return linked;
}

export function projectPublicEnv(source, target) {
  // Existing local configuration belongs to its owner, even if it differs.
  if (stat(target)) {
    if (!existsSync(target)) throw new Error("Broken existing app env link: " + target);
    return false;
  }
  if (!existsSync(source)) throw new Error("Missing source apps/university/.env.local");
  const values = parseEnv(readFileSync(source, "utf8"));
  for (const key of PUBLIC_ENV_KEYS.slice(0, 2)) {
    if (!values[key]) throw new Error("Missing public app configuration: " + key);
  }
  const key = values.VITE_SWIMMER_BACKEND_PUBLISHABLE_KEY;
  let role;
  if (key.startsWith("eyJ")) {
    try {
      role = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role;
    } catch {
      throw new Error("Invalid public app key");
    }
  }
  if (key.startsWith("sb_secret_") || role === "service_role") {
    throw new Error("Refuse to project a server key into the browser");
  }
  const body =
    PUBLIC_ENV_KEYS.filter((name) => values[name] !== undefined)
      .map((name) => name + "=" + JSON.stringify(values[name]))
      .join("\n") + "\n";
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, body, { mode: 0o600, flag: "wx" });
  return true;
}

export function readWorktreeSettings(root) {
  const path = join(root, ".scratch/worktree.json");
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
}

/** Reserve all ports together; never terminate or silently reuse a listener. */
export async function reservePorts(requested) {
  const fixed = requested.filter((port) => port !== 0);
  if (
    new Set(fixed).size !== fixed.length ||
    requested.some((port) => !Number.isInteger(port) || port < 0 || port > 65535)
  ) {
    throw new Error(
      "E2E ports must be distinct integers from 1 to 65535 (0 allocates a free port)",
    );
  }
  const servers = [];
  const release = () =>
    Promise.all(servers.map((server) => new Promise((done) => server.close(done))));
  try {
    for (const port of requested) {
      const server = createServer();
      await new Promise((done, reject) => {
        server.once("error", () =>
          reject(
            new Error(
              "E2E port " +
                port +
                " is unavailable. Inspect lsof -nP -iTCP:" +
                port +
                " -sTCP:LISTEN and the PID's cwd; stop only your own interrupted run.",
            ),
          ),
        );
        server.listen(port, "127.0.0.1", done);
      });
      servers.push(server);
    }
    return { ports: servers.map((server) => server.address().port), release };
  } catch (error) {
    await release();
    throw error;
  }
}

/** Current committed input is the shrink baseline, never a previous run's cache. */
export function refreshE2EManifest(root) {
  const folder = join(root, ".scratch/evidence2");
  mkdirSync(folder, { recursive: true });
  const target = join(folder, "e2e-imported.json");
  if (stat(folder).isSymbolicLink() || stat(target)?.isSymbolicLink()) {
    throw new Error("Refuse to replace a symlinked E2E manifest: " + target);
  }
  copyFileSync(join(root, "apps/university/src/content/imported.json"), target);
}

function requireStudiesRoot(path) {
  const root = realpathSync(path);
  const marker = JSON.parse(readFileSync(join(root, ".university-local-root"), "utf8"));
  if (marker.schemaVersion !== 1 || marker.product !== "UniversityLocal") {
    throw new Error("Invalid studies root marker: " + root);
  }
  return root;
}

/** Preserve an isolated input intact, with its old path still resolving to it. */
export function relocateNestedStudies(worktreeCandidate) {
  const worktree = realpathSync(worktreeCandidate);
  const nested = join(worktree, "apps/local/studies/studies");
  if (!stat(nested)) return null;
  const root = requireStudiesRoot(nested);
  if (!inside(join(worktree, "apps/local"), root)) return root;
  if (stat(nested).isSymbolicLink()) {
    throw new Error(
      "Nested study link resolves inside apps/local; select --studies-root explicitly",
    );
  }
  const target = join(worktree, ".scratch/worktree-studies");
  if (stat(target))
    throw new Error("Preserve both study inputs; relocation target exists: " + target);
  mkdirSync(dirname(target), { recursive: true });
  renameSync(nested, target);
  try {
    symlinkSync(relative(dirname(nested), target), nested, "dir");
  } catch (error) {
    renameSync(target, nested);
    throw error;
  }
  console.log(
    "worktree: preserved nested isolation input at " + target + "; old path remains linked",
  );
  return realpathSync(target);
}

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function run(cwd, args, extraEnv = {}) {
  const result = spawnSync("pnpm", args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0)
    throw new Error("pnpm " + args.join(" ") + " failed (" + result.status + ")");
}

export async function prepareWorktree(worktreeCandidate, options = {}) {
  const worktree = realpathSync(worktreeCandidate);
  const common = realpathSync(resolve(worktree, git(worktree, "rev-parse", "--git-common-dir")));
  const main = dirname(common);
  const registered = git(main, "worktree", "list", "--porcelain")
    .split("\n")
    .filter((line) => line.startsWith("worktree "))
    .map((line) => realpathSync(line.slice(9)));
  if (
    !registered.includes(worktree) ||
    worktree === main ||
    !inside(join(main, ".worktrees"), worktree)
  ) {
    throw new Error("Select a registered University worktree under " + join(main, ".worktrees"));
  }
  if (process.env.UNIVERSITY_LOCAL_STUDIES_ROOT) {
    throw new Error("Unset UNIVERSITY_LOCAL_STUDIES_ROOT before preparation and pnpm verify");
  }
  const settings = readWorktreeSettings(worktree);
  const requested =
    options.portBase === undefined
      ? E2E_PORT_NAMES.map((name) => settings.ports?.[name] ?? 0)
      : E2E_PORT_NAMES.map((_, index) => options.portBase + index);
  const reservation = await reservePorts(requested);
  try {
    const studiesRoot = options.studiesRoot
      ? requireStudiesRoot(resolve(options.studiesRoot))
      : (relocateNestedStudies(worktree) ?? requireStudiesRoot(join(main, "apps/local/studies")));

    // Preserve the raw tracked PGS links. The one ignored bridge compensates
    // for the extra .worktrees directory depth without editing shared assets.
    const pgs = join(dirname(main), "ProjectGovernanceSystem");
    if (existsSync(pgs)) {
      const bridge = join(main, ".worktrees/ProjectGovernanceSystem");
      if (!stat(bridge)) symlinkSync(realpathSync(pgs), bridge, "dir");
      if (!existsSync(bridge) || realpathSync(bridge) !== realpathSync(pgs)) {
        throw new Error("Existing PGS bridge points elsewhere: " + bridge);
      }
    }
    const linked = linkMissing(
      join(main, "apps/local/studies"),
      join(worktree, "apps/local/studies"),
    );
    const projected = projectPublicEnv(
      join(main, "apps/university/.env.local"),
      join(worktree, "apps/university/.env.local"),
    );
    console.log(
      "worktree: linked " +
        linked +
        " missing study paths; public env " +
        (projected ? "projected (deployment/server fields omitted)" : "preserved"),
    );

    run(worktree, ["install", "--frozen-lockfile", "--prefer-offline"]);
    const content = join(worktree, "apps/university/content");
    const scratch = join(worktree, ".scratch");
    mkdirSync(scratch, { recursive: true });
    // Older setup shared a generated cache with main. Keep that link as a
    // recoverable receipt; rebuilding this branch must never clear main's cache.
    if (stat(content)?.isSymbolicLink()) {
      const backup = join(scratch, "content-link-before-prepare-" + Date.now());
      renameSync(content, backup);
      console.log("worktree: preserved old shared content link at " + backup);
    }
    const manifestPath = join(worktree, "apps/university/src/content/imported.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    run(worktree, ["content"], {
      UNIVERSITY_STUDIES_ROOT: studiesRoot,
      UNIVERSITY_UPSTREAM_RECOVERY: join(worktree, "apps/local/course-proposals/recovery"),
      UNIVERSITY_UPSTREAM_LEXICON: join(worktree, "apps/local/data/vocabulary/en.json"),
      UNIVERSITY_CONTENT_ROOT: content,
      UNIVERSITY_IMPORTED_MANIFEST_PATH: manifestPath,
      UNIVERSITY_IMPORT_DATE: manifest.importedAt,
      UNIVERSITY_EVIDENCE_MODE: "auto",
      UNIVERSITY_REQUIRE_BAKED_EVIDENCE: "1",
    });
    run(worktree, [
      "exec",
      "oxfmt",
      "--write",
      "apps/university/src/content/imported.json",
      "apps/university/src/content/lexicon.json",
    ]);
    refreshE2EManifest(worktree);
    const ports = Object.fromEntries(
      E2E_PORT_NAMES.map((name, index) => [name, reservation.ports[index]]),
    );
    writeFileSync(
      join(scratch, "worktree.json"),
      JSON.stringify({ studiesRoot, ports }, null, 2) + "\n",
      { mode: 0o600 },
    );
    console.log("worktree ready: " + worktree);
    console.log("E2E ports: " + JSON.stringify(ports));
    console.log("Next, in this worktree: pnpm verify && pnpm e2e");
  } finally {
    await reservation.release();
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: {
        "studies-root": { type: "string" },
        "e2e-port-base": { type: "string" },
        help: { type: "boolean" },
      },
    });
    if (values.help) {
      console.log(
        "Usage: pnpm worktree:prepare <worktree-path> [--studies-root <path>] [--e2e-port-base <port>]",
      );
    } else {
      if (positionals.length !== 1) throw new Error("Usage: pnpm worktree:prepare <worktree-path>");
      await prepareWorktree(resolve(positionals[0]), {
        studiesRoot: values["studies-root"],
        portBase:
          values["e2e-port-base"] === undefined ? undefined : Number(values["e2e-port-base"]),
      });
    }
  } catch (error) {
    console.error("worktree preparation: " + error.message);
    process.exitCode = 1;
  }
}
