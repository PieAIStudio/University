import { describe, expect, it } from "vitest";

import {
  activeIdForView,
  fromHash,
  fromPath,
  isBareView,
  isSafeId,
  libraryTabOf,
  studyIdOfView,
  toHash,
  toPath,
  WORLD,
  type View,
} from "./view.js";

const views: View[] = [
  WORLD,
  { kind: "review" },
  { kind: "mistakes" },
  { kind: "course", studyId: "turing-pact", courseId: "foundations-before-zero" },
  {
    kind: "lesson",
    studyId: "turing-pact",
    courseId: "foundations-before-zero",
    unitId: "what-is-an-app",
    lessonId: "you-already-know-apps",
  },
  {
    kind: "settled",
    studyId: "turing-pact",
    courseId: "foundations-before-zero",
    unitId: "what-is-an-app",
    lessonId: "you-already-know-apps",
  },
  { kind: "catalog" },
  { kind: "avatar-lab" },
  { kind: "studio" },
  { kind: "studio", section: "map" },
];

describe("the address bar", () => {
  it("round-trips every view", () => {
    for (const view of views) expect(fromPath(toPath(view))).toEqual(view);
  });

  it("falls back to the world rather than throwing", () => {
    // A URL is user input: trimmed by a person, mangled by a chat client,
    // outliving the course it pointed at. None of those may break the app.
    for (const junk of ["", "/", "/onlyastudy", "/%", "//", "not-a-path"]) {
      expect(fromPath(junk).kind).toBe("world");
    }
  });

  it("survives a malformed percent-escape instead of throwing", () => {
    expect(() => fromPath("/%E0%A4%A/course")).not.toThrow();
  });

  it("survives an id that is not a slug", () => {
    const view: View = { kind: "course", studyId: "a/b", courseId: "c d?e" };
    expect(toPath(view)).not.toContain("a/b");
    expect(fromPath(toPath(view))).toEqual(view);
  });

  it("falls back to the island when the lesson address is half-written", () => {
    // Half a lesson address is a typo or a truncated paste. Landing on the
    // course is recoverable; a blank screen is not.
    expect(fromPath("/turing-pact/foundations-before-zero/what-is-an-app")).toEqual({
      kind: "course",
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
    });
  });

  it("keeps a settled lesson distinct from the lesson itself", () => {
    const lesson = views[4]!;
    const settled = views[5]!;
    expect(toPath(lesson)).not.toBe(toPath(settled));
    expect(fromPath(toPath(settled)).kind).toBe("settled");
  });

  it("keeps the public flavour paths as the anti-pattern collection", () => {
    expect(toPath({ kind: "anti-pattern" })).toBe("/flavour");
    expect(fromPath("/flavour")).toEqual({ kind: "anti-pattern" });
    expect(toPath({ kind: "anti-pattern-entry", id: "steady-catch" })).toBe(
      "/flavour/steady-catch",
    );
    expect(fromPath("/flavour/steady-catch")).toEqual({
      kind: "anti-pattern-entry",
      id: "steady-catch",
    });
    expect(toPath({ kind: "library", tab: "flavour" })).toBe("/library/flavour");
    expect(fromPath("/library/flavour")).toEqual({ kind: "library", tab: "flavour" });
  });

  it("keeps the 2D directory on its own path instead of falling back to the world", () => {
    expect(toPath({ kind: "catalog" })).toBe("/catalog");
    expect(fromPath("/catalog")).toEqual({ kind: "catalog" });
  });

  it("keeps the mistake book on its own path", () => {
    expect(toPath({ kind: "mistakes" })).toBe("/mistakes");
    expect(fromPath("/mistakes")).toEqual({ kind: "mistakes" });
  });

  it("keeps the temporary avatar lab on its own path instead of treating it as a study", () => {
    expect(toPath({ kind: "avatar-lab" })).toBe("/avatar-lab");
    expect(fromPath("/avatar-lab")).toEqual({ kind: "avatar-lab" });
  });

  it("keeps the shell destinations as reserved first segments", () => {
    expect(fromPath("/league")).toEqual({ kind: "league" });
    expect(fromPath("/quests")).toEqual({ kind: "quests" });
    expect(fromPath("/plans")).toEqual({ kind: "plans" });
    expect(fromPath("/settings")).toEqual({ kind: "settings" });
    expect(fromPath("/me")).toEqual({ kind: "me" });
    expect(toPath({ kind: "league" })).toBe("/league");
    expect(toPath({ kind: "me" })).toBe("/me");
  });

  it("reserves the workbench segment instead of reading it as a study", () => {
    // `/studio` was the authoring campus's own route before the two campuses
    // shared a parser. Reading it as `{ study: "studio" }` would send the
    // 更多 entry to a course nobody has.
    expect(fromPath("/studio")).toEqual({ kind: "studio" });
    expect(toPath({ kind: "studio" })).toBe("/studio");
    expect(fromPath("/studio/map")).toEqual({ kind: "studio", section: "map" });
    expect(toPath({ kind: "studio", section: "map" })).toBe("/studio/map");
  });

  it("migrates legacy hashes through the canonical path parser", () => {
    const lesson: View = {
      kind: "lesson",
      studyId: "turing-pact",
      courseId: "foundations-before-zero",
      unitId: "what-is-an-app",
      lessonId: "you-already-know-apps",
    };
    expect(toHash(lesson)).toBe(
      "#/turing-pact/foundations-before-zero/what-is-an-app/you-already-know-apps",
    );
    expect(fromHash(toHash(lesson))).toEqual(lesson);
    expect(fromHash("#/terms")).toEqual({ kind: "terms" });
  });

  it("maps legacy library hashes onto the tab the index already has", () => {
    expect(libraryTabOf({ kind: "concepts" })).toBe("concepts");
    expect(libraryTabOf({ kind: "terms" })).toBe("terms");
    expect(libraryTabOf({ kind: "anti-pattern" })).toBe("flavour");
    expect(libraryTabOf({ kind: "favourites" })).toBe("favourites");
    expect(libraryTabOf({ kind: "library", tab: "flavour" })).toBe("flavour");
  });

  it("names the series only where a view actually carries one", () => {
    expect(studyIdOfView(views[3]!)).toBe("turing-pact");
    expect(studyIdOfView(views[4]!)).toBe("turing-pact");
    expect(studyIdOfView(WORLD)).toBeNull();
    expect(studyIdOfView({ kind: "studio" })).toBeNull();
  });
});

