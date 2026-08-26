import { describe, expect, it } from "vitest";

import { createOnlineSourceAccessPort } from "./source-access";

describe("createOnlineSourceAccessPort", () => {
  it("returns explanations for every repository capability", async () => {
    const port = createOnlineSourceAccessPort();
    const accesses = [
      port.lessonVersion({ studyId: "study", sourceCommit: "commit" }),
      port.closeLessonVersion({ studyId: "study", sourceCommit: "commit" }),
      port.uaDashboard({ studyId: "study" }),
      await port.layerCoverage({ studyId: "study" }),
    ];

    for (const access of accesses) {
      expect(access.kind).toBe("explanation");
      if (access.kind !== "explanation") continue;
      expect(access.whatItDoes.length).toBeGreaterThan(0);
      expect(access.whyUnavailable.length).toBeGreaterThan(0);
      expect(access.futureSupport.length).toBeGreaterThan(0);
    }
  });
});
