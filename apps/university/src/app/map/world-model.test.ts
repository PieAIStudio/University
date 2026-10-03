import { describe, expect, it } from "vitest";

import { studyIdForView } from "./world-model";

describe("study context", () => {
  it("lets a course URL override a stale map selection", () => {
    expect(
      studyIdForView(
        { kind: "course", studyId: "turing-pact", courseId: "bilingual-by-design" },
        "buzz",
      ),
    ).toBe("turing-pact");
  });
});
