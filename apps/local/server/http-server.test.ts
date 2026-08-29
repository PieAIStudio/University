import { once } from "node:events";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { get } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { EvidenceReference, KnowledgeNote } from "@pieai/university-core/domain/schemas.js";
import { executeUniversityLocalCli } from "./cli.js";
import { createUniversityLocalHttpServer } from "./http-server.js";
import {
  updateCourseStatus,
  updateUnitStatus,
  readLatestLesson,
  writeCardRevision,
  writeCourse,
  writeExerciseRevision,
  writeLessonRevision,
  writeUnit,
} from "./content/repository.js";
import { writeKnowledgeNoteRevision } from "./knowledge/repository.js";
import { SqliteLearningStore } from "./learning/sqlite-learning-store.js";
import { cardContentKey, knowledgeCardContentKey, lessonContentKey } from "./learning/types.js";
import { getStudyPaths } from "./studies/paths.js";
import { createStudy, registerLocalGitSource, setDefaultCourse } from "./studies/repository.js";
import { setAuthoringFocus } from "./workflows/focus.js";
import { createCleanSnapshot } from "./studies/snapshots.js";

const servers: ReturnType<typeof createUniversityLocalHttpServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
});

function makeProject(): string {
  const root = mkdtempSync(join(tmpdir(), "university-local-api-"));
  mkdirSync(join(root, "studies"));
  writeFileSync(
    join(root, "university-local.config.json"),
    JSON.stringify({ schemaVersion: 1, studiesRoot: "./studies" }),
  );
  return root;
}

async function start(projectRoot: string) {
  const server = createUniversityLocalHttpServer(projectRoot);
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  return { base: `http://127.0.0.1:${port}`, server };
}

async function stop(server: ReturnType<typeof createUniversityLocalHttpServer>): Promise<void> {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  const index = servers.indexOf(server);
  if (index >= 0) servers.splice(index, 1);
}

function makeLearningProject(enrollCard = true): {
  readonly projectRoot: string;
  readonly studiesRoot: string;
  readonly sourceRoot: string;
  readonly lessonPath: string;
  readonly evidence: EvidenceReference;
} {
  const projectRoot = makeProject();
  const studiesRoot = join(projectRoot, "studies");
  const sourceRoot = mkdtempSync(join(tmpdir(), "university-local-api-source-"));
  execFileSync("git", ["init", "-q", sourceRoot]);
  execFileSync("git", ["-C", sourceRoot, "config", "user.name", "UniversityLocal Test"]);
  execFileSync("git", ["-C", sourceRoot, "config", "user.email", "test@university.local"]);
  writeFileSync(
    join(sourceRoot, "auth.ts"),
    "export const owner = 'identity-service';\n// <img src=x onerror=alert(1)>\n",
  );
  execFileSync("git", ["-C", sourceRoot, "add", "auth.ts"]);
  execFileSync("git", ["-C", sourceRoot, "commit", "-q", "-m", "Initial"]);

  createStudy(studiesRoot, { id: "sample", title: "Sample" });
  registerLocalGitSource(studiesRoot, "sample", sourceRoot);
  const snapshot = createCleanSnapshot(studiesRoot, "sample");
  const evidence = {
    kind: "fact" as const,
    snapshotId: snapshot.id,
    sourceCommit: snapshot.sourceCommit,
    sourcePath: "auth.ts",
    lineStart: 1,
    lineEnd: 1,
    nodeIds: [],
  };
  const createdAt = "2026-07-20T00:00:00.000Z";
  writeCourse(studiesRoot, "sample", {
    schemaVersion: 1,
    id: "founder-engineer",
    title: "Founder Engineer",
    description: "Learn the ownership boundary.",
    audience: "Founder",
    objectives: ["Identify the authentication owner"],
    unitIds: ["auth-architecture"],
    status: "draft",
    createdAt,
    updatedAt: createdAt,
  });
  writeUnit(studiesRoot, "sample", "founder-engineer", {
    schemaVersion: 1,
    id: "auth-architecture",
    title: "Authentication",
    objective: "Locate the owner.",
    prerequisiteUnitIds: [],
    lessonIds: ["auth-owner"],
    status: "draft",
  });
  writeLessonRevision(studiesRoot, "sample", {
    manifest: {
      schemaVersion: 1,
      id: "auth-owner",
      title: "Who owns authentication?",
      courseId: "founder-engineer",
      unitId: "auth-architecture",
      exerciseIds: ["name-auth-owner"],
      cardIds: ["auth-owner-card"],
      contentRevision: 1,
      status: "active",
      evidence: [evidence],
      createdAt,
      updatedAt: createdAt,
    },
    content: "# Authentication\n\nThe identity service owns authentication.\n",
  });
  writeCardRevision(studiesRoot, "sample", {
    schemaVersion: 1,
    id: "auth-owner-card",
    kind: "basic",
    courseId: "founder-engineer",
    unitId: "auth-architecture",
    lessonId: "auth-owner",
    front: "Which service owns authentication?",
    back: "identity-service",
    contentRevision: 1,
    status: "active",
    tags: ["auth"],
    evidence: [evidence],
  });
  writeExerciseRevision(studiesRoot, "sample", {
    schemaVersion: 1,
    id: "name-auth-owner",
    kind: "short-answer",
    title: "Name the owner",
    courseId: "founder-engineer",
    unitId: "auth-architecture",
    lessonId: "auth-owner",
    prompt: "Name the authentication owner.",
    expectedAnswer: "identity-service",
    contentRevision: 1,
    status: "active",
    evidence: [evidence],
  });
  updateUnitStatus(studiesRoot, "sample", "founder-engineer", "auth-architecture", "active");
  updateCourseStatus(studiesRoot, "sample", "founder-engineer", "active");
  setDefaultCourse(studiesRoot, "sample", "founder-engineer");
  const store = new SqliteLearningStore(getStudyPaths(studiesRoot, "sample").learner.database);
  if (enrollCard) {
    store.ensureCard(
      cardContentKey({
        courseId: "founder-engineer",
        unitId: "auth-architecture",
        lessonId: "auth-owner",
        cardId: "auth-owner-card",
      }),
      1,
      new Date("2026-07-20T00:00:00.000Z"),
    );
  }
  store.close();
  return {
    projectRoot,
    studiesRoot,
    sourceRoot,
    evidence,
    lessonPath:
      "/api/studies/sample/courses/founder-engineer/units/auth-architecture/lessons/auth-owner",
  };
}

/**
 * Writes an AI host's verdict back the way a host would: the route ids come
 * from the URL, the judgement from the body. Pass/fail is the host's call, so
 * every completion test has to go through here rather than through an answer
 * string the server would have to grade itself.
 */
function hostGrade(
  base: string,
  headers: Record<string, string>,
  exercisePath: string,
  body: {
    readonly commandId: string;
    readonly passed: boolean;
    readonly evaluation: string;
    readonly contentRevision?: number;
  },
): Promise<Response> {
  return fetch(`${base}${exercisePath}/host-grade`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      commandId: body.commandId,
      contentRevision: body.contentRevision ?? 1,
      passed: body.passed,
      evaluation: body.evaluation,
    }),
  });
}

function confirmLesson(
  base: string,
  headers: Record<string, string>,
  lessonPath: string,
  commandId: string,
  contentRevision = 1,
): Promise<Response> {
  return fetch(`${base}${lessonPath}/complete`, {
    method: "POST",
    headers,
    body: JSON.stringify({ commandId, contentRevision }),
  });
}

