import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  EvidenceCode,
  KnowledgeNotesSection,
  StudyEvidenceStatus,
  cardActionPath,
  lessonNeighbours,
  recentStudies,
  relativeTimeLabel,
} from "./App.js";
import {
  buildCardCoachingPacket,
  buildCardRevealPayload,
  highlightEvidenceCode,
} from "./view/lesson-view.js";

describe("StudyEvidenceStatus", () => {
  it("shows source and ready-UA counts without presenting UA as a course", () => {
    const markup = renderToStaticMarkup(
      <StudyEvidenceStatus snapshotCount={2} readyUaAnalysisCount={1} />,
    );

    expect(markup).toContain('aria-label="研究证据状态"');
    expect(markup).toContain(">2</strong><span>份源码快照");
    expect(markup).toContain(">1</strong><span>份 UA READY 分析");
    expect(markup).toContain("UA 原生地图/导览是课程证据，不是正式课程。");
  });
});

describe("retrieval and immutable evidence UI", () => {
  it("routes formal-course and classroom-note cards through their own API contracts", () => {
    expect(
      cardActionPath(
        {
          kind: "course-card",
          studyId: "supaluv",
          courseId: "founder-engineer",
          unitId: "architecture",
          lessonId: "auth-owner",
          cardId: "auth-owner-card",
          front: "Who owns auth?",
          contentRevision: 2,
        },
        "review",
      ),
    ).toBe(
      "/api/studies/supaluv/courses/founder-engineer/units/architecture/lessons/auth-owner/cards/auth-owner-card/review",
    );
    expect(
      cardActionPath(
        {
          kind: "knowledge-card",
          studyId: "supaluv",
          noteId: "session-boundary",
          cardId: "session-boundary-card",
          front: "What did I learn?",
          contentRevision: 3,
        },
        "reveal",
      ),
    ).toBe("/api/studies/supaluv/notes/session-boundary/cards/session-boundary-card/reveal");
  });

  it("builds a stable answer-before-reveal command without mixing in an FSRS rating", () => {
    const draft = {
      commandId: "11111111-1111-4111-8111-111111111111",
      startedAt: "2026-07-20T01:02:03.000Z",
    };

    expect(buildCardRevealPayload(draft, 3, "identity-service")).toEqual({
      commandId: draft.commandId,
      contentRevision: 3,
      answer: "identity-service",
      startedAt: draft.startedAt,
      usedHint: false,
    });
    expect(buildCardRevealPayload(draft, 3, "identity-service")).toEqual(
      buildCardRevealPayload(draft, 3, "identity-service"),
    );
    expect(buildCardRevealPayload(draft, 3, "identity-service")).not.toHaveProperty("rating");
  });

  it("renders Shiki tokens as escaped React text and marks only cited lines", async () => {
    const source = [
      "const before = true;",
      '// <img src=x onerror="globalThis.pwned=true">',
      "const after = true;",
    ].join("\n");
    const snippet = {
      sourcePath: "src/auth.ts",
      sourceCommit: "a".repeat(40),
      startLine: 8,
      endLine: 10,
      highlightStartLine: 9,
      highlightEndLine: 9,
      language: "typescript",
      code: source,
    };
    const tokens = await highlightEvidenceCode(source, "typescript");
    const markup = renderToStaticMarkup(<EvidenceCode snippet={snippet} lines={tokens} />);

    expect(markup).toContain("evidence-code__line--highlighted");
    expect(markup.match(/evidence-code__line--highlighted/g)).toHaveLength(1);
    expect(markup).toContain("&lt;img");
    expect(markup).not.toContain("<img");
    expect(markup).not.toContain("dangerouslySetInnerHTML");
    expect(markup).toContain(">9</span>");
  });
});

