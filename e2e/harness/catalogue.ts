import type { Page, Route } from "@playwright/test";
import { readFileSync } from "node:fs";

type JsonObject = { [key: string]: unknown };

export interface ShelfLessonForSelection {
  readonly id: string;
  readonly title: string;
  readonly exerciseCount?: number;
  readonly evidenceLocators?: readonly string[];
}

export interface ShelfUnitForSelection {
  readonly id: string;
  readonly lessons: readonly ShelfLessonForSelection[];
}

export interface ShelfCourseForSelection {
  readonly id: string;
  readonly title: string;
  readonly units: readonly ShelfUnitForSelection[];
}

export interface ShelfStudyForSelection {
  readonly id: string;
  readonly title: string;
  readonly courses: readonly ShelfCourseForSelection[];
}

export interface ShelfForSelection {
  readonly studies: readonly ShelfStudyForSelection[];
}

export interface ShelfEntryForSelection {
  readonly study: ShelfStudyForSelection;
  readonly course: ShelfCourseForSelection;
  readonly unit: ShelfUnitForSelection;
  readonly lesson: ShelfLessonForSelection;
}

export interface ShippedLesson {
  readonly id: string;
  readonly title: string;
  readonly unitId: string;
  readonly exerciseCount: number;
  readonly firstExerciseIsUndecided: boolean;
  readonly evidenceLocators: readonly string[];
  readonly packageLesson: JsonObject;
  readonly shelfLesson: JsonObject;
}

export interface ShippedUnit {
  readonly id: string;
  readonly lessons: readonly ShippedLesson[];
  readonly packageUnit: JsonObject;
}

export interface ShippedCourse {
  readonly studyId: string;
  readonly id: string;
  readonly title: string;
  readonly prerequisiteCourseIds: readonly string[];
  readonly isBeingRewritten: boolean;
  readonly lessonCount: number;
  readonly units: readonly ShippedUnit[];
  readonly packageBody: JsonObject;
  readonly shelfCourse: JsonObject;
}

export interface ShippedStudy {
  readonly id: string;
  readonly title: string;
  readonly courses: readonly ShippedCourse[];
}

export interface CourseLessonRole {
  readonly study: ShippedStudy;
  readonly course: ShippedCourse;
  readonly lesson: ShippedLesson;
}

const IMPORTED_PATH = "apps/university/src/content/imported.json";
const SHELF_PATH = "apps/university/content/shelf.json";
const CONTENT_ROOT = "apps/university/content";

function readJson(path: string): JsonObject {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as JsonObject;
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason);
    throw new Error(`e2e catalogue: cannot read ${path}; run pnpm content first (${message})`);
  }
}

function objectOf(value: unknown, label: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`e2e catalogue: ${label} is not an object`);
  }
  return value as JsonObject;
}

function arrayOf(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`e2e catalogue: ${label} is not an array`);
  return value;
}

function stringOf(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`e2e catalogue: ${label} is empty or not a string`);
  }
  return value;
}

