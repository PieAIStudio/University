#!/usr/bin/env node
/**
 * Bring up both shells on the e2e ports, then sit until Playwright kills us.
 *
 * The authoring shell is a chain (core build → server emit → API → Vite).
 * Spawning `pnpm dev` would also take 9999/4317 and watch studies/, which is
 * the opposite of what a test run wants. This script is the one place that
 * knows the ports, so the tests never invent a second launcher.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const LOCAL = join(ROOT, "apps/local");
const ONLINE = join(ROOT, "apps/online");

const ONLINE_PORT = Number(process.env.E2E_ONLINE_PORT ?? 18093);
const LOCAL_WEB_PORT = Number(process.env.E2E_LOCAL_WEB_PORT ?? 18094);
const LOCAL_API_PORT = Number(process.env.E2E_LOCAL_API_PORT ?? 18095);
const LOCAL_API_ORIGIN = `http://127.0.0.1:${LOCAL_API_PORT}`;

const children = [];

function run(command, args, cwd, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const tag = `[${cwd === ONLINE ? "online" : cwd === LOCAL ? "local" : "e2e"}]`;
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

function must(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", env: process.env });
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

if (!existsSync(join(ONLINE, "content", "manifest.json"))) {
  console.log("e2e: importing course content into the online shell");
  must("pnpm", ["content"], ROOT);
}

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

run(
  "node",
  [join(LOCAL, ".university-local-build/server/http-server.js")],
  LOCAL,
  localApiEnv,
);

run(
  "pnpm",
  [
    "exec",
    "vite",
    "--config",
    join(ROOT, "e2e/vite.local.config.ts"),
    "--host",
    "127.0.0.1",
    "--port",
    String(LOCAL_WEB_PORT),
    "--strictPort",
  ],
  LOCAL,
  {
    E2E_LOCAL_WEB_PORT: String(LOCAL_WEB_PORT),
    E2E_LOCAL_API_ORIGIN: LOCAL_API_ORIGIN,
  },
);

try {
  await waitFor(`${LOCAL_API_ORIGIN}/api/health`, 60_000);
  await waitFor(`http://127.0.0.1:${LOCAL_WEB_PORT}/`, 60_000);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  stop("SIGTERM");
  process.exit(1);
}

run(
  "pnpm",
  ["exec", "vite", "--host", "127.0.0.1", "--port", String(ONLINE_PORT), "--strictPort"],
  ONLINE,
  // Keeps this run's pre-bundled dependencies out of the dev server's cache;
  // see the note in apps/online/vite.config.ts.
  { UNIVERSITY_E2E: "1" },
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
