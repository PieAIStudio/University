import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getStudyPaths } from "../studies/paths.js";
import { createStudy } from "../studies/repository.js";
import { endLearningSession, inspectLearningSession, startLearningSession } from "./session.js";

const STUDY_ID = "sample-study";

function temporaryStudiesRoot(): string {
  const root = join(mkdtempSync(join(tmpdir(), "university-local-session-workflow-")), "studies");
  createStudy(root, { id: STUDY_ID, title: "Sample Study" });
  return root;
}

describe("learning session workflow", () => {
  it("runs a complete session lifecycle while status remains non-creating", () => {
    const studiesRoot = temporaryStudiesRoot();
    const database = getStudyPaths(studiesRoot, STUDY_ID).learner.database;

    const emptyStatus = inspectLearningSession({ studiesRoot, studyId: STUDY_ID });
    expect(emptyStatus).toMatchObject({
      schemaVersion: 1,
      operation: "session-status",
      studyId: STUDY_ID,
      databaseExists: false,
      openSession: null,
      recentSessions: [],
    });
    expect(existsSync(database)).toBe(false);

    const started = startLearningSession({
      studiesRoot,
      studyId: STUDY_ID,
      host: "grok-build",
      objective: "Understand authentication",
    });
    const sessionId = started.sessionId;
    expect(sessionId).toEqual(expect.any(String));
    expect(started).toMatchObject({
      schemaVersion: 1,
      operation: "session-start",
      studyId: STUDY_ID,
      sessionId,
      session: {
        sessionId,
        host: "grok-build",
        objective: "Understand authentication",
        endedAt: null,
        reviewCount: 0,
        retrievalAttemptCount: 0,
        exerciseAttemptCount: 0,
        lessonProgressEventCount: 0,
      },
    });
    expect(existsSync(database)).toBe(true);

    expect(() =>
      startLearningSession({
        studiesRoot,
        studyId: STUDY_ID,
        host: "grok-build",
        objective: "A second session",
      }),
    ).toThrow(/already open/);
    expect(() =>
      endLearningSession({
        studiesRoot,
        studyId: STUDY_ID,
        sessionId: "not-the-open-session",
      }),
    ).toThrow(/only open session/);

    const activeStatus = inspectLearningSession({ studiesRoot, studyId: STUDY_ID });
    expect(activeStatus).toMatchObject({
      schemaVersion: 1,
      operation: "session-status",
      databaseExists: true,
      openSession: { sessionId, host: "grok-build" },
      recentSessions: [{ sessionId, reviewCount: 0 }],
    });

    const ended = endLearningSession({ studiesRoot, studyId: STUDY_ID });
    expect(ended).toMatchObject({
      schemaVersion: 1,
      operation: "session-end",
      studyId: STUDY_ID,
      summary: {
        sessionId,
        host: "grok-build",
        reviewCount: 0,
        retrievalAttemptCount: 0,
        exerciseAttemptCount: 0,
        lessonProgressEventCount: 0,
      },
    });
    expect(ended.summary.endedAt).toEqual(expect.any(String));

    const closedStatus = inspectLearningSession({ studiesRoot, studyId: STUDY_ID });
    expect(closedStatus).toMatchObject({
      openSession: null,
      recentSessions: [{ sessionId, endedAt: expect.any(String) }],
    });
  });

  it("rejects end when no learner database or open session exists", () => {
    const studiesRoot = temporaryStudiesRoot();
    const database = getStudyPaths(studiesRoot, STUDY_ID).learner.database;

    expect(() => endLearningSession({ studiesRoot, studyId: STUDY_ID })).toThrow(
      /No learner database or open learning session exists/,
    );
    expect(existsSync(database)).toBe(false);

    startLearningSession({
      studiesRoot,
      studyId: STUDY_ID,
      host: "grok-build",
      objective: "Close me",
    });
    endLearningSession({ studiesRoot, studyId: STUDY_ID });

    expect(() => endLearningSession({ studiesRoot, studyId: STUDY_ID })).toThrow(
      /No open learning session exists/,
    );
  });
});
