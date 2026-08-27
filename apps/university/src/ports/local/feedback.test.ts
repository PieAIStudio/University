import { describe, expect, it, vi } from "vitest";
import type { FeedbackSubmission } from "@pieai/university-core";

import { createClipboardFeedbackPort } from "./feedback";

const INPUT: FeedbackSubmission = {
  message: "作者看这里",
  context: {
    locator: {
      studyId: "study",
      courseId: "course",
      unitId: "unit",
      lessonId: "lesson",
    },
    contentRevision: 7,
    exerciseAttemptCount: 2,
    signedIn: false,
    route: "#/lesson/study/course/unit/lesson",
    viewport: [375, 812],
  },
};

describe("clipboard feedback port", () => {
  it("keeps the authoring hand-off and carries the shared context", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    const port = createClipboardFeedbackPort({
      shell: "本地端",
      now: () => new Date("2026-08-27T06:00:00.000Z"),
      writeText,
    });

    await expect(port.submit(INPUT)).resolves.toEqual({
      id: null,
      submittedAt: "2026-08-27T06:00:00.000Z",
      transport: "clipboard",
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0]?.[0]).toContain("作者看这里");
    expect(writeText.mock.calls[0]?.[0]).toContain("study/course/unit/lesson");
    expect(writeText.mock.calls[0]?.[0]).toContain("内容版本：7");
    expect(writeText.mock.calls[0]?.[0]).toContain("练习尝试次数：2");
  });
});
