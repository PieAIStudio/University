import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  EvidenceCode,
  KnowledgeNotesSection,
  StudyEvidenceStatus,
  buildCardRevealPayload,
  cardActionPath,
  highlightEvidenceCode,
} from "./App.js";

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
