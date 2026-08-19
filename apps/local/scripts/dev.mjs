import { spawn, spawnSync, execFileSync } from "node:child_process";
import { createServer } from "node:net";

/**
 * Both ports are deliberately fixed: the web client proxies `/api` to a known
 * API port, and the campus should live at a stable bookmark. A port that is
 * already taken is therefore a stop, not something to route around silently —
 * moving the web server would break the bookmark, and moving the API port would
 * break the proxy.
 */
const PORTS = [
  { port: 4317, label: "API 服务" },
  { port: 9999, label: "网页界面" },
];

function isPortFree(port) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => probe.close(() => resolve(true)));
    probe.listen(port, "127.0.0.1");
  });
}

/** Best-effort: `lsof` is not everywhere, and not knowing is not a failure. */
function describeHolder(port) {
  try {
    const out = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const line = out.split("\n")[1];
    return line ? line.trim().split(/\s+/)[1] : null;
  } catch {
    return null;
  }
}

const taken = [];
for (const entry of PORTS) {
  if (!(await isPortFree(entry.port))) taken.push({ ...entry, pid: describeHolder(entry.port) });
}

if (taken.length > 0) {
  const lines = [
    "",
    "UniversityLocal 起不来：端口已被占用。",
    "",
    ...taken.map(
      ({ port, label, pid }) =>
        `  · ${port}（${label}）${pid ? ` 被进程 ${pid} 占着` : " 已被占用"}`,
    ),
    "",
    "最常见的原因：pnpm dev 已经在另一个终端窗口里跑着了。先去那个窗口看看。",
    "",
    "如果确认是不要的旧进程，结束它：",
    ...taken.map(({ port, pid }) =>
      pid ? `  kill ${pid}` : `  lsof -nP -iTCP:${port} -sTCP:LISTEN   # 查出 PID 后 kill 它`,
    ),
    "",
    "端口空出来后重新运行 pnpm dev。",
    "",
  ];
  console.error(lines.join("\n"));
  process.exit(1);
}

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
// Ctrl-C reaches the children directly because they share this process group;
// this is the belt for every other way of leaving, so a stray server can never
// be what blocks the next `pnpm dev`.
process.on("exit", () => stop("SIGTERM"));
for (const child of children) {
  child.on("exit", (code) => {
    if (!stopping) {
      stop("SIGTERM");
      process.exitCode = code ?? 1;
    }
  });
}
