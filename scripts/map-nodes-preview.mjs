#!/usr/bin/env node
import { existsSync, lstatSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { createServer as createProbe } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createOwnerAuthoring } from "./map-nodes-authoring.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
if (!process.argv.includes("--owner-preview")) {
  console.error(
    "This is an owner-only loopback pilot, not a production AI endpoint. Pass --owner-preview.",
  );
  process.exit(2);
}
const arg = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at < 0 ? fallback : (process.argv[at + 1] ?? fallback);
};
const port = Number(arg("--port", "23161"));
const origin = arg("--origin", "http://127.0.0.1:23160");
const corpusRoot = resolve(arg("--corpus-root", join(root, "apps/local/studies")));
const scratchRoot = resolve(
  arg("--studies-root", join(root, ".scratch/map-nodes-personal-studies")),
);
if (
  !Number.isInteger(port) ||
  port < 1024 ||
  port > 65535 ||
  !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)
)
  throw new Error("Explicit loopback port/origin required");
if (!existsSync(corpusRoot)) throw new Error("Verified course corpus is unavailable");
if (existsSync(scratchRoot) && lstatSync(scratchRoot).isSymbolicLink())
  throw new Error("Private root must not be a symlink");
await new Promise((done, fail) => {
  const probe = createProbe();
  probe.once("error", () => fail(new Error("Port occupied; inspect its owner, do not kill it.")));
  probe.listen(port, "127.0.0.1", () => probe.close(done));
});

// Compile the current tree every time. An old .js file is not proof the current
// source is running. Do not regenerate or publish any public course package.
for (const args of [
  ["--filter", "@pieai/university-local", "build"],
  [
    "--filter",
    "@pieai/university-grading-service",
    "exec",
    "tsc",
    "--noEmit",
    "false",
    "--outDir",
    ".primm-preview-build",
  ],
]) {
  const result = spawnSync("pnpm", args, { cwd: root, stdio: "inherit", shell: false });
  if (result.status !== 0) throw new Error("Current native services did not compile");
}
const load = (file) => import(pathToFileURL(join(root, file)).href);
const [{ PersonalLessonService, PersonalLessonError, PRIVATE_CARD_ID }, contracts, grading, local] =
  await Promise.all([
    load("apps/local/.university-local-build/server/personal/service.js"),
    load("apps/local/.university-local-build/server/personal/contracts.js"),
    load("apps/university-grading/.primm-preview-build/src/primm/runtime.js"),
    load("apps/university-grading/.primm-preview-build/src/primm/local-transport.js"),
  ]);
const authoring = await createOwnerAuthoring(root, contracts, {
  writerArm: arg("--writer-arm", "grok"),
  fallbackReason: arg("--fallback-reason", ""),
});
const service = new PersonalLessonService({
  corpusRoot,
  scratchRoot,
  projectRoot: root,
  generate: authoring.generate,
});
const require = createRequire(join(root, "apps/university-grading/package.json"));
const { z } = await import(pathToFileURL(require.resolve("zod")).href);
const bindings = new Map();
const jobs = new Map();
const digest = (value) => createHash("sha256").update(value).digest("hex");
const jobKey = (account, id) => `${digest(account)}:${id}`;
function bindRun(input, contentId, account) {
  const previous = bindings.get(input.commandId);
  if (previous && (previous.account !== account || previous.contentId !== contentId))
    throw new Error("Command already belongs to another lesson");
  if (bindings.size > 120 && !previous) throw new Error("Preview execution allowance exhausted");
  bindings.set(input.commandId, { contentId, account });
}
const runtime = grading.createPrimmRuntime({
  transport: local.createLocalOllamaTransport(),
  resolveLesson: async (input) => {
    const binding = bindings.get(input.commandId);
    if (!binding) throw new Error("Unbound lesson execution");
    return service.canonical(binding.contentId, binding.account, input);
  },
  quota: 100,
});