function optionalStringArray(value: unknown, label: string): readonly string[] {
  return arrayOf(value ?? [], label).map((entry, index) => stringOf(entry, `${label}[${index}]`));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function courseKey(studyId: string, courseId: string): string {
  return `${studyId}/${courseId}`;
}

const imported = readJson(IMPORTED_PATH);
const shelf = readJson(SHELF_PATH) as unknown as ShelfForSelection;
const importedStudies = arrayOf(imported.studies, "imported.studies").map((entry, index) =>
  objectOf(entry, `imported.studies[${index}]`),
);
const shelfStudies = arrayOf(shelf.studies, "shelf.studies").map((entry, index) =>
  objectOf(entry, `shelf.studies[${index}]`),
);

function shelfStudyOf(studyId: string): JsonObject {
  const found = shelfStudies.find((entry) => entry.id === studyId);
  if (!found) {
    throw new Error(
      `e2e catalogue: ${studyId} is in imported.json but not shelf.json; run pnpm content again`,
    );
  }
  return found as unknown as JsonObject;
}

function shelfCourseOf(study: JsonObject, courseId: string): JsonObject {
  const courses = arrayOf(study.courses, `${String(study.id)}.courses`).map((entry) =>
    objectOf(entry, `${String(study.id)}.courses[]`),
  );
  const found = courses.find((entry) => entry.id === courseId);
  if (!found) {
    throw new Error(
      `e2e catalogue: ${courseKey(String(study.id), courseId)} is in imported.json but not shelf.json`,
    );
  }
  return found;
}

function buildCourse(
  studyId: string,
  manifestCourse: JsonObject,
  shelfCourse: JsonObject,
): ShippedCourse {
  const courseId = stringOf(manifestCourse.courseId, `${studyId}.courseId`);
  const packageBody = readJson(`${CONTENT_ROOT}/${studyId}/${courseId}.json`);
  const packageCourse = objectOf(
    packageBody.course ?? packageBody,
    `${courseKey(studyId, courseId)}.course`,
  );
  const packageUnits = arrayOf(packageCourse.units, `${courseKey(studyId, courseId)}.units`).map(
    (entry, index) => objectOf(entry, `${courseKey(studyId, courseId)}.units[${index}]`),
  );
  const shelfUnits = arrayOf(shelfCourse.units, `${courseKey(studyId, courseId)}.shelf units`).map(
    (entry) => objectOf(entry, `${courseKey(studyId, courseId)}.shelf units[]`),
  );
  const units = packageUnits.map((packageUnit, unitIndex) => {
    const unitId = stringOf(
      packageUnit.id,
      `${courseKey(studyId, courseId)}.units[${unitIndex}].id`,
    );
    const shelfUnit = shelfUnits.find((entry) => entry.id === unitId);
    if (!shelfUnit)
      throw new Error(
        `e2e catalogue: missing shelf unit ${courseKey(studyId, courseId)}/${unitId}`,
      );
    const packageLessons = arrayOf(
      packageUnit.lessons,
      `${courseKey(studyId, courseId)}/${unitId}.lessons`,
    ).map((entry, lessonIndex) =>
      objectOf(entry, `${courseKey(studyId, courseId)}/${unitId}.lessons[${lessonIndex}]`),
    );
    const shelfLessons = arrayOf(
      shelfUnit.lessons,
      `${courseKey(studyId, courseId)}/${unitId}.shelf lessons`,
    ).map((entry) => objectOf(entry, `${courseKey(studyId, courseId)}/${unitId}.shelf lessons[]`));
    return {
      id: unitId,
      packageUnit,
      lessons: packageLessons.map((packageLesson, lessonIndex) => {
        const lessonId = stringOf(
          packageLesson.id,
          `${courseKey(studyId, courseId)}/${unitId}.lessons[${lessonIndex}].id`,
        );
        const shelfLesson = shelfLessons.find((entry) => entry.id === lessonId);
        if (!shelfLesson) {
          throw new Error(
            `e2e catalogue: missing shelf lesson ${courseKey(studyId, courseId)}/${unitId}/${lessonId}`,
          );
        }
        const packageExercises = arrayOf(
          packageLesson.exercises,
          `${courseKey(studyId, courseId)}/${unitId}/${lessonId}.exercises`,
        ).map((entry) =>
          objectOf(entry, `${courseKey(studyId, courseId)}/${unitId}/${lessonId}.exercise`),
        );
        const firstExercise = packageExercises[0];
        const answerKey = firstExercise?.answerKey;
        const answerKeyObject: JsonObject | null =
          typeof answerKey === "object" && answerKey !== null && !Array.isArray(answerKey)
            ? (answerKey as JsonObject)
            : null;
        const answerLength = answerKeyObject?.len;
        const symbolLength = answerKeyObject?.symLen;
        return {
          id: lessonId,
          title: stringOf(packageLesson.title, `${courseKey(studyId, courseId)}/${lessonId}.title`),
          unitId,
          exerciseCount:
            typeof shelfLesson.exerciseCount === "number" ? shelfLesson.exerciseCount : 0,
          firstExerciseIsUndecided:
            firstExercise !== undefined &&
            (answerKeyObject === null ||
              typeof answerLength !== "number" ||
              answerLength > 12 ||
              (typeof symbolLength === "number" && symbolLength > 12)),
          evidenceLocators: optionalStringArray(
            shelfLesson.evidenceLocators,
            `${courseKey(studyId, courseId)}/${lessonId}.evidenceLocators`,
          ),
          packageLesson,
          shelfLesson,
        };
      }),
    };
  });
  const lessons = units.flatMap((unit) => unit.lessons);
  const manifestLessonCount = manifestCourse.lessons;
  if (typeof manifestLessonCount === "number" && manifestLessonCount !== lessons.length) {
    throw new Error(
      `e2e catalogue: ${courseKey(studyId, courseId)} says ${manifestLessonCount} lessons in imported.json but package has ${lessons.length}`,
    );
  }
  return {
    studyId,
    id: courseId,
    title: stringOf(
      packageCourse.title ?? manifestCourse.title,
      `${courseKey(studyId, courseId)}.title`,
    ),
    prerequisiteCourseIds: optionalStringArray(
      packageCourse.prerequisiteCourseIds,
      `${courseKey(studyId, courseId)}.prerequisiteCourseIds`,
    ),
    isBeingRewritten: packageCourse.isBeingRewritten === true,
    lessonCount: lessons.length,
    units,
    packageBody,
    shelfCourse,
  };
}

function buildStudy(manifestStudy: JsonObject): ShippedStudy {
  const studyId = stringOf(manifestStudy.studyId, "imported studyId");
  const shelfStudy = shelfStudyOf(studyId);
  const manifestCourses = arrayOf(manifestStudy.courses, `${studyId}.courses`).map((entry, index) =>
    objectOf(entry, `${studyId}.courses[${index}]`),
  );
  return {
    id: studyId,
    title: stringOf(shelfStudy.title ?? manifestStudy.title, `${studyId}.title`),
    courses: manifestCourses.map((manifestCourse) =>
      buildCourse(
        studyId,
        manifestCourse,
        shelfCourseOf(shelfStudy, stringOf(manifestCourse.courseId, `${studyId}.courseId`)),
      ),
    ),
  };
}

export const SHIPPED_CATALOGUE: readonly ShippedStudy[] = importedStudies.map(buildStudy);
export const SHIPPED_COURSES: readonly ShippedCourse[] = SHIPPED_CATALOGUE.flatMap(
  (study) => study.courses,
);

function requireCourse(predicate: (course: ShippedCourse) => boolean, role: string): ShippedCourse {
  const course = SHIPPED_COURSES.find(predicate);
  if (!course) {
    throw new Error(
      `e2e catalogue: no shipped course satisfies role ${role}; shipped courses: ${SHIPPED_COURSES.map((entry) => courseKey(entry.studyId, entry.id)).join(", ") || "(none)"}`,
    );
  }
  return course;
}

function studyOf(course: ShippedCourse): ShippedStudy {
  const study = SHIPPED_CATALOGUE.find((entry) => entry.id === course.studyId);
  if (!study)
    throw new Error(`e2e catalogue: course ${courseKey(course.studyId, course.id)} has no study`);
  return study;
}

const settlementCourse = requireCourse(
  (course) =>
    course.prerequisiteCourseIds.length === 0 && course.units[0]?.lessons[0]?.exerciseCount > 0,
  "an unlocked course with a graded opening lesson",
);
const settlementStudy = studyOf(settlementCourse);
const settlementLesson = settlementCourse.units.flatMap((unit) => unit.lessons)[0];
if (!settlementLesson) throw new Error("e2e catalogue: settlement course has no lesson");

const prerequisiteCourse = requireCourse(
  (course) => course.prerequisiteCourseIds.length > 0,
  "a course carrying a prerequisite",
);
const skipTestCourse = requireCourse(
  (course) =>
    course.units.some(
      (unit) =>
        unit.lessons.length === 5 && unit.lessons.every((lesson) => lesson.exerciseCount > 0),
    ),
  "a five-lesson unit with exercises for the skip-test journey",
);
const skipTestUnit = skipTestCourse.units.find(
  (unit) => unit.lessons.length === 5 && unit.lessons.every((lesson) => lesson.exerciseCount > 0),
);
if (!skipTestUnit) throw new Error("e2e catalogue: skip-test course has no eligible unit");
const skipTestPrerequisite = requireCourse(
  (course) =>
    course.studyId === skipTestCourse.studyId &&
    course.id === skipTestCourse.prerequisiteCourseIds[0],
  "the first prerequisite of the skip-test course",
);
const alternateCourse =
  [...SHIPPED_COURSES]
    .reverse()
    .find(
      (course) => course.id !== settlementCourse.id || course.studyId !== settlementCourse.studyId,
    ) ?? settlementCourse;
const longestCourse = [...SHIPPED_COURSES].sort(
  (left, right) => right.lessonCount - left.lessonCount,
)[0];
if (!longestCourse) throw new Error("e2e catalogue: no shipped course exists");
export const SECONDARY_STUDY =
  SHIPPED_CATALOGUE.find((study) => study.id !== settlementStudy.id) ?? null;
export const SECONDARY_COURSE =
  [...(SECONDARY_STUDY?.courses ?? [])].sort(
    (left, right) => right.lessonCount - left.lessonCount,
  )[0] ?? longestCourse;

function shelfSelectionOfCatalogue(): readonly ShelfStudyForSelection[] {
  return SHIPPED_CATALOGUE.map((study) => ({
    id: study.id,
    title: study.title,
    courses: study.courses.map((course) => ({
      id: course.id,
      title: course.title,
      units: course.units.map((unit) => ({
        id: unit.id,
        lessons: unit.lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          exerciseCount: lesson.exerciseCount,
          evidenceLocators: lesson.evidenceLocators,
        })),
      })),
    })),
  }));
}

