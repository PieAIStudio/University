import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  LearningFocusSchema,
  UniversityLocalConfigSchema,
  type LearningFocus,
} from "../../src/domain/schemas.js";
import { readCourse } from "../content/repository.js";
import { readStudy } from "../studies/repository.js";
import { writeJsonAtomically } from "../storage/atomic-json.js";

/**
 * Which study — and optionally which course — "今日学习" should reach into
 * first. It lives in the local config rather than the tracked one because it is
 * a statement about what this person is working on right now, not about the
 * project.
 */
const LOCAL_CONFIG = "university-local.config.local.json";

/**
 * Everything in the local config except the focus itself. `focus set` and
 * `focus clear` are on their way to replacing that key, so validating the value
 * they are about to discard would let a focus written by an older version wedge
 * the only two commands able to repair it.
 */
const OtherLocalKeysSchema = UniversityLocalConfigSchema.omit({ focus: true }).partial().strict();

interface SetFocusInput {
  readonly projectRoot: string;
  readonly studiesRoot: string;
  readonly studyId: string;
  readonly courseIds?: readonly string[];
}

interface FocusResult {
  readonly schemaVersion: 1;
  readonly operation: "focus-set" | "focus-clear" | "focus-show";
  readonly focus: LearningFocus | null;
  readonly configPath: string;
}

/** Only used to make a rejection actionable, so an unreadable root is not fatal. */
function listStudyIds(studiesRoot: string): readonly string[] {
  try {
    return readdirSync(studiesRoot, { withFileTypes: true })
      .filter(
        (entry) => entry.isDirectory() && existsSync(join(studiesRoot, entry.name, "study.json")),
      )
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

function readLocalConfig(path: string): { rest: Record<string, unknown>; focus: unknown } {
  if (!existsSync(path)) return { rest: {}, focus: undefined };
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const { focus, ...others } = raw;
  return { rest: OtherLocalKeysSchema.parse(others) as Record<string, unknown>, focus };
}

/**
 * The focus is validated against what is actually on the shelf, because a
 * silently ignored typo is worse than a refusal: the learner would keep being
 * handed lessons from the study they thought they had set aside, with nothing
 * to explain why.
 */
export function setLearningFocus(input: SetFocusInput): FocusResult {
  let study;
  try {
    study = readStudy(input.studiesRoot, input.studyId);
  } catch {
    const available = listStudyIds(input.studiesRoot);
    throw new Error(
      `No study named ${input.studyId}. Available: ${available.join(", ") || "(none)"}`,
    );
  }
  if (study.status !== "active") {
    throw new Error(`Only an active study can be focused: ${study.id} is ${study.status}`);
  }
  const courseIds = input.courseIds ?? [];
  // A repeated id is wrong about the list itself, so it is reported before any
  // question about what the shelf holds.
  const duplicate = courseIds.find((id, index) => courseIds.indexOf(id) !== index);
  if (duplicate) {
    throw new Error(`Course ${duplicate} is listed twice; a run has one position per course`);
  }
  for (const courseId of courseIds) {
    let course;
    try {
      course = readCourse(input.studiesRoot, study.id, courseId);
    } catch {
      throw new Error(`No course named ${courseId} in study ${study.id}`);
    }
    if (course.status !== "active") {
      throw new Error(`Only an active course can be focused: ${course.id} is ${course.status}`);
    }
  }
  const focus = LearningFocusSchema.parse({ studyId: study.id, courseIds });
  const configPath = resolve(input.projectRoot, LOCAL_CONFIG);
  const { rest } = readLocalConfig(configPath);
  writeJsonAtomically(configPath, { schemaVersion: 1, ...rest, focus });
  return { schemaVersion: 1, operation: "focus-set", focus, configPath };
}

export function clearLearningFocus(projectRoot: string): FocusResult {
  const configPath = resolve(projectRoot, LOCAL_CONFIG);
  const { rest } = readLocalConfig(configPath);
  writeJsonAtomically(configPath, { schemaVersion: 1, ...rest });
  return { schemaVersion: 1, operation: "focus-clear", focus: null, configPath };
}

export function showLearningFocus(projectRoot: string): FocusResult {
  const configPath = resolve(projectRoot, LOCAL_CONFIG);
  const { focus } = readLocalConfig(configPath);
  return {
    schemaVersion: 1,
    operation: "focus-show",
    focus: focus ? LearningFocusSchema.parse(focus) : null,
    configPath,
  };
}
