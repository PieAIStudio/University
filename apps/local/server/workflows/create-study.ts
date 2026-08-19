import { existsSync } from "node:fs";

import { StableId, type SnapshotManifest, type StudyManifest } from "../../src/domain/schemas.js";
import { SqliteLearningStore } from "../learning/sqlite-learning-store.js";
import { getStudyPaths } from "../studies/paths.js";
import { createStudy, readStudy, registerLocalGitSource } from "../studies/repository.js";
import { createCleanSnapshot } from "../studies/snapshots.js";

interface CreateStudyWorkflowInput {
  readonly studiesRoot: string;
  readonly id: string;
  readonly title: string;
  readonly sourceRoot: string;
  readonly description?: string;
  readonly goals?: readonly string[];
  readonly reference?: string;
  readonly now?: Date;
}

interface CreateStudyReceipt {
  readonly schemaVersion: 1;
  readonly operation: "study-create";
  readonly disposition: "created" | "resumed";
  readonly study: StudyManifest;
  readonly sourceRoot: string;
  readonly snapshot: SnapshotManifest;
}

/**
 * Puts one new subject on the shelf: a study container, a registered source, a
 * first immutable snapshot, and a learner database that has run its migrations.
 *
 * These four steps were previously a per-study script with the source path
 * hardcoded on line 20, copied once for the second study. That is not a
 * capability, it is a habit — and it meant the ordering constraints between the
 * steps (a source cannot be registered before the study exists; a snapshot
 * cannot be taken before the source is registered) lived only in whoever
 * remembered to copy the file correctly.
 *
 * Resumable on purpose. Each step checks whether it has already happened, so an
 * interrupted run can be repeated instead of demanding a hand-cleaned shelf.
 */
export function createStudyWithSource(input: CreateStudyWorkflowInput): CreateStudyReceipt {
  const id = StableId.parse(input.id);
  const paths = getStudyPaths(input.studiesRoot, id);
  const existed = existsSync(paths.manifest);

  const study = existed
    ? readStudy(input.studiesRoot, id)
    : createStudy(input.studiesRoot, {
        id,
        title: input.title,
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.goals === undefined ? {} : { goals: input.goals }),
        ...(input.now === undefined ? {} : { now: input.now }),
      });

  if (!existsSync(paths.source.registration)) {
    registerLocalGitSource(
      input.studiesRoot,
      id,
      input.sourceRoot,
      input.reference ?? "HEAD",
      input.now,
    );
  }

  const snapshot = createCleanSnapshot(input.studiesRoot, id, input.reference, input.now);

  // Opening the store is part of creating the study, not an afterthought: it is
  // what runs the schema migrations and validates the scheduler profile, so a
  // shelf entry that cannot hold progress fails here rather than at the first
  // review.
  const store = new SqliteLearningStore(paths.learner.database);
  store.close();

  return {
    schemaVersion: 1,
    operation: "study-create",
    disposition: existed ? "resumed" : "created",
    study,
    sourceRoot: input.sourceRoot,
    snapshot,
  };
}