const completeLessonSelection = selectCompleteLessonEntry(shelfSelectionOfCatalogue());
if (!completeLessonSelection) {
  throw new Error("e2e catalogue: shipped shelf has no complete lesson for parity/source checks");
}
const completeLessonCourse = SHIPPED_COURSES.find(
  (course) =>
    course.studyId === completeLessonSelection.study.id &&
    course.id === completeLessonSelection.course.id,
);
if (!completeLessonCourse) {
  throw new Error(
    `e2e catalogue: complete lesson course ${courseKey(completeLessonSelection.study.id, completeLessonSelection.course.id)} is not in the package catalogue`,
  );
}
const completeLesson = completeLessonCourse.units
  .flatMap((unit) => unit.lessons)
  .find((lesson) => lesson.id === completeLessonSelection.lesson.id);
if (!completeLesson) {
  throw new Error(
    `e2e catalogue: complete lesson ${courseKey(completeLessonCourse.studyId, completeLessonSelection.lesson.id)} is not in the package`,
  );
}
const completeLessonStudy = studyOf(completeLessonCourse);
const undecidedGradingCourse = requireCourse(
  (course) =>
    course.units.some((unit) => unit.lessons.some((lesson) => lesson.firstExerciseIsUndecided)),
  "a course whose first exercise is correctly left undecided by tier-one grading",
);
const undecidedGradingLesson = undecidedGradingCourse.units
  .flatMap((unit) => unit.lessons)
  .find((lesson) => lesson.firstExerciseIsUndecided);
