import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  reviewLine,
  TodaySection,
  todayMeta,
  type TodaySectionData,
} from "@pieai/university-ui/today/TodaySection.js";

describe("todayMeta", () => {
  it("names the project and withholds the count when the course is unstarted", () => {
    expect(todayMeta("TuringPact", { done: 0, total: 41 })).toBe("TuringPact");
  });

  it("names remaining, not the catalogue size, once they have started", () => {
    expect(todayMeta("TuringPact", { done: 3, total: 41 })).toBe("TuringPact · 还剩 38 关");
  });

  it("withholds the count when remaining cannot be read", () => {
    expect(todayMeta("TuringPact", null)).toBe("TuringPact");
  });
});

describe("reviewLine", () => {
  it("hides the row when nothing is due today or tomorrow", () => {
    expect(reviewLine(0, 0)).toBeNull();
  });

  it("reports today's due cards when there are some", () => {
    expect(reviewLine(4, 0)).toBe("复习 · 4 张到期");
  });

  it("reports tomorrow only when that number is real", () => {
    expect(reviewLine(0, 2)).toBe("复习 · 明天 2 张");
  });
});

describe("TodaySection", () => {
  it("does not mention a catalogue-size or zero review pile", () => {
    const data: TodaySectionData = {
      card: null,
      nextLesson: {
        studyId: "turing-pact",
        courseId: "foundations-before-zero",
        unitId: "first-steps",
        lessonId: "before-start",
        studyTitle: "TuringPact",
        courseTitle: "Foundations",
        lessonTitle: "在开始之前",
        contentRevision: 1,
        progress: null,
      },
      dueCount: 0,
      focus: null,
      issues: [],
    };
    const markup = renderToStaticMarkup(
      <TodaySection
        data={data}
        onOpenLesson={() => undefined}
        onReviewed={async () => undefined}
      />,
    );
    expect(markup).toContain("TuringPact");
    expect(markup).not.toContain("41");
    expect(markup).not.toContain("0 张");
  });
});
