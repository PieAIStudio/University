import { existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { loadUniversityLocalConfig } from "./config/load-config.js";
import { HttpError } from "./http/errors.js";
import { rejectNonLoopbackHost, sendJson } from "./http/wire.js";
import { createServerContext } from "./http/context.js";
import { createBootstrapHandler } from "./http/handlers/bootstrap.js";
import { handleCard } from "./http/handlers/card.js";
import { handleExercise } from "./http/handlers/exercise.js";
import { handleLesson } from "./http/handlers/lesson.js";
import { handleReaderMark } from "./http/handlers/reader-mark.js";
import { handleStudyMap } from "./http/handlers/study-map.js";
import { handleAirlock, handleStudy } from "./http/handlers/study.js";
import type { Handler } from "./http/handlers/types.js";
import { handleVocabulary } from "./http/handlers/vocabulary.js";
import { getStudyPaths } from "./studies/paths.js";
import { inspectStudyShelf } from "./studies/repository.js";

const DEFAULT_PORT = 4317;

function defaultProjectRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../..");
}

export function createUniversityLocalHttpServer(projectRoot: string): Server {
  const config = loadUniversityLocalConfig({ projectRoot });
  const context = createServerContext(config.studiesRoot);

  // Archived studies keep their data but leave the shelf; a superseded study
  // that still greets the learner every day is clutter wearing a title.
  for (const study of inspectStudyShelf(context.studiesRoot).studies.filter(
    (candidate) => candidate.status === "active",
  )) {
    if (existsSync(getStudyPaths(context.studiesRoot, study.id).learner.database)) {
      context.getStore(study.id);
    }
  }

  // Order is behaviour. Each handler returns true when it handled the request.
  // This list preserves the original flat-branch sequence exactly — including
  // handleAirlock after expression-packet (inside handleExercise), not next to
  // handleStudy. Do not sort by resource name.
  const handlers: Handler[] = [
    createBootstrapHandler(config.focus),
    handleStudy,
    handleLesson,
    handleExercise,
    handleAirlock,
    handleVocabulary,
    handleCard,
    // Last: their routes are all leaves (`/marks`, `/map`) that no earlier
    // handler claims, so placing them here cannot change any existing route.
    handleReaderMark,
    handleStudyMap,
  ];

  const server = createServer((request, response) => {
    void (async () => {
      if (rejectNonLoopbackHost(request, response)) return;
      const url = new URL(request.url ?? "/", "http://127.0.0.1");

      for (const handler of handlers) {
        if (await handler(context, request, response, url)) return;
      }

      if (request.method !== "GET" && request.method !== "POST") {
        sendJson(response, 405, { error: "Method not allowed" });
        return;
      }
      sendJson(response, 404, { error: "Not found" });
    })().catch((error: unknown) => {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      if (error instanceof HttpError) {
        sendJson(response, error.status, { error: error.message });
        return;
      }
      if (error instanceof z.ZodError) {
        sendJson(response, 400, { error: "Request validation failed", issues: error.issues });
        return;
      }
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? (error as { code?: unknown }).code
          : undefined;
      if (code === "ENOENT") {
        sendJson(response, 404, { error: "Requested learning content was not found" });
        return;
      }
      console.error("UniversityLocal API error", error);
      sendJson(response, 500, { error: "UniversityLocal could not complete the request" });
    });
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 5_000;
  server.on("close", () => {
    context.close();
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const projectRoot = process.env["UNIVERSITY_LOCAL_PROJECT_ROOT"] ?? defaultProjectRoot();
  const port = Number(process.env["UNIVERSITY_LOCAL_PORT"] ?? DEFAULT_PORT);
  const server = createUniversityLocalHttpServer(projectRoot);
  server.listen(port, "127.0.0.1", () => {
    console.log(`UniversityLocal API listening on http://127.0.0.1:${port}`);
  });
}