if (!undecidedGradingLesson) {
  throw new Error("e2e catalogue: undecided grading course has no eligible lesson");
}

export const CATALOGUE_ROLES = {
  settlement: {
    study: settlementStudy,
    course: settlementCourse,
    lesson: settlementLesson,
    answer: "会动手的",
  },
  prerequisiteCourse: {
    study: studyOf(prerequisiteCourse),
    course: prerequisiteCourse,
    lesson: prerequisiteCourse.units.flatMap((unit) => unit.lessons)[0]!,
  },
  alternateCourse: {
    study: studyOf(alternateCourse),
    course: alternateCourse,
    lesson: alternateCourse.units.flatMap((unit) => unit.lessons)[0]!,
  },
  completeLesson: {
    study: completeLessonStudy,
    course: completeLessonCourse,
    lesson: completeLesson,
  },
  undecidedGrading: {
    study: studyOf(undecidedGradingCourse),
    course: undecidedGradingCourse,
    lesson: undecidedGradingLesson,
  },
  longestCourse: {
    study: studyOf(longestCourse),
    course: longestCourse,
    lesson: longestCourse.units.flatMap((unit) => unit.lessons)[0]!,
  },
  skipTest: {
    study: studyOf(skipTestCourse),
    course: skipTestCourse,
    unit: skipTestUnit,
    prerequisiteCourse: skipTestPrerequisite,
  },
} as const;

export const SHIPPED_STUDY_TITLES = SHIPPED_CATALOGUE.map((study) => study.title);
export const HAS_MULTIPLE_SHIPPED_STUDIES = SHIPPED_CATALOGUE.length > 1;
export const MULTI_STUDY_CATALOGUE_REASON = `当前发布目录只有 ${SHIPPED_CATALOGUE.length} 个 study（${SHIPPED_STUDY_TITLES.join("、") || "无"}）；这个回归要求至少两个真实 study，须在解锁另一个 package 后再提出。`;

export function coursePathOf(course: Pick<ShippedCourse, "studyId" | "id">): string {
  return `/${encodeURIComponent(course.studyId)}/${encodeURIComponent(course.id)}`;
}

export function lessonPathOf(
  course: Pick<ShippedCourse, "studyId" | "id">,
  lesson: Pick<ShippedLesson, "unitId" | "id">,
): string {
  return `${coursePathOf(course)}/${encodeURIComponent(lesson.unitId)}/${encodeURIComponent(lesson.id)}`;
}

export function coursePackagePathOf(course: Pick<ShippedCourse, "studyId" | "id">): string {
  return `/content/${encodeURIComponent(course.studyId)}/${encodeURIComponent(course.id)}.json`;
}

export function catalogueStudyOf(studyId: string): ShippedStudy {
  const study = SHIPPED_CATALOGUE.find((entry) => entry.id === studyId);
  if (!study) throw new Error(`e2e catalogue: ${studyId} is not shipped`);
  return study;
}

export function selectCompleteLessonEntry(
  studies: readonly ShelfStudyForSelection[],
): ShelfEntryForSelection | undefined {
  const entries = studies.flatMap((study) =>
    study.courses.flatMap((course) =>
      course.units.flatMap((unit) =>
        unit.lessons.map((lesson) => ({ study, course, unit, lesson })),
      ),
    ),
  );
  const hasShortEvidence = (lesson: ShelfLessonForSelection): boolean =>
    (lesson.evidenceLocators ?? []).some((locator) => {
      const match = /:(\d+)(?:-(\d+))?$/u.exec(locator.trim());
      if (!match) return false;
      const start = Number(match[1]);
      const end = Number(match[2] ?? match[1]);
      return (
        Number.isInteger(start) && Number.isInteger(end) && end >= start && end - start + 1 <= 16
      );
    });
  const hasSingleEvidence = (lesson: ShelfLessonForSelection): boolean =>
    (lesson.evidenceLocators ?? []).length === 1;
  const isCourseStart = (entry: ShelfEntryForSelection): boolean =>
    entry.course.units[0]?.id === entry.unit.id &&
    entry.course.units[0]?.lessons[0]?.id === entry.lesson.id;
  const eligible = (entry: ShelfEntryForSelection): boolean =>
    (entry.lesson.exerciseCount ?? 0) > 0 && hasShortEvidence(entry.lesson);
  return (
    entries.find((entry) => eligible(entry) && hasSingleEvidence(entry.lesson)) ??
    entries.find((entry) => eligible(entry) && isCourseStart(entry)) ??
    entries.find(eligible)
  );
}

