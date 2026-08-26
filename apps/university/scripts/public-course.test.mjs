import { describe, expect, it } from "vitest";

import { PUBLIC_DTO_FIELDS, toPublicPackage } from "./public-course.mjs";

describe("the public course DTO", () => {
  it("documents a reason for every explicit public field list", () => {
    for (const spec of Object.values(PUBLIC_DTO_FIELDS)) {
      expect(spec.fields.length).toBeGreaterThan(0);
      expect(spec.why.length).toBeGreaterThan(0);
    }
  });

  it("publishes only learner content and strips recovery metadata", () => {
    const published = toPublicPackage({
      schemaVersion: 1,
      packageKind: "university-local-course-recovery",
      evidenceMode: "source-only",
      droppedUaBindingCount: 4,
      course: {
        id: "public-course",
        title: "公开课",
        description: "给学习者看的说明",
        audience: "初学者",
        objectives: ["读懂边界"],
        currency: "follow-ref",
        prerequisiteCourseIds: [],
        trackId: null,
        units: [
          {
            id: "public-unit",
            title: "单元",
            objective: "理解边界",
            prerequisiteUnitIds: [],
            authorNote: "不能发布",
            lessons: [
              {
                id: "public-lesson",
                title: "课时",
                content: "正文",
                contentRevision: 1,
                sections: [],
                variant: "现象",
                evidence: [
                  {
                    kind: "fact",
                    snapshotId: "author-snapshot",
                    sourceCommit: "a".repeat(40),
                    sourcePath: "src/example.ts",
                    lineStart: 1,
                    lineEnd: 2,
                    nodeIds: ["internal-node"],
                    note: "给学习者看的出处",
                  },
                ],
                assets: [
                  {
                    id: "public-asset",
                    kind: "real-screenshot",
                    mime: "image/png",
                    url: "/content/assets/public.png",
                    alt: "公开截图",
                    path: "assets/public.png",
                    sha256: "sha256:internal",
                    bytes: 12,
                    capture: {
                      sourceCommit: "a".repeat(40),
                      route: "file-manager:<source-root>",
                      state: "作者窗口",
                      viewport: { width: 100, height: 100 },
                      locale: "en-US",
                      captureRecipe: "作者步骤",
                    },
                    source: { license: "保留给学习者" },
                  },
                ],
                cards: [
                  {
                    id: "public-card",
                    kind: "basic",
                    front: "正面",
                    back: "背面",
                    tags: ["tag"],
                    evidence: [],
                  },
                ],
                exercises: [
                  {
                    id: "public-exercise",
                    kind: "short-answer",
                    title: "练习",
                    prompt: "题目",
                    expectedAnswer: "答案原文",
                    rubric: ["作者评分标准"],
                    answerKey: { len: 2 },
                    evidence: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    expect(Object.keys(published)).toEqual(["course"]);
    expect(Object.keys(published.course)).toEqual(PUBLIC_DTO_FIELDS.course.fields);
    expect(published.course.currency).toBeUndefined();
    expect(published.course.units[0].authorNote).toBeUndefined();

    const lesson = published.course.units[0].lessons[0];
    expect(lesson.assets[0].capture).toBeUndefined();
    expect(JSON.stringify(published)).not.toContain("file-manager:");
    expect(JSON.stringify(published)).not.toContain("captureRecipe");
    expect(JSON.stringify(published)).not.toContain("expectedAnswer");
    expect(JSON.stringify(published)).not.toContain("rubric");
    expect(JSON.stringify(published)).not.toContain("snapshotId");
    expect(JSON.stringify(published)).not.toContain("nodeIds");
    expect(lesson.exercises[0].answerKey).toEqual({ len: 2 });
    expect(lesson.evidence[0]).toEqual({
      kind: "fact",
      sourceCommit: "a".repeat(40),
      sourcePath: "src/example.ts",
      lineStart: 1,
      lineEnd: 2,
      note: "给学习者看的出处",
    });
  });

  it("keeps a meaningful app route while filtering only author file-manager routes", () => {
    const published = toPublicPackage({
      course: {
        id: "public-course",
        title: "公开课",
        description: "",
        audience: "初学者",
        objectives: ["理解"],
        prerequisiteCourseIds: [],
        trackId: null,
        units: [
          {
            id: "public-unit",
            title: "单元",
            objective: "理解",
            prerequisiteUnitIds: [],
            lessons: [
              {
                id: "public-lesson",
                title: "课时",
                content: "正文",
                evidence: [],
                assets: [
                  {
                    id: "public-asset",
                    kind: "real-screenshot",
                    mime: "image/png",
                    url: "/content/assets/public.png",
                    alt: "公开截图",
                    capture: {
                      sourceCommit: "a".repeat(40),
                      route: "app:/settings",
                      state: "设置页",
                      viewport: { width: 100, height: 100 },
                      locale: "zh-CN",
                    },
                  },
                ],
                cards: [],
                exercises: [],
              },
            ],
          },
        ],
      },
    });

    expect(published.course.units[0].lessons[0].assets[0].capture).toEqual({
      route: "app:/settings",
      state: "设置页",
      viewport: { width: 100, height: 100 },
      locale: "zh-CN",
    });
  });
});
