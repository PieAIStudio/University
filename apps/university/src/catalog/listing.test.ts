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
      would catch that. R40 deliberately retired 12 courses from R39's 48 and
      added the 61-lesson AI foundations course. On 2026-09-12 everything but
      `browser-ai` was locked — moved to `apps/local/course-proposals/locked/`,
      which nothing in the delivery path reads — because all 29 interactive
      activities live in `browser-ai` and the rest predate the contract that
      requires one in every lesson. They come back a package at a time as each
      is rewritten, and this line is where that has to be confirmed by a person.
      This moves only when the recovery transport deliberately changes.
    */
    // Approved addition: two source-grounded beginner paths, not restoration
    // of the locked technical AI course. Keep the literal outside generated data.
    expect(fromLibrary).toBe(6);
    expect(library.studies.map((study) => study.studyId)).toEqual(["ai-literacy", "browser-ai"]);
    expect(
      library.studies
        .find((study) => study.studyId === "ai-literacy")
        ?.courses.map((course) => course.courseId),
    ).toEqual(["understanding-ai", "ai-for-real-life"]);
    expect(
      library.studies
        .find((study) => study.studyId === "browser-ai")
        ?.courses.map((course) => course.courseId)
        .sort(),
    ).toEqual([
      "make-the-cutout-app-yours",
      "run-a-real-project-with-ai",
      "search-your-own-photos",
      "when-a-project-is-too-big-to-read",
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

    /*
      Approved catalogue, not counts derived from the same generated input.
      Hand-written so that content appearing or vanishing has to be looked at by
      a person rather than absorbed by a formula — and it worked: restoring the
      browser-ai curriculum moved this and turned the suite red until somebody
      confirmed the new numbers. 469 and 37 are what `check-content-revisions`
      counts off the studies on disk; 117 is the unit count in the packages the
      map loads. The 2026-09-12 lock took them from 117 and 469 to the shipped
      `browser-ai` curriculum alone; `check-content-revisions` counts the same
      27 lessons across 4 courses off the studies on disk.
    */
    // The new release adds 11 units / 66 lessons; the original 9 / 27 remain.
    expect(listing.totals.units).toBe(20);
    expect(listing.totals.lessons).toBe(93);
  });

  it("folds the generated shelf into the same directory read model", () => {
    expect(assembleCatalogListingFromShelf(shelf as Shelf, progressSource())).toEqual(listingOf());
  });

  it("lays independent courses flat instead of inventing a chain (synthetic shelf)", () => {
    const base = (shelf as Shelf).studies.find((study) => study.id === "browser-ai")!.courses[0]!;
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

  /*
    The shipped chain, whatever its length. This read the fourteen-layer
    `turing-pact` climb until that package was locked on 2026-09-12; what it
    actually guards is that a study whose courses declare prerequisites renders
    as an ordered climb rather than a flat shelf, and `browser-ai` still does
    that across four courses. The depth literal moves with the shipped set on
    purpose — this file tests the directory against the library the map really
    loads, so it is the place a catalogue change has to be looked at.
  */
  it("keeps the shipped climb readable as depth order", () => {
    const pact = listingOf().studies.find((study) => study.id === "browser-ai");
    expect(pact).toBeDefined();
    expect(pact!.flat).toBe(false);
    const depths = pact!.courses.map((course) => course.depth);
    expect(Math.max(...depths)).toBe(3);
    expect(depths).toEqual([...depths].sort((left, right) => left - right));
    const withPrereq = pact!.courses.filter((course) => course.prerequisiteCourseIds.length > 0);
    expect(withPrereq.length).toBeGreaterThan(0);
    expect(withPrereq.every((course) => course.prerequisiteTitles.length > 0)).toBe(true);
  });

  it("marks locked courses idle until every in-study prerequisite is finished", () => {
    const empty = listingOf();
    const locked = empty.studies
      .find((study) => study.id === "browser-ai")
      ?.courses.find((course) => course.id === "make-the-cutout-app-yours");
    expect(locked?.state).toBe("idle");
    expect(locked?.prerequisiteCourseIds).toEqual(["run-a-real-project-with-ai"]);

    const packaged = packagedCourses();
    const preface = packaged.get("browser-ai/run-a-real-project-with-ai");
    expect(preface).toBeDefined();
    for (const unit of preface!.units) {
      for (const lesson of unit.lessons) {
        advanceLesson(lessonKey("browser-ai", preface!.id, lesson.id), lesson.contentRevision);
      }
    }

    const opened = listingOf();
    const next = opened.studies
      .find((study) => study.id === "browser-ai")
      ?.courses.find((course) => course.id === "make-the-cutout-app-yours");
    /*
      Reachable is the claim; whether it is also the accented one is the
      accent rule's business. With a single shipped study the course that just
      opened is also the shallowest open course, so it arrives as `live` rather
      than `open` — both mean the prerequisite gate let go, and `idle`,
      `locked` and `done` all still fail here.
    */
    expect(["open", "live"]).toContain(next?.state);
    const done = opened.studies
      .find((study) => study.id === "browser-ai")
      ?.courses.find((course) => course.id === "run-a-real-project-with-ai");
    expect(done?.state).toBe("done");
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
