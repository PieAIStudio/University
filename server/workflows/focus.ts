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

const PartialConfigSchema = UniversityLocalConfigSchema.partial().strict();

export interface SetFocusInput {
  readonly projectRoot: string;
  readonly studiesRoot: string;
  readonly studyId: string;
  readonly courseId?: string;
}

export interface FocusResult {
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

function readLocalConfig(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  return PartialConfigSchema.parse(JSON.parse(readFileSync(path, "utf8"))) as Record<
    string,
    unknown
  >;
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
  if (input.courseId) {
    let course;
    try {
      course = readCourse(input.studiesRoot, study.id, input.courseId);
    } catch {
      throw new Error(`No course named ${input.courseId} in study ${study.id}`);
    }
    if (course.status !== "active") {
      throw new Error(`Only an active course can be focused: ${course.id} is ${course.status}`);
    }
  }
  const focus = LearningFocusSchema.parse({
    studyId: study.id,
    ...(input.courseId ? { courseId: input.courseId } : {}),
  });
  const configPath = resolve(input.projectRoot, LOCAL_CONFIG);
  const current = readLocalConfig(configPath);
  writeJsonAtomically(configPath, { schemaVersion: 1, ...current, focus });
  return { schemaVersion: 1, operation: "focus-set", focus, configPath };
}

export function clearLearningFocus(projectRoot: string): FocusResult {
  const configPath = resolve(projectRoot, LOCAL_CONFIG);
  const current = readLocalConfig(configPath);
  const { focus: _focus, ...rest } = current;
  writeJsonAtomically(configPath, { schemaVersion: 1, ...rest });
  return { schemaVersion: 1, operation: "focus-clear", focus: null, configPath };
}

export function showLearningFocus(projectRoot: string): FocusResult {
  const configPath = resolve(projectRoot, LOCAL_CONFIG);
  const current = readLocalConfig(configPath);
  const focus = current["focus"];
  return {
    schemaVersion: 1,
    operation: "focus-show",
    focus: focus ? LearningFocusSchema.parse(focus) : null,
    configPath,
  };
}
