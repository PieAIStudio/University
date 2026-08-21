import { describe, expect, it } from "vitest";

import { fromHash, toHash, WORLD, type View } from "./url-state";

const views: View[] = [
  WORLD,
  { kind: "review" },
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
];

describe("the address bar", () => {
  it("round-trips every view", () => {
    for (const view of views) expect(fromHash(toHash(view))).toEqual(view);
  });

  it("falls back to the world rather than throwing", () => {
    // A URL is user input: trimmed by a person, mangled by a chat client,
    // outliving the course it pointed at. None of those may break the app.
    for (const junk of ["", "#", "#/", "#/onlyastudy", "#/%", "#//", "not-a-hash"]) {
      expect(fromHash(junk).kind).toBe("world");
    }
  });

  it("survives an id that is not a slug", () => {
    const view: View = { kind: "course", studyId: "a/b", courseId: "c d?e" };
    expect(toHash(view)).not.toContain("a/b");
    expect(fromHash(toHash(view))).toEqual(view);
  });

  it("keeps a settled lesson distinct from the lesson itself", () => {
    const lesson = views[3]!;
    const settled = views[4]!;
    expect(toHash(lesson)).not.toBe(toHash(settled));
    expect(fromHash(toHash(settled)).kind).toBe("settled");
  });

  it("keeps the public flavour hashes as the anti-pattern collection", () => {
    expect(toHash({ kind: "anti-pattern" })).toBe("#/flavour");
    expect(fromHash("#/flavour")).toEqual({ kind: "anti-pattern" });
    expect(toHash({ kind: "anti-pattern-entry", id: "steady-catch" })).toBe(
      "#/flavour/steady-catch",
    );
    expect(fromHash("#/flavour/steady-catch")).toEqual({
      kind: "anti-pattern-entry",
      id: "steady-catch",
    });
    expect(toHash({ kind: "library", tab: "flavour" })).toBe("#/library/flavour");
    expect(fromHash("#/library/flavour")).toEqual({ kind: "library", tab: "flavour" });
  });

  it("keeps the 2D directory on its own hash instead of falling back to the world", () => {
    expect(toHash({ kind: "catalog" })).toBe("#/catalog");
    expect(fromHash("#/catalog")).toEqual({ kind: "catalog" });
  });
});