/**
 * Adds a second short-answer exercise to the fixture lesson, so completion can
 * be tested against a lesson that asks more than one question. Content is
 * immutable while a course is active, so this walks the same
 * active -> stale -> edit -> active path the revise workflow uses.
 */
function addSecondExercise(fixture: ReturnType<typeof makeLearningProject>): void {
  const { studiesRoot, evidence } = fixture;
  const createdAt = "2026-07-20T02:00:00.000Z";
  updateCourseStatus(studiesRoot, "sample", "founder-engineer", "stale");
  updateUnitStatus(studiesRoot, "sample", "founder-engineer", "auth-architecture", "stale");
  // The lesson must declare the exercise before the exercise can be written.
  writeLessonRevision(studiesRoot, "sample", {
    manifest: {
      schemaVersion: 1,
      id: "auth-owner",
      title: "Who owns authentication?",
      courseId: "founder-engineer",
      unitId: "auth-architecture",
      exerciseIds: ["name-auth-owner", "name-auth-store"],
      cardIds: ["auth-owner-card"],
      contentRevision: 2,
      status: "active",
      evidence: [evidence],
      createdAt,
      updatedAt: createdAt,
    },
    content: "# Authentication\n\nThe identity service owns authentication.\n",
  });
  writeExerciseRevision(studiesRoot, "sample", {
    schemaVersion: 1,
    id: "name-auth-store",
    kind: "short-answer",
    title: "Name the store",
    courseId: "founder-engineer",
    unitId: "auth-architecture",
    lessonId: "auth-owner",
    prompt: "Name the session store.",
    expectedAnswer: "session-store",
    contentRevision: 1,
    status: "active",
    evidence: [evidence],
  });
  updateUnitStatus(studiesRoot, "sample", "founder-engineer", "auth-architecture", "active");
  updateCourseStatus(studiesRoot, "sample", "founder-engineer", "active");
}

/**
 * Adds a whole second course to the fixture study. The study's default course
 * stays `founder-engineer`, so anything this course can do is something a
 * non-default course can do.
 */
function addSecondCourse(fixture: ReturnType<typeof makeLearningProject>): string {
  const { studiesRoot, evidence } = fixture;
  const createdAt = "2026-07-20T03:00:00.000Z";
  writeCourse(studiesRoot, "sample", {
    schemaVersion: 1,
    id: "cost-boundaries",
    title: "Cost Boundaries",
    description: "Where the money stops.",
    audience: "Founder",
    objectives: ["Name the spend gate"],
    unitIds: ["spend"],
    status: "draft",
    createdAt,
    updatedAt: createdAt,
  });
  writeUnit(studiesRoot, "sample", "cost-boundaries", {
    schemaVersion: 1,
    id: "spend",
    title: "Spend",
    objective: "Locate the gate.",
    prerequisiteUnitIds: [],
    lessonIds: ["spend-gate"],
    status: "draft",
  });
  writeLessonRevision(studiesRoot, "sample", {
    manifest: {
      schemaVersion: 1,
      id: "spend-gate",
      title: "Where does spending stop?",
      courseId: "cost-boundaries",
      unitId: "spend",
      exerciseIds: ["explain-spend-gate"],
      cardIds: ["spend-gate-card"],
      contentRevision: 1,
      status: "active",
      evidence: [evidence],
      createdAt,
      updatedAt: createdAt,
    },
    content: "# Spend\n\nThe gate runs before the call, not after.\n",
  });
  writeCardRevision(studiesRoot, "sample", {
    schemaVersion: 1,
    id: "spend-gate-card",
    kind: "basic",
    courseId: "cost-boundaries",
    unitId: "spend",
    lessonId: "spend-gate",
    front: "When does the spend gate run?",
    back: "SPEND-GATE-BACK-SECRET",
    contentRevision: 1,
    status: "active",
    tags: [],
    evidence: [evidence],
  });
  writeExerciseRevision(studiesRoot, "sample", {
    schemaVersion: 1,
    id: "explain-spend-gate",
    kind: "explain",
    title: "Explain the gate",
    courseId: "cost-boundaries",
    unitId: "spend",
    lessonId: "spend-gate",
    prompt: "Explain why the gate runs before the call.",
    rubric: ["names the ordering", "says what fails closed"],
    contentRevision: 1,
    status: "active",
    evidence: [evidence],
  });
  updateUnitStatus(studiesRoot, "sample", "cost-boundaries", "spend", "active");
  updateCourseStatus(studiesRoot, "sample", "cost-boundaries", "active");
  return "/api/studies/sample/courses/cost-boundaries/units/spend/lessons/spend-gate";
}

function addKnowledgeNotes(fixture: ReturnType<typeof makeLearningProject>): void {
  const createdAt = "2026-07-20T01:00:00.000Z";
  const makeNote = (
    id: string,
    status: KnowledgeNote["status"],
    evidence: readonly EvidenceReference[],
    back: string,
  ): Omit<KnowledgeNote, "contentHash"> => ({
    schemaVersion: 1,
    id,
    title: `${id} title`,
    question: `What did the ${id} conversation establish?`,
    summary: `${id} summary`,
    claimType: "source-fact",
    status,
    contentRevision: 1,
    tags: ["auth"],
    evidence: [...evidence],
    origin: {
      kind: "ai-conversation",
      host: "Grok",
      capturedAt: createdAt,
      captureId: `capture:${id}:1`,
    },
    cards: [
      {
        id: `${id}-card`,
        kind: "basic",
        front: `Recall ${id}`,
        back,
        tags: ["auth"],
      },
    ],
    createdAt,
    updatedAt: createdAt,
  });

  writeKnowledgeNoteRevision(fixture.studiesRoot, "sample", {
    note: makeNote("active-note", "active", [fixture.evidence], "ACTIVE-NOTE-BACK-SECRET"),
    content: "# Active classroom note\n\nThis claim was grounded in the immutable snapshot.\n",
  });
  writeKnowledgeNoteRevision(fixture.studiesRoot, "sample", {
    note: makeNote("draft-note", "draft", [], "DRAFT-NOTE-BACK-SECRET"),
    content: "# Draft classroom note\n\nThis still needs source evidence.\n",
  });
  writeKnowledgeNoteRevision(fixture.studiesRoot, "sample", {
    note: makeNote("stale-note", "stale", [fixture.evidence], "STALE-NOTE-BACK-SECRET"),
    content: "# Stale classroom note\n\nIts source has changed since capture.\n",
  });

  const store = new SqliteLearningStore(
    getStudyPaths(fixture.studiesRoot, "sample").learner.database,
  );
  for (const noteId of ["active-note", "draft-note", "stale-note"] as const) {
    store.ensureCard(
      knowledgeCardContentKey({ noteId, cardId: `${noteId}-card` }),
      1,
      new Date("2020-01-01T00:00:00.000Z"),
    );
  }
  store.close();
}

