import { randomBytes } from "node:crypto";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { getStudyPaths, getUaAnalysisPaths } from "../studies/paths.js";
import { newestReadyAnalysis } from "./study-map.js";

const LOOPBACK = "127.0.0.1";
const FIRST_DASHBOARD_PORT = 5173;
const LAST_DASHBOARD_PORT = 5199;
// The API server's request timeout is 10s. Keep this bounded below it so a
// slow first Vite bundle returns our own actionable error instead of a blank
// socket timeout.
const STARTUP_TIMEOUT_MS = 8_000;
const DASHBOARD_WORKSPACE_MARKER = ".university-local-dashboard-workspace";
const DASHBOARD_WORKSPACE_VERSION = "5";

export class UaDashboardError extends Error {
  readonly status: 404 | 503;

  constructor(status: 404 | 503, message: string) {
    super(message);
    this.name = "UaDashboardError";
    this.status = status;
  }
}

interface UaDashboardView {
  readonly url: string;
  readonly analysisId: string;
  readonly sourceCommit: string;
}

interface DashboardSession extends UaDashboardView {
  readonly child: ChildProcess;
}

function dashboardView(session: DashboardSession): UaDashboardView {
  return {
    url: session.url,
    analysisId: session.analysisId,
    sourceCommit: session.sourceCommit,
  };
}

function withDashboardNode(view: UaDashboardView, nodeId?: string | null): UaDashboardView {
  if (!nodeId) return view;
  const url = new URL(view.url);
  url.searchParams.set("node", nodeId);
  return { ...view, url: url.toString() };
}

interface DashboardDirectoryOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly home?: string;
}

/**
 * Resolve the Dashboard using the same install locations as
 * `understand-dashboard`. The repository contains no machine-specific path;
 * an explicit environment variable is available for non-standard installs.
 */
export function resolveUaDashboardDirectory(
  options: DashboardDirectoryOptions = {},
): string | null {
  const env = options.env ?? process.env;
  const home = options.home ?? homedir();
  const candidates: string[] = [];
  const configured = env["UNIVERSITY_LOCAL_UA_DASHBOARD_DIR"];
  if (configured) candidates.push(configured);
  candidates.push(
    join(home, ".understand-anything-plugin", "packages", "dashboard"),
    join(
      home,
      ".codex",
      "understand-anything",
      "understand-anything-plugin",
      "packages",
      "dashboard",
    ),
    join(
      home,
      ".opencode",
      "understand-anything",
      "understand-anything-plugin",
      "packages",
      "dashboard",
    ),
    join(home, ".pi", "understand-anything", "understand-anything-plugin", "packages", "dashboard"),
    join(home, "understand-anything", "understand-anything-plugin", "packages", "dashboard"),
  );

  try {
    const skill = realpathSync(join(home, ".agents", "skills", "understand-dashboard"));
    candidates.push(join(skill, "..", "..", "packages", "dashboard"));
  } catch {
    // The skill is optional; the other documented install locations still work.
  }

  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    if (!existsSync(join(candidate, "vite.config.ts"))) continue;
    try {
      return realpathSync(candidate);
    } catch {
      // A path can disappear between the existence check and realpath. Try the
      // next documented location rather than making the whole campus fail.
    }
  }
  return null;
}

async function findFreePort(): Promise<number> {
  for (let port = FIRST_DASHBOARD_PORT; port <= LAST_DASHBOARD_PORT; port += 1) {
    const available = await new Promise<boolean>((resolve) => {
      const probe = createServer();
      probe.once("error", () => resolve(false));
      probe.once("listening", () => probe.close(() => resolve(true)));
      probe.listen(port, LOOPBACK);
    });
    if (available) return port;
  }
  throw new UaDashboardError(
    503,
    `没有可用的 UA Dashboard 端口（已检查 ${FIRST_DASHBOARD_PORT}-${LAST_DASHBOARD_PORT}）。`,
  );
}

function appendOutput(buffer: { value: string }, chunk: Buffer | string): void {
  buffer.value = `${buffer.value}${chunk.toString("utf8")}`.slice(-8_000);
}