const LABEL_FIXTURE_TITLE = "这是一个故意很长的课程标题，用来验证桌面和手机标签的截断行为";
export const LABEL_FIXTURE = {
  course: CATALOGUE_ROLES.settlement.course,
  title: LABEL_FIXTURE_TITLE,
};

function labelCourse(course: JsonObject): JsonObject {
  return { ...course, title: LABEL_FIXTURE_TITLE, isBeingRewritten: true };
}

async function rewriteJsonRoute(
  route: Route,
  rewrite: (payload: JsonObject) => JsonObject,
): Promise<void> {
  const response = await route.fetch();
  const payload = objectOf(await response.json(), route.request().url());
  await route.fulfill({ response, body: JSON.stringify(rewrite(payload)) });
}

/** Give the label-status test the exact shape it is about, in both shells. */
export async function installCourseLabelFixture(page: Page): Promise<void> {
  const target = LABEL_FIXTURE.course;
  await page.route("**/content/shelf.json", async (route) => {
    await rewriteJsonRoute(route, (payload) => {
      const studies = arrayOf(payload.studies, "shelf.studies").map((entry) => {
        const study = objectOf(entry, "shelf.study");
        if (study.id !== target.studyId) return study;
        return {
          ...study,
          courses: arrayOf(study.courses, `${target.studyId}.courses`).map((entry) => {
            const course = objectOf(entry, `${target.studyId}.course`);
            return course.id === target.id ? labelCourse(course) : course;
          }),
        };
      });
      return { ...payload, studies };
    });
  });
  await page.route("**/api/studies/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname !== `/api/studies/${encodeURIComponent(target.studyId)}`) {
      await route.continue();
      return;
    }
    await rewriteJsonRoute(route, (payload) => ({
      ...payload,
      courses: arrayOf(payload.courses, `${target.studyId}.courses`).map((entry) => {
        const course = objectOf(entry, `${target.studyId}.course`);
        return course.id === target.id ? labelCourse(course) : course;
      }),
    }));
  });
}

export interface TerrainLengthFixture {
  readonly name: string;
  readonly lessonCount: number;
  readonly sourceCourse: ShippedCourse;
  readonly course: ShippedCourse;
}

// The current shelf has no long course, and none of its hashed recipes carries
// the crafted R01 scenery that the original terrain contract observes. Use a
// test-only identity whose stable recipe bucket is R01; its prose and summary
// still come from a shipped course, and the synthetic identity never enters the
// real catalogue.
const TERRAIN_FIXTURE_COURSE_ID = "e2e-terrain-8";
const terrainFixtureCourse = (source: ShippedCourse): ShippedCourse => ({
  ...source,
  id: TERRAIN_FIXTURE_COURSE_ID,
  shelfCourse: { ...clone(source.shelfCourse), id: TERRAIN_FIXTURE_COURSE_ID },
});
const shortTerrainSource = CATALOGUE_ROLES.settlement.course;
const longTerrainSource = CATALOGUE_ROLES.longestCourse.course;

export const TERRAIN_LENGTH_FIXTURES: readonly TerrainLengthFixture[] = [
  {
    name: "short-shaped",
    lessonCount: 41,
    sourceCourse: shortTerrainSource,
    course: terrainFixtureCourse(shortTerrainSource),
  },
  {
    name: "long-shaped",
    lessonCount: 61,
    sourceCourse: longTerrainSource,
    course: terrainFixtureCourse(longTerrainSource),
  },
];

/** A shaped R01 preview for the authoring-only asset inspector. */
export const MAP_STUDIO_FIXTURE = {
  study: CATALOGUE_ROLES.settlement.study,
  sourceCourse: shortTerrainSource,
  course: terrainFixtureCourse(shortTerrainSource),
  lessonCount: TERRAIN_LENGTH_FIXTURES[0]!.lessonCount,
} as const;

export const COURSE_SCENE_FIXTURE = {
  ...MAP_STUDIO_FIXTURE,
  lessonCount: TERRAIN_LENGTH_FIXTURES[0]!.lessonCount,
} as const;