const Envelope = z.object({ contentId: z.string().regex(/^[a-f0-9]{12}-[a-f0-9]{20}$/) });
const Complete = Envelope.extend({ commandId: z.string().uuid() }).strict();
const publicRecord = ({
  contentId,
  locator,
  title,
  goal,
  scope,
  createdAt,
  unitObjective,
  cardIds,
}) => ({ contentId, locator, title, goal, scope, createdAt, unitObjective, cardIds });
const publicJob = (job) => ({
  commandId: job.commandId,
  goal: job.goal,
  status: job.status,
  stage: job.stage,
  ...(job.record ? { record: publicRecord(job.record) } : {}),
  ...(job.error ? { error: job.error } : {}),
});

const reply = (res, status, data) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
  });
  res.end(JSON.stringify(data));
};
async function readBody(request, max = 64 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > max) throw new Error("Request too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function accountOf(req) {
  const account = req.headers["x-map-nodes-account"];
  if (typeof account !== "string" || !/^[a-zA-Z0-9:_-]{8,200}$/.test(account))
    throw new Error("Invalid owner namespace");
  return account;
}

const server = createServer(async (req, res) => {
  // Origin + loopback + explicit owner flag are local-pilot boundaries, NOT
  // production authentication. No public binding or permissive CORS fallback.
  if (
    !["127.0.0.1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress) ||
    req.headers.host !== `127.0.0.1:${port}` ||
    req.headers.origin !== origin
  )
    return reply(res, 403, {
      error: "This endpoint only accepts its explicit owner preview origin",
    });
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": origin,
      Vary: "Origin",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "content-type,x-map-nodes-owner,x-map-nodes-account",
    });
    return res.end();
  }
  if (req.headers["x-map-nodes-owner"] !== "owner-preview-v1")
    return reply(res, 403, { error: "Owner preview required" });
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });
  try {
    const account = accountOf(req);
    if (req.method === "GET" && url.pathname === "/status")
      return reply(res, 200, {
        available: true,
        mode: "owner-preview",
        models: authoring.models,
        runtime: runtime.status(),
        corpus: "installed-verified-material",
        generationLimit: 12,
      });
    if (req.method === "GET" && url.pathname === "/list")
      return reply(res, 200, {
        lessons: service.list(account).map(publicRecord),
        active: [...jobs.values()]
          .filter((job) => job.account === account && job.status === "working")
          .map(publicJob),
        recent: [...jobs.values()]
          .filter((job) => job.account === account)
          .slice(-1)
          .map(publicJob),
      });
    if (req.method === "POST" && url.pathname === "/generate") {
      const input = contracts.PersonalCreateRequestSchema.parse(await readBody(req, 16 * 1024));
      if (input.accountScope !== account) throw new Error("Account namespace mismatch");
      const key = jobKey(account, input.commandId);
      const fingerprint = digest(JSON.stringify(input));
      let job = jobs.get(key);
      if (job && job.fingerprint !== fingerprint)
        return reply(res, 409, { error: "A retry cannot change its task" });
      if (!job) {
        if ([...jobs.values()].some((candidate) => candidate.status === "working"))
          return reply(res, 429, { error: "已有一节课在生成，请稍后再试。" });
        const abort = new AbortController();
        job = {
          commandId: input.commandId,
          goal: input.goal,
          account,
          fingerprint,
          status: "working",
          stage: "writing",
          abort,
        };
        jobs.set(key, job);
        // Full writer + independent review + polish are async. The explicit
        // owner pilot is bounded, cancellable, and survives closing the dialog.
        const timer = setTimeout(() => abort.abort(), 15 * 60 * 1000);
        const current = job;
        void service
          .create(input, abort.signal, (stage) => {
            current.stage = stage;
          })
          .then((record) => {
            current.record = record;
            current.status = "ready";
            console.info(`Personal job ${current.commandId}: ready`);
          })
          .catch((error) => {
            current.status = abort.signal.aborted ? "cancelled" : "failed";
            current.error = error instanceof Error ? error.message : "课程没有生成，请稍后再试。";
            console.info(`Personal job ${current.commandId}: ${current.status}: ${current.error}`);
          })
          .finally(() => clearTimeout(timer));
      }
      return reply(res, job.status === "working" ? 202 : 200, publicJob(job));
    }
    const jobMatch = /^\/jobs\/([a-f0-9-]{36})$/.exec(url.pathname);
    if (req.method === "GET" && jobMatch) {
      const job = jobs.get(jobKey(account, jobMatch[1]));
      if (!job)
        return reply(res, 404, {
          error: "Generation session not found; your saved lessons are unchanged",
        });
      return reply(res, 200, publicJob(job));
    }
    if (req.method === "POST" && url.pathname === "/cancel-generation") {
      const input = z
        .object({ commandId: z.string().uuid() })
        .strict()
        .parse(await readBody(req, 1024));
      const job = jobs.get(jobKey(account, input.commandId));
      if (!job) return reply(res, 404, { error: "Generation session not found" });
      if (job.status === "working") job.abort.abort();
      return reply(res, 200, { cancelled: job.status !== "ready" });
    }
    const item = /^\/(lesson|card|exercise)\/([a-f0-9]{12}-[a-f0-9]{20})$/.exec(url.pathname);
    if (req.method === "GET" && item) {
      if (item[1] === "lesson") return reply(res, 200, service.lessonView(item[2], account));
      if (item[1] === "card") {
        if (url.searchParams.get("cardId") !== PRIVATE_CARD_ID)
          throw new Error("Unknown private card");
        return reply(res, 200, service.card(item[2], account));
      }
      const view = service.lessonView(item[2], account);
      const exercise = view.lesson.exercises.find(
        (e) => e.id === url.searchParams.get("exerciseId"),
      );
      if (!exercise) throw new Error("Unknown private exercise");
      return reply(res, 200, { ...exercise, lessonTitle: view.lesson.title, correctAnswer: null });
    }
    if (req.method === "POST" && url.pathname === "/complete") {
      const input = Complete.parse(await readBody(req, 4096));
      return reply(
        res,
        200,
        publicRecord(service.complete(input.contentId, account, input.commandId)),
      );
    }
    if (req.method === "POST" && url.pathname === "/run") {
      const input = Envelope.extend({ input: z.unknown() })
        .strict()
        .parse(await readBody(req));
      // The shared runtime validates the full native Run schema before using it.
      if (!input.input || typeof input.input.commandId !== "string")
        throw new Error("Invalid command");
      service.get(input.contentId, account);
      bindRun(input.input, input.contentId, account);
      return reply(res, 200, await runtime.run(input.input, controller.signal));
    }
    if (req.method === "POST" && url.pathname === "/grade") {
      const input = Envelope.extend({ grade: grading.GradeSchema })
        .strict()
        .parse(await readBody(req));
      const work = grading.MakeEnvelopeSchema.parse(JSON.parse(input.grade.answer));
      service.get(input.contentId, account);
      bindRun(work.request, input.contentId, account);
      const result = await runtime.grade(input.grade, controller.signal);
      if (result.hostGrade?.passed && result.hostGrade.outcome === "pass")
        service.recordPassedMake(
          input.contentId,
          account,
          input.grade.commandId,
          input.grade.contentRevision,
        );
      return reply(res, 200, result);
    }
    return reply(res, 404, { error: "Not found" });
  } catch (error) {
    const status =
      error instanceof PersonalLessonError
        ? ({
            invalid: 400,
            unsupported: 422,
            unavailable: 503,
            busy: 429,
            cancelled: 499,
            "not-found": 404,
          }[error.code] ?? 400)
        : 400;
    return reply(res, status, {
      error: error instanceof Error ? error.message : "Personal lesson request failed",
    });
  }
});
server.requestTimeout = 125_000;
server.headersTimeout = 10_000;
server.listen(port, "127.0.0.1", () =>
  console.log(
    `Map personal lessons ready at http://127.0.0.1:${port}; origin ${origin}; ${authoring.models.writer} + ${authoring.models.polisher}; local studies only.`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    for (const job of jobs.values()) if (job.status === "working") job.abort.abort();
    runtime.close();
    server.closeAllConnections();
    server.close(() => process.exit(0));
  });
