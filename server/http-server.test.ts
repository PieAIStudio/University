import { once } from "node:events";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { get } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { EvidenceReference, KnowledgeNote } from "../src/domain/schemas.js";
import { createUniversityLocalHttpServer, normalizeAnswer } from "./http-server.js";
import {
  updateCourseStatus,
  updateUnitStatus,
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
import { setLearningFocus } from "./workflows/focus.js";
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
        Origin: "http://127.0.0.1:5173",
      },
      body: JSON.stringify(revealBody),
    });
    expect(revealed.status).toBe(200);
    const revealedBody = (await revealed.json()) as {
      attemptId: string;
      durationMs: number;
    };
    expect(revealedBody).toMatchObject({ back: "identity-service" });
    expect(revealedBody.durationMs).toBeGreaterThanOrEqual(0);

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
    expect(store.retrievalAttemptCount()).toBe(1);
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

  it("lists classroom notes safely and reviews only active derived cards", async () => {
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
      dueCount: 1,
      card: {
        kind: "knowledge-card",
        studyId: "sample",
        noteId: "active-note",
        cardId: "active-note-card",
        front: "Recall active-note",
        contentRevision: 1,
      },
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

  it("enrolls active lesson cards only after a correct completion", async () => {
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
    const attemptPath = `${fixture.lessonPath}/exercises/name-auth-owner/attempt`;
    const wrong = await fetch(`${base}${attemptPath}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        commandId: "55555555-5555-4555-8555-555555555555",
        contentRevision: 1,
        answer: "wrong",
      }),
    });
    expect(wrong.status).toBe(200);
    expect((await (await fetch(`${base}/api/bootstrap`)).json()) as unknown).toMatchObject({
      today: { dueCount: 0 },
    });

    const correct = await fetch(`${base}${attemptPath}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        commandId: "66666666-6666-4666-8666-666666666666",
        contentRevision: 1,
        answer: "identity-service",
      }),
    });
    expect(correct.status).toBe(200);
    expect((await (await fetch(`${base}/api/bootstrap`)).json()) as unknown).toMatchObject({
      today: {
        dueCount: 1,
        card: { cardId: "auth-owner-card", contentRevision: 1 },
      },
    });
  });

  it("completes a multi-exercise lesson only when every exercise is answered", async () => {
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
    const answer = async (exerciseId: string, commandId: string, text: string) =>
      fetch(`${base}${fixture.lessonPath}/exercises/${exerciseId}/attempt`, {
        method: "POST",
        headers,
        body: JSON.stringify({ commandId, contentRevision: 1, answer: text }),
      });
    const lessonProgress = async () =>
      (
        (await (await fetch(`${base}${fixture.lessonPath}`)).json()) as {
          lesson: { progress: { status: string } | null };
        }
      ).lesson.progress;

    const first = await answer(
      "name-auth-owner",
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "identity-service",
    );
    expect(first.status).toBe(200);
    expect(await lessonProgress()).toMatchObject({ status: "in-progress" });
    // One of two exercises answered must not open the review queue.
    expect((await (await fetch(`${base}/api/bootstrap`)).json()) as unknown).toMatchObject({
      today: { dueCount: 0 },
    });

    const second = await answer(
      "name-auth-store",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "session-store",
    );
    expect(second.status).toBe(200);
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

  it("forgives typing noise but not different answers", () => {
    const expected = normalizeAnswer("Ink");

    expect(normalizeAnswer("ink")).toBe(expected);
    expect(normalizeAnswer("  INK  ")).toBe(expected);
    expect(normalizeAnswer("ink.")).toBe(expected);
    expect(normalizeAnswer("ink。")).toBe(expected);
    expect(normalizeAnswer('"ink"')).toBe(expected);
    expect(normalizeAnswer("「ink」")).toBe(expected);
    expect(normalizeAnswer("ｉｎｋ")).toBe(expected);

    expect(normalizeAnswer("inkjs")).not.toBe(expected);
    expect(normalizeAnswer("react")).not.toBe(expected);
    expect(normalizeAnswer("ink runner")).not.toBe(expected);
  });

  it("withholds the reference answer until the second wrong attempt", async () => {
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
    const attempt = async (commandId: string, answer: string) =>
      (await (
        await fetch(`${base}${attemptPath}`, {
          method: "POST",
          headers,
          body: JSON.stringify({ commandId, contentRevision: 1, answer }),
        })
      ).json()) as {
        readonly correct: boolean;
        readonly attemptCount: number;
        readonly expectedAnswer?: string;
      };

    const first = await attempt("11111111-1111-4111-8111-111111111111", "wrong");
    expect(first).toMatchObject({ correct: false, attemptCount: 1 });
    expect(first.expectedAnswer).toBeUndefined();

    const second = await attempt("22222222-2222-4222-8222-222222222222", "still wrong");
    expect(second).toMatchObject({
      correct: false,
      attemptCount: 2,
      expectedAnswer: "identity-service",
    });
  });

  it("returns the reference answer as soon as the attempt is correct", async () => {
    const fixture = makeLearningProject();
    const { base } = await start(fixture.projectRoot);
    const bootstrap = (await (await fetch(`${base}/api/bootstrap`)).json()) as {
      requestToken: string;
    };
    const correct = await fetch(`${base}${fixture.lessonPath}/exercises/name-auth-owner/attempt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-University-Local-Token": bootstrap.requestToken,
      },
      body: JSON.stringify({
        commandId: "33333333-3333-4333-8333-333333333333",
        contentRevision: 1,
        answer: "identity-service",
      }),
    });

    expect(await correct.json()).toMatchObject({
      correct: true,
      attemptCount: 1,
      expectedAnswer: "identity-service",
    });
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
      Origin: "http://localhost:5173",
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
    expect(firstAttemptBody.correct).toBe(true);
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
      today: { dueCount: number; nextLesson: unknown };
    };
    expect(refreshed.today.dueCount).toBe(0);
    expect(refreshed.today.nextLesson).toBeNull();
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
    setLearningFocus({
      projectRoot: fixture.projectRoot,
      studiesRoot: fixture.studiesRoot,
      studyId: "sample",
      courseIds: ["cost-boundaries", "founder-engineer"],
    });

    const focused = await start(fixture.projectRoot);
    const after = (await (await fetch(`${focused.base}/api/bootstrap`)).json()) as {
      today: {
        nextLesson: { courseId: string } | null;
        focus: { studyId: string; courseIds: readonly string[] } | null;
      };
      studies: Array<{ activeCourseCount: number }>;
    };
    expect(after.today.nextLesson?.courseId).toBe("cost-boundaries");
    expect(after.today.focus).toEqual({
      studyId: "sample",
      courseIds: ["cost-boundaries", "founder-engineer"],
    });
    // Focus reorders; it must not remove anything from the shelf.
    expect(after.studies[0]?.activeCourseCount).toBe(2);
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

  it("grades an explain exercise by rubric self-assessment and enrolls its cards", async () => {
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

    const withoutSelfAssessment = await fetch(`${base}${exercisePath}/attempt`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        commandId: "44444444-4444-4444-8444-444444444444",
        contentRevision: 1,
        answer: "The gate runs first.",
      }),
    });
    expect(withoutSelfAssessment.status).toBe(400);

    const rubric = await fetch(`${base}${exercisePath}/rubric`, {
      method: "POST",
      headers,
      body: JSON.stringify({ contentRevision: 1, answer: "The gate runs first." }),
    });
    expect(rubric.status).toBe(200);
    expect(await rubric.json()).toMatchObject({
      rubric: ["names the ordering", "says what fails closed"],
    });

    const partial = await fetch(`${base}${exercisePath}/attempt`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        commandId: "55555555-5555-4555-8555-555555555555",
        contentRevision: 1,
        answer: "The gate runs first.",
        met: [0],
      }),
    });
    expect(await partial.json()).toMatchObject({ correct: false, score: 1, maxScore: 2 });
    expect(
      ((await (await fetch(`${base}/api/bootstrap`)).json()) as { today: { dueCount: number } })
        .today.dueCount,
    ).toBe(0);

    // Repeating one covered point must not be able to buy the missing one.
    const inflated = await fetch(`${base}${exercisePath}/attempt`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        commandId: "66666666-6666-4666-8666-666666666666",
        contentRevision: 1,
        answer: "The gate runs first.",
        met: [0, 0],
      }),
    });
    expect(await inflated.json()).toMatchObject({ correct: false, score: 1, maxScore: 2 });

    const outOfRange = await fetch(`${base}${exercisePath}/attempt`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        commandId: "77777777-7777-4777-8777-777777777777",
        contentRevision: 1,
        answer: "The gate runs first.",
        met: [0, 9],
      }),
    });
    expect(outOfRange.status).toBe(400);

    const full = await fetch(`${base}${exercisePath}/attempt`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        commandId: "88888888-8888-4888-8888-888888888888",
        contentRevision: 1,
        answer: "The gate runs first, and an unavailable meter refuses the call.",
        met: [0, 1],
      }),
    });
    expect(await full.json()).toMatchObject({ correct: true, score: 2, maxScore: 2 });

    // A lesson whose only exercise is rubric-based used to be uncompletable, so
    // its cards were written and then never scheduled.
    const after = (await (await fetch(`${base}/api/bootstrap`)).json()) as {
      today: { dueCount: number; card: { cardId: string } | null };
    };
    expect(after.today.dueCount).toBe(1);
    expect(after.today.card?.cardId).toBe("spend-gate-card");
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

  it("keeps rubric self-assessment away from short-answer exercises", async () => {
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
    expect(rubric.status).toBe(409);

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