function syntheticLessons(course: ShippedCourse, lessonCount: number): JsonObject[] {
  const sourceLessons = course.units.flatMap((unit) => unit.lessons);
  if (sourceLessons.length === 0)
    throw new Error(
      `e2e catalogue: ${courseKey(course.studyId, course.id)} has no lesson template`,
    );
  return Array.from({ length: lessonCount }, (_, index) => {
    const source = sourceLessons[index % sourceLessons.length]!;
    return {
      ...clone(source.packageLesson),
      id: `e2e-length-${index + 1}`,
      title: `${source.title} · 形状 fixture 第 ${index + 1} 节`,
    };
  });
}

function syntheticCourseBody(course: ShippedCourse, lessonCount: number): JsonObject {
  const body = clone(course.packageBody);
  const packageCourse = objectOf(
    body.course ?? body,
    `${courseKey(course.studyId, course.id)}.course`,
  );
  const packageUnits = arrayOf(
    packageCourse.units,
    `${courseKey(course.studyId, course.id)}.units`,
  ).map((entry) => objectOf(entry, `${courseKey(course.studyId, course.id)}.unit`));
  const firstUnit = packageUnits[0];
  if (!firstUnit)
    throw new Error(`e2e catalogue: ${courseKey(course.studyId, course.id)} has no unit template`);
  const units = packageUnits.map((unit, index) => ({
    ...unit,
    lessons: index === 0 ? syntheticLessons(course, lessonCount) : [],
  }));
  return { ...body, course: { ...packageCourse, id: course.id, units } };
}

function syntheticShelfCourse(course: ShippedCourse, lessonCount: number): JsonObject {
  const shelfCourse = clone(course.shelfCourse);
  const shelfUnits = arrayOf(
    shelfCourse.units,
    `${courseKey(course.studyId, course.id)}.shelf units`,
  ).map((entry) => objectOf(entry, `${courseKey(course.studyId, course.id)}.shelf unit`));
  const sourceLessons = course.units.flatMap((unit) => unit.lessons);
  const units = shelfUnits.map((unit, unitIndex) => ({
    ...unit,
    lessons:
      unitIndex === 0
        ? Array.from({ length: lessonCount }, (_, index) => {
            const source = sourceLessons[index % sourceLessons.length]!;
            return {
              ...clone(source.shelfLesson),
              id: `e2e-length-${index + 1}`,
              title: `${source.title} · 形状 fixture 第 ${index + 1} 节`,
              exerciseCount: source.exerciseCount,
              evidenceLocators: source.evidenceLocators,
              cardCount: Array.isArray(source.packageLesson.cards)
                ? source.packageLesson.cards.length
                : 0,
            };
          })
        : [],
  }));
  return { ...shelfCourse, units };
}

