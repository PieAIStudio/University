#!/usr/bin/env node
/**
 * Bring up both modes on the e2e ports, then sit until Playwright kills us.
 *
 * The authoring mode is a chain (core build → server emit → API → Vite).
 * Spawning `pnpm dev` would also take 9998/9999/4317 and watch studies/, which
 * is the opposite of what a test run wants. This script is the one place that
 * knows the ports, so the tests never invent a second launcher.
 *
 * Both Vite instances now run in one app directory, so each gets its own
 * pre-bundle cache — `UNIVERSITY_E2E` plus the mode name, decided in
 * `apps/university/vite.config.ts`. Sharing one would have the second instance
 * rewrite the first's dependency hashes, and a campus that was working a second
 * ago answers 504 Outdated Optimize Dep with a white page.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LOCAL = join(ROOT, "apps/local");
const APP = join(ROOT, "apps/university");
const GRADING = join(ROOT, "apps/university-grading");
const E2E_CONTENT_ROOT = join(ROOT, ".scratch/evidence2/e2e-content");
const E2E_IMPORTED_MANIFEST = join(ROOT, ".scratch/evidence2/e2e-imported.json");

const ONLINE_PORT = Number(process.env.E2E_ONLINE_PORT ?? 18093);
const LOCAL_WEB_PORT = Number(process.env.E2E_LOCAL_WEB_PORT ?? 18094);
const LOCAL_API_PORT = Number(process.env.E2E_LOCAL_API_PORT ?? 18095);
const GRADING_PORT = Number(process.env.E2E_GRADING_PORT ?? 18096);
const LOCAL_API_ORIGIN = `http://127.0.0.1:${LOCAL_API_PORT}`;
const GRADING_ORIGIN = `http://127.0.0.1:${GRADING_PORT}`;
const SERVER_ONLY_ENV = [
  "OPENROUTER_API_KEY",
  "SWIMMER_BACKEND_SUPABASE_URL",
  "SWIMMER_BACKEND_PUBLISHABLE_KEY",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "SUPABASE_DEFAULT_KEY",
  "UNIVERSITY_WALLET_APP_ID",
  "UNIVERSITY_WEB_ORIGIN",
];

const children = [];

function run(command, args, cwd, extraEnv = {}) {
  const childEnv = { ...process.env, ...extraEnv };
  // Vite only embeds VITE_* values, but do not hand the browser-mode process
  // server credentials at all. The grading child keeps them in its own
  // process, where the Vercel function is the only consumer.
  if (extraEnv.E2E_TAG === "online" || extraEnv.E2E_TAG === "local") {
    for (const name of SERVER_ONLY_ENV) delete childEnv[name];
  }
  const child = spawn(command, args, {
    cwd,
    env: childEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const tag = `[${extraEnv.E2E_TAG ?? (cwd === LOCAL ? "api" : cwd === GRADING ? "grading" : "e2e")}]`;
  const pipe = (stream, sink) => {
    stream.setEncoding("utf8");
    let rest = "";
    stream.on("data", (chunk) => {
      const lines = (rest + chunk).split("\n");
      rest = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) sink.write(`${tag} ${line}\n`);
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  children.push(child);
  child.on("exit", (code, signal) => {
    if (!stopping && code !== 0 && signal !== "SIGTERM") {
      console.error(`${tag} exited (${code ?? signal})`);
      stop("SIGTERM");
      process.exitCode = code ?? 1;
    }
  });
  return child;
}

function must(command, args, cwd, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function waitFor(url, timeoutMs) {
  const start = Date.now();
  let last = "";
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) return;
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`timed out waiting for ${url} (${last})`);
}

let stopping = false;
function stop(signal) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try {
      child.kill(signal);
    } catch {
      // already gone
    }
  }
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
process.on("exit", () => stop("SIGTERM"));

// The delivery gate needs source bytes, but this worktree deliberately keeps
// its content directory as a symlink and the generated packages out of git.
// Build a fresh, isolated baked fixture for every run so the browser never
// passes by reading a stale none-mode package left by another task.
console.log("e2e: importing baked course content for the delivery mode");
must("pnpm", ["content"], ROOT, {
  UNIVERSITY_CONTENT_ROOT: E2E_CONTENT_ROOT,
  UNIVERSITY_IMPORTED_MANIFEST_PATH: E2E_IMPORTED_MANIFEST,
  UNIVERSITY_EVIDENCE_MODE: "auto",
  UNIVERSITY_REQUIRE_BAKED_EVIDENCE: "1",
});

console.log("e2e: building @pieai/university-core (the local API cannot import .ts)");
must("pnpm", ["--filter", "@pieai/university-core", "build"], ROOT);
must("pnpm", ["exec", "tsc", "-p", "tsconfig.server.build.json"], LOCAL);

const nestedStudies = join(LOCAL, "studies", "studies");
const localApiEnv = {
  UNIVERSITY_LOCAL_PORT: String(LOCAL_API_PORT),
  UNIVERSITY_LOCAL_PROJECT_ROOT: LOCAL,
};
// This worktree keeps personal studies behind a nested symlink so the
// checkout does not own learner data. Point the API at the containers
// themselves, otherwise bootstrap is an empty shelf and the authoring
// walk never finds 「开始学习」.
if (existsSync(nestedStudies)) {
  localApiEnv.UNIVERSITY_LOCAL_STUDIES_ROOT = nestedStudies;
}

run("node", [join(LOCAL, ".university-local-build/server/http-server.js")], LOCAL, localApiEnv);

run(
  "pnpm",
  ["exec", "vercel", "dev", "--local", "--listen", `127.0.0.1:${GRADING_PORT}`, "--yes"],
  GRADING,
  {
    E2E_TAG: "grading",
    UNIVERSITY_WEB_ORIGIN: `http://127.0.0.1:${ONLINE_PORT}`,
  },
);

run(
  "pnpm",
  [
    "exec",
    "vite",
    "--mode",
    "authoring",
    "--host",
    "127.0.0.1",
    "--port",
    String(LOCAL_WEB_PORT),
    "--strictPort",
  ],
  APP,
  {
    E2E_TAG: "local",
    UNIVERSITY_E2E: "1",
    // The config builds the `/api` proxy target from this, so the suite's Vite
    // talks to the suite's API rather than to a campus somebody left running.
    UNIVERSITY_LOCAL_PORT: String(LOCAL_API_PORT),
  },
);

try {
  await waitFor(`${LOCAL_API_ORIGIN}/api/health`, 60_000);
  await waitFor(`http://127.0.0.1:${LOCAL_WEB_PORT}/`, 60_000);
  await waitFor(`${GRADING_ORIGIN}/`, 60_000);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  stop("SIGTERM");
  process.exit(1);
}

run(
  "pnpm",
  [
    "exec",
    "vite",
    "--mode",
    "delivery",
    "--host",
    "127.0.0.1",
    "--port",
    String(ONLINE_PORT),
    "--strictPort",
  ],
  APP,
  // Keeps this run's pre-bundled dependencies out of the dev server's cache;
  // see the note in apps/university/vite.config.ts.
  {
    E2E_TAG: "online",
    UNIVERSITY_E2E: "1",
    UNIVERSITY_CONTENT_ROOT: E2E_CONTENT_ROOT,
    VITE_UNIVERSITY_GRADING_URL: `${GRADING_ORIGIN}/api/grade`,
  },
);

try {
  await waitFor(`http://127.0.0.1:${ONLINE_PORT}/`, 180_000);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  stop("SIGTERM");
  process.exit(1);
}

console.log(`e2e: online  http://127.0.0.1:${ONLINE_PORT}`);
console.log(`e2e: local   http://127.0.0.1:${LOCAL_WEB_PORT}  (API ${LOCAL_API_ORIGIN})`);
console.log(`e2e: grading ${GRADING_ORIGIN}/api/grade`);
