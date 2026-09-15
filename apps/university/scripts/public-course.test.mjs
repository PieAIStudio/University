import { describe, expect, it } from "vitest";
import { gradeDeterministically } from "@pieai/university-core";

import { PUBLIC_DTO_FIELDS, publicDisplayLocales, toPublicPackage } from "./public-course.mjs";

describe("the public course DTO", () => {
  it("keeps accessible translated media copy without leaking production paths", () => {
    const result = toPublicPackage({
      course: {
        units: [
          {
            lessons: [
              {
                contentRevision: 1,
                assets: [
                  {
                    id: "photo",
                    kind: "authorized-external",
                    url: "/content/assets/photo.jpg",
                    mime: "image/jpeg",
                    alt: "图",
                    locales: {
                      en: {
                        alt: "Earth above the lunar horizon",
                        caption: "NASA / Apollo 8",
                        path: "PRIVATE_PATH",
                        source: "PRIVATE_SOURCE",
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    expect(result.course.units[0].lessons[0].assets[0].locales.en).toEqual({
      alt: "Earth above the lunar horizon",
      caption: "NASA / Apollo 8",
    });
    expect(JSON.stringify(result)).not.toContain("PRIVATE_");
  });

  it("projects only named catalogue copy, not translated lesson bodies or answers", () => {
    expect(
      publicDisplayLocales(
        {
          en: {
            title: "Lesson",
            content: "PRIVATE_PROSE",
            expectedAnswer: "PRIVATE_ANSWER",
            status: "draft",
          },
        },
        ["title"],
      ),
    ).toEqual({ en: { title: "Lesson" } });
    expect(publicDisplayLocales(undefined, ["title"])).toBeUndefined();
  });

  it("never publishes a translated answer, rubric, private option notes, or an unreviewed locale", () => {
    const published = toPublicPackage({
      course: {
        units: [
          {
            lessons: [
              {
                contentRevision: 1,
                exercises: [
                  {
                    id: "check-source",
                    kind: "short-answer",
                    locales: {
                      en: {
                        title: "Check a source",
                        prompt: "Which date belongs to the photograph?",
                        sourceRevision: 1,
                        expectedAnswer: "1968",
                        rubric: ["PRIVATE_RUBRIC"],
                        options: [{ id: "one", text: "one", explanation: "PRIVATE_EXPLANATION" }],
                        authorNote: "PRIVATE_NOTE",
                      },
                      unsafe: { expectedAnswer: "PRIVATE_UNREVIEWED" },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const serialized = JSON.stringify(published);
    expect(serialized).not.toContain("PRIVATE_");
    expect(serialized).not.toContain("expectedAnswer");
    expect(serialized).not.toContain("rubric");
    const localized = published.course.units[0].lessons[0].exercises[0].locales.en;
    expect(localized.prompt).toBe("Which date belongs to the photograph?");
    expect(localized.answerKey).toBeTruthy();
    // Locale copy shares the lesson revision. An unrelated author field is not public.
    expect(localized.sourceRevision).toBeUndefined();
  });

  it("publishes source provenance but strips nested private production notes", () => {
    const provenance = {
      type: "case-study",
      publisher: "Be My Eyes",
      accessedOn: "2026-09-14",
      supports: "The announcement describes human volunteer help.",
      limitations: "This is not an independent accuracy study.",
    };
    const published = toPublicPackage({
      course: {
        units: [
          {
            lessons: [
              {
                contentRevision: 1,
                evidence: [
                  {
                    kind: "fact",
                    sourceUrl: "https://www.bemyeyes.com/blog/introducing-be-my-ai/",
                    provenance: {
                      ...provenance,
                      authorNote: "PRIVATE_PRODUCTION_NOTE",
                      rawCapture: { credential: "PRIVATE_CAPTURE" },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const evidence = published.course.units[0].lessons[0].evidence[0];
    expect(evidence.provenance).toEqual(provenance);
    expect(JSON.stringify(published)).not.toContain("PRIVATE_");
  });

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
        status: "stale",
        authorStatus: "active",
        isBeingRewritten: true,
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
    expect(Object.keys(published.course)).toEqual(
      PUBLIC_DTO_FIELDS.course.fields.filter((key) => key !== "locales"),
    );
    expect(published.course.locales).toBeUndefined();
    expect(published.course.currency).toBeUndefined();
    expect(published.course.isBeingRewritten).toBe(true);
    expect(published.course.units[0].authorNote).toBeUndefined();

    const lesson = published.course.units[0].lessons[0];
    expect(lesson.assets[0].capture).toBeUndefined();
    expect(JSON.stringify(published)).not.toContain("file-manager:");
    expect(JSON.stringify(published)).not.toContain("captureRecipe");
    expect(JSON.stringify(published)).not.toContain("expectedAnswer");
    expect(JSON.stringify(published)).not.toContain("rubric");
    expect(JSON.stringify(published)).not.toContain("snapshotId");
    expect(JSON.stringify(published)).not.toContain("nodeIds");
    expect(JSON.stringify(published)).not.toContain('"stale"');
    expect(JSON.stringify(published)).not.toContain('"active"');
    // When source text is present, the boundary compiles it rather than trusting
    // the deliberately stale fingerprint in this fixture.
    expect(gradeDeterministically("答案原文", lesson.exercises[0].answerKey).outcome).toBe("pass");
    expect(gradeDeterministically("错误", lesson.exercises[0].answerKey).outcome).not.toBe("pass");
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
                contentRevision: 3,
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

  /*
    Nine landed activities reached no delivery learner, because this list did
    not name them — while the prose that references them crossed intact, so the
    reader rendered "找不到这个互动课件" in the middle of nine paid lessons. The
    field was not withheld on purpose; it was added to the lesson after this
    list was written, and an allowlist's whole point is that it does not notice.
  */
  it("publishes the activities the prose points at, payload and all", () => {
    const published = toPublicPackage({
      course: {
        units: [
          {
            lessons: [
              {
                id: "l",
                content: "::play{#vector-boundary-sort}",
                contentRevision: 2,
                cards: [],
                exercises: [],
                activities: [
                  {
                    id: "vector-boundary-sort",
                    kind: "sort",
                    role: "apply",
                    difficulty: "intro",
                    title: "标题",
                    brief: "引子",
                    goal: "目标",
                    takeaway: "收获",
                    hint: "提示",
                    source: {
                      label: "出处",
                      path: "src/worker.js",
                      line: 8,
                      commit: "a".repeat(40),
                    },
                    buckets: [{ id: "vector", label: "向量" }],
                    items: [{ id: "one", label: "一句话", bucketId: "vector" }],
                    question: "放进哪一格？",
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    const activity = published.course.units[0].lessons[0].activities[0];
    expect(activity.id).toBe("vector-boundary-sort");
    expect(activity.source).toEqual({
      label: "出处",
      path: "src/worker.js",
      line: 8,
      commit: "a".repeat(40),
    });
    // The engine cannot play a board it was handed without buckets or items.
    expect(activity.buckets).toHaveLength(1);
    expect(activity.items).toHaveLength(1);
    expect(activity.question).toBe("放进哪一格？");
  });

  it("strips authoring state from an activity", () => {
    const published = toPublicPackage({
      course: {
        units: [
          {
            lessons: [
              {
                id: "l",
                content: "::play{#a}",
                contentRevision: 1,
                cards: [],
                exercises: [],
                activities: [
                  {
                    id: "a",
                    kind: "connect",
                    role: "observe",
                    title: "t",
                    brief: "b",
                    goal: "g",
                    takeaway: "k",
                    hint: "h",
                    source: { label: "l", url: "https://example.com/a" },
                    nodes: [],
                    edges: [],
                    probes: [],
                    contentHash: "sha256:private",
                    status: "draft",
                    lessonId: "l",
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    const activity = published.course.units[0].lessons[0].activities[0];
    expect(activity).not.toHaveProperty("contentHash");
    expect(activity).not.toHaveProperty("status");
    expect(activity).not.toHaveProperty("lessonId");
    expect(activity.nodes).toEqual([]);
  });

  /*
    An empty array and a missing key read the same to `::play`, but not to a
    reviewer diffing two published packages — and a lesson with no activity is
    the normal case, not a lesson whose activities went missing.
  */
  it("omits the key entirely when a lesson has no activity", () => {
    const published = toPublicPackage({
      course: {
        units: [
          { lessons: [{ id: "l", content: "正文", contentRevision: 1, cards: [], exercises: [] }] },
        ],
      },
    });

    expect(published.course.units[0].lessons[0]).not.toHaveProperty("activities");
  });

  it("rejects a lesson without a source content revision", () => {
    expect(() =>
      toPublicPackage({
        course: {
          units: [
            {
              lessons: [{ id: "missing-revision", content: "正文", cards: [], exercises: [] }],
            },
          ],
        },
      }),
    ).toThrow(/contentRevision/);
  });
});
