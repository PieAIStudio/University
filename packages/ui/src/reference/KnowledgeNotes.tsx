import { translate } from "../i18n/index.js";
import { GameBadge, GameCallout } from "@pieai/swimmer-ui-kit";

import { EvidenceRail } from "../evidence/EvidenceRail.js";
import { MarkdownContent } from "../markdown/MarkdownContent.js";
import type { KnowledgeNoteView } from "../view/lesson-view.js";

const claimTypeLabels: Readonly<Record<KnowledgeNoteView["claimType"], string>> = {
  "source-fact": translate("ui.reference.knowledgeNotes.copy.源码事实"),
  inference: translate("ui.reference.knowledgeNotes.copy.推论"),
  "personal-understanding": translate("ui.reference.knowledgeNotes.copy.个人理解"),
};

function noteStatusPresentation(status: KnowledgeNoteView["status"]): {
  readonly label: string;
  readonly tone: "success" | "warning" | "neutral";
} {
  if (status === "active")
    return { label: translate("ui.reference.knowledgeNotes.copy.可复习"), tone: "success" };
  if (status === "draft")
    return { label: translate("ui.reference.knowledgeNotes.copy.草稿"), tone: "warning" };
  if (status === "stale")
    return { label: translate("ui.reference.knowledgeNotes.copy.待重新核验"), tone: "warning" };
  return { label: translate("ui.reference.knowledgeNotes.copy.已归档"), tone: "neutral" };
}

function noteReviewAvailability(note: KnowledgeNoteView): string {
  if (note.status === "draft") return translate("ui.reference.knowledgeNotes.copy.缺证据-未入复习");
  if (note.status === "stale")
    return translate("ui.reference.knowledgeNotes.copy.来源已变化-暂停复习");
  if (note.status === "retired")
    return translate("ui.reference.knowledgeNotes.copy.已经归档-不再进入复习");
  return note.cardCount > 0
    ? translate("ui.reference.knowledgeNotes.copy.value0-张卡片可进入复习", {
        value0: note.cardCount,
      })
    : translate("ui.reference.knowledgeNotes.copy.当前没有派生卡片");
}

/**
 * 我的追问 / 课堂笔记 — the library's fifth collection.
 *
 * A note is what a learner kept after arguing with an AI host about a piece of
 * source, so it belongs beside the other things you look up rather than in the
 * workbench where courses are made. It lived in the workbench because that is
 * where the authoring API that serves it lives, and the merge made that
 * accidental home fatal: `src/authoring/` is eliminated from the delivery
 * build, so leaving it there would have compiled the feature out of the half
 * of the product customers use.
 *
 * `basePathOf` is why this can be shared. The evidence rail needs a URL to
 * fetch a citation's source from, and only the build knows what that URL is —
 * the authoring build has a loopback server with the repository on disk, the
 * delivery build will have whatever the export pipeline ends up publishing. It
 * was written into the component as `/api/studies/…`, which is the authoring
 * server's address and nobody else's.
 */
export function KnowledgeNotes({
  notes,
  basePathOf,
  panelIdPrefix,
}: {
  readonly notes: readonly KnowledgeNoteView[];
  /** Where this note's evidence is fetched from, in this build. */
  readonly basePathOf: (note: KnowledgeNoteView) => string;
  /** Disambiguates the evidence panels' ids when a page holds more than one. */
  readonly panelIdPrefix: string;
}) {
  return (
    <section className="knowledge-notes" aria-labelledby="knowledge-notes-title">
      <header className="knowledge-notes__header">
        <div>
          <h2 id="knowledge-notes-title">
            {translate("ui.reference.knowledgeNotes.copy.我的追问-课堂笔记")}
          </h2>
        </div>
        <GameBadge tone="ai">{translate("ui.reference.knowledgeNotes.copy.AI-宿主沉淀")}</GameBadge>
      </header>
      <p className="knowledge-notes__boundary">
        {translate(
          "ui.reference.knowledgeNotes.copy.这里保存你与-Grok-等-AI-宿主追问后沉淀的知识-它与经过编排的正式课程分开管理",
        )}
      </p>
      {notes.length === 0 ? (
        <GameCallout
          heading={translate("ui.reference.knowledgeNotes.copy.还没有课堂笔记")}
          tone="neutral"
        >
          {translate(
            "ui.reference.knowledgeNotes.copy.在-AI-宿主中把一次追问保存为知识点后-它会出现在这里",
          )}
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
                      {claimTypeLabels[note.claimType]}{" "}
                      {translate("ui.reference.knowledgeNotes.copy.第")} {note.contentRevision}{" "}
                      {translate("ui.reference.knowledgeNotes.copy.版")}
                    </p>
                    <h3>{note.title}</h3>
                  </div>
                  <GameBadge tone={status.tone}>{status.label}</GameBadge>
                </header>
                <p className="knowledge-note__question">{note.question}</p>
                <p className="knowledge-note__abstract">{note.summary}</p>
                <div className="knowledge-note__meta">
                  <span>
                    {note.cardCount} {translate("ui.reference.knowledgeNotes.copy.张派生卡片")}
                  </span>
                  <span>
                    {note.evidence.length > 0
                      ? translate("ui.reference.knowledgeNotes.copy.value0-条固定源码证据", {
                          value0: note.evidence.length,
                        })
                      : translate("ui.reference.knowledgeNotes.copy.没有源码证据")}
                  </span>
                  <strong>{noteReviewAvailability(note)}</strong>
                </div>
                <details className="knowledge-note__details">
                  <summary>
                    {translate("ui.reference.knowledgeNotes.copy.展开笔记正文与证据")}
                  </summary>
                  <div className="knowledge-note__body markdown-body">
                    <MarkdownContent>{note.content}</MarkdownContent>
                  </div>
                  {note.evidence.length > 0 ? (
                    <EvidenceRail
                      basePath={basePathOf(note)}
                      evidence={note.evidence}
                      panelIdPrefix={`${panelIdPrefix}-${note.id}`}
                      ariaLabel={translate("ui.reference.knowledgeNotes.copy.value0-的知识证据", {
                        value0: note.title,
                      })}
                      title={translate("ui.reference.knowledgeNotes.copy.这条知识依据什么")}
                    />
                  ) : (
                    <p className="knowledge-note__no-evidence">
                      {note.claimType === "personal-understanding"
                        ? translate(
                            "ui.reference.knowledgeNotes.copy.这是个人理解-可以保留-但不要把它冒充源码事实",
                          )
                        : translate("ui.reference.knowledgeNotes.copy.尚未通过源码证据门禁")}
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