/** Replace only the structural catalogue for terrain scaling; source content stays a template. */
export async function installTerrainLengthFixture(
  page: Page,
  fixture: TerrainLengthFixture,
): Promise<void> {
  const target = fixture.course;
  const packageBody = syntheticCourseBody(target, fixture.lessonCount);
  const shelfCourse = syntheticShelfCourse(target, fixture.lessonCount);
  await page.route("**/content/shelf.json", async (route) => {
    await rewriteJsonRoute(route, (payload) => {
      const studies = arrayOf(payload.studies, "shelf.studies").map((entry) => {
        const study = objectOf(entry, "shelf.study");
        if (study.id !== target.studyId) return study;
        return {
          ...study,
          courses: arrayOf(study.courses, `${target.studyId}.courses`).map((entry) => {
            const course = objectOf(entry, `${target.studyId}.course`);
            return course.id === fixture.sourceCourse.id ? shelfCourse : course;
          }),
        };
      });
      return { ...payload, studies };
    });
  });
  await page.route(`**${coursePackagePathOf(target)}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(packageBody),
    });
  });
}

function syntheticMapStudioCourse(
  course: JsonObject,
  fixture: ShippedCourse,
  lessonCount?: number,
): JsonObject {
  const sourceUnits = arrayOf(course.units, `${fixture.studyId}/${fixture.id}.units`).map((entry) =>
    objectOf(entry, `${fixture.studyId}/${fixture.id}.unit`),
  );
  const sourceLessons = sourceUnits.flatMap((unit) =>
    arrayOf(unit.lessons, `${fixture.studyId}/${fixture.id}.lessons`).map((entry) =>
      objectOf(entry, `${fixture.studyId}/${fixture.id}.lesson`),
    ),
  );
  if (lessonCount !== undefined && sourceLessons.length === 0) {
    throw new Error(
      `e2e catalogue: ${courseKey(fixture.studyId, fixture.id)} has no lesson template`,
    );
  }
  const units = sourceUnits.map((unit, unitIndex) => {
    const sourceUnitLessons = arrayOf(unit.lessons, `${fixture.studyId}/${fixture.id}.lessons`).map(
      (entry) => objectOf(entry, `${fixture.studyId}/${fixture.id}.lesson`),
    );
    const lessons =
      lessonCount !== undefined
        ? Array.from({ length: lessonCount }, (_, index) => {
            const source = sourceLessons[index % sourceLessons.length]!;
            return {
              ...clone(source),
              id: `e2e-length-${index + 1}`,
              title: `${source.title} · 形状 fixture 第 ${index + 1} 节`,
              exerciseCount: 0,
              exerciseIds: [],
              exerciseIdsComplete: true,
            };
          })
        : sourceUnitLessons.map((entry) => ({
            ...entry,
            exerciseCount: 0,
            exerciseIds: [],
            exerciseIdsComplete: true,
          }));
    return {
      ...unit,
      lessons: unitIndex === 0 ? lessons : [],
    };
  });
  return {
    ...clone(course),
    id: fixture.id,
    isDefault: false,
    units,
  };
}

/** Add one test-only R01-shaped course to the authoring preview response. */
export async function installMapStudioFixture(page: Page): Promise<void> {
  const fixture = MAP_STUDIO_FIXTURE;
  await page.route("**/api/studies/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname !== `/api/studies/${encodeURIComponent(fixture.study.id)}`) {
      await route.continue();
      return;
    }
    await rewriteJsonRoute(route, (payload) => {
      const courses = arrayOf(payload.courses, `${fixture.study.id}.courses`).map((entry) =>
        objectOf(entry, `${fixture.study.id}.course`),
      );
      const source = courses.find((course) => course.id === fixture.sourceCourse.id);
      if (!source) {
        throw new Error(
          `e2e catalogue: map-studio fixture could not find ${courseKey(fixture.study.id, fixture.sourceCourse.id)}`,
        );
      }
      return {
        ...payload,
        courses: [
          ...courses,
          syntheticMapStudioCourse(source, fixture.course, fixture.lessonCount),
        ],
      };
    });
  });
}

/** Give the learner scene the same shaped R01 identity used by MapStudio. */
export async function installCourseSceneFixture(page: Page): Promise<void> {
  const fixture = COURSE_SCENE_FIXTURE;
  const target = fixture.course;
  const packageBody = syntheticCourseBody(target, fixture.lessonCount);
  const shelfCourse = syntheticShelfCourse(target, fixture.lessonCount);

  await page.route("**/content/shelf.json", async (route) => {
    await rewriteJsonRoute(route, (payload) => {
      const studies = arrayOf(payload.studies, "shelf.studies").map((entry) => {
        const study = objectOf(entry, "shelf.study");
        if (study.id !== target.studyId) return study;
        return {
          ...study,
          courses: arrayOf(study.courses, `${target.studyId}.courses`).map((entry) => {
            const course = objectOf(entry, `${target.studyId}.course`);
            return course.id === fixture.sourceCourse.id ? shelfCourse : course;
          }),
        };
      });
      return { ...payload, studies };
    });
  });
  await page.route(`**${coursePackagePathOf(target)}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(packageBody),
    });
  });
  await page.route("**/api/studies/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const lessonPrefix = `/api/studies/${encodeURIComponent(fixture.study.id)}/courses/${encodeURIComponent(target.id)}/units/`;
    const lessonMatch = new RegExp(
      `^${lessonPrefix.replaceAll("/", "\\/")}[^/]+\\/lessons\\/(e2e-length-\\d+)$`,
    ).exec(pathname);
    if (lessonMatch) {
      const sourceLessons = fixture.sourceCourse.units.flatMap((unit) => unit.lessons);
      const index = Number(lessonMatch[1].slice("e2e-length-".length)) - 1;
      const sourceLesson = sourceLessons[index % sourceLessons.length];
      if (!sourceLesson) throw new Error("e2e catalogue: course scene has no lesson template");
      const sourceUrl = new URL(route.request().url());
      sourceUrl.pathname = `/api/studies/${encodeURIComponent(fixture.sourceCourse.studyId)}/courses/${encodeURIComponent(fixture.sourceCourse.id)}/units/${encodeURIComponent(sourceLesson.unitId)}/lessons/${encodeURIComponent(sourceLesson.id)}`;
      const response = await route.fetch({ url: sourceUrl.toString() });
      const payload = objectOf(await response.json(), sourceUrl.pathname);
      const lesson = objectOf(payload.lesson, `${sourceUrl.pathname}.lesson`);
      await route.fulfill({
        response,
        body: JSON.stringify({
          ...payload,
          lesson: { ...lesson, id: lessonMatch[1] },
        }),
      });
      return;
    }
    if (pathname !== `/api/studies/${encodeURIComponent(fixture.study.id)}`) {
      await route.continue();
      return;
    }
    await rewriteJsonRoute(route, (payload) => {
      const courses = arrayOf(payload.courses, `${fixture.study.id}.courses`).map((entry) =>
        objectOf(entry, `${fixture.study.id}.course`),
      );
      const source = courses.find((course) => course.id === fixture.sourceCourse.id);
      if (!source) {
        throw new Error(
          `e2e catalogue: course scene fixture could not find ${courseKey(fixture.study.id, fixture.sourceCourse.id)}`,
        );
      }
      return {
        ...payload,
        courses: [...courses, syntheticMapStudioCourse(source, target, fixture.lessonCount)],
      };
    });
  });
}