describe("classroom knowledge notes", () => {
  it("keeps AI-host notes separate from formal courses and explains lifecycle gates", () => {
    const common = {
      question: "这个模块为什么这样设计？",
      summary: "一次 Grok 追问后形成的解释。",
      claimType: "personal-understanding" as const,
      contentRevision: 1,
      cardCount: 1,
      evidence: [],
      content: "# 我的理解\n\n这是展开后阅读的正文。",
    };
    const markup = renderToStaticMarkup(
      <KnowledgeNotesSection
        studyId="supaluv"
        notes={[
          { ...common, id: "active-note", title: "已核验知识", status: "active" },
          { ...common, id: "draft-note", title: "待补证据", status: "draft" },
          { ...common, id: "stale-note", title: "来源已变化", status: "stale" },
        ]}
      />,
    );

    expect(markup).toContain("我的追问 / 课堂笔记");
    expect(markup).toContain("与经过编排的正式课程分开管理");
    expect(markup).toContain("缺证据，未入复习");
    expect(markup).toContain("来源已变化，暂停复习");
    expect(markup).toContain("展开笔记正文与证据");
    expect(markup).toContain("这是展开后阅读的正文");
    expect(markup).toContain('data-status="active"');
    expect(markup).toContain('data-status="draft"');
    expect(markup).toContain('data-status="stale"');
  });
});

describe("recently-studied shelf", () => {
  const study = (id: string, lastActivityAt: string | null) =>
    ({
      id,
      title: id,
      description: "",
      goals: [],
      defaultCourseId: null,
      sourceRegistered: true,
      snapshotCount: 0,
      uaAnalysisCount: 0,
      readyUaAnalysisCount: 0,
      courseCount: 0,
      activeCourseCount: 1,
      defaultCourse: null,
      hasLearningDatabase: true,
      lastActivityAt,
    }) as Parameters<typeof recentStudies>[0][number];

  it("orders by most recent activity, not by title", () => {
    const ordered = recentStudies([
      study("a-supaluv", "2026-08-01T00:00:00.000Z"),
      study("z-turing-pact", "2026-08-07T00:00:00.000Z"),
      study("m-university-local", "2026-08-05T00:00:00.000Z"),
    ]);

    expect(ordered.map((entry) => entry.id)).toEqual([
      "z-turing-pact",
      "m-university-local",
      "a-supaluv",
    ]);
  });

  it("leaves out projects that were never opened, rather than sorting them last", () => {
    const ordered = recentStudies([
      study("touched", "2026-08-07T00:00:00.000Z"),
      study("never", null),
    ]);

    expect(ordered.map((entry) => entry.id)).toEqual(["touched"]);
  });

  it("stops at three so the shortcut does not become the list again", () => {
    const ordered = recentStudies([
      study("one", "2026-08-07T04:00:00.000Z"),
      study("two", "2026-08-07T03:00:00.000Z"),
      study("three", "2026-08-07T02:00:00.000Z"),
      study("four", "2026-08-07T01:00:00.000Z"),
    ]);

    expect(ordered.map((entry) => entry.id)).toEqual(["one", "two", "three"]);
  });

  it("reports elapsed time in the unit a learner thinks in", () => {
    const now = Date.parse("2026-08-07T12:00:00.000Z");

    expect(relativeTimeLabel("2026-08-07T11:59:40.000Z", now)).toBe("刚刚");
    expect(relativeTimeLabel("2026-08-07T09:00:00.000Z", now)).toBe("3小时前");
    expect(relativeTimeLabel("2026-08-05T12:00:00.000Z", now)).toBe("前天");
  });
});

