// Run after compiling the grading module (pnpm primm:preview does that). Local entry,
// not a production model endpoint and not a second course producer.
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { createPrimmRuntime } from "../apps/university-grading/.primm-preview-build/src/primm/runtime.js";
import { createCanonicalPrimmResolver } from "../apps/university-grading/.primm-preview-build/src/primm/content.js";
import {
  createLocalOllamaTransport,
  createLocalWhisperTranscriber,
} from "../apps/university-grading/.primm-preview-build/src/primm/local-transport.js";
import { createPrimmPreviewServer } from "../apps/university-grading/.primm-preview-build/src/primm/http.js";
const root = fileURLToPath(new URL("..", import.meta.url));
if (!process.argv.includes("--owner-preview")) throw Error("Explicit --owner-preview required");
const withApp = process.argv.includes("--with-app");
async function requireFree(port) {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", () =>
      reject(
        Error(
          `Port ${port} is busy. Open the existing preview or stop only its own terminal first.`,
        ),
      ),
    );
    probe.listen(port, "127.0.0.1", () => probe.close(resolve));
  });
}
await requireFree(23151);
if (withApp) await requireFree(23150);
const runtime = createPrimmRuntime({
  transport: createLocalOllamaTransport(),
  resolveLesson: createCanonicalPrimmResolver({
    contentRoot: join(root, "apps/university/content"),
    recoveryRoot: join(root, "apps/local/course-proposals/recovery/ai-literacy"),
  }),
  transcriber: createLocalWhisperTranscriber({
    python: join(root, ".scratch/primm-five/asr-venv/bin/python"),
    script: join(root, "scripts/primm-transcribe.py"),
    modelsRoot: join(root, ".scratch/primm-five/asr-models"),
  }),
  quota: 100,
  timeoutMs: 110000,
});
const server = createPrimmPreviewServer(runtime, {
  port: 23151,
  origins: ["http://127.0.0.1:23150", "http://127.0.0.1:23140", "http://127.0.0.1:23141"],
});
let app;
server.listen(23151, "127.0.0.1", () => {
  console.log(
    "PRIMM owner preview ready at 127.0.0.1:23151; real local model, max100 explicit commands.",
  );
  if (withApp) {
    const appEnv = { ...process.env, VITE_UNIVERSITY_PRIMM_PREVIEW_URL: "http://127.0.0.1:23151" };
    for (const key of Object.keys(appEnv)) {
      if (!key.startsWith("VITE_") && /(?:API_KEY|SECRET|TOKEN|PASSWORD|SERVICE_ROLE)/i.test(key))
        delete appEnv[key];
    }
    app = spawn(
      "pnpm",
      [
        "exec",
        "vite",
        "--mode",
        "delivery",
        "--host",
        "127.0.0.1",
        "--port",
        "23150",
        "--strictPort",
      ],
      {
        cwd: join(root, "apps/university"),
        detached: true,
        stdio: "inherit",
        env: appEnv,
      },
    );
    app.once("error", stop);
    app.once("exit", stop);
  }
});
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  runtime.close();
  if (app?.pid) {
    try {
      process.kill(-app.pid, "SIGTERM");
    } catch {
      /* Already stopped. */
    }
  }
  server.closeAllConnections();
  server.close(() => process.exit(0));
}
for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, stop);
