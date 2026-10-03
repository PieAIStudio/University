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
    // Owner T1, task 13: only the three accepted V3 lessons remain in release.
    expect(fromLibrary).toBe(1);
    expect(library.studies.map((study) => study.studyId)).toEqual(["ai-literacy"]);
    expect(library.studies[0]!.courses.map((course) => course.courseId)).toEqual([
      "understanding-ai",
    ]);
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

    expect(listing.totals.units).toBe(1);
    expect(listing.totals.lessons).toBe(3);
    expect(listing.studies[0]!.courses[0]!.units[0]!.lessons.map((lesson) => lesson.id)).toEqual([
      "ask-about-a-picture",
      "sound-words-and-meaning",
      "name-the-result",
    ]);
  });

  it("folds the generated shelf into the same directory read model", () => {
    expect(assembleCatalogListingFromShelf(shelf as Shelf, progressSource())).toEqual(listingOf());
  });

  it("lays independent courses flat instead of inventing a chain (synthetic shelf)", () => {
    const base = (shelf as Shelf).studies[0]!.courses[0]!;
    const courses = ["first", "second", "third"].map((id) => ({
      ...base,
      id,
      prerequisiteCourseIds: [],
    }));
    const flat = assembleCatalogListingFromShelf(
      { studies: [{ id: "flat-fixture", title: "Synthetic independent courses", courses }] },
      progressSource(),
    ).studies[0]!;
    expect(flat.flat).toBe(true);
    expect(flat.courses.every((course) => course.depth === 0)).toBe(true);
    expect(flat.courses.every((course) => course.prerequisiteCourseIds.length === 0)).toBe(true);
    expect(flat.courses.map((course) => course.id)).toEqual(courses.map((course) => course.id));
  });

  // Structural prerequisite coverage uses a synthetic chain, independent of release inventory.
  const base = (shelf as Shelf).studies[0]!.courses[0]!;
  const chain: Shelf = {
    studies: [
      {
        id: "chain-fixture",
        title: "Synthetic chain",
        courses: ["foundation", "second", "third", "fourth"].map((id, index, ids) => ({
          ...base,
          id,
          title: id,
          prerequisiteCourseIds: index ? [ids[index - 1]!] : [],
        })),
      },
    ],
  };
  it("keeps a synthetic climb readable as depth order", () => {
    const study = assembleCatalogListingFromShelf(chain, progressSource()).studies[0]!;
    expect(study.flat).toBe(false);
    expect(study.courses.map((course) => course.depth)).toEqual([0, 1, 2, 3]);
    expect(
      study.courses
        .filter((course) => course.depth > 0)
        .every((course) => course.prerequisiteTitles.length === 1),
    ).toBe(true);
  });

  it("marks locked courses idle until every in-study prerequisite is finished", () => {
    const empty = assembleCatalogListingFromShelf(chain, progressSource());
    expect(empty.studies[0]!.courses.find((course) => course.id === "second")?.state).toBe("idle");
    expect(
      empty.studies[0]!.courses.find((course) => course.id === "second")?.prerequisiteCourseIds,
    ).toEqual(["foundation"]);
    for (const unit of base.units)
      for (const lesson of unit.lessons) {
        advanceLesson(lessonKey("chain-fixture", "foundation", lesson.id), lesson.contentRevision);
      }
    const opened = assembleCatalogListingFromShelf(chain, progressSource()).studies[0]!;
    expect(["open", "live"]).toContain(
      opened.courses.find((course) => course.id === "second")?.state,
    );
    expect(opened.courses.find((course) => course.id === "foundation")?.state).toBe("done");
  });

  it("accents one live course the same way the world map does: shallowest open, then most lessons", () => {
    const listing = listingOf();
    const live = listing.studies
      .flatMap((study) => study.courses)
      .filter((course) => course.state === "live");
    expect(live).toHaveLength(1);
    expect(live[0]?.id).toBe("understanding-ai");
    expect(listing.nextLesson).toEqual({
      studyId: "ai-literacy",
      courseId: "understanding-ai",
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