describe("which slot lights up", () => {
  it("keeps a lesson bare and everything else inside the shell", () => {
    expect(isBareView(views[4]!)).toBe(true);
    for (const view of views.filter((candidate) => candidate.kind !== "lesson")) {
      expect(isBareView(view)).toBe(false);
    }
  });

  it("lights the slot the destination belongs to", () => {
    expect(activeIdForView(WORLD)).toBe("learn");
    // Standing on the planet is choosing what to learn, not leaving learning.
    expect(activeIdForView({ kind: "planet" })).toBe("learn");
    expect(activeIdForView({ kind: "me" })).toBe("profile");
    expect(activeIdForView({ kind: "favourites" })).toBe("favourites");
    expect(activeIdForView({ kind: "mistakes" })).toBe("review");
    expect(activeIdForView({ kind: "library", tab: "terms" })).toBe("library");
    expect(activeIdForView({ kind: "concept", id: "state" })).toBe("library");
    expect(activeIdForView({ kind: "studio" })).toBe("studio");
  });

  it("gives every view a slot", () => {
    for (const view of views) expect(activeIdForView(view)).not.toBe("");
  });
});

describe("ids that may be joined into a path", () => {
  it("refuses segments that could not have been produced by formatting one", () => {
    // Ids are directory names. A segment with `..` or a separator is either a
    // typo or a probe, and neither should reach a path join downstream.
    expect(isSafeId("../etc")).toBe(false);
    expect(isSafeId("a/b")).toBe(false);
    expect(isSafeId("-leading-dash")).toBe(false);
    expect(isSafeId("")).toBe(false);
    expect(isSafeId("ok..still")).toBe(false);
  });

  it("accepts the slugs every published course actually uses", () => {
    for (const id of [
      "turing-pact",
      "foundations-before-zero",
      "what-is-an-app",
      "you-already-know-apps",
      "university-local",
      "v1.2_draft",
    ]) {
      expect(isSafeId(id)).toBe(true);
    }
  });
});
