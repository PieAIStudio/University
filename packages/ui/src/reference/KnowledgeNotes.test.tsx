import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { KnowledgeNotes } from "./KnowledgeNotes.js";
import type { KnowledgeNoteView } from "../view/lesson-view.js";

/*
  These assertions came with the component from the authoring workbench, where
  they were the only thing standing between a note and being mistaken for a
  published lesson. The move to the library does not soften that: a note is
  what a learner kept after arguing with an AI host, and the page has to keep
  saying so.
*/
const common = {
  question: "这个模块为什么这样设计？",
  summary: "一次 Grok 追问后形成的解释。",
  claimType: "personal-understanding" as const,
  contentRevision: 1,
  cardCount: 1,
  evidence: [],
  content: "# 我的理解\n\n这是展开后阅读的正文。",
};

const notes: readonly KnowledgeNoteView[] = [
  { ...common, id: "active-note", title: "已核验知识", status: "active" },
  { ...common, id: "draft-note", title: "待补证据", status: "draft" },
  { ...common, id: "stale-note", title: "来源已变化", status: "stale" },
];

describe("classroom knowledge notes", () => {
  it("keeps AI-host notes separate from formal courses and explains lifecycle gates", () => {
    const markup = renderToStaticMarkup(
      <KnowledgeNotes
        notes={notes}
        basePathOf={(note) => `/api/studies/supaluv/notes/${note.id}`}
        panelIdPrefix="supaluv"
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

  it("says so when the collection is empty, rather than rendering nothing", () => {
    const markup = renderToStaticMarkup(
      <KnowledgeNotes notes={[]} basePathOf={() => "/nowhere"} panelIdPrefix="empty" />,
    );

    // The delivery build has no notes until the export pipeline ships them, and
    // a tab that renders blank reads as broken rather than as empty.
    expect(markup).toContain("还没有课堂笔记");
    expect(markup).toContain("我的追问 / 课堂笔记");
  });

  it("asks the caller where a note's evidence lives instead of assuming a server", () => {
    const asked: string[] = [];
    renderToStaticMarkup(
      <KnowledgeNotes
        notes={[
          {
            ...common,
            id: "cited-note",
            title: "有证据的笔记",
            status: "active",
            evidence: [
              {
                kind: "repository",
                sourcePath: "src/app.ts",
                lineStart: 1,
                lineEnd: 2,
                sourceCommit: "abc1234567890",
                nodeIds: [],
                note: null,
                ua: null,
              },
            ],
          },
        ]}
        basePathOf={(note) => {
          asked.push(note.id);
          return `/somewhere/${note.id}`;
        }}
        panelIdPrefix="cited"
      />,
    );

    // The old component wrote `/api/studies/…` into itself, which is the
    // authoring server's address and no other build's.
    expect(asked).toEqual(["cited-note"]);
  });
});