describe("review-card coaching packet", () => {
  const packet = buildCardCoachingPacket({
    front: "App 这个词通常是什么英文词的缩写？",
    back: "application",
    answer: "apply?",
    priorAttempts: [
      { answer: "applications", revealedAt: "2026-08-01T00:00:00.000Z", contentRevision: 1 },
    ],
  });

  it("asks for an explanation and refuses to ask for a grade", () => {
    // FSRS schedules on how hard the recall felt, which only the person
    // recalling can report. A packet that invited a verdict would put someone
    // else's judgement into that slot.
    expect(packet).toContain("不要判分");
    expect(packet).toContain("不要给我打分");
    expect(packet).not.toContain("请判断对错");
  });

  it("carries the question, the reference answer, and both attempts", () => {
    expect(packet).toContain("App 这个词通常是什么英文词的缩写？");
    expect(packet).toContain("application");
    expect(packet).toContain("apply?");
    expect(packet).toContain("applications");
  });

  it("omits the history section for a card answered for the first time", () => {
    const first = buildCardCoachingPacket({
      front: "q",
      back: "a",
      answer: "mine",
      priorAttempts: [],
    });

    expect(first).not.toContain("我以前的回答");
  });
});

describe("lesson navigation", () => {
  const courses = [
    {
      id: "before-zero",
      title: "《在开始之前》",
      description: "",
      audience: "",
      objectives: [],
      status: "active",
      isDefault: true,
      units: [
        {
          id: "what-is-an-app",
          title: "App 是什么",
          objective: "",
          status: "active",
          lessons: [
            {
              id: "a",
              title: "第一节",
              status: "active",
              contentRevision: 1,
              cardCount: 0,
              exerciseCount: 0,
              progress: null,
            },
            {
              id: "b",
              title: "第二节",
              status: "active",
              contentRevision: 1,
              cardCount: 0,
              exerciseCount: 0,
              progress: null,
            },
          ],
        },
        {
          id: "what-is-code",
          title: "代码是什么",
          objective: "",
          status: "active",
          lessons: [
            {
              id: "c",
              title: "第三节",
              status: "active",
              contentRevision: 1,
              cardCount: 0,
              exerciseCount: 0,
              progress: null,
            },
          ],
        },
      ],
    },
    {
      id: "other-course",
      title: "另一门课",
      description: "",
      audience: "",
      objectives: [],
      status: "active",
      isDefault: false,
      units: [
        {
          id: "u",
          title: "单元",
          objective: "",
          status: "active",
          lessons: [
            {
              id: "z",
              title: "别的课的第一节",
              status: "active",
              contentRevision: 1,
              cardCount: 0,
              exerciseCount: 0,
              progress: null,
            },
          ],
        },
      ],
    },
  ];

  const at = (lessonId: string, unitId: string) => ({
    studyId: "turing-pact",
    courseId: "before-zero",
    unitId,
    lessonId,
  });

  it("walks across unit boundaries, because a unit edge is not the end of the course", () => {
    const neighbours = lessonNeighbours(courses, at("b", "what-is-an-app"));
    expect(neighbours?.next?.lessonId).toBe("c");
    expect(neighbours?.next?.unitId).toBe("what-is-code");
    expect(neighbours?.previous?.lessonId).toBe("a");
  });

  it("counts position over the whole course, not the unit", () => {
    const neighbours = lessonNeighbours(courses, at("c", "what-is-code"));
    expect(neighbours?.position).toBe(3);
    expect(neighbours?.total).toBe(3);
  });

  it("stops at the course edges rather than falling into another course", () => {
    expect(lessonNeighbours(courses, at("a", "what-is-an-app"))?.previous).toBeNull();
    const last = lessonNeighbours(courses, at("c", "what-is-code"));
    expect(last?.next).toBeNull();
  });

  it("carries the study id forward so the neighbour is directly openable", () => {
    expect(lessonNeighbours(courses, at("a", "what-is-an-app"))?.next).toMatchObject({
      studyId: "turing-pact",
      courseId: "before-zero",
      unitId: "what-is-an-app",
      lessonId: "b",
      title: "第二节",
    });
  });

  it("returns null for a lesson that is not in the tree yet", () => {
    expect(lessonNeighbours(courses, at("missing", "what-is-an-app"))).toBeNull();
    expect(lessonNeighbours([], at("a", "what-is-an-app"))).toBeNull();
  });
});
