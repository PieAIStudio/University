import { spawn, spawnSync } from "node:child_process";

const initialBuild = spawnSync("pnpm", ["exec", "tsc", "-p", "tsconfig.server.build.json"], {
  stdio: "inherit",
});
if (initialBuild.status !== 0) process.exit(initialBuild.status ?? 1);

const children = [
  spawn(
    "pnpm",
    ["exec", "tsc", "-p", "tsconfig.server.build.json", "--watch", "--preserveWatchOutput"],
    { stdio: "inherit" },
  ),
  spawn("node", ["--watch", ".university-local-build/server/http-server.js"], {
    stdio: "inherit",
    env: { ...process.env, UNIVERSITY_LOCAL_PROJECT_ROOT: process.cwd() },
  }),
  spawn("pnpm", ["exec", "vite"], { stdio: "inherit" }),
];

let stopping = false;
function stop(signal) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill(signal);
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
for (const child of children) {
  child.on("exit", (code) => {
    if (!stopping) {
      stop("SIGTERM");
      process.exitCode = code ?? 1;
    }
  });
}
