import { GameBadge, GameCallout } from "@pieai/swimmer-ui-kit";

import { MarkdownContent } from "../markdown/MarkdownContent.js";
import { EvidenceRail } from "../evidence/EvidenceRail.js";
import type { KnowledgeNoteView } from "../view/lesson-view.js";

const claimTypeLabels: Readonly<Record<KnowledgeNoteView["claimType"], string>> = {
  "source-fact": "源码事实",
  inference: "推论",
  "personal-understanding": "个人理解",
};

function noteStatusPresentation(status: KnowledgeNoteView["status"]): {
  readonly label: string;
  readonly tone: "success" | "warning" | "neutral";
} {
  if (status === "active") return { label: "可复习", tone: "success" };
  if (status === "draft") return { label: "草稿", tone: "warning" };
  if (status === "stale") return { label: "待重新核验", tone: "warning" };
  return { label: "已归档", tone: "neutral" };
}

function noteReviewAvailability(note: KnowledgeNoteView): string {
  if (note.status === "draft") return "缺证据，未入复习";
  if (note.status === "stale") return "来源已变化，暂停复习";
  if (note.status === "retired") return "已经归档，不再进入复习";
  return note.cardCount > 0 ? `${note.cardCount} 张卡片可进入复习` : "当前没有派生卡片";
}

export function KnowledgeNotesSection({
  studyId,
  notes,
}: {
  readonly studyId: string;
  readonly notes: readonly KnowledgeNoteView[];
}) {
  return (
    <section className="knowledge-notes" aria-labelledby="knowledge-notes-title">
      <header className="knowledge-notes__header">
        <div>
          <p className="eyebrow">MY QUESTIONS · CLASS NOTES</p>
          <h2 id="knowledge-notes-title">我的追问 / 课堂笔记</h2>
        </div>
        <GameBadge tone="ai">AI 宿主沉淀</GameBadge>
      </header>
      <p className="knowledge-notes__boundary">
        这里保存你与 Grok 等 AI 宿主追问后沉淀的知识；它与经过编排的正式课程分开管理。
      </p>
      {notes.length === 0 ? (
        <GameCallout heading="还没有课堂笔记" tone="neutral">
          在 AI 宿主中把一次追问保存为知识点后，它会出现在这里。
        </GameCallout>
      ) : (
        <div className="knowledge-note-list">
          {notes.map((note) => {
            const status = noteStatusPresentation(note.status);
            return (
              <article className="knowledge-note" data-status={note.status} key={note.id}>
                <header className="knowledge-note__summary">
                  <div>
                    <p className="eyebrow">
                      {claimTypeLabels[note.claimType]} · REV {note.contentRevision}
                    </p>
                    <h3>{note.title}</h3>
                  </div>
                  <GameBadge tone={status.tone}>{status.label}</GameBadge>
                </header>
                <p className="knowledge-note__question">{note.question}</p>
                <p className="knowledge-note__abstract">{note.summary}</p>
                <div className="knowledge-note__meta">
                  <span>{note.cardCount} 张派生卡片</span>
                  <span>
                    {note.evidence.length > 0
                      ? `${note.evidence.length} 条固定源码证据`
                      : "没有源码证据"}
                  </span>
                  <strong>{noteReviewAvailability(note)}</strong>
                </div>
                <details className="knowledge-note__details">
                  <summary>展开笔记正文与证据</summary>
                  <div className="knowledge-note__body markdown-body">
                    <MarkdownContent>{note.content}</MarkdownContent>
                  </div>
                  {note.evidence.length > 0 ? (
                    <EvidenceRail
                      basePath={`/api/studies/${studyId}/notes/${note.id}`}
                      evidence={note.evidence}
                      panelIdPrefix={`${studyId}-${note.id}`}
                      ariaLabel={`${note.title} 的知识证据`}
                      title="这条知识依据什么"
                    />
                  ) : (
                    <p className="knowledge-note__no-evidence">
                      {note.claimType === "personal-understanding"
                        ? "这是个人理解；可以保留，但不要把它冒充源码事实。"
                        : "尚未通过源码证据门禁。"}
                    </p>
                  )}
                </details>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
