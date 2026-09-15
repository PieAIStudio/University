import { expect, test } from "@playwright/test";
import {
  CATALOGUE_ROLES,
  shippedShortAnswer,
  TERRAIN_LENGTH_FIXTURES,
} from "./harness/catalogue.js";
import { islandThemeSelectionForCourse } from "../packages/world/src/island/kenney-recipes.js";
import { terrainCraftCoverage } from "./harness/terrain-craft.js";
import {
  EMPTY_DOMAIN_ID,
  PRIMARY_DOMAIN_ID,
  RELEASED_DOMAIN_STUDIES,
} from "./harness/domain-catalogue.js";

test("catalogue roles keep answers, revisions and destinations in the selected release", () => {
  const role = CATALOGUE_ROLES.settlement;
  expect(role.answer).toBe(shippedShortAnswer(role.course, role.lesson));
  expect(role.answer.trim()).not.toBe("");
  expect(role.lesson.firstExerciseIsUndecided).toBe(false);
  expect(role.lesson.exerciseCount).toBe(1);
  expect(CATALOGUE_ROLES.alternateCourse.study.id).toBe(role.study.id);
  expect(CATALOGUE_ROLES.alternateCourse.course.id).not.toBe(role.course.id);
  expect(
    RELEASED_DOMAIN_STUDIES.find((domain) => domain.id === PRIMARY_DOMAIN_ID)?.studies,
  ).toContainEqual(role.study);
  expect(RELEASED_DOMAIN_STUDIES.find((domain) => domain.id === EMPTY_DOMAIN_ID)?.studies).toEqual(
    [],
  );
});

test("a mismatched authored revision cannot silently provide a settlement answer", () => {
  const role = CATALOGUE_ROLES.settlement;
  expect(() =>
    shippedShortAnswer(role.course, {
      ...role.lesson,
      packageLesson: { ...role.lesson.packageLesson, contentRevision: -1 },
    }),
  ).toThrow("recovery lesson revision mismatch");
});

test("synthetic terrain keeps its named R01 technique when the source study changes", () => {
  for (const fixture of TERRAIN_LENGTH_FIXTURES) {
    expect(islandThemeSelectionForCourse(fixture.course.studyId, fixture.course.id).recipeId).toBe(
      "R01-forest-academy",
    );
    expect(fixture.course.id).not.toBe(fixture.sourceCourse.id);
    const coverage = terrainCraftCoverage(fixture.course.studyId, fixture.course.id);
    expect(coverage.stalls).toBeGreaterThan(0);
    expect(coverage.academies).toBeGreaterThan(0);
  }
});