async function waitForDashboard(url: string, child: ChildProcess, output: { value: string }) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < STARTUP_TIMEOUT_MS) {
    if (child.exitCode !== null) {
      const detail = output.value.trim();
      throw new UaDashboardError(
        503,
        `UA Dashboard 启动失败。${detail ? ` ${detail}` : " 请检查 Dashboard 依赖是否已安装。"}`,
      );
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // Vite needs a moment to bundle the dashboard. Keep polling until the
      // bounded startup window expires.
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  child.kill("SIGTERM");
  throw new UaDashboardError(503, "UA Dashboard 启动超时。请检查 Dashboard 依赖和终端输出。");
}

function stopSession(session: DashboardSession): void {
  if (session.child.exitCode === null) session.child.kill("SIGTERM");
}

/**
 * Finalizing an analysis removes its temporary checkout. The official UA
 * Dashboard still needs a project root for source previews and Git freshness,
 * so recreate a detached checkout from the immutable snapshot on first open.
 * The clone is local-only and uses a copied object store; it never writes to
 * the inspected external repository.
 */
function ensureDashboardWorkspace(
  studiesRoot: string,
  studyId: string,
  sourceCommit: string,
  workspace: string,
): void {
  const markerPath = join(workspace, ".ua", DASHBOARD_WORKSPACE_MARKER);
  const legacyMarkerPath = join(workspace, DASHBOARD_WORKSPACE_MARKER);
  if (existsSync(markerPath)) {
    if (
      readFileSync(markerPath, "utf8").trim() === `${sourceCommit}\n${DASHBOARD_WORKSPACE_VERSION}`
    ) {
      return;
    }
    // This is a generated workspace owned by UniversityLocal. Rebuild it when
    // the materialization format changes so newly supported text files appear.
    rmSync(workspace, { recursive: true, force: true });
  } else if (existsSync(legacyMarkerPath)) {
    // Version 4 placed the marker at the project root, which the official
    // Dashboard correctly reported as an untracked working-tree change.
    rmSync(workspace, { recursive: true, force: true });
  }
  if (existsSync(workspace)) {
    throw new UaDashboardError(503, "UA Dashboard 工作区不完整，请重新刷新 UA。");
  }

  const studyPaths = getStudyPaths(studiesRoot, studyId);
  const temporary = mkdtempSync(join(dirname(workspace), ".dashboard-workspace-"));
  try {
    execFileSync("git", ["init", "--quiet", temporary], {
      maxBuffer: 16 * 1024 * 1024,
    });
    const gitObjectsInfo = join(temporary, ".git", "objects", "info");
    mkdirSync(gitObjectsInfo, { recursive: true });
    writeFileSync(
      join(gitObjectsInfo, "alternates"),
      `${realpathSync(studyPaths.source.repository)}/objects\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    execFileSync("git", ["checkout", "--detach", "--quiet", sourceCommit], {
      cwd: temporary,
      maxBuffer: 16 * 1024 * 1024,
    });
    rmSync(join(temporary, ".ua"), { recursive: true, force: true });
    symlinkSync("../data", join(temporary, ".ua"), "dir");
    writeFileSync(
      join(temporary, ".ua", DASHBOARD_WORKSPACE_MARKER),
      `${sourceCommit}\n${DASHBOARD_WORKSPACE_VERSION}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    renameSync(temporary, workspace);
  } catch (error) {
    rmSync(temporary, { recursive: true, force: true });
    throw new UaDashboardError(
      503,
      `无法为 UA Dashboard 准备源码预览工作区：${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export class UaDashboardManager {
  private readonly sessions = new Map<string, DashboardSession>();
  private readonly starts = new Map<string, Promise<UaDashboardView>>();
  private closed = false;

  constructor(
    private readonly studiesRoot: string,
    private readonly options: DashboardDirectoryOptions = {},
  ) {}

  async open(studyId: string, nodeId?: string | null): Promise<UaDashboardView> {
    if (this.closed) throw new UaDashboardError(503, "UniversityLocal 服务正在关闭。");
    const existingStart = this.starts.get(studyId);
    if (existingStart) {
      const view = await existingStart;
      return withDashboardNode(view, nodeId);
    }
    const start = this.start(studyId);
    this.starts.set(studyId, start);
    try {
      return withDashboardNode(await start, nodeId);
    } finally {
      if (this.starts.get(studyId) === start) this.starts.delete(studyId);
    }
  }

  private async start(studyId: string): Promise<UaDashboardView> {
    const analysis = newestReadyAnalysis(this.studiesRoot, studyId);
    if (!analysis) {
      throw new UaDashboardError(404, "这个学习项目还没有可打开的 UA 分析。");
    }

    const paths = getUaAnalysisPaths(this.studiesRoot, studyId, analysis.id);
    const graphPath = join(paths.data, "knowledge-graph.json");
    if (!existsSync(graphPath)) {
      throw new UaDashboardError(503, "这份 UA 分析缺少 Dashboard 所需的图谱文件，请重新刷新 UA。");
    }
    ensureDashboardWorkspace(this.studiesRoot, studyId, analysis.sourceCommit, paths.workspace);

    const current = this.sessions.get(studyId);
    if (current?.analysisId === analysis.id && current.child.exitCode === null) {
      return dashboardView(current);
    }
    if (current) {
      stopSession(current);
      this.sessions.delete(studyId);
    }

    const dashboardDirectory = resolveUaDashboardDirectory(this.options);
    if (!dashboardDirectory) {
      throw new UaDashboardError(
        503,
        "找不到 Understand Anything Dashboard。请安装 UA，或设置 UNIVERSITY_LOCAL_UA_DASHBOARD_DIR。",
      );
    }

    const port = await findFreePort();
    const token = randomBytes(24).toString("hex");
    const url = `http://${LOOPBACK}:${port}/?token=${encodeURIComponent(token)}`;
    const output = { value: "" };
    const child = spawn(
      "pnpm",
      [
        "exec",
        "vite",
        "--config",
        join(dashboardDirectory, "vite.config.ts"),
        "--host",
        LOOPBACK,
        "--port",
        String(port),
        "--strictPort",
        "--open",
        "false",
      ],
      {
        cwd: dashboardDirectory,
        env: {
          ...process.env,
          GRAPH_DIR: paths.workspace,
          UNDERSTAND_ACCESS_TOKEN: token,
          BROWSER: "none",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    child.stdout?.on("data", (chunk: Buffer | string) => appendOutput(output, chunk));
    child.stderr?.on("data", (chunk: Buffer | string) => appendOutput(output, chunk));

    try {
      await waitForDashboard(url, child, output);
    } catch (error) {
      if (child.exitCode === null) child.kill("SIGTERM");
      throw error;
    }
    if (this.closed) {
      child.kill("SIGTERM");
      throw new UaDashboardError(503, "UniversityLocal 服务正在关闭。");
    }

    const session: DashboardSession = {
      url,
      analysisId: analysis.id,
      sourceCommit: analysis.sourceCommit,
      child,
    };
    this.sessions.set(studyId, session);
    child.once("exit", () => {
      if (this.sessions.get(studyId)?.child === child) this.sessions.delete(studyId);
    });
    return dashboardView(session);
  }

  close(): void {
    this.closed = true;
    for (const session of this.sessions.values()) stopSession(session);
    this.sessions.clear();
    this.starts.clear();
  }
}