describe("UniversityLocal loopback API", () => {
  it("returns real study summaries without creating learner data", async () => {
    const projectRoot = makeProject();
    createStudy(join(projectRoot, "studies"), { id: "sample", title: "Sample" });
    const { base } = await start(projectRoot);
    const response = await fetch(`${base}/api/bootstrap`);
    const body = (await response.json()) as { studies: Array<Record<string, unknown>> };

    expect(response.status).toBe(200);
    expect(body.studies).toMatchObject([
      {
        id: "sample",
        title: "Sample",
        sourceRegistered: false,
        snapshotCount: 0,
        uaAnalysisCount: 0,
        hasLearningDatabase: false,
      },
    ]);
  });

  it("rejects non-loopback Host headers and state-changing methods", async () => {
    const { base } = await start(makeProject());
    const foreignStatus = await new Promise<number | undefined>((resolve, reject) => {
      get(`${base}/api/health`, { headers: { Host: "attacker.example" } }, (response) => {
        response.resume();
        response.on("end", () => resolve(response.statusCode));
      }).on("error", reject);
    });
    const post = await fetch(`${base}/api/health`, { method: "POST" });
    expect(foreignStatus).toBe(403);
    expect(post.status).toBe(405);
  });

  it("never sends answers in GET views and protects answer-revealing mutations", async () => {
    const fixture = makeLearningProject();
    const { base, server } = await start(fixture.projectRoot);
    const bootstrapResponse = await fetch(`${base}/api/bootstrap`);
    const bootstrap = (await bootstrapResponse.json()) as {
      requestToken: string;
      today: { dueCount: number; card: { front: string } | null };
    };
    expect(bootstrap.today.dueCount).toBe(1);
    expect(bootstrap.today.card?.front).toContain("owns authentication");
    expect(JSON.stringify(bootstrap)).not.toContain("identity-service");

    const lessonResponse = await fetch(`${base}${fixture.lessonPath}`);
    const lessonText = await lessonResponse.text();
    expect(lessonResponse.status).toBe(200);
    expect(lessonText).toContain("Name the authentication owner");
    expect(lessonText).not.toContain('"expectedAnswer"');
    expect(lessonText).not.toContain('"back"');
    expect(lessonResponse.headers.get("access-control-allow-origin")).toBeNull();
    expect(lessonResponse.headers.get("x-content-type-options")).toBe("nosniff");

    const revealPath = `${fixture.lessonPath}/cards/auth-owner-card/reveal`;
    const revealBody = {
      commandId: "33333333-3333-4333-8333-333333333333",
      contentRevision: 1,
      answer: "my answer",
      startedAt: new Date(Date.now() - 1_000).toISOString(),
      usedHint: false,
    };
    const unauthorized = await fetch(`${base}${revealPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(revealBody),
    });
    expect(unauthorized.status).toBe(403);

    const foreignOrigin = await fetch(`${base}${revealPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-University-Local-Token": bootstrap.requestToken,
        Origin: "https://attacker.example",
      },
      body: JSON.stringify(revealBody),
    });
    expect(foreignOrigin.status).toBe(403);

    const revealed = await fetch(`${base}${revealPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-University-Local-Token": bootstrap.requestToken,
        Origin: "http://127.0.0.1:9999",
      },
      body: JSON.stringify(revealBody),
    });
    expect(revealed.status).toBe(200);
    const revealedBody = (await revealed.json()) as {
      attemptId: string;
      durationMs: number;
      priorAttempts: readonly { answer: string }[];
    };
    expect(revealedBody).toMatchObject({ back: "identity-service" });
    expect(revealedBody.durationMs).toBeGreaterThanOrEqual(0);
    // First time through this card, so there is nothing behind it — and in
    // particular the answer just submitted is not echoed back as its own
    // history.
    expect(revealedBody.priorAttempts).toEqual([]);

    // Answering a second time is where the history has to appear, and it must
    // arrive only with the reveal: a review card whose previous answer is
    // readable while the question is still open is not testing recall.
    const secondReveal = await fetch(`${base}${revealPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-University-Local-Token": bootstrap.requestToken,
        Origin: "http://127.0.0.1:9999",
      },
      body: JSON.stringify({
        ...revealBody,
        commandId: "44444444-4444-4444-8444-444444444444",
        answer: "a later, better answer",
      }),
    });
    expect(secondReveal.status).toBe(200);
    const secondBody = (await secondReveal.json()) as {
      priorAttempts: readonly { answer: string }[];
    };
    expect(secondBody.priorAttempts.map((attempt) => attempt.answer)).toEqual(["my answer"]);

    const lessonAfterReveal = (await (await fetch(`${base}${fixture.lessonPath}`)).json()) as {
      lesson: { cards: readonly Record<string, unknown>[] };
    };
    for (const card of lessonAfterReveal.lesson.cards) {
      expect(JSON.stringify(card)).not.toContain("my answer");
    }

    const retried = await fetch(`${base}${revealPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-University-Local-Token": bootstrap.requestToken,
      },
      body: JSON.stringify(revealBody),
    });
    expect(await retried.json()).toMatchObject({ attemptId: revealedBody.attemptId });

    const conflict = await fetch(`${base}${revealPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-University-Local-Token": bootstrap.requestToken,
      },
      body: JSON.stringify({ ...revealBody, answer: "a different answer" }),
    });
    expect(conflict.status).toBe(409);

    const revisionConflict = await fetch(`${base}${revealPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-University-Local-Token": bootstrap.requestToken,
      },
      body: JSON.stringify({
        ...revealBody,
        commandId: "44444444-4444-4444-8444-444444444444",
        contentRevision: 2,
      }),
    });
    expect(revisionConflict.status).toBe(409);
    const invalidRevision = await fetch(`${base}${revealPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-University-Local-Token": bootstrap.requestToken,
      },
      body: JSON.stringify({
        ...revealBody,
        commandId: "77777777-7777-4777-8777-777777777777",
        contentRevision: 0,
      }),
    });
    expect(invalidRevision.status).toBe(400);

    await stop(server);
    const restarted = await start(fixture.projectRoot);
    const restartedBootstrap = (await (await fetch(`${restarted.base}/api/bootstrap`)).json()) as {
      requestToken: string;
    };
    const persistedRetry = await fetch(`${restarted.base}${revealPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-University-Local-Token": restartedBootstrap.requestToken,
      },
      body: JSON.stringify(revealBody),
    });
    expect(await persistedRetry.json()).toMatchObject({ attemptId: revealedBody.attemptId });

    const store = new SqliteLearningStore(
      getStudyPaths(fixture.studiesRoot, "sample").learner.database,
    );
    // Two genuine answers, and every replay of either command ID above folded
    // back onto the row it already wrote rather than adding another.
    expect(store.retrievalAttemptCount()).toBe(2);
    expect(store.getRetrievalAttemptByCommandId(revealBody.commandId)).toMatchObject({
      attemptId: revealedBody.attemptId,
      answer: revealBody.answer,
      contentRevision: 1,
      usedHint: false,
    });
    store.close();
  });

  it("serves only lesson-approved evidence from its fixed commit", async () => {
    const fixture = makeLearningProject();
    const { base } = await start(fixture.projectRoot);
    writeFileSync(join(fixture.sourceRoot, "auth.ts"), "export const owner = 'attacker';\n");

    const response = await fetch(`${base}${fixture.lessonPath}/evidence/0?path=../../etc/passwd`);
    const body = (await response.json()) as {
      sourcePath: string;
      sourceCommit: string;
      startLine: number;
      endLine: number;
      highlightStartLine: number;
      highlightEndLine: number;
      language: string;
      code: string;
    };
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      sourcePath: "auth.ts",
      startLine: 1,
      endLine: 2,
      highlightStartLine: 1,
      highlightEndLine: 1,
      language: "typescript",
    });
    expect(body.code).toContain("identity-service");
    expect(body.code).toContain("<img src=x onerror=alert(1)>");
    expect(body.code).not.toContain("attacker");
    expect(body.code).not.toContain("passwd");

    const outside = await fetch(`${base}/api/evidence?path=/etc/passwd`);
    const invalidIndex = await fetch(`${base}${fixture.lessonPath}/evidence/1`);
    const pathInsteadOfIndex = await fetch(`${base}${fixture.lessonPath}/evidence/auth.ts`);
    expect(outside.status).toBe(404);
    expect(invalidIndex.status).toBe(404);
    expect(pathInsteadOfIndex.status).toBe(404);
  });

  it("serves only the active lesson revision's hashed local assets", async () => {
    const fixture = makeLearningProject(false);
    const sourceAsset = join(fixture.projectRoot, "captured-screen.svg");
    const assetContents =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4" fill="red"/></svg>\n';
    writeFileSync(sourceAsset, assetContents);
    const assetHash = `sha256:${createHash("sha256").update(assetContents).digest("hex")}`;
    const current = readLatestLesson(
      fixture.studiesRoot,
      "sample",
      "founder-engineer",
      "auth-architecture",
      "auth-owner",
    );
    updateCourseStatus(fixture.studiesRoot, "sample", "founder-engineer", "stale");
    updateUnitStatus(
      fixture.studiesRoot,
      "sample",
      "founder-engineer",
      "auth-architecture",
      "stale",
    );
    writeLessonRevision(fixture.studiesRoot, "sample", {
      manifest: {
        ...current.manifest,
        contentRevision: 2,
        updatedAt: "2026-07-20T04:00:00.000Z",
        assets: [
          {
            id: "captured-screen",
            kind: "diagram",
            path: "assets/captured-screen.svg",
            sha256: assetHash,
            mime: "image/svg+xml",
            bytes: Buffer.byteLength(assetContents),
            width: 4,
            height: 4,
            alt: "A local captured screen test asset.",
            caption: "A local asset with a manifest identity.",
            source: {
              license: "Test fixture",
              attribution: "UniversityLocal test fixture",
            },
          },
        ],
      },
      content: current.content,
      assetFiles: [{ path: "assets/captured-screen.svg", sourcePath: sourceAsset }],
    });
    updateUnitStatus(
      fixture.studiesRoot,
      "sample",
      "founder-engineer",
      "auth-architecture",
      "active",
    );
    updateCourseStatus(fixture.studiesRoot, "sample", "founder-engineer", "active");

    const { base } = await start(fixture.projectRoot);
    const lesson = (await (await fetch(`${base}${fixture.lessonPath}`)).json()) as {
      lesson: { contentRevision: number; assets: readonly { id: string; url: string }[] };
    };
    expect(lesson.lesson.contentRevision).toBe(2);
    expect(lesson.lesson.assets[0]?.url).toBe(
      `${fixture.lessonPath}/revisions/2/assets/captured-screen`,
    );
    expect(JSON.stringify(lesson)).not.toContain(fixture.studiesRoot);

    const assetPath = `${fixture.lessonPath}/revisions/2/assets/captured-screen`;
    const served = await fetch(`${base}${assetPath}`);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toContain("image/svg+xml");
    expect(served.headers.get("content-length")).toBe(String(Buffer.byteLength(assetContents)));
    expect(served.headers.get("cache-control")).toContain("immutable");
    expect(served.headers.get("x-content-type-options")).toBe("nosniff");
    expect(served.headers.get("etag")).toBe(`"${assetHash}"`);
    expect(await served.text()).toBe(assetContents);

    const oldRevision = await fetch(
      `${base}${fixture.lessonPath}/revisions/1/assets/captured-screen`,
    );
    const unknownAsset = await fetch(`${base}${assetPath}-unknown`);
    const traversal = await fetch(`${base}${fixture.lessonPath}/revisions/2/assets/%2E%2E`);
    expect(oldRevision.status).toBe(409);
    expect(unknownAsset.status).toBe(404);
    expect([400, 404]).toContain(traversal.status);

    writeFileSync(
      join(
        fixture.studiesRoot,
        "sample/courses/founder-engineer/units/auth-architecture/lessons/auth-owner/revisions/2/assets/captured-screen.svg",
      ),
      "<svg>tampered</svg>\n",
    );
    const tampered = await fetch(`${base}${assetPath}`);
    expect(tampered.status).toBe(422);
  });

  it("lists classroom notes safely but keeps their cards out of the learner review queue", async () => {
    const fixture = makeLearningProject(false);
    addKnowledgeNotes(fixture);
    const learnerPath = getStudyPaths(fixture.studiesRoot, "sample").learner.database;
    const seededStore = new SqliteLearningStore(learnerPath);
    seededStore.ensureCard(
      knowledgeCardContentKey({ noteId: "missing-note", cardId: "missing-card" }),
      1,
      new Date("2019-01-01T00:00:00.000Z"),
    );
    seededStore.close();

    const { base, server } = await start(fixture.projectRoot);
    const studyResponse = await fetch(`${base}/api/studies/sample`);
    const studyText = await studyResponse.text();
    const study = JSON.parse(studyText) as {
      notes: Array<{
        id: string;
        status: string;
        cardCount: number;
        contentRevision: number;
        content: string;
        evidence: unknown[];
      }>;
    };
    expect(studyResponse.status).toBe(200);
    expect(study.notes).toMatchObject([
      {
        id: "active-note",
        status: "active",
        cardCount: 1,
        contentRevision: 1,
        evidence: [{ sourcePath: "auth.ts" }],
      },
      { id: "draft-note", status: "draft", cardCount: 1, evidence: [] },
      { id: "stale-note", status: "stale", cardCount: 1 },
    ]);
    expect(studyText).toContain("Active classroom note");
    expect(studyText).not.toContain("ACTIVE-NOTE-BACK-SECRET");
    expect(studyText).not.toContain("DRAFT-NOTE-BACK-SECRET");
    expect(studyText).not.toContain("STALE-NOTE-BACK-SECRET");
    expect(studyText).not.toContain('"cards"');

    const bootstrapResponse = await fetch(`${base}/api/bootstrap`);
    const bootstrap = (await bootstrapResponse.json()) as {
      requestToken: string;
      today: {
        dueCount: number;
        card: null | {
          kind: string;
          studyId: string;
          noteId: string;
          cardId: string;
          front: string;
          contentRevision: number;
        };
        issues: string[];
      };
    };
    expect(bootstrap.today).toMatchObject({
      dueCount: 0,
      card: null,
    });
    expect(bootstrap.today.issues.join(" ")).toContain("missing-note");
    expect(JSON.stringify(bootstrap)).not.toContain("BACK-SECRET");

    writeFileSync(join(fixture.sourceRoot, "auth.ts"), "export const owner = 'attacker';\n");
    const evidenceResponse = await fetch(
      `${base}/api/studies/sample/notes/active-note/evidence/0?path=../../etc/passwd`,
    );
    const evidence = (await evidenceResponse.json()) as { code: string; sourcePath: string };
    expect(evidenceResponse.status).toBe(200);
    expect(evidence.sourcePath).toBe("auth.ts");
    expect(evidence.code).toContain("identity-service");
    expect(evidence.code).not.toContain("attacker");
    expect(evidence.code).not.toContain("passwd");

    const headers = {
      "Content-Type": "application/json",
      "X-University-Local-Token": bootstrap.requestToken,
    };
    const activePath = "/api/studies/sample/notes/active-note/cards/active-note-card";
    const revealBody = {
      commandId: "88888888-8888-4888-8888-888888888888",
      contentRevision: 1,
      answer: "my recalled answer",
      startedAt: new Date(Date.now() - 1_000).toISOString(),
      usedHint: false,
    };
    const revealed = await fetch(`${base}${activePath}/reveal`, {
      method: "POST",
      headers,
      body: JSON.stringify(revealBody),
    });
    const revealedBody = (await revealed.json()) as { attemptId: string; back: string };
    expect(revealed.status).toBe(200);
    expect(revealedBody.back).toBe("ACTIVE-NOTE-BACK-SECRET");
    const duplicateReveal = await fetch(`${base}${activePath}/reveal`, {
      method: "POST",
      headers,
      body: JSON.stringify(revealBody),
    });
    expect(await duplicateReveal.json()).toMatchObject({ attemptId: revealedBody.attemptId });

    for (const status of ["draft", "stale"] as const) {
      const blocked = await fetch(
        `${base}/api/studies/sample/notes/${status}-note/cards/${status}-note-card/reveal`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            ...revealBody,
            commandId:
              status === "draft"
                ? "99999999-9999-4999-8999-999999999999"
                : "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          }),
        },
      );
      expect(blocked.status).toBe(409);
    }

    const reviewBody = {
      commandId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      contentRevision: 1,
      rating: 3,
    };
    const reviewed = await fetch(`${base}${activePath}/review`, {
      method: "POST",
      headers,
      body: JSON.stringify(reviewBody),
    });
    const reviewedBody = (await reviewed.json()) as { eventId: string };
    expect(reviewed.status).toBe(200);
    const duplicateReview = await fetch(`${base}${activePath}/review`, {
      method: "POST",
      headers,
      body: JSON.stringify(reviewBody),
    });
    expect(await duplicateReview.json()).toMatchObject({ eventId: reviewedBody.eventId });
    expect((await (await fetch(`${base}/api/bootstrap`)).json()) as unknown).toMatchObject({
      today: { dueCount: 0, card: null },
    });

    await stop(server);
    const restarted = await start(fixture.projectRoot);
    expect(
      (await (await fetch(`${restarted.base}/api/bootstrap`)).json()) as unknown,
    ).toMatchObject({
      today: { dueCount: 0, card: null },
    });
  });

  /**
   * Submitting is no longer the same act as passing. The page records what the
   * learner wrote and stops; the pass comes back from an AI host. A card that
   * enrolled on submission would put an unlearned fact into the review queue.
   */
  it("enrolls active lesson cards only after the host grades a pass", async () => {
    const fixture = makeLearningProject(false);
    const { base } = await start(fixture.projectRoot);
    const bootstrap = (await (await fetch(`${base}/api/bootstrap`)).json()) as {
      requestToken: string;
      today: { dueCount: number };
    };
    expect(bootstrap.today.dueCount).toBe(0);
    const headers = {
      "Content-Type": "application/json",
      "X-University-Local-Token": bootstrap.requestToken,
    };
    const exercisePath = `${fixture.lessonPath}/exercises/name-auth-owner`;

    const exerciseContent = await fetch(`${base}${exercisePath}`);
    expect(exerciseContent.status).toBe(200);
    expect(await exerciseContent.json()).toMatchObject({
      id: "name-auth-owner",
      lessonTitle: "Who owns authentication?",
      title: "Name the owner",
      prompt: "Name the authentication owner.",
      correctAnswer: "identity-service",
      contentRevision: 1,
    });

    const submitted = await fetch(`${base}${exercisePath}/attempt`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        commandId: "55555555-5555-4555-8555-555555555555",
        contentRevision: 1,
        answer: "identity-service",
      }),
    });
    expect(submitted.status).toBe(200);
    // Even a verbatim-correct answer waits for the host.
    expect(await submitted.json()).toMatchObject({ correct: false, awaitingHostGrade: true });
    expect((await (await fetch(`${base}/api/bootstrap`)).json()) as unknown).toMatchObject({
      today: { dueCount: 0 },
    });

    const failed = await hostGrade(base, headers, exercisePath, {
      commandId: "66666666-6666-4666-8666-666666666666",
      passed: false,
      evaluation: "少了一个关键点",
    });
    expect(failed.status).toBe(200);
    expect((await (await fetch(`${base}/api/bootstrap`)).json()) as unknown).toMatchObject({
      today: { dueCount: 0 },
    });

    const passed = await hostGrade(base, headers, exercisePath, {
      commandId: "77777777-7777-4777-8777-777777777777",
      passed: true,
      evaluation: "对了：identity-service 拥有认证。",
    });
    expect(passed.status).toBe(200);
    const confirmed = await confirmLesson(
      base,
      headers,
      fixture.lessonPath,
      "99999999-9999-4999-8999-999999999999",
    );
    expect(confirmed.status).toBe(200);
    expect((await (await fetch(`${base}/api/bootstrap`)).json()) as unknown).toMatchObject({
      today: {
        dueCount: 1,
        card: { cardId: "auth-owner-card", contentRevision: 1 },
      },
    });
  });

  /**
   * Regression: the HTTP layer and the grade workflow each kept their own
   * "attempted but unsolved" progress floor, at 0.25 and 0.05. Submitting wrote
   * the higher one, and a `passed: false` grade then tried to write the lower
   * one, which the store rightly refuses as moving progress backward. The
   * learner got a 409 and no explanation at all — on the most common path there
   * is, a first answer that is wrong.
   */
  it("records a failing grade after a submission instead of refusing it", async () => {
    const fixture = makeLearningProject(false);
    const { base } = await start(fixture.projectRoot);
    const bootstrap = (await (await fetch(`${base}/api/bootstrap`)).json()) as {
      requestToken: string;
    };
    const headers = {
      "Content-Type": "application/json",
      "X-University-Local-Token": bootstrap.requestToken,
    };
    const exercisePath = `${fixture.lessonPath}/exercises/name-auth-owner`;

    await fetch(`${base}${exercisePath}/attempt`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        commandId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        contentRevision: 1,
        answer: "a first, wrong answer",
      }),
    });
    const failed = await hostGrade(base, headers, exercisePath, {
      commandId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      passed: false,
      evaluation: "认证的拥有者不是这个。",
    });
    expect(failed.status).toBe(200);

    const lesson = (await (await fetch(`${base}${fixture.lessonPath}`)).json()) as {
      lesson: {
        progress: { status: string } | null;
        exercises: readonly { hostGrade: { evaluation: string; passed: boolean } | null }[];
      };
    };
    expect(lesson.lesson.progress).toMatchObject({ status: "in-progress" });
    expect(lesson.lesson.exercises[0]?.hostGrade).toMatchObject({
      passed: false,
      evaluation: "认证的拥有者不是这个。",
    });
  });

  it("completes a multi-exercise lesson only when every exercise is graded a pass", async () => {
    const fixture = makeLearningProject(false);
    addSecondExercise(fixture);
    const { base } = await start(fixture.projectRoot);
    const bootstrap = (await (await fetch(`${base}/api/bootstrap`)).json()) as {
      requestToken: string;
    };
    const headers = {
      "Content-Type": "application/json",
      "X-University-Local-Token": bootstrap.requestToken,
    };
    const lessonProgress = async () =>
      (
        (await (await fetch(`${base}${fixture.lessonPath}`)).json()) as {
          lesson: { progress: { status: string } | null };
        }
      ).lesson.progress;

    const first = await hostGrade(
      base,
      headers,
      `${fixture.lessonPath}/exercises/name-auth-owner`,
      {
        commandId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        passed: true,
        evaluation: "对",
      },
    );
    expect(first.status).toBe(200);
    expect(await lessonProgress()).toMatchObject({ status: "in-progress" });
    // One of two exercises passed must not open the review queue.
    expect((await (await fetch(`${base}/api/bootstrap`)).json()) as unknown).toMatchObject({
      today: { dueCount: 0 },
    });

    const second = await hostGrade(
      base,
      headers,
      `${fixture.lessonPath}/exercises/name-auth-store`,
      {
        commandId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        passed: true,
        evaluation: "也对",
      },
    );
    expect(second.status).toBe(200);
    const confirmed = await confirmLesson(
      base,
      headers,
      fixture.lessonPath,
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      2,
    );
    expect(confirmed.status).toBe(200);
    expect(await lessonProgress()).toMatchObject({ status: "completed", progress: 1 });
    expect((await (await fetch(`${base}/api/bootstrap`)).json()) as unknown).toMatchObject({
      today: { dueCount: 1 },
    });
  });

  it("answers a reused command ID with 409 instead of a server error", async () => {
    const fixture = makeLearningProject();
    const { base } = await start(fixture.projectRoot);
    const bootstrap = (await (await fetch(`${base}/api/bootstrap`)).json()) as {
      requestToken: string;
    };
    const headers = {
      "Content-Type": "application/json",
      "X-University-Local-Token": bootstrap.requestToken,
    };
    const commandId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const attemptPath = `${fixture.lessonPath}/exercises/name-auth-owner/attempt`;
    const send = async (answer: string) =>
      fetch(`${base}${attemptPath}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ commandId, contentRevision: 1, answer }),
      });

    expect((await send("first guess")).status).toBe(200);
    // Same command ID, different body: a client conflict, not a 500.
    expect((await send("different guess")).status).toBe(409);
  });

  it("refuses a coaching packet before the learner has submitted anything", async () => {
    const fixture = makeLearningProject();
    const { base } = await start(fixture.projectRoot);
    const response = await fetch(
      `${base}${fixture.lessonPath}/exercises/name-auth-owner/coaching-packet`,
    );
    expect(response.status).toBe(409);
  });

  /**
   * The packet is what an assistant in a fresh chat window grades from. It has
   * to carry the cited source, because that assistant usually cannot open the
   * repository, and it must not carry the reference answer on a first try,
   * because handing it over ends the retrieval practice the exercise exists for.
   */
  it("packs cited source but withholds the reference until the learner has really tried", async () => {
    const fixture = makeLearningProject();
    const { base } = await start(fixture.projectRoot);
    const bootstrap = (await (await fetch(`${base}/api/bootstrap`)).json()) as {
      readonly requestToken: string;
    };
    const headers = {
      "Content-Type": "application/json",
      "X-University-Local-Token": bootstrap.requestToken,
    };
    const attemptPath = `${fixture.lessonPath}/exercises/name-auth-owner/attempt`;
    const packetPath = `${fixture.lessonPath}/exercises/name-auth-owner/coaching-packet`;
    const submit = (commandId: string, answer: string) =>
      fetch(`${base}${attemptPath}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ commandId, contentRevision: 1, answer }),
      });

    expect((await submit("aaaaaaa1-1111-4111-8111-111111111111", "first guess")).status).toBe(200);
    const first = (await (await fetch(`${base}${packetPath}`)).json()) as {
      readonly packet: string;
      readonly referenceDisclosed: boolean;
      readonly evidenceCount: number;
      readonly submissionCount: number;
    };
    expect(first.submissionCount).toBe(1);
    expect(first.referenceDisclosed).toBe(false);
    expect(first.evidenceCount).toBe(1);
    expect(first.packet).toContain("export const owner = 'identity-service';");
    expect(first.packet).toContain("first guess");
    expect(first.packet).toContain("本次不提供参考答案");
    expect(first.packet).toContain('"passed": false');

    expect((await submit("aaaaaaa2-2222-4222-8222-222222222222", "second guess")).status).toBe(200);
    const second = (await (await fetch(`${base}${packetPath}`)).json()) as {
      readonly packet: string;
      readonly referenceDisclosed: boolean;
      readonly submissionCount: number;
    };
    expect(second.submissionCount).toBe(2);
    expect(second.referenceDisclosed).toBe(true);
    expect(second.packet).toContain("identity-service");
    expect(second.packet).toContain("参考答案（学习者已多次尝试，可以揭晓）");
    // The newest answer, not the one the first packet was built from.
    expect(second.packet).toContain("second guess");
  });

  it("serves the restored database after the learner file is replaced under it", async () => {
    const fixture = makeLearningProject();
    const { base } = await start(fixture.projectRoot);
    const learnerPath = getStudyPaths(fixture.studiesRoot, "sample").learner.database;

    // Opening the shelf makes the server hold this database open.
    expect((await (await fetch(`${base}/api/bootstrap`)).json()) as unknown).toMatchObject({
      today: { dueCount: 1 },
    });

    // What `learner restore` / `learner reset` do: rename a different file
    // into place. The old inode stays alive for anyone still holding it, so a
    // server that trusts its cached handle keeps reading the replaced database
    // and writes into a file that is no longer reachable by path.
    const replacementPath = join(mkdtempSync(join(tmpdir(), "ul-restore-")), "learning.sqlite");
    new SqliteLearningStore(replacementPath).close();
    for (const suffix of ["-wal", "-shm"]) rmSync(`${learnerPath}${suffix}`, { force: true });
    renameSync(replacementPath, learnerPath);

    expect((await (await fetch(`${base}/api/bootstrap`)).json()) as unknown).toMatchObject({
      today: { dueCount: 0, card: null },
    });
  });

  /**
   * The attempt endpoint used to grade by string equality and hand back the
   * reference answer once the learner had tried twice. Grading moved to the AI
   * host, and disclosure moved to the coaching packet, which the server builds.
   * Neither the reference answer nor a verdict may leak from this route now —
   * a client that still reads `expectedAnswer` here must find nothing.
   */
  it("records the answer without judging it or leaking the reference", async () => {
    const fixture = makeLearningProject();
    const { base } = await start(fixture.projectRoot);
    const bootstrap = (await (await fetch(`${base}/api/bootstrap`)).json()) as {
      requestToken: string;
    };
    const headers = {
      "Content-Type": "application/json",
      "X-University-Local-Token": bootstrap.requestToken,
    };
    const attemptPath = `${fixture.lessonPath}/exercises/name-auth-owner/attempt`;
    const attempt = async (commandId: string, answer: string) => {
      const response = await fetch(`${base}${attemptPath}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ commandId, contentRevision: 1, answer }),
      });
      const text = await response.text();
      return {
        text,
        body: JSON.parse(text) as {
          readonly correct: boolean;
          readonly awaitingHostGrade: boolean;
          readonly attemptCount: number;
          readonly expectedAnswer?: string;
        },
      };
    };

    const wrong = await attempt("11111111-1111-4111-8111-111111111111", "wrong");
    expect(wrong.body).toMatchObject({ correct: false, awaitingHostGrade: true, attemptCount: 1 });
    expect(wrong.body.expectedAnswer).toBeUndefined();
    expect(wrong.text).not.toContain("identity-service");

    // A verbatim-correct answer is still only an answer until the host says so.
    const verbatim = await attempt("22222222-2222-4222-8222-222222222222", "identity-service");
    expect(verbatim.body).toMatchObject({ correct: false, awaitingHostGrade: true });
    expect(verbatim.body.expectedAnswer).toBeUndefined();
  });

  it("persists idempotent exercise and FSRS review commands", async () => {
    const fixture = makeLearningProject();
    const { base } = await start(fixture.projectRoot);
    const bootstrap = (await (await fetch(`${base}/api/bootstrap`)).json()) as {
      requestToken: string;
    };
    const headers = {
      "Content-Type": "application/json",
      "X-University-Local-Token": bootstrap.requestToken,
      Origin: "http://localhost:9999",
    };

    const attemptBody = {
      commandId: "11111111-1111-4111-8111-111111111111",
      contentRevision: 1,
      answer: " identity-service ",
    };
    const attemptPath = `${fixture.lessonPath}/exercises/name-auth-owner/attempt`;
    const firstAttempt = await fetch(`${base}${attemptPath}`, {
      method: "POST",
      headers,
      body: JSON.stringify(attemptBody),
    });
    const firstAttemptBody = (await firstAttempt.json()) as { attemptId: string; correct: boolean };
    const duplicateAttempt = await fetch(`${base}${attemptPath}`, {
      method: "POST",
      headers,
      body: JSON.stringify(attemptBody),
    });
    // Submitting records; it never decides. The verdict belongs to the host.
    expect(firstAttemptBody.correct).toBe(false);
    expect(await duplicateAttempt.json()).toMatchObject({ attemptId: firstAttemptBody.attemptId });

    const reviewBody = {
      commandId: "22222222-2222-4222-8222-222222222222",
      contentRevision: 1,
      rating: 3,
    };
    const reviewPath = `${fixture.lessonPath}/cards/auth-owner-card/review`;
    const firstReview = await fetch(`${base}${reviewPath}`, {
      method: "POST",
      headers,
      body: JSON.stringify(reviewBody),
    });
    const firstReviewBody = (await firstReview.json()) as { eventId: string };
    const duplicateReview = await fetch(`${base}${reviewPath}`, {
      method: "POST",
      headers,
      body: JSON.stringify(reviewBody),
    });
    expect(await duplicateReview.json()).toMatchObject({ eventId: firstReviewBody.eventId });

    const refreshed = (await (await fetch(`${base}/api/bootstrap`)).json()) as {
      today: { dueCount: number; nextLesson: { lessonId: string } | null };
    };
    expect(refreshed.today.dueCount).toBe(0);
    // Submitting no longer finishes a lesson, so today still reaches for it —
    // the learner has written an answer but nothing has judged it yet.
    expect(refreshed.today.nextLesson?.lessonId).toBe("auth-owner");
  });

  it("teaches every active course in a study, not only the default one", async () => {
    const fixture = makeLearningProject(false);
    const secondLessonPath = addSecondCourse(fixture);
    const { base } = await start(fixture.projectRoot);

    // The gate used to be `defaultCourseId`, so this lesson answered 404 even
    // though its course was written, validated and marked active.
    const lesson = await fetch(`${base}${secondLessonPath}`);
    expect(lesson.status).toBe(200);
    expect(await lesson.text()).toContain("Where does spending stop?");

    const study = (await (await fetch(`${base}/api/studies/sample`)).json()) as {
      courses: Array<{ id: string; isDefault: boolean }>;
    };
    expect(study.courses.map((course) => course.id)).toEqual([
      "founder-engineer",
      "cost-boundaries",
    ]);
    expect(study.courses.map((course) => course.isDefault)).toEqual([true, false]);

    const bootstrap = (await (await fetch(`${base}/api/bootstrap`)).json()) as {
      studies: Array<{ activeCourseCount: number }>;
    };
    expect(bootstrap.studies[0]?.activeCourseCount).toBe(2);

    const missing = await fetch(
      `${base}/api/studies/sample/courses/no-such-course/units/spend/lessons/spend-gate`,
    );
    expect(missing.status).toBe(404);
  });

  it("offers the focused course first without hiding the rest", async () => {
    const fixture = makeLearningProject(false);
    addSecondCourse(fixture);

    const unfocused = await start(fixture.projectRoot);
    const before = (await (await fetch(`${unfocused.base}/api/bootstrap`)).json()) as {
      today: { nextLesson: { courseId: string } | null; focus: unknown };
    };
    // Walk order decides the offer, and by default that is just whichever
    // course the shelf listed first.
    expect(before.today.nextLesson?.courseId).toBe("founder-engineer");
    expect(before.today.focus).toBeNull();

    // Written through the workflow rather than by hand, so the run the learner
    // would actually type is the one the server then walks.
    setAuthoringFocus({
      projectRoot: fixture.projectRoot,
      studiesRoot: fixture.studiesRoot,
      studyId: "sample",
      courseIds: ["cost-boundaries", "founder-engineer"],
    });

    const focused = await start(fixture.projectRoot);
    const after = (await (await fetch(`${focused.base}/api/bootstrap`)).json()) as {
      today: {
        nextLesson: { courseId: string } | null;
        focus: {
          studyId: string;
          courseIds: readonly string[];
          courses: readonly { id: string; title: string }[];
        } | null;
      };
      studies: Array<{ activeCourseCount: number }>;
    };
    expect(after.today.nextLesson?.courseId).toBe("cost-boundaries");
    // The ids are what is stored; the titles ride along so the front page has
    // something to show that is not a slug.
    expect(after.today.focus).toEqual({
      studyId: "sample",
      courseIds: ["cost-boundaries", "founder-engineer"],
      courses: [
        { id: "cost-boundaries", title: "Cost Boundaries" },
        { id: "founder-engineer", title: "Founder Engineer" },
      ],
    });
    // Focus reorders; it must not remove anything from the shelf.
    expect(after.studies[0]?.activeCourseCount).toBe(2);
  });

  it("gives AI hosts the same focused next lesson as the web home page", async () => {
    const fixture = makeLearningProject(false);
    addSecondCourse(fixture);
    setAuthoringFocus({
      projectRoot: fixture.projectRoot,
      studiesRoot: fixture.studiesRoot,
      studyId: "sample",
      courseIds: ["cost-boundaries", "founder-engineer"],
    });

    const cli = (await executeUniversityLocalCli({
      projectRoot: fixture.projectRoot,
      command: { kind: "teach-next" },
    })) as {
      operation: string;
      teachingStudyId: string | null;
      nextLesson: {
        courseId: string;
        lessonId: string;
        evidence: readonly EvidenceReference[];
        artifact: { manifestPath: string; contentPath: string };
      } | null;
    };
    expect(cli.operation).toBe("teach-next");
    expect(cli.teachingStudyId).toBe("sample");
    expect(cli.nextLesson).toMatchObject({
      courseId: "cost-boundaries",
      lessonId: "spend-gate",
      evidence: expect.any(Array),
      artifact: {
        manifestPath: expect.stringContaining("/revisions/1/manifest.json"),
        contentPath: expect.stringContaining("/revisions/1/content.md"),
      },
    });

    const { base } = await start(fixture.projectRoot);
    const bootstrap = (await (await fetch(`${base}/api/bootstrap`)).json()) as {
      today: { nextLesson: { courseId: string; lessonId: string } | null };
    };
    expect(bootstrap.today.nextLesson).toMatchObject({
      courseId: cli.nextLesson?.courseId,
      lessonId: cli.nextLesson?.lessonId,
    });
  });

  it("surfaces due cards from a non-default course", async () => {
    const fixture = makeLearningProject(false);
    addSecondCourse(fixture);
    const store = new SqliteLearningStore(
      getStudyPaths(fixture.studiesRoot, "sample").learner.database,
    );
    store.ensureCard(
      cardContentKey({
        courseId: "cost-boundaries",
        unitId: "spend",
        lessonId: "spend-gate",
        cardId: "spend-gate-card",
      }),
      1,
      new Date("2026-07-20T00:00:00.000Z"),
    );
    store.close();

    const { base } = await start(fixture.projectRoot);
    const bootstrap = (await (await fetch(`${base}/api/bootstrap`)).json()) as {
      today: { dueCount: number; card: { courseId: string; front: string } | null };
    };
    // The due queue used to drop any card whose course was not the default, so
    // reviews scheduled for a second course silently never came back.
    expect(bootstrap.today.dueCount).toBe(1);
    expect(bootstrap.today.card?.courseId).toBe("cost-boundaries");
    expect(JSON.stringify(bootstrap)).not.toContain("SPEND-GATE-BACK-SECRET");
  });

  /**
   * `explain` used to be graded by the learner ticking rubric points about
   * their own answer, which is not a check — it is a self-report. It now takes
   * the same host-grade path as `short-answer`, and the rubric is answer-key
   * material the coaching packet discloses under the same rule.
   */
  it("grades an explain exercise through host write-back and enrolls its cards", async () => {
    const fixture = makeLearningProject(false);
    const lessonPath = addSecondCourse(fixture);
    const { base } = await start(fixture.projectRoot);
    const bootstrap = (await (await fetch(`${base}/api/bootstrap`)).json()) as {
      requestToken: string;
    };
    const headers = {
      "Content-Type": "application/json",
      "X-University-Local-Token": bootstrap.requestToken,
    };
    const exercisePath = `${lessonPath}/exercises/explain-spend-gate`;

    // The rubric is the answer key, so it must not travel with the prompt.
    expect(await (await fetch(`${base}${lessonPath}`)).text()).not.toContain("fails closed");

    const selfAssessed = await fetch(`${base}${exercisePath}/attempt`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        commandId: "44444444-4444-4444-8444-444444444444",
        contentRevision: 1,
        answer: "The gate runs first.",
        met: [0],
      }),
    });
    expect(selfAssessed.status).toBe(400);

    const submitted = await fetch(`${base}${exercisePath}/attempt`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        commandId: "55555555-5555-4555-8555-555555555555",
        contentRevision: 1,
        answer: "The gate runs first.",
      }),
    });
    expect(await submitted.json()).toMatchObject({ correct: false, awaitingHostGrade: true });
    expect(
      ((await (await fetch(`${base}/api/bootstrap`)).json()) as { today: { dueCount: number } })
        .today.dueCount,
    ).toBe(0);

    // A partial answer is the host's call, and a fail keeps the queue closed.
    const partial = await hostGrade(base, headers, exercisePath, {
      commandId: "66666666-6666-4666-8666-666666666666",
      passed: false,
      evaluation: "只说了顺序，没说不可用时会怎样。",
    });
    expect(partial.status).toBe(200);
    expect(
      ((await (await fetch(`${base}/api/bootstrap`)).json()) as { today: { dueCount: number } })
        .today.dueCount,
    ).toBe(0);

    const full = await hostGrade(base, headers, exercisePath, {
      commandId: "88888888-8888-4888-8888-888888888888",
      passed: true,
      evaluation: "顺序和 fail-closed 都说到了。",
    });
    expect(full.status).toBe(200);

    const confirmed = await confirmLesson(
      base,
      headers,
      lessonPath,
      "99999999-9999-4999-8999-999999999999",
    );
    expect(confirmed.status).toBe(200);

    // A lesson whose only exercise is rubric-based used to be uncompletable, so
    // its cards were written and then never scheduled.
    const after = (await (await fetch(`${base}/api/bootstrap`)).json()) as {
      today: { dueCount: number; card: { cardId: string } | null };
    };
    expect(after.today.dueCount).toBe(1);
    expect(after.today.card?.cardId).toBe("spend-gate-card");

    // The rubric endpoint is retired for every kind, not just short-answer.
    const rubric = await fetch(`${base}${exercisePath}/rubric`, {
      method: "POST",
      headers,
      body: JSON.stringify({ contentRevision: 1, answer: "The gate runs first." }),
    });
    expect(rubric.status).toBe(410);
  });

  it("re-offers a lesson whose content was revised after it was completed", async () => {
    const fixture = makeLearningProject(false);
    const store = new SqliteLearningStore(
      getStudyPaths(fixture.studiesRoot, "sample").learner.database,
    );
    store.recordLessonProgress({
      lessonKey: lessonContentKey({
        courseId: "founder-engineer",
        unitId: "auth-architecture",
        lessonId: "auth-owner",
      }),
      contentRevision: 1,
      status: "completed",
      progress: 1,
    });
    store.close();

    const before = await start(fixture.projectRoot);
    expect(
      (
        (await (await fetch(`${before.base}/api/bootstrap`)).json()) as {
          today: { nextLesson: unknown };
        }
      ).today.nextLesson,
    ).toBeNull();
    await stop(before.server);

    // A revise bumps the lesson to revision 2 and re-enrols its cards only when
    // the lesson is completed again. Carrying the revision-1 completion forward
    // left the course looking finished with nothing left in the review queue.
    addSecondExercise(fixture);
    const after = await start(fixture.projectRoot);
    const bootstrap = (await (await fetch(`${after.base}/api/bootstrap`)).json()) as {
      today: {
        nextLesson: { lessonId: string; contentRevision: number; progress: unknown } | null;
      };
    };
    expect(bootstrap.today.nextLesson?.lessonId).toBe("auth-owner");
    expect(bootstrap.today.nextLesson?.contentRevision).toBe(2);
    expect(bootstrap.today.nextLesson?.progress).toMatchObject({
      contentRevision: 1,
      status: "completed",
    });
  });

  /**
   * A client left over from before host grading must fail loudly rather than
   * quietly self-assess its way to a completed lesson.
   */
  it("retires rubric self-assessment rather than leaving it half-wired", async () => {
    const fixture = makeLearningProject(false);
    const { base } = await start(fixture.projectRoot);
    const bootstrap = (await (await fetch(`${base}/api/bootstrap`)).json()) as {
      requestToken: string;
    };
    const headers = {
      "Content-Type": "application/json",
      "X-University-Local-Token": bootstrap.requestToken,
    };
    const exercisePath = `${fixture.lessonPath}/exercises/name-auth-owner`;

    const rubric = await fetch(`${base}${exercisePath}/rubric`, {
      method: "POST",
      headers,
      body: JSON.stringify({ contentRevision: 1, answer: "identity-service" }),
    });
    expect(rubric.status).toBe(410);

    const selfAssessed = await fetch(`${base}${exercisePath}/attempt`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        commandId: "99999999-9999-4999-8999-999999999999",
        contentRevision: 1,
        answer: "identity-service",
        met: [0],
      }),
    });
    expect(selfAssessed.status).toBe(400);
  });
});
