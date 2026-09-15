import { describe, expect, it } from "vitest";
import { localizeLearnerContent } from "./localization.js";

describe("one identity, multiple content languages", () => {
  const course = {
    id: "same-course",
    title: "中文标题",
    locales: { en: { title: "English title", id: "do-not-copy" } },
    units: [
      {
        id: "unit",
        title: "单元",
        locales: { en: { title: "Unit" } },
        lessons: [
          {
            id: "lesson",
            contentRevision: 3,
            content: "正文",
            sections: [{ start: 0, end: 2 }],
            language: { ranges: [1] },
            locales: { en: { content: "English prose" } },
            cards: [
              {
                id: "card",
                front: "问",
                back: "答",
                locales: { en: { front: "Question", back: "Answer" } },
              },
            ],
            exercises: [
              {
                id: "exercise",
                prompt: "问题",
                locales: { en: { prompt: "New question", expectedAnswer: "PRIVATE" } },
              },
            ],
            evidence: [
              {
                sourceUrl: "https://www.nasa.gov/",
                provenance: {
                  supports: "事实",
                  limitations: "局限",
                  locales: { en: { supports: "Fact", limitations: "Limit" } },
                },
              },
            ],
          },
        ],
      },
    ],
  };
  it("localizes the whole visible tree without changing progress identity", () => {
    const localized = localizeLearnerContent(course, "en");
    expect(localized).toMatchObject({ id: "same-course", title: "English title" });
    const lesson = localized.units[0]!.lessons[0]!;
    expect(lesson).toMatchObject({
      id: "lesson",
      contentRevision: 3,
      content: "English prose",
      sections: [],
    });
    expect(lesson.cards[0]).toMatchObject({ id: "card", front: "Question", back: "Answer" });
    expect(lesson.exercises[0]).toMatchObject({ id: "exercise", prompt: "New question" });
    expect(lesson.exercises[0]).not.toHaveProperty("expectedAnswer");
    expect(lesson.evidence[0]!.provenance.supports).toBe("Fact");
    expect(lesson.language).toBeUndefined();
    expect(course.units[0]!.lessons[0]!.content).toBe("正文");
  });
  it("does not translate saved learner answers or source URLs", () => {
    const input = {
      ...course,
      latestSubmission: { answer: "我的回答", locales: { en: { answer: "not-mine" } } },
    };
    expect(localizeLearnerContent(input, "en").latestSubmission.answer).toBe("我的回答");
  });
});
