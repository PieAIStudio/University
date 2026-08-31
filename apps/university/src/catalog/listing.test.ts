import { afterEach, describe, expect, it } from "vitest";

import { NOT_STARTED, type ProgressSource } from "@pieai/university-core";
import type { Shelf } from "@pieai/university-ui/content/port.js";

import shelf from "../../content/shelf.json";
import { library, type Course } from "../content/library";
import { progressSource } from "../progress/source";
import { advanceLesson, lessonKey, resetAll } from "../progress/store";
import { assembleCatalogListing, assembleCatalogListingFromShelf } from "./listing";

afterEach(() => {
  resetAll();
});

const PACKAGE_FILES = import.meta.glob<{ course: Course }>("../../content/*/*.json", {
  eager: true,
  import: "default",
});

function packagedCourses(): Map<string, Course> {
  const packaged = new Map<string, Course>();
  for (const [path, file] of Object.entries(PACKAGE_FILES)) {
    const match = path.match(/\/content\/([^/]+)\/[^/]+\.json$/);
    if (!match) continue;
    packaged.set(`${match[1]}/${file.course.id}`, file.course);
  }
  return packaged;
}

function listingOf(source: ProgressSource = progressSource()) {
  return assembleCatalogListing(packagedCourses(), source);
}

function libraryCourseCount() {
  return library.studies.reduce((sum, study) => sum + study.courses.length, 0);
}

describe("the 2D directory against the library the map uses", () => {
  it("lists every course the imported library lists, no more", () => {
    const listing = listingOf();
    const fromLibrary = libraryCourseCount();
    expect(listing.totals.courses).toBe(fromLibrary);
    expect(listing.studies.flatMap((study) => study.courses).length).toBe(fromLibrary);
    /*
      The literal is the point of this line: the two sides above could agree
      with each other while both silently dropping a study, and this is what
      would catch that. It moves when the shelf really moves — 44 is 43
      repository courses plus 通用课's first, which cites MDN rather than a
      commit and is the first course here that studies no codebase. It was 53
      until the UniversityLocal study was retired on 2026-08-31.
    */
    expect(fromLibrary).toBe(44);
  });

  it("keeps each course's units and lessons identical to the package the map loads", () => {
    const packaged = packagedCourses();
    const listing = assembleCatalogListing(packaged, progressSource());
    expect(packaged.size).toBe(libraryCourseCount());

    for (const study of library.studies) {
      const listedStudy = listing.studies.find((entry) => entry.id === study.studyId);
      expect(listedStudy, study.studyId).toBeDefined();
      expect(listedStudy!.courses.length).toBe(study.courses.length);

      for (const summary of study.courses) {
        const course = packaged.get(`${study.studyId}/${summary.courseId}`);
        expect(course, summary.courseId).toBeDefined();
        const listed = listedStudy!.courses.find((entry) => entry.id === summary.courseId);
        expect(listed, summary.courseId).toBeDefined();

        expect(listed!.units.map((unit) => unit.id)).toEqual(course!.units.map((unit) => unit.id));
        expect(listed!.units.map((unit) => unit.lessons.map((lesson) => lesson.id))).toEqual(
          course!.units.map((unit) => unit.lessons.map((lesson) => lesson.id)),
        );
        expect(listed!.total).toBe(summary.lessons);
        expect(listed!.total).toBe(
          course!.units.reduce((sum, unit) => sum + unit.lessons.length, 0),
        );
      }
    }

    // 124 + 4 units and 476 + 19 lessons: 通用课's first course.
    expect(listing.totals.units).toBe(128);
    expect(listing.totals.lessons).toBe(495);
  });

  it("folds the generated shelf into the same directory read model", () => {
    expect(assembleCatalogListingFromShelf(shelf as Shelf, progressSource())).toEqual(listingOf());
  });

  it("lays buzz flat instead of inventing a chain", () => {
    const buzz = listingOf().studies.find((study) => study.id === "buzz");
    const fromLibrary = library.studies.find((study) => study.studyId === "buzz");
    expect(buzz).toBeDefined();
    expect(fromLibrary).toBeDefined();
    expect(buzz!.flat).toBe(true);
    expect(buzz!.courses.every((course) => course.depth === 0)).toBe(true);
    expect(buzz!.courses.every((course) => course.prerequisiteCourseIds.length === 0)).toBe(true);
    expect(buzz!.courses.map((course) => course.id)).toEqual(
      fromLibrary!.courses.map((course) => course.courseId),
    );
  });

  it("keeps the fourteen-layer turing-pact climb readable as depth order", () => {
    const pact = listingOf().studies.find((study) => study.id === "turing-pact");
    expect(pact).toBeDefined();
    expect(pact!.flat).toBe(false);
    const depths = pact!.courses.map((course) => course.depth);
    expect(Math.max(...depths)).toBe(13);
    expect(depths).toEqual([...depths].sort((left, right) => left - right));
    const withPrereq = pact!.courses.filter((course) => course.prerequisiteCourseIds.length > 0);
    expect(withPrereq.length).toBeGreaterThan(0);
    expect(withPrereq.every((course) => course.prerequisiteTitles.length > 0)).toBe(true);
  });

  it("marks locked courses idle until every in-study prerequisite is finished", () => {
    const empty = listingOf();
    const locked = empty.studies
      .find((study) => study.id === "supaluv")
      ?.courses.find((course) => course.id === "ai-cost-and-boundaries");
    expect(locked?.state).toBe("idle");
    expect(locked?.prerequisiteCourseIds).toEqual(["founder-engineer"]);

    const packaged = packagedCourses();
    const preface = packaged.get("supaluv/founder-engineer");
    expect(preface).toBeDefined();
    for (const unit of preface!.units) {
      for (const lesson of unit.lessons) {
        advanceLesson(lessonKey("supaluv", preface!.id, lesson.id), 1);
      }
    }

    const opened = listingOf();
    const next = opened.studies
      .find((study) => study.id === "supaluv")
      ?.courses.find((course) => course.id === "ai-cost-and-boundaries");
    expect(next?.state).toBe("open");
    const done = opened.studies
      .find((study) => study.id === "supaluv")
      ?.courses.find((course) => course.id === "founder-engineer");
    expect(done?.state).toBe("done");
  });

  it("accents one live course the same way the world map does: shallowest open, then most lessons", () => {
    const listing = listingOf();
    const live = listing.studies
      .flatMap((study) => study.courses)
      .filter((course) => course.state === "live");
    expect(live).toHaveLength(1);
    expect(live[0]?.id).toBe("foundations-before-zero");
    expect(listing.nextLesson).toEqual({
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      unitId: live[0]!.units[0]!.id,
      lessonId: live[0]!.units[0]!.lessons[0]!.id,
    });
    expect(
      listing.studies
        .flatMap((study) => study.courses)
        .flatMap((course) => course.units)
        .flatMap((unit) => unit.lessons)
        .filter((lesson) => lesson.state === "live"),
    ).toHaveLength(1);
  });

  it("does not invent progress when the store is empty", () => {
    const untouched: ProgressSource = { completionOf: () => NOT_STARTED };
    const listing = assembleCatalogListing(packagedCourses(), untouched);
    expect(
      listing.studies.flatMap((study) => study.courses).every((course) => course.done === 0),
    ).toBe(true);
  });
});