export const REFERENCE_ARCHIPELAGO_COURSE_IDS = [
  "zz-e2e-reference-0013",
  "zz-e2e-reference-0025",
  "zz-e2e-reference-0006",
  "zz-e2e-reference-0005",
  "zz-e2e-reference-0004",
  "zz-e2e-reference-0003",
  "zz-e2e-reference-0002",
  "zz-e2e-reference-0009",
  "zz-e2e-reference-0008",
  "zz-e2e-reference-0010",
  "zz-e2e-reference-0015",
  "zz-e2e-reference-0001",
] as const;

export const REFERENCE_ARCHIPELAGO_FIXTURE = {
  study: CATALOGUE_ROLES.settlement.study,
  sourceCourse: CATALOGUE_ROLES.settlement.course,
  courseIds: REFERENCE_ARCHIPELAGO_COURSE_IDS,
} as const;

/** Give the remote-map performance contract enough intentionally varied islands to ask its question. */
export async function installReferenceArchipelagoFixture(page: Page): Promise<void> {
  const fixture = REFERENCE_ARCHIPELAGO_FIXTURE;
  await page.route("**/content/shelf.json", async (route) => {
    await rewriteJsonRoute(route, (payload) => {
      const studies = arrayOf(payload.studies, "shelf.studies").map((entry) => {
        const study = objectOf(entry, "shelf.study");
        if (study.id !== fixture.study.id) return study;
        const courses = arrayOf(study.courses, `${fixture.study.id}.courses`).map((entry) =>
          objectOf(entry, `${fixture.study.id}.course`),
        );
        const source = courses.find((course) => course.id === fixture.sourceCourse.id);
        if (!source) {
          throw new Error(
            `e2e catalogue: archipelago fixture could not find ${courseKey(fixture.study.id, fixture.sourceCourse.id)}`,
          );
        }
        const syntheticCourses = fixture.courseIds.map((id, index) => ({
          ...clone(source),
          id,
          title: `${String(source.title)} · 参考岛 ${index + 1}`,
        }));
        /*
         * The reference archipelago is a fixed population, not the shipped one
         * plus extras. Appending to the catalogue made the island count — and
         * therefore how many labels the framing can place — move whenever a
         * package was locked or unlocked, which is what sent the desktop label
         * floor red on a four-course catalogue. One real course keeps the round
         * trip honest; the synthetic ones make the count the fixture's to state.
         */
        return { ...study, courses: [source, ...syntheticCourses] };
      });
      return { ...payload, studies };
    });
  });
}

/** Limit one delivery shelf to one real course so the one-course property is synthetic, not stale. */
export async function installSingleCourseShelfFixture(
  page: Page,
  course = CATALOGUE_ROLES.settlement.course,
): Promise<void> {
  await page.route("**/content/shelf.json", async (route) => {
    await rewriteJsonRoute(route, (payload) => {
      const studies = arrayOf(payload.studies, "shelf.studies").map((entry) => {
        const study = objectOf(entry, "shelf.study");
        if (study.id !== course.studyId) return { ...study, courses: [] };
        const selected = arrayOf(study.courses, `${course.studyId}.courses`)
          .map((entry) => objectOf(entry, `${course.studyId}.course`))
          .find((entry) => entry.id === course.id);
        if (!selected)
          throw new Error(
            `e2e catalogue: single-course fixture could not find ${courseKey(course.studyId, course.id)}`,
          );
        return { ...study, courses: [selected] };
      });
      return { ...payload, studies };
    });
  });
}

export const SHARED_LANDSCAPE_CASES: readonly ShippedCourse[] = (() => {
  if (SHIPPED_CATALOGUE.length < 2 || SHIPPED_COURSES.length < 3) return [];
  const firstStudy = SHIPPED_CATALOGUE[0]!;
  const secondStudy = SHIPPED_CATALOGUE.find((study) => study.id !== firstStudy.id)!;
  const fromFirst = firstStudy.courses.slice(0, 2);
  const fromSecond = secondStudy.courses.slice(0, 1);
  return [...fromFirst, ...fromSecond].slice(0, 3);
})();

export const SHARED_LANDSCAPE_CATALOGUE_REASON = `当前发布目录只有 ${SHIPPED_CATALOGUE.length} 个 study、${SHIPPED_COURSES.length} 门课；这个回归要求跨至少两个 study 的三门真实课，须在解锁 package 后再提出。`;
