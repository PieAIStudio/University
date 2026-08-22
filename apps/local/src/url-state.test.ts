import { describe, expect, it } from "vitest";

import {
  formatAddress,
  parseAddress,
  parseShellHash,
  sameAddress,
  type AppAddress,
} from "./url-state.js";

const LESSON: AppAddress = {
  section: "studies",
  studyId: "turing-pact",
  lesson: {
    studyId: "turing-pact",
    courseId: "foundations-before-zero",
    unitId: "what-is-an-app",
    lessonId: "empty-box-called-root",
  },
};

describe("addresses", () => {
  it("round-trips every view the campus has", () => {
    const addresses: AppAddress[] = [
      { section: "today", studyId: null, lesson: null },
      { section: "studies", studyId: null, lesson: null },
      { section: "studies", studyId: "turing-pact", lesson: null },
      LESSON,
    ];

    for (const address of addresses) {
      expect(parseAddress(formatAddress(address))).toEqual(address);
    }
  });

  it("gives a lesson an address someone could paste", () => {
    expect(formatAddress(LESSON)).toBe(
      "/studies/turing-pact/foundations-before-zero/what-is-an-app/empty-box-called-root",
    );
  });

  it("treats the root and /today as the same place", () => {
    expect(parseAddress("/")).toEqual(parseAddress("/today"));
    expect(parseAddress("")).toEqual(parseAddress("/today"));
  });

  it("tolerates trailing and doubled slashes", () => {
    expect(parseAddress("/studies/turing-pact/")).toEqual(parseAddress("//studies//turing-pact"));
  });

  it("falls back to the study when the lesson path is incomplete", () => {
    // Half a lesson address is a typo or a truncated paste. Landing on the
    // study is recoverable; a blank screen is not.
    expect(parseAddress("/studies/turing-pact/course/unit")).toEqual({
      section: "studies",
      studyId: "turing-pact",
      lesson: null,
    });
  });

  it("refuses ids that could not have been produced by formatting one", () => {
    // Ids are directory names. A segment with `..` or a separator is either a
    // typo or a probe, and neither should reach a path join downstream.
    expect(parseAddress("/studies/..%2Fetc/c/u/l").studyId).toBeNull();
    expect(parseAddress("/studies/ok/..%2F..%2Fetc/u/l").lesson).toBeNull();
    expect(parseAddress("/studies/-leading-dash").studyId).toBeNull();
  });

  it("survives a malformed percent-escape instead of throwing", () => {
    expect(() => parseAddress("/studies/%E0%A4%A")).not.toThrow();
  });

  it("sends an unknown top-level path home rather than nowhere", () => {
    expect(parseAddress("/wat").section).toBe("today");
  });

  it("reads shell slots from the hash without changing pathname addresses", () => {
    expect(parseShellHash("")).toBe("learn");
    expect(parseShellHash("#/")).toBe("learn");
    expect(parseShellHash("#/library")).toBe("library");
    expect(parseShellHash("#/studio")).toBe("studio");
    expect(parseShellHash("#/me")).toBe("profile");
    expect(parseShellHash("#/plans")).toBe("plan");
  });

  it("compares addresses by the URL they produce", () => {
    expect(sameAddress(LESSON, { ...LESSON })).toBe(true);
    expect(sameAddress(LESSON, { section: "studies", studyId: "turing-pact", lesson: null })).toBe(
      false,
    );
  });
});
