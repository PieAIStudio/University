import { describe, expect, it } from "vitest";

import { legacyAddressOf } from "./legacy-address.js";

describe("the address this campus used to carry", () => {
  it("reads a full lesson path as the lesson it named", () => {
    expect(
      legacyAddressOf(
        "/studies/turing-pact/foundations-before-zero/what-is-an-app/empty-box-called-root",
      ),
    ).toEqual({
      studyId: "turing-pact",
      view: {
        kind: "lesson",
        studyId: "turing-pact",
        courseId: "foundations-before-zero",
        unitId: "what-is-an-app",
        lessonId: "empty-box-called-root",
      },
    });
  });

  it("leaves the root and /today alone, because the hash beside them may be real", () => {
    expect(legacyAddressOf("/")).toBeNull();
    expect(legacyAddressOf("")).toBeNull();
    expect(legacyAddressOf("/today")).toBeNull();
  });

  it("sends an unknown top-level path nowhere rather than home", () => {
    expect(legacyAddressOf("/wat")).toBeNull();
  });

  it("tolerates trailing and doubled slashes", () => {
    expect(legacyAddressOf("/studies/turing-pact/")).toEqual(
      legacyAddressOf("//studies//turing-pact"),
    );
  });

  it("keeps the series when the lesson path is incomplete", () => {
    // Half a lesson address is a typo or a truncated paste. Landing on the
    // series is recoverable; a blank screen is not.
    expect(legacyAddressOf("/studies/turing-pact/course/unit")).toEqual({
      studyId: "turing-pact",
      view: null,
    });
  });

  it("refuses ids that could not have been produced by formatting one", () => {
    // Ids are directory names. A segment with `..` or a separator is either a
    // typo or a probe, and neither should reach a path join downstream.
    expect(legacyAddressOf("/studies/..%2Fetc/c/u/l")?.studyId).toBeNull();
    expect(legacyAddressOf("/studies/ok/..%2F..%2Fetc/u/l")?.view).toBeNull();
    expect(legacyAddressOf("/studies/-leading-dash")?.studyId).toBeNull();
  });

  it("survives a malformed percent-escape instead of throwing", () => {
    expect(() => legacyAddressOf("/studies/%E0%A4%A")).not.toThrow();
  });
});
